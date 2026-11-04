// ============================================================
//  CONTROLADOR DE CAJAS
// ============================================================

const servicio = require('./cajas.service');

// POST /api/cajas/abrir
async function abrir(req, res) {
  const datos = await servicio.abrir(req.usuario, req.body);
  res.status(201).json({
    ok: true,
    mensaje: 'Caja abierta correctamente',
    datos,
  });
}

// GET /api/cajas/abierta
async function abierta(req, res) {
  const datos = await servicio.obtenerAbierta(req.usuario);
  res.json({
    ok: true,
    mensaje: datos ? 'Tienes una caja abierta' : 'No tienes una caja abierta',
    datos,
  });
}

// POST /api/cajas/:id/cerrar
async function cerrar(req, res) {
  const datos = await servicio.cerrar(req.params.id, req.usuario, req.body);
  res.json({
    ok: true,
    mensaje: 'Caja cerrada. Arqueo realizado.',
    datos,
  });
}

// GET /api/cajas?usuario_id=&estado=&desde=&hasta=  (admin)
async function listar(req, res) {
  const datos = await servicio.listar({
    usuario_id: req.query.usuario_id,
    estado: req.query.estado,
    desde: req.query.desde,
    hasta: req.query.hasta,
  });
  res.json({ ok: true, datos });
}

// GET /api/cajas/:id  (admin o el dueño de la caja)
async function obtener(req, res) {
  const datos = await servicio.obtenerDetalle(req.params.id, req.usuario);
  res.json({ ok: true, datos });
}

module.exports = { abrir, abierta, cerrar, listar, obtener };
