// ============================================================
//  SERVICIO DE REPORTES
// ------------------------------------------------------------
//  Todos los reportes trabajan sobre VENTAS EMITIDAS:
//  las anuladas no cuentan como ingreso.
//
//  Regla del negocio para el dinero:
//    total   = lo cobrado originalmente
//    devuelto = devoluciones parciales registradas
//    neto    = total - devuelto  (lo que realmente queda)
//
//  Se filtra por rango de fechas de la VENTA. Por defecto, hoy.
// ============================================================

const { query } = require('../../config/db');
const { ErrorHttp } = require('../../utils/http');

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

function validarFecha(valor, porDefecto) {
  if (valor === undefined || valor === null || valor === '') return porDefecto;

  const texto = String(valor);

  if (!RE_FECHA.test(texto)) {
    throw new ErrorHttp(400, 'Las fechas deben tener el formato AAAA-MM-DD.');
  }

  // El formato puede estar bien y la fecha no existir (2026-02-31).
  // Comparamos el ida y vuelta para detectarlo.
  const fecha = new Date(`${texto}T00:00:00Z`);
  if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== texto) {
    throw new ErrorHttp(400, `La fecha "${texto}" no existe en el calendario.`);
  }

  return texto;
}

// Rango por defecto: el dia de hoy.
function obtenerRango(filtros = {}) {
  const hoy = new Date().toISOString().slice(0, 10);
  const desde = validarFecha(filtros.desde, hoy);
  const hasta = validarFecha(filtros.hasta, hoy);

  if (desde > hasta) {
    throw new ErrorHttp(400, 'La fecha "desde" no puede ser mayor que la fecha "hasta".');
  }

  return { desde, hasta };
}

// ------------------------------------------------------------
// RESUMEN DEL PERIODO
// ------------------------------------------------------------
async function resumen(filtros) {
  const { desde, hasta } = obtenerRango(filtros);

  const { rows } = await query(
    `SELECT COUNT(*)::int                            AS cantidad_ventas,
            COALESCE(SUM(v.subtotal), 0)::numeric(10,2)             AS subtotal,
            COALESCE(SUM(v.igv), 0)::numeric(10,2)                  AS igv,
            COALESCE(SUM(v.total), 0)::numeric(10,2)                AS total,
            COALESCE(SUM(v.total_devuelto), 0)::numeric(10,2)       AS devuelto,
            COALESCE(SUM(v.total - v.total_devuelto), 0)::numeric(10,2) AS neto
       FROM ventas v
      WHERE v.estado = 'emitida'
        AND v.creada_en >= $1::date
        AND v.creada_en <  ($2::date + INTERVAL '1 day')`,
    [desde, hasta]
  );

  const datos = rows[0];
  const cantidad = Number(datos.cantidad_ventas);

  return {
    desde,
    hasta,
    cantidad_ventas: cantidad,
    subtotal: datos.subtotal,
    igv: datos.igv,
    total: datos.total,
    devuelto: datos.devuelto,
    neto: datos.neto,
    ticket_promedio: cantidad === 0
      ? '0.00'
      : (Number(datos.neto) / cantidad).toFixed(2),
  };
}

// ------------------------------------------------------------
// PRODUCTOS MAS VENDIDOS
//  cantidad_vendida ya descuenta las unidades devueltas.
// ------------------------------------------------------------
async function productos(filtros) {
  const { desde, hasta } = obtenerRango(filtros);

  let limite = Number(filtros.limite ?? 10);
  if (!Number.isInteger(limite) || limite < 1 || limite > 100) {
    throw new ErrorHttp(400, 'El limite debe ser un entero entre 1 y 100.');
  }

  const { rows } = await query(
    `SELECT p.id,
            p.nombre,
            p.categoria,
            SUM(vd.cantidad - vd.cantidad_devuelta)::int AS cantidad_vendida,
            SUM((vd.cantidad - vd.cantidad_devuelta) * vd.precio_unitario)::numeric(10,2) AS ingreso
       FROM venta_detalle vd
       JOIN ventas v    ON v.id = vd.venta_id
       JOIN productos p ON p.id = vd.producto_id
      WHERE v.estado = 'emitida'
        AND v.creada_en >= $1::date
        AND v.creada_en <  ($2::date + INTERVAL '1 day')
      GROUP BY p.id, p.nombre, p.categoria
     HAVING SUM(vd.cantidad - vd.cantidad_devuelta) > 0
      ORDER BY cantidad_vendida DESC, ingreso DESC
      LIMIT $3`,
    [desde, hasta, limite]
  );

  return { desde, hasta, limite, productos: rows };
}

// ------------------------------------------------------------
// VENTAS POR SUCURSAL
// ------------------------------------------------------------
async function porSucursal(filtros) {
  const { desde, hasta } = obtenerRango(filtros);

  const { rows } = await query(
    `SELECT s.id,
            s.nombre AS sucursal,
            COUNT(*)::int                      AS cantidad_ventas,
            COALESCE(SUM(v.total), 0)::numeric(10,2)          AS total,
            COALESCE(SUM(v.total_devuelto), 0)::numeric(10,2) AS devuelto,
            COALESCE(SUM(v.total - v.total_devuelto), 0)::numeric(10,2) AS neto
       FROM ventas v
       JOIN sucursales s ON s.id = v.sucursal_id
      WHERE v.estado = 'emitida'
        AND v.creada_en >= $1::date
        AND v.creada_en <  ($2::date + INTERVAL '1 day')
      GROUP BY s.id, s.nombre
      ORDER BY neto DESC`,
    [desde, hasta]
  );

  return { desde, hasta, sucursales: rows };
}

// ------------------------------------------------------------
// VENTAS POR CAJERO
// ------------------------------------------------------------
async function porCajero(filtros) {
  const { desde, hasta } = obtenerRango(filtros);

  const { rows } = await query(
    `SELECT u.id,
            u.nombre AS cajero,
            s.nombre AS sucursal,
            COUNT(*)::int                      AS cantidad_ventas,
            COALESCE(SUM(v.total), 0)::numeric(10,2)          AS total,
            COALESCE(SUM(v.total_devuelto), 0)::numeric(10,2) AS devuelto,
            COALESCE(SUM(v.total - v.total_devuelto), 0)::numeric(10,2) AS neto
       FROM ventas v
       JOIN usuarios u   ON u.id = v.usuario_id
       JOIN sucursales s ON s.id = v.sucursal_id
      WHERE v.estado = 'emitida'
        AND v.creada_en >= $1::date
        AND v.creada_en <  ($2::date + INTERVAL '1 day')
      GROUP BY u.id, u.nombre, s.nombre
      ORDER BY neto DESC`,
    [desde, hasta]
  );

  return { desde, hasta, cajeros: rows };
}

// ------------------------------------------------------------
// SERIE POR DIA (para graficos del frontend)
// ------------------------------------------------------------
async function porDia(filtros) {
  const { desde, hasta } = obtenerRango(filtros);

  const { rows } = await query(
    `SELECT TO_CHAR(v.creada_en, 'YYYY-MM-DD') AS fecha,
            COUNT(*)::int                      AS cantidad_ventas,
            COALESCE(SUM(v.total), 0)::numeric(10,2)          AS total,
            COALESCE(SUM(v.total_devuelto), 0)::numeric(10,2) AS devuelto,
            COALESCE(SUM(v.total - v.total_devuelto), 0)::numeric(10,2) AS neto
       FROM ventas v
      WHERE v.estado = 'emitida'
        AND v.creada_en >= $1::date
        AND v.creada_en <  ($2::date + INTERVAL '1 day')
      GROUP BY 1
      ORDER BY 1`,
    [desde, hasta]
  );

  return { desde, hasta, dias: rows };
}

module.exports = { resumen, productos, porSucursal, porCajero, porDia };
