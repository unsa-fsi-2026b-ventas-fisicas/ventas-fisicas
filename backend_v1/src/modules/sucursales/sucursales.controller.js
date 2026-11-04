// ============================================================
//  CONTROLADOR DE SUCURSALES
// ============================================================

const servicio = require('./sucursales.service');

// GET /api/sucursales
async function listar(req, res) {
  const datos = await servicio.listar();
  res.json({ ok: true, datos });
}

module.exports = { listar };
