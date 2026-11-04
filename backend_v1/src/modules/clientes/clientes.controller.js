// ============================================================
//  CONTROLADOR DE CLIENTES
// ============================================================

const servicio = require('./clientes.service');

// GET /api/clientes?q=
async function listar(req, res) {
  const datos = await servicio.listar({ q: req.query.q });
  res.json({ ok: true, datos });
}

// GET /api/clientes/:id
async function obtener(req, res) {
  const datos = await servicio.obtener(req.params.id);
  res.json({ ok: true, datos });
}

// POST /api/clientes
async function crear(req, res) {
  const datos = await servicio.crear(req.body);
  res.status(201).json({
    ok: true,
    mensaje: 'Cliente creado correctamente',
    datos,
  });
}

// PUT /api/clientes/:id
async function actualizar(req, res) {
  const datos = await servicio.actualizar(req.params.id, req.body);
  res.json({
    ok: true,
    mensaje: 'Cliente actualizado correctamente',
    datos,
  });
}

module.exports = { listar, obtener, crear, actualizar };
