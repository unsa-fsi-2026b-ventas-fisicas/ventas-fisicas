// ============================================================
//  SERVICIO DE INVENTARIO
// ------------------------------------------------------------
//  El stock NO es un campo del producto: es una tabla aparte
//  porque un mismo producto tiene distinto stock en cada tienda.
//
//  Aca solo hay dos operaciones:
//    - consultar stock (cajero y administrador)
//    - ajuste manual por conteo fisico (solo administrador)
//
//  El descuento automatico al vender lo hace el modulo de ventas,
//  dentro de su transaccion.
// ============================================================

const { query } = require('../../config/db');
const { ErrorHttp } = require('../../utils/http');

const CAMPOS = `i.producto_id, p.codigo_barras, p.nombre, p.categoria, p.unidad_medida,
                i.sucursal_id, s.nombre AS sucursal,
                i.stock, i.stock_minimo,
                (i.stock < i.stock_minimo) AS stock_bajo`;

// ------------------------------------------------------------
// LISTAR STOCK
//   ?sucursal_id=1      filtra por tienda
//   ?q=coca             busca por nombre o codigo
//   ?solo_bajo=true     solo los que estan por debajo del minimo
// ------------------------------------------------------------
async function listar(filtros = {}) {
  let sql = `SELECT ${CAMPOS}
               FROM inventario i
               JOIN productos p  ON p.id = i.producto_id
               JOIN sucursales s ON s.id = i.sucursal_id
              WHERE p.activo = TRUE`;
  const parametros = [];

  if (filtros.sucursal_id !== undefined) {
    const id = Number(filtros.sucursal_id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ErrorHttp(400, 'El parametro sucursal_id debe ser un numero entero.');
    }
    parametros.push(id);
    sql += ` AND i.sucursal_id = $${parametros.length}`;
  }

  if (filtros.q) {
    parametros.push(`%${filtros.q}%`);
    sql += ` AND (p.nombre ILIKE $${parametros.length} OR p.codigo_barras ILIKE $${parametros.length})`;
  }

  if (filtros.solo_bajo === 'true') {
    sql += ' AND i.stock < i.stock_minimo';
  }

  sql += ' ORDER BY p.nombre, i.sucursal_id';

  const { rows } = await query(sql, parametros);
  return rows;
}

// ------------------------------------------------------------
// AJUSTE MANUAL (conteo fisico)
//  No suma ni resta: FIJA el stock al valor contado.
//  Ejemplo: el sistema dice 10, el administrador cuenta 12
//           y manda { "stock": 12 }.
//  Tambien se puede cambiar el stock_minimo de esa tienda.
// ------------------------------------------------------------
async function ajustar(productoId, sucursalId, datos) {
  const cambios = [];
  const valores = [];

  if (datos.stock !== undefined) {
    const stock = Number(datos.stock);
    if (!Number.isInteger(stock) || stock < 0) {
      throw new ErrorHttp(400, 'El stock debe ser un numero entero mayor o igual a 0.');
    }
    valores.push(stock);
    cambios.push(`stock = $${valores.length}`);
  }

  if (datos.stock_minimo !== undefined) {
    const minimo = Number(datos.stock_minimo);
    if (!Number.isInteger(minimo) || minimo < 0) {
      throw new ErrorHttp(400, 'El stock_minimo debe ser un numero entero mayor o igual a 0.');
    }
    valores.push(minimo);
    cambios.push(`stock_minimo = $${valores.length}`);
  }

  if (cambios.length === 0) {
    throw new ErrorHttp(400, 'Debes enviar "stock" o "stock_minimo".');
  }

  // Los dos ultimos parametros son las llaves del WHERE
  valores.push(productoId, sucursalId);
  const indiceProducto = valores.length - 1;
  const indiceSucursal = valores.length;

  const { rows } = await query(
    `UPDATE inventario
        SET ${cambios.join(', ')}
      WHERE producto_id = $${indiceProducto}
        AND sucursal_id = $${indiceSucursal}
  RETURNING producto_id, sucursal_id, stock, stock_minimo`,
    valores
  );

  if (!rows[0]) {
    throw new ErrorHttp(404, 'Ese producto no tiene stock registrado en esa sucursal.');
  }

  return {
    ...rows[0],
    stock_bajo: rows[0].stock < rows[0].stock_minimo,
  };
}

module.exports = { listar, ajustar };
