// ============================================================
//  SERVICIO DE VENTAS  (el corazon del POS)
// ------------------------------------------------------------
//  Una venta toca 5 tablas y TODO pasa dentro de una sola
//  transaccion: o se guarda todo, o no se guarda nada.
//
//      ventas          -> cabecera (comprobante y totales)
//      venta_detalle   -> productos vendidos
//      pagos           -> como pago el cliente
//      inventario      -> descuento de stock
//      correlativos    -> numero del comprobante
//
//  Reglas de oro:
//   1. Los PRECIOS salen de la base, nunca del frontend.
//   2. El IGV lo calcula el backend, linea por linea, respetando
//      si el producto esta afecto o exonerado.
//   3. No se vende sin caja abierta.
//   4. No se vende sin stock suficiente (lo decide un UPDATE
//      condicional, no una lectura previa).
// ============================================================

const { query, transaccion } = require('../../config/db');
const { ErrorHttp } = require('../../utils/http');

const TIPOS_COMPROBANTE = ['ticket', 'boleta', 'factura'];
const SERIES = { ticket: 'T001', boleta: 'B001', factura: 'F001' };
const METODOS_PAGO = ['efectivo', 'tarjeta', 'billetera'];

// ------------------------------------------------------------
// Dinero en centavos
//  Trabajar con centavos enteros evita los errores de coma
//  flotante (0.1 + 0.2 !== 0.3). Se convierte a soles recien
//  al guardar y al responder.
// ------------------------------------------------------------
function aCentavos(valor) {
  return Math.round(Number(valor) * 100);
}

function aSoles(centavos) {
  return Number((centavos / 100).toFixed(2));
}

function formatoSoles(centavos) {
  return (centavos / 100).toFixed(2);
}

// "B001-00000001" (serie + 8 digitos)
function numeroComprobante(venta) {
  return `${venta.serie}-${String(venta.numero).padStart(8, '0')}`;
}

// ------------------------------------------------------------
// Validaciones de entrada
// ------------------------------------------------------------
function validarItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ErrorHttp(400, 'La venta debe tener al menos un producto.');
  }

  const vistos = new Set();

  return items.map((item, indice) => {
    const productoId = Number(item.producto_id);
    const cantidad = Number(item.cantidad);

    if (!Number.isInteger(productoId) || productoId <= 0) {
      throw new ErrorHttp(400, `El item ${indice + 1} no tiene un producto_id valido.`);
    }

    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      throw new ErrorHttp(400, `La cantidad del item ${indice + 1} debe ser un entero mayor a 0.`);
    }

    if (vistos.has(productoId)) {
      throw new ErrorHttp(400, 'Hay un producto repetido en la venta. Junta las cantidades en un solo item.');
    }
    vistos.add(productoId);

    return { producto_id: productoId, cantidad };
  });
}

function validarPagos(pagos) {
  if (!Array.isArray(pagos) || pagos.length === 0) {
    throw new ErrorHttp(400, 'Debes registrar al menos un pago.');
  }

  return pagos.map((pago, indice) => {
    if (!METODOS_PAGO.includes(pago.metodo)) {
      throw new ErrorHttp(
        400,
        `Metodo de pago invalido en el pago ${indice + 1}. Debe ser: ${METODOS_PAGO.join(', ')}.`
      );
    }

    const montoCent = aCentavos(pago.monto);
    if (!Number.isFinite(montoCent) || montoCent <= 0) {
      throw new ErrorHttp(400, `El monto del pago ${indice + 1} debe ser mayor a 0.`);
    }

    return { metodo: pago.metodo, montoCent };
  });
}

// ------------------------------------------------------------
// Cuadrar los pagos contra el total
//  - Si pagan de menos  -> error con cuanto falta.
//  - Si pagan de mas    -> el excedente es VUELTO y se descuenta
//                          del pago en efectivo (porque el vuelto
//                          sale del cajon).
//  - Se guardan solo los montos APLICADOS a la venta, asi el
//    arqueo de caja cuadra.
// ------------------------------------------------------------
function cuadrarPagos(pagos, totalCent) {
  const sumaCent = pagos.reduce((acumulado, pago) => acumulado + pago.montoCent, 0);

  if (sumaCent < totalCent) {
    throw new ErrorHttp(
      400,
      `El pago es insuficiente. Falta S/ ${formatoSoles(totalCent - sumaCent)}.`
    );
  }

  const vueltoCent = sumaCent - totalCent;
  const pagosFinales = pagos.map((pago) => ({ ...pago }));

  if (vueltoCent > 0) {
    const efectivo = pagosFinales.find((pago) => pago.metodo === 'efectivo');

    if (!efectivo) {
      throw new ErrorHttp(400, 'Solo se puede dar vuelto cuando hay un pago en efectivo.');
    }

    if (efectivo.montoCent < vueltoCent) {
      throw new ErrorHttp(400, 'El vuelto no puede superar el efectivo recibido.');
    }

    efectivo.montoCent -= vueltoCent;
  }

  // Si un pago quedo en 0 (por ejemplo, el efectivo se fue todo en vuelto),
  // no lo guardamos: la tabla pagos exige monto > 0.
  return {
    pagosFinales: pagosFinales.filter((pago) => pago.montoCent > 0),
    vuelto: aSoles(vueltoCent),
  };
}

// ------------------------------------------------------------
// Buscar una venta completa (cabecera + items + pagos)
// "ejecutor" permite usar el pool o un cliente de transaccion.
// ------------------------------------------------------------
async function buscarVenta(id, ejecutor = query) {
  const { rows } = await ejecutor(
    `SELECT v.id, v.tipo_comprobante, v.serie, v.numero, v.cliente_id,
            v.usuario_id, u.nombre AS cajero,
            v.caja_id, v.sucursal_id, s.nombre AS sucursal,
            c.nombre AS cliente, c.numero_documento AS cliente_documento,
            v.subtotal, v.igv, v.total, v.vuelto,
            v.total_devuelto, v.estado,
            v.motivo_anulacion, v.creada_en,
            v.anulada_en, v.anulada_por
       FROM ventas v
       JOIN usuarios u    ON u.id = v.usuario_id
       JOIN sucursales s  ON s.id = v.sucursal_id
       LEFT JOIN clientes c ON c.id = v.cliente_id
      WHERE v.id = $1`,
    [id]
  );

  const venta = rows[0];
  if (!venta) return null;

  const { rows: items } = await ejecutor(
    `SELECT vd.id, vd.producto_id, p.codigo_barras, p.nombre,
            vd.cantidad, vd.precio_unitario, vd.total_linea,
            vd.afecto_igv, vd.cantidad_devuelta
       FROM venta_detalle vd
       JOIN productos p ON p.id = vd.producto_id
      WHERE vd.venta_id = $1
      ORDER BY vd.id`,
    [id]
  );

  const { rows: pagos } = await ejecutor(
    `SELECT id, metodo, monto
       FROM pagos
      WHERE venta_id = $1
      ORDER BY id`,
    [id]
  );

  // Historial de devoluciones: quien devolvio, cuanto y por que.
  const { rows: devoluciones } = await ejecutor(
    `SELECT d.id, d.motivo, d.metodo, d.total, d.creada_en,
            u.nombre AS registrada_por
       FROM devoluciones d
       JOIN usuarios u ON u.id = d.usuario_id
      WHERE d.venta_id = $1
      ORDER BY d.id`,
    [id]
  );

  return {
    ...venta,
    numero_comprobante: numeroComprobante(venta),
    total_neto: totalNetoVenta(venta),
    items,
    pagos,
    devoluciones,
  };
}

// ------------------------------------------------------------
// Utilidades de dinero para devoluciones
//  total_neto = total original - lo ya devuelto
// ------------------------------------------------------------
function restarSoles(total, devuelto) {
  return (Number(total) - Number(devuelto)).toFixed(2);
}

// Importe que realmente queda en la venta:
//  - anulada -> 0 (se devolvio todo, deja de facturar)
//  - emitida -> total - devoluciones parciales
function totalNetoVenta(venta) {
  if (venta.estado === 'anulada') return '0.00';
  return restarSoles(venta.total, venta.total_devuelto);
}

function validarMotivo(motivo) {
  const limpio = String(motivo ?? '').trim();

  if (limpio.length < 3) {
    throw new ErrorHttp(400, 'El motivo debe tener al menos 3 caracteres.');
  }

  if (limpio.length > 300) {
    throw new ErrorHttp(400, 'El motivo no puede superar los 300 caracteres.');
  }

  return limpio;
}

// ------------------------------------------------------------
// ANULAR VENTA (solo administrador, lo exige la ruta)
// ------------------------------------------------------------
async function anular(id, usuario, datos) {
  const motivo = validarMotivo(datos.motivo);

  return transaccion(async (cliente) => {
    // Bloqueamos la venta: si dos personas anulan a la vez, la
    // segunda espera y ya la encuentra anulada.
    const { rows: ventas } = await cliente.query(
      'SELECT * FROM ventas WHERE id = $1 FOR UPDATE',
      [id]
    );

    const venta = ventas[0];
    if (!venta) {
      throw new ErrorHttp(404, 'Venta no encontrada.');
    }

    if (venta.estado === 'anulada') {
      throw new ErrorHttp(409, 'La venta ya esta anulada.');
    }

    // Devolvemos al stock SOLO lo que aun no se habia devuelto.
    // Lo ya devuelto se repuso en su momento; si lo sumaramos otra
    // vez, el inventario quedaria inflado.
    const { rows: items } = await cliente.query(
      `SELECT id, producto_id, cantidad, cantidad_devuelta
         FROM venta_detalle
        WHERE venta_id = $1
        ORDER BY producto_id
        FOR UPDATE`,
      [id]
    );

    for (const item of items) {
      const pendiente = item.cantidad - item.cantidad_devuelta;
      if (pendiente > 0) {
        await cliente.query(
          `UPDATE inventario
              SET stock = stock + $1
            WHERE producto_id = $2
              AND sucursal_id = $3`,
          [pendiente, item.producto_id, venta.sucursal_id]
        );
      }
    }

    await cliente.query(
      `UPDATE ventas
          SET estado = 'anulada',
              motivo_anulacion = $1,
              anulada_por = $2,
              anulada_en = NOW()
        WHERE id = $3`,
      [motivo, usuario.id, id]
    );

    // OJO: no tocamos pagos. Al quedar 'anulada', calcularEfectivo
    // la excluye sola del arqueo. Si tambien descontaramos un
    // reembolso, restariamos dos veces el mismo dinero.
    return await buscarVenta(id, cliente.query.bind(cliente));
  });
}

// ------------------------------------------------------------
// DEVOLVER ITEMS (parcial o total, solo administrador)
//  - Sube el stock de los productos devueltos.
//  - Acumula cantidad_devuelta y total_devuelto.
//  - Registra cabecera + detalle de la devolucion (auditoria).
// ------------------------------------------------------------
async function devolver(id, usuario, datos) {
  const motivo = validarMotivo(datos.motivo);
  const metodo = datos.metodo ?? 'efectivo';

  if (!METODOS_PAGO.includes(metodo)) {
    throw new ErrorHttp(400, `Metodo de reembolso invalido. Debe ser: ${METODOS_PAGO.join(', ')}.`);
  }

  if (!Array.isArray(datos.items) || datos.items.length === 0) {
    throw new ErrorHttp(400, 'Debes indicar al menos un item a devolver.');
  }

  const pedidos = datos.items.map((item, indice) => {
    const detalleId = Number(item.venta_detalle_id);
    const cantidad = Number(item.cantidad);

    if (!Number.isInteger(detalleId) || detalleId <= 0) {
      throw new ErrorHttp(400, `El item ${indice + 1} no tiene un venta_detalle_id valido.`);
    }

    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      throw new ErrorHttp(400, `La cantidad a devolver del item ${indice + 1} debe ser un entero mayor a 0.`);
    }

    return { venta_detalle_id: detalleId, cantidad };
  });

  // No permitimos el mismo item dos veces (evita sumar mal).
  const idsPedidos = new Set();
  for (const pedido of pedidos) {
    if (idsPedidos.has(pedido.venta_detalle_id)) {
      throw new ErrorHttp(400, 'Hay un item repetido en la devolucion. Junta las cantidades.');
    }
    idsPedidos.add(pedido.venta_detalle_id);
  }

  return transaccion(async (cliente) => {
    const { rows: ventas } = await cliente.query(
      'SELECT * FROM ventas WHERE id = $1 FOR UPDATE',
      [id]
    );

    const venta = ventas[0];
    if (!venta) {
      throw new ErrorHttp(404, 'Venta no encontrada.');
    }

    if (venta.estado === 'anulada') {
      throw new ErrorHttp(409, 'No se puede devolver items de una venta anulada.');
    }

    // La devolucion en efectivo sale del cajon. Si la caja de esa
    // venta ya se cerro, el arqueo guardado no se puede corregir,
    // asi que la rechazamos en vez de dejar numeros inconsistentes.
    const { rows: cajas } = await cliente.query(
      'SELECT estado FROM cajas WHERE id = $1',
      [venta.caja_id]
    );

    if (!cajas[0] || cajas[0].estado !== 'abierta') {
      throw new ErrorHttp(
        409,
        'La caja de esta venta ya esta cerrada. No se puede registrar la devolucion.'
      );
    }

    const { rows: lineas } = await cliente.query(
      `SELECT id, producto_id, cantidad, cantidad_devuelta, precio_unitario
         FROM venta_detalle
        WHERE venta_id = $1
        ORDER BY producto_id
        FOR UPDATE`,
      [id]
    );

    const porId = new Map(lineas.map((linea) => [linea.id, linea]));
    const detalleDevolucion = [];
    let totalCent = 0;

    for (const pedido of pedidos) {
      const linea = porId.get(pedido.venta_detalle_id);
      if (!linea) {
        throw new ErrorHttp(404, `El item ${pedido.venta_detalle_id} no pertenece a esta venta.`);
      }

      const disponible = linea.cantidad - linea.cantidad_devuelta;
      if (pedido.cantidad > disponible) {
        throw new ErrorHttp(
          400,
          `No puedes devolver ${pedido.cantidad} unidades: solo quedan ${disponible} por devolver.`
        );
      }

      const montoCent = aCentavos(linea.precio_unitario) * pedido.cantidad;
      totalCent += montoCent;

      detalleDevolucion.push({
        venta_detalle_id: linea.id,
        producto_id: linea.producto_id,
        cantidad: pedido.cantidad,
        monto: formatoSoles(montoCent),
      });
    }

    // --- Cabecera de la devolucion ---
    const { rows: devoluciones } = await cliente.query(
      `INSERT INTO devoluciones (venta_id, usuario_id, motivo, metodo, total)
            VALUES ($1, $2, $3, $4, $5)
         RETURNING id, creada_en`,
      [id, usuario.id, motivo, metodo, aSoles(totalCent)]
    );

    const devolucionId = devoluciones[0].id;

    // --- Detalle + reposicion de stock + acumulados ---
    for (const item of detalleDevolucion) {
      await cliente.query(
        `INSERT INTO devolucion_detalle
           (devolucion_id, venta_detalle_id, cantidad, monto)
         VALUES ($1, $2, $3, $4)`,
        [devolucionId, item.venta_detalle_id, item.cantidad, item.monto]
      );

      await cliente.query(
        `UPDATE venta_detalle
            SET cantidad_devuelta = cantidad_devuelta + $1
          WHERE id = $2`,
        [item.cantidad, item.venta_detalle_id]
      );

      await cliente.query(
        `UPDATE inventario
            SET stock = stock + $1
          WHERE producto_id = $2
            AND sucursal_id = $3`,
        [item.cantidad, item.producto_id, venta.sucursal_id]
      );
    }

    // El CHECK de la tabla impide que total_devuelto supere total.
    await cliente.query(
      `UPDATE ventas
          SET total_devuelto = total_devuelto + $1
        WHERE id = $2`,
      [aSoles(totalCent), id]
    );

    return {
      devolucion: {
        id: devolucionId,
        venta_id: Number(id),
        motivo,
        metodo,
        total: formatoSoles(totalCent),
        creada_en: devoluciones[0].creada_en,
        items: detalleDevolucion,
      },
      venta: await buscarVenta(id, cliente.query.bind(cliente)),
    };
  });
}

// ------------------------------------------------------------
// CREAR VENTA
// ------------------------------------------------------------
async function crear(usuario, datos) {
  // --- 1. Validaciones de forma (antes de tocar la base) ---
  const tipo = datos.tipo_comprobante;
  if (!TIPOS_COMPROBANTE.includes(tipo)) {
    throw new ErrorHttp(400, `Tipo de comprobante invalido. Debe ser: ${TIPOS_COMPROBANTE.join(', ')}.`);
  }

  const items = validarItems(datos.items);
  const pagos = validarPagos(datos.pagos);

  return transaccion(async (cliente) => {
    // --- 2. Caja abierta del cajero ---
    // FOR SHARE bloquea la fila mientras dure la venta: si alguien
    // intenta cerrar la caja justo ahora, espera a que termine.
    const { rows: cajas } = await cliente.query(
      `SELECT id, sucursal_id
         FROM cajas
        WHERE usuario_id = $1
          AND estado = 'abierta'
        FOR SHARE`,
      [usuario.id]
    );

    const caja = cajas[0];
    if (!caja) {
      throw new ErrorHttp(409, 'No tienes una caja abierta. Abre tu caja antes de vender.');
    }

    // --- 3. Cliente (opcional) y regla de la factura ---
    let clienteVenta = null;

    if (datos.cliente_id !== undefined && datos.cliente_id !== null) {
      const { rows } = await cliente.query(
        'SELECT id, tipo_documento, nombre FROM clientes WHERE id = $1',
        [datos.cliente_id]
      );

      clienteVenta = rows[0];
      if (!clienteVenta) {
        throw new ErrorHttp(404, 'El cliente indicado no existe.');
      }
    }

    if (tipo === 'factura') {
      if (!clienteVenta) {
        throw new ErrorHttp(400, 'La factura requiere un cliente con RUC.');
      }
      if (clienteVenta.tipo_documento !== 'RUC') {
        throw new ErrorHttp(400, 'La factura solo se puede emitir a un cliente con RUC.');
      }
    }

    // --- 4. Productos: precio y datos salen de la BASE, no del frontend ---
    const ids = items.map((item) => item.producto_id);

    const { rows: productos } = await cliente.query(
      `SELECT id, nombre, precio_venta, afecto_igv, activo
         FROM productos
        WHERE id = ANY($1::int[])`,
      [ids]
    );

    if (productos.length !== ids.length) {
      throw new ErrorHttp(404, 'Uno de los productos de la venta no existe.');
    }

    for (const producto of productos) {
      if (!producto.activo) {
        throw new ErrorHttp(400, `El producto "${producto.nombre}" esta inactivo y no se puede vender.`);
      }
    }

    const porId = new Map(productos.map((producto) => [producto.id, producto]));

    // --- 5. Calculo de totales en centavos ---
    let totalCent = 0;
    let baseCent = 0;
    let igvCent = 0;

    const detalle = items.map((item) => {
      const producto = porId.get(item.producto_id);
      const precioCent = aCentavos(producto.precio_venta);
      const lineaCent = precioCent * item.cantidad;

      // Si el producto esta exonerado, todo el importe es base.
      // Si esta afecto, el precio incluye IGV: base = importe / 1.18.
      let baseLineaCent = lineaCent;
      if (producto.afecto_igv) {
        baseLineaCent = Math.round(lineaCent / 1.18);
      }
      const igvLineaCent = lineaCent - baseLineaCent;

      totalCent += lineaCent;
      baseCent += baseLineaCent;
      igvCent += igvLineaCent;

      return {
        producto_id: producto.id,
        nombre: producto.nombre,
        cantidad: item.cantidad,
        precio_unitario: aSoles(precioCent),
        total_linea: aSoles(lineaCent),
        afecto_igv: producto.afecto_igv,
      };
    });

    // --- 6. Pagos: validar que alcancen y calcular vuelto ---
    const { pagosFinales, vuelto } = cuadrarPagos(pagos, totalCent);

    // --- 7. Numero correlativo ---
    // ON CONFLICT hace todo en una sola sentencia atomica:
    // si el comprobante ya existe, lo incrementa; si no, lo crea en 1.
    const { rows: correlativo } = await cliente.query(
      `INSERT INTO correlativos (tipo_comprobante, serie, ultimo_numero)
            VALUES ($1, $2, 1)
       ON CONFLICT (tipo_comprobante, serie)
       DO UPDATE SET ultimo_numero = correlativos.ultimo_numero + 1
         RETURNING ultimo_numero`,
      [tipo, SERIES[tipo]]
    );
    const numero = correlativo[0].ultimo_numero;

    // --- 8. Descontar stock ---
    // El WHERE ... AND stock >= cantidad es la clave: si no alcanza,
    // el UPDATE no toca ninguna fila y nosotros respondemos 409.
    // Asi dos cajeros nunca venden el mismo ultimo producto.
    // Ordenamos por producto para que dos ventas simultaneas bloqueen
    // las filas en el mismo orden y no se queden trabadas.
    const itemsOrdenados = [...detalle].sort((a, b) => a.producto_id - b.producto_id);

    for (const item of itemsOrdenados) {
      const resultado = await cliente.query(
        `UPDATE inventario
            SET stock = stock - $1
          WHERE producto_id = $2
            AND sucursal_id = $3
            AND stock >= $1`,
        [item.cantidad, item.producto_id, caja.sucursal_id]
      );

      if (resultado.rowCount === 0) {
        const { rows: actual } = await cliente.query(
          `SELECT stock FROM inventario
            WHERE producto_id = $1 AND sucursal_id = $2`,
          [item.producto_id, caja.sucursal_id]
        );

        const disponible = actual[0] ? actual[0].stock : 0;

        throw new ErrorHttp(
          409,
          `No hay stock suficiente de "${item.nombre}". Disponible: ${disponible}, pedido: ${item.cantidad}.`
        );
      }
    }

    // --- 9. Cabecera de la venta ---
    const { rows: ventas } = await cliente.query(
      `INSERT INTO ventas
         (tipo_comprobante, serie, numero, cliente_id, usuario_id,
          caja_id, sucursal_id, subtotal, igv, total, vuelto)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id`,
      [
        tipo,
        SERIES[tipo],
        numero,
        clienteVenta ? clienteVenta.id : null,
        usuario.id,
        caja.id,
        caja.sucursal_id,
        aSoles(baseCent),
        aSoles(igvCent),
        aSoles(totalCent),
        vuelto,
      ]
    );

    const ventaId = ventas[0].id;

    // --- 10. Detalle ---
    for (const item of detalle) {
      await cliente.query(
        `INSERT INTO venta_detalle
           (venta_id, producto_id, cantidad, precio_unitario, total_linea, afecto_igv)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          ventaId,
          item.producto_id,
          item.cantidad,
          item.precio_unitario,
          item.total_linea,
          item.afecto_igv,
        ]
      );
    }

    // --- 11. Pagos (montos ya aplicados) ---
    for (const pago of pagosFinales) {
      await cliente.query(
        'INSERT INTO pagos (venta_id, metodo, monto) VALUES ($1, $2, $3)',
        [ventaId, pago.metodo, aSoles(pago.montoCent)]
      );
    }

    // --- 12. Respuesta: la venta completa, leida con el mismo cliente ---
    return await buscarVenta(ventaId, cliente.query.bind(cliente));
  });
}

// ------------------------------------------------------------
// LISTAR VENTAS
//  El cajero ve solo las suyas; el administrador ve todas.
// ------------------------------------------------------------
async function listar(usuario, filtros = {}) {
  let sql = `SELECT v.id, v.tipo_comprobante, v.serie, v.numero,
                    v.cliente_id, c.nombre AS cliente,
                    v.usuario_id, u.nombre AS cajero,
                    v.sucursal_id, s.nombre AS sucursal,
                    v.subtotal, v.igv, v.total, v.vuelto,
                    v.total_devuelto, v.estado, v.creada_en
               FROM ventas v
               JOIN usuarios u     ON u.id = v.usuario_id
               JOIN sucursales s   ON s.id = v.sucursal_id
               LEFT JOIN clientes c ON c.id = v.cliente_id
              WHERE 1 = 1`;
  const parametros = [];

  // Regla de permisos: el cajero solo ve lo suyo.
  if (usuario.rol === 'cajero') {
    parametros.push(usuario.id);
    sql += ` AND v.usuario_id = $${parametros.length}`;
  } else if (filtros.usuario_id) {
    parametros.push(Number(filtros.usuario_id));
    sql += ` AND v.usuario_id = $${parametros.length}`;
  }

  if (filtros.estado) {
    if (!['emitida', 'anulada'].includes(filtros.estado)) {
      throw new ErrorHttp(400, 'El estado debe ser "emitida" o "anulada".');
    }
    parametros.push(filtros.estado);
    sql += ` AND v.estado = $${parametros.length}`;
  }

  if (filtros.desde) {
    parametros.push(filtros.desde);
    sql += ` AND v.creada_en >= $${parametros.length}::date`;
  }

  if (filtros.hasta) {
    parametros.push(filtros.hasta);
    sql += ` AND v.creada_en < ($${parametros.length}::date + INTERVAL '1 day')`;
  }

  sql += ' ORDER BY v.creada_en DESC';

  const { rows } = await query(sql, parametros);

  return rows.map((venta) => ({
    ...venta,
    numero_comprobante: numeroComprobante(venta),
    total_neto: totalNetoVenta(venta),
  }));
}

// ------------------------------------------------------------
// OBTENER UNA VENTA
// ------------------------------------------------------------
async function obtener(id, usuario) {
  const venta = await buscarVenta(id);

  if (!venta) {
    throw new ErrorHttp(404, 'Venta no encontrada.');
  }

  if (usuario.rol === 'cajero' && Number(venta.usuario_id) !== Number(usuario.id)) {
    throw new ErrorHttp(403, 'Solo puedes ver tus propias ventas.');
  }

  return venta;
}

module.exports = { crear, listar, obtener, anular, devolver, numeroComprobante };
