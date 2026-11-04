// ============================================================
//  CONTROLADOR DE USUARIOS
//  Solo traduce HTTP <-> servicio. Nada de SQL aca.
// ============================================================

const servicio = require('./usuarios.service');

// GET /api/usuarios?q=&rol=
async function listar(req, res) {
  const datos = await servicio.listar({
    q: req.query.q,
    rol: req.query.rol,
  });

  res.json({ ok: true, datos });
}

// GET /api/usuarios/:id
async function obtener(req, res) {
  const datos = await servicio.obtener(req.params.id);
  res.json({ ok: true, datos });
}

// POST /api/usuarios
async function crear(req, res) {
  const datos = await servicio.crear(req.body);
  res.status(201).json({
    ok: true,
    mensaje: 'Usuario creado correctamente',
    datos,
  });
}

// PUT /api/usuarios/:id
async function actualizar(req, res) {
  const datos = await servicio.actualizar(req.params.id, req.body);
  res.json({
    ok: true,
    mensaje: 'Usuario actualizado correctamente',
    datos,
  });
}

// DELETE /api/usuarios/:id  (baja logica: activo = false)
async function desactivar(req, res) {
  // req.usuario viene del token; sirve para impedir auto-desactivarse.
  const datos = await servicio.desactivar(req.params.id, req.usuario.id);
  res.json({
    ok: true,
    mensaje: 'Usuario desactivado correctamente',
    datos,
  });
}

module.exports = { listar, obtener, crear, actualizar, desactivar };
