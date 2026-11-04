// ============================================================
//  SERVICIO DE CAJAS
// ------------------------------------------------------------
//  Una caja es un TURNO de trabajo:
//    abrir  -> el cajero pone un monto inicial (sencillo)
//    vender -> las ventas quedan asociadas a esa caja
//    cerrar -> cuenta el dinero y se compara con lo esperado
//
//  Arqueo = comparar lo esperado con lo contado:
//    total_esperado = monto_inicial
//                   + ventas cobradas en efectivo
//                   - devoluciones pagadas en efectivo
//    diferencia     = monto_contado - total_esperado
//
//  Las devoluciones en efectivo salen del cajon, por eso se
//  restan. Las devoluciones por tarjeta/billetera no tocan el
//  cajon y no afectan el arqueo.
//
//  Regla del negocio: un cajero solo puede tener UNA caja abierta.
//  Lo garantiza un indice UNIQUE parcial en la base de datos
//  (no solo el codigo), asi no hay forma de saltearlo.
// ============================================================

const { query, transaccion } = require('../../config/db');
const { ErrorHttp } = require('../../utils/http');

const CAMPOS = `c.id, c.usuario_id, u.nombre AS cajero,
                c.sucursal_id, s.nombre AS sucursal,
                c.monto_inicial, c.estado, c.abierta_en, c.cerrada_en,
                c.total_efectivo, c.total_esperado, c.monto_contado, c.diferencia`;

// Redondeo a 2 decimales para evitar diferencias de centavos.
function redondear(numero) {
  return Number(Number(numero).toFixed(2));
}

// Clasificacion del arqueo (sirve para pintar el resultado en el frontend)
function clasificar(diferencia) {
  if (Math.abs(diferencia) < 0.005) return 'cuadrada';
  return diferencia > 0 ? 'sobrante' : 'faltante';
}

function mensajeArqueo(resultado, diferencia) {
  const monto = Math.abs(diferencia).toFixed(2);
  if (resultado === 'cuadrada') return 'Caja cuadrada: lo contado coincide con lo esperado.';
  if (resultado === 'sobrante') return `Sobrante de S/ ${monto}.`;
  return `Faltante de S/ ${monto}.`;
}

// ------------------------------------------------------------
// Busca una caja con los nombres de cajero y sucursal.
// "ejecutor" permite usar el pool (query) o un cliente de
// transaccion (cliente.query), segun donde estemos parados.
// ------------------------------------------------------------
async function buscarCaja(id, ejecutor = query) {
  const { rows } = await ejecutor(
    `SELECT ${CAMPOS}
       FROM cajas c
       JOIN usuarios u   ON u.id = c.usuario_id
       JOIN sucursales s ON s.id = c.sucursal_id
      WHERE c.id = $1`,
    [id]
  );
  return rows[0] || null;
}

// ------------------------------------------------------------
// Efectivo NETO de una caja:
//   ventas cobradas en efectivo - devoluciones en efectivo
//
// Solo cuentan las ventas emitidas: una venta anulada deja de
// sumar (el dinero se devolvio) y tampoco se resta su devolucion,
// para no descontar dos veces el mismo billete.
// ------------------------------------------------------------
async function calcularEfectivo(cajaId, ejecutor = query) {
  const { rows } = await ejecutor(
    `SELECT COALESCE(SUM(p.monto), 0)
            - COALESCE((
                SELECT SUM(d.total)
                  FROM devoluciones d
                  JOIN ventas v2 ON v2.id = d.venta_id
                 WHERE v2.caja_id = $1
                   AND v2.estado = 'emitida'
                   AND d.metodo = 'efectivo'
              ), 0) AS efectivo
       FROM pagos p
       JOIN ventas v ON v.id = p.venta_id
      WHERE v.caja_id = $1
        AND v.estado = 'emitida'
        AND p.metodo = 'efectivo'`,
    [cajaId]
  );
  return redondear(rows[0].efectivo);
}

// ------------------------------------------------------------
// Solo el total devuelto en efectivo (para mostrarlo aparte
// en la pantalla de caja, sin mezclarlo con las ventas).
// ------------------------------------------------------------
async function calcularDevolucionesEfectivo(cajaId, ejecutor = query) {
  const { rows } = await ejecutor(
    `SELECT COALESCE(SUM(d.total), 0) AS devuelto
       FROM devoluciones d
       JOIN ventas v ON v.id = d.venta_id
      WHERE v.caja_id = $1
        AND v.estado = 'emitida'
        AND d.metodo = 'efectivo'`,
    [cajaId]
  );
  return redondear(rows[0].devuelto);
}

// ------------------------------------------------------------
// ABRIR CAJA
// ------------------------------------------------------------
async function abrir(usuario, datos) {
  const montoInicial = Number(datos.monto_inicial);
  if (!Number.isFinite(montoInicial) || montoInicial < 0) {
    throw new ErrorHttp(400, 'El monto inicial debe ser un numero mayor o igual a 0.');
  }

  // El cajero trabaja en su sucursal. El administrador puede elegir.
  const sucursalId = datos.sucursal_id ?? usuario.sucursal_id;
  if (!sucursalId) {
    throw new ErrorHttp(400, 'Indica la sucursal donde abres la caja.');
  }

  if (usuario.rol === 'cajero' && Number(sucursalId) !== Number(usuario.sucursal_id)) {
    throw new ErrorHttp(403, 'Solo puedes abrir caja en tu sucursal asignada.');
  }

  const { rows: sucursales } = await query(
    'SELECT id FROM sucursales WHERE id = $1 AND activo = TRUE',
    [sucursalId]
  );
  if (!sucursales[0]) {
    throw new ErrorHttp(404, 'La sucursal indicada no existe o esta inactiva.');
  }

  try {
    const { rows } = await query(
      `INSERT INTO cajas (usuario_id, sucursal_id, monto_inicial)
            VALUES ($1, $2, $3)
         RETURNING id`,
      [usuario.id, sucursalId, redondear(montoInicial)]
    );

    return await buscarCaja(rows[0].id);
  } catch (error) {
    // 23505 = choco con el indice unico de "una caja abierta por cajero".
    if (error.code === '23505') {
      throw new ErrorHttp(409, 'Ya tienes una caja abierta. Cierrala antes de abrir otra.');
    }
    throw error;
  }
}

// ------------------------------------------------------------
// MI CAJA ABIERTA (lo que consulta el POS al cargar la pantalla)
// ------------------------------------------------------------
async function obtenerAbierta(usuario) {
  const { rows } = await query(
    `SELECT ${CAMPOS}
       FROM cajas c
       JOIN usuarios u   ON u.id = c.usuario_id
       JOIN sucursales s ON s.id = c.sucursal_id
      WHERE c.usuario_id = $1
        AND c.estado = 'abierta'`,
    [usuario.id]
  );

  const caja = rows[0];
  if (!caja) return null; // no es un error: simplemente no abrio caja todavia

  const efectivo = await calcularEfectivo(caja.id);
  const devuelto = await calcularDevolucionesEfectivo(caja.id);

  const { rows: conteo } = await query(
    `SELECT COUNT(*)::int AS cantidad
       FROM ventas
      WHERE caja_id = $1 AND estado = 'emitida'`,
    [caja.id]
  );

  return {
    ...caja,
    ventas_efectivo: redondear(efectivo + devuelto),
    devoluciones_efectivo: devuelto,
    efectivo_neto: efectivo,
    total_esperado_parcial: redondear(Number(caja.monto_inicial) + efectivo),
    cantidad_ventas: conteo[0].cantidad,
  };
}

// ------------------------------------------------------------
// CERRAR CAJA + ARQUEO
// ------------------------------------------------------------
async function cerrar(id, usuario, datos) {
  const contado = Number(datos.monto_contado);
  if (!Number.isFinite(contado) || contado < 0) {
    throw new ErrorHttp(400, 'El monto contado debe ser un numero mayor o igual a 0.');
  }

  return transaccion(async (cliente) => {
    // FOR UPDATE bloquea la fila: si dos personas cierran a la vez,
    // la segunda espera y cuando entra ya ve el estado 'cerrada'.
    const { rows } = await cliente.query(
      'SELECT * FROM cajas WHERE id = $1 FOR UPDATE',
      [id]
    );

    const caja = rows[0];
    if (!caja) {
      throw new ErrorHttp(404, 'Caja no encontrada.');
    }

    if (usuario.rol === 'cajero' && Number(caja.usuario_id) !== Number(usuario.id)) {
      throw new ErrorHttp(403, 'Solo puedes cerrar tu propia caja.');
    }

    if (caja.estado === 'cerrada') {
      throw new ErrorHttp(409, 'La caja ya esta cerrada.');
    }

    const efectivo = await calcularEfectivo(id, cliente.query.bind(cliente));
    const devuelto = await calcularDevolucionesEfectivo(id, cliente.query.bind(cliente));
    const esperado = redondear(Number(caja.monto_inicial) + efectivo);
    const contadoRedondeado = redondear(contado);
    const diferencia = redondear(contadoRedondeado - esperado);

    await cliente.query(
      `UPDATE cajas
          SET estado = 'cerrada',
              cerrada_en = NOW(),
              total_efectivo = $1,
              total_esperado = $2,
              monto_contado = $3,
              diferencia = $4
        WHERE id = $5`,
      [efectivo, esperado, contadoRedondeado, diferencia, id]
    );

    // Leemos la caja actualizada con el MISMO cliente de la transaccion,
    // porque el cambio todavia no esta confirmado para el resto.
    const cerrada = await buscarCaja(id, cliente.query.bind(cliente));
    const resultado = clasificar(diferencia);

    return {
      ...cerrada,
      ventas_efectivo: redondear(efectivo + devuelto),
      devoluciones_efectivo: devuelto,
      efectivo_neto: efectivo,
      resultado,
      mensaje: mensajeArqueo(resultado, diferencia),
    };
  });
}

// ------------------------------------------------------------
// HISTORIAL DE CAJAS (administrador)
// ------------------------------------------------------------
async function listar(filtros = {}) {
  let sql = `SELECT ${CAMPOS}
               FROM cajas c
               JOIN usuarios u   ON u.id = c.usuario_id
               JOIN sucursales s ON s.id = c.sucursal_id
              WHERE 1 = 1`;
  const parametros = [];

  if (filtros.usuario_id) {
    parametros.push(Number(filtros.usuario_id));
    sql += ` AND c.usuario_id = $${parametros.length}`;
  }

  if (filtros.estado) {
    if (!['abierta', 'cerrada'].includes(filtros.estado)) {
      throw new ErrorHttp(400, 'El estado debe ser "abierta" o "cerrada".');
    }
    parametros.push(filtros.estado);
    sql += ` AND c.estado = $${parametros.length}`;
  }

  if (filtros.desde) {
    parametros.push(filtros.desde);
    sql += ` AND c.abierta_en >= $${parametros.length}::date`;
  }

  if (filtros.hasta) {
    parametros.push(filtros.hasta);
    sql += ` AND c.abierta_en < ($${parametros.length}::date + INTERVAL '1 day')`;
  }

  sql += ' ORDER BY c.abierta_en DESC';

  const { rows } = await query(sql, parametros);
  return rows;
}

// ------------------------------------------------------------
// DETALLE DE UNA CAJA
//  Un cajero solo puede ver las suyas.
// ------------------------------------------------------------
async function obtenerDetalle(id, usuario) {
  const caja = await buscarCaja(id);
  if (!caja) {
    throw new ErrorHttp(404, 'Caja no encontrada.');
  }

  if (usuario.rol === 'cajero' && Number(caja.usuario_id) !== Number(usuario.id)) {
    throw new ErrorHttp(403, 'Solo puedes ver tus propias cajas.');
  }

  // Si esta abierta, mostramos el avance en vivo.
  if (caja.estado === 'abierta') {
    const efectivo = await calcularEfectivo(caja.id);
    const devuelto = await calcularDevolucionesEfectivo(caja.id);
    return {
      ...caja,
      ventas_efectivo: redondear(efectivo + devuelto),
      devoluciones_efectivo: devuelto,
      efectivo_neto: efectivo,
      total_esperado_parcial: redondear(Number(caja.monto_inicial) + efectivo),
    };
  }

  return caja;
}

module.exports = { abrir, obtenerAbierta, cerrar, listar, obtenerDetalle };
