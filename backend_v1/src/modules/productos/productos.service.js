// ============================================================
//  SERVICIO DE PRODUCTOS
// ------------------------------------------------------------
//  CRUD del catalogo. Reglas importantes:
//   - El codigo de barras es unico (la base lo garantiza).
//   - La eliminacion es LOGICA: activo = FALSE.
//   - Al crear un producto se le abre stock en 0 en cada
//     sucursal activa (asi despues se puede vender en cualquiera).
// ============================================================

const { query, transaccion } = require('../../config/db');
const { ErrorHttp } = require('../../utils/http');

const UNIDADES_VALIDAS = ['unidad', 'kg', 'litro', 'caja', 'paquete'];

// Columnas publicas del producto (las que devuelve la API)
const CAMPOS = `id, codigo_barras, nombre, descripcion, marca, categoria,
                presentacion, unidad_medida, precio_venta, costo,
                afecto_igv, activo, creado_en, actualizado_en`;

// ------------------------------------------------------------
// Helpers de validacion
// ------------------------------------------------------------
function textoOpcional(valor) {
  if (valor === undefined) return undefined;
  if (valor === null) return null;
  const limpio = String(valor).trim();
  return limpio === '' ? null : limpio;
}

function numeroNoNegativo(valor, campo) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0) {
    throw new ErrorHttp(400, `El campo "${campo}" debe ser un numero mayor o igual a 0.`);
  }
  // Redondeamos a 2 decimales para no arrastrar errores de coma flotante.
  return Number(numero.toFixed(2));
}

// Valida y normaliza los datos. Con { parcial: true } solo revisa
// los campos que vinieron (lo usa el PUT).
function validarProducto(datos, { parcial = false } = {}) {
  const salida = {};

  // --- codigo de barras: obligatorio al crear, unico ---
  if (!parcial || datos.codigo_barras !== undefined) {
    const codigo = String(datos.codigo_barras ?? '').trim();
    if (!codigo) {
      throw new ErrorHttp(400, 'El codigo de barras es obligatorio.');
    }
    if (codigo.length > 50) {
      throw new ErrorHttp(400, 'El codigo de barras no puede superar los 50 caracteres.');
    }
    salida.codigo_barras = codigo;
  }

  // --- nombre ---
  if (!parcial || datos.nombre !== undefined) {
    const nombre = String(datos.nombre ?? '').trim();
    if (nombre.length < 2) {
      throw new ErrorHttp(400, 'El nombre del producto debe tener al menos 2 caracteres.');
    }
    salida.nombre = nombre;
  }

  // --- precio de venta (obligatorio al crear) ---
  if (!parcial || datos.precio_venta !== undefined) {
    if (datos.precio_venta === undefined) {
      throw new ErrorHttp(400, 'El precio de venta es obligatorio.');
    }
    salida.precio_venta = numeroNoNegativo(datos.precio_venta, 'precio_venta');
  }

  // --- costo (opcional, por defecto 0) ---
  if (!parcial || datos.costo !== undefined) {
    salida.costo = datos.costo === undefined ? 0 : numeroNoNegativo(datos.costo, 'costo');
  }

  // --- unidad de medida ---
  if (!parcial || datos.unidad_medida !== undefined) {
    const unidad = datos.unidad_medida ?? 'unidad';
    if (!UNIDADES_VALIDAS.includes(unidad)) {
      throw new ErrorHttp(400, `Unidad invalida. Debe ser: ${UNIDADES_VALIDAS.join(', ')}.`);
    }
    salida.unidad_medida = unidad;
  }

  // --- afecto a IGV (por defecto TRUE) ---
  if (!parcial || datos.afecto_igv !== undefined) {
    salida.afecto_igv = datos.afecto_igv === undefined ? true : Boolean(datos.afecto_igv);
  }

  // --- activo (se puede reactivar con el PUT) ---
  if (datos.activo !== undefined) {
    salida.activo = Boolean(datos.activo);
  }

  // --- campos de texto libres (opcionales) ---
  const opcionales = ['descripcion', 'marca', 'categoria', 'presentacion'];
  for (const campo of opcionales) {
    if (datos[campo] !== undefined) {
      salida[campo] = textoOpcional(datos[campo]);
    }
  }

  return salida;
}

// ------------------------------------------------------------
// LISTAR
//  Por defecto devuelve solo los ACTIVOS (lo que ve el POS).
//    ?activo=false  -> solo los dados de baja
//    ?activo=todos  -> todos (panel del administrador)
// ------------------------------------------------------------
async function listar(filtros = {}) {
  let sql = `SELECT ${CAMPOS} FROM productos WHERE 1 = 1`;
  const parametros = [];

  if (filtros.activo === 'todos') {
    // sin filtro de estado
  } else if (filtros.activo === 'false') {
    sql += ' AND activo = FALSE';
  } else {
    sql += ' AND activo = TRUE';
  }

  if (filtros.q) {
    parametros.push(`%${filtros.q}%`);
    // Busca por nombre, marca o codigo de barras, todo en una sola condicion
    sql += ` AND (nombre ILIKE $${parametros.length}
                  OR marca ILIKE $${parametros.length}
                  OR codigo_barras ILIKE $${parametros.length})`;
  }

  if (filtros.categoria) {
    parametros.push(filtros.categoria);
    sql += ` AND categoria = $${parametros.length}`;
  }

  sql += ' ORDER BY nombre';

  const { rows } = await query(sql, parametros);
  return rows;
}

// ------------------------------------------------------------
// CATEGORIAS (para llenar el combo del frontend)
// ------------------------------------------------------------
async function categorias() {
  const { rows } = await query(
    `SELECT DISTINCT categoria
       FROM productos
      WHERE activo = TRUE AND categoria IS NOT NULL
      ORDER BY categoria`
  );
  return rows.map((fila) => fila.categoria);
}

// ------------------------------------------------------------
// OBTENER POR CODIGO DE BARRAS (lo usa el escaner del POS)
// ------------------------------------------------------------
async function obtenerPorCodigo(codigo) {
  const { rows } = await query(
    `SELECT ${CAMPOS} FROM productos WHERE codigo_barras = $1`,
    [String(codigo).trim()]
  );

  if (!rows[0]) {
    throw new ErrorHttp(404, `No existe un producto con el codigo ${codigo}.`);
  }

  if (!rows[0].activo) {
    throw new ErrorHttp(404, `El producto "${rows[0].nombre}" esta inactivo y no se puede vender.`);
  }

  return rows[0];
}

// ------------------------------------------------------------
// OBTENER POR ID
// ------------------------------------------------------------
async function obtener(id) {
  const { rows } = await query(
    `SELECT ${CAMPOS} FROM productos WHERE id = $1`,
    [id]
  );

  if (!rows[0]) {
    throw new ErrorHttp(404, 'Producto no encontrado.');
  }

  return rows[0];
}

// ------------------------------------------------------------
// CREAR
// ------------------------------------------------------------
async function crear(datos) {
  const producto = validarProducto(datos);

  try {
    // Transaccion: el producto y su stock inicial son "todo o nada".
    return await transaccion(async (cliente) => {
      const { rows } = await cliente.query(
        `INSERT INTO productos
           (codigo_barras, nombre, descripcion, marca, categoria, presentacion,
            unidad_medida, precio_venta, costo, afecto_igv)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING ${CAMPOS}`,
        [
          producto.codigo_barras,
          producto.nombre,
          producto.descripcion ?? null,
          producto.marca ?? null,
          producto.categoria ?? null,
          producto.presentacion ?? null,
          producto.unidad_medida,
          producto.precio_venta,
          producto.costo,
          producto.afecto_igv,
        ]
      );

      const nuevo = rows[0];

      // Le abrimos una fila de stock en 0 por cada sucursal activa.
      // Una sola sentencia: INSERT ... SELECT sobre la tabla sucursales.
      await cliente.query(
        `INSERT INTO inventario (producto_id, sucursal_id, stock, stock_minimo)
         SELECT $1, id, 0, 5
           FROM sucursales
          WHERE activo = TRUE`,
        [nuevo.id]
      );

      return nuevo;
    });
  } catch (error) {
    if (error.code === '23505') {
      throw new ErrorHttp(409, 'Ya existe un producto con ese codigo de barras.');
    }
    throw error;
  }
}

// ------------------------------------------------------------
// ACTUALIZAR (parcial)
// ------------------------------------------------------------
async function actualizar(id, datos) {
  await obtener(id); // 404 si no existe

  const cambios = validarProducto(datos, { parcial: true });

  const columnas = Object.keys(cambios);
  if (columnas.length === 0) {
    throw new ErrorHttp(400, 'No enviaste ningun campo para actualizar.');
  }

  const valores = columnas.map((columna) => cambios[columna]);
  const asignaciones = columnas.map(
    (columna, indice) => `${columna} = $${indice + 1}`
  );

  valores.push(id);

  try {
    const { rows } = await query(
      `UPDATE productos
          SET ${asignaciones.join(', ')}, actualizado_en = NOW()
        WHERE id = $${valores.length}
    RETURNING ${CAMPOS}`,
      valores
    );

    return rows[0];
  } catch (error) {
    if (error.code === '23505') {
      throw new ErrorHttp(409, 'Ya existe otro producto con ese codigo de barras.');
    }
    throw error;
  }
}

// ------------------------------------------------------------
// DESACTIVAR (baja logica)
// ------------------------------------------------------------
async function desactivar(id) {
  await obtener(id);

  const { rows } = await query(
    `UPDATE productos
        SET activo = FALSE, actualizado_en = NOW()
      WHERE id = $1
  RETURNING ${CAMPOS}`,
    [id]
  );

  return rows[0];
}

module.exports = {
  listar,
  categorias,
  obtenerPorCodigo,
  obtener,
  crear,
  actualizar,
  desactivar,
};
