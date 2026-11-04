// ============================================================
//  CONTROLADOR DE VENTAS
// ------------------------------------------------------------
//  Delgado a proposito: recibe la peticion, llama al servicio
//  y responde. Toda la logica (transaccion, IGV, stock) vive en
//  el servicio, que es lo que se explica en la defensa.
// ============================================================

const servicio = require('./ventas.service');

// POST /api/ventas
async function crear(req, res) {
  const datos = await servicio.crear(req.usuario, req.body);

  res.status(201).json({
    ok: true,
    mensaje: 'Venta registrada correctamente',
    datos,
  });
}

// GET /api/ventas?estado=&desde=&hasta=&usuario_id=
async function listar(req, res) {
  const datos = await servicio.listar(req.usuario, {
    estado: req.query.estado,
    desde: req.query.desde,
    hasta: req.query.hasta,
    usuario_id: req.query.usuario_id,
  });

  res.json({ ok: true, datos });
}

// GET /api/ventas/:id
async function obtener(req, res) {
  const datos = await servicio.obtener(req.params.id, req.usuario);
  res.json({ ok: true, datos });
}

module.exports = { crear, listar, obtener };
