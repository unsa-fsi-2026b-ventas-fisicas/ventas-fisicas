// ============================================================
//  CONTROLADOR DE REPORTES
// ============================================================

const servicio = require('./reportes.service');

function filtros(req) {
  return {
    desde: req.query.desde,
    hasta: req.query.hasta,
    limite: req.query.limite,
  };
}

// GET /api/reportes/resumen?desde=&hasta=
async function resumen(req, res) {
  res.json({ ok: true, datos: await servicio.resumen(filtros(req)) });
}

// GET /api/reportes/productos?desde=&hasta=&limite=
async function productos(req, res) {
  res.json({ ok: true, datos: await servicio.productos(filtros(req)) });
}

// GET /api/reportes/por-sucursal?desde=&hasta=
async function porSucursal(req, res) {
  res.json({ ok: true, datos: await servicio.porSucursal(filtros(req)) });
}

// GET /api/reportes/por-cajero?desde=&hasta=
async function porCajero(req, res) {
  res.json({ ok: true, datos: await servicio.porCajero(filtros(req)) });
}

// GET /api/reportes/por-dia?desde=&hasta=
async function porDia(req, res) {
  res.json({ ok: true, datos: await servicio.porDia(filtros(req)) });
}

module.exports = { resumen, productos, porSucursal, porCajero, porDia };
