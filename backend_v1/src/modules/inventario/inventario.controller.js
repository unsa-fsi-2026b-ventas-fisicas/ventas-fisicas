// ============================================================
//  CONTROLADOR DE INVENTARIO
// ============================================================

const servicio = require('./inventario.service');

// GET /api/inventario?sucursal_id=&q=&solo_bajo=
async function listar(req, res) {
  const datos = await servicio.listar({
    sucursal_id: req.query.sucursal_id,
    q: req.query.q,
    solo_bajo: req.query.solo_bajo,
  });

  res.json({ ok: true, datos });
}

// PUT /api/inventario/:productoId/:sucursalId
async function ajustar(req, res) {
  const datos = await servicio.ajustar(
    req.params.productoId,
    req.params.sucursalId,
    req.body
  );

  res.json({
    ok: true,
    mensaje: 'Stock ajustado correctamente',
    datos,
  });
}

module.exports = { listar, ajustar };
