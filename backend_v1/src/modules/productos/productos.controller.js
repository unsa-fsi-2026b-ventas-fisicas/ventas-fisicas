// ============================================================
//  CONTROLADOR DE PRODUCTOS
//  Traduce HTTP <-> servicio.
// ============================================================

const servicio = require('./productos.service');

// GET /api/productos?q=&categoria=&activo=
async function listar(req, res) {
  const datos = await servicio.listar({
    q: req.query.q,
    categoria: req.query.categoria,
    activo: req.query.activo,
  });

  res.json({ ok: true, datos });
}

// GET /api/productos/categorias
async function categorias(req, res) {
  const datos = await servicio.categorias();
  res.json({ ok: true, datos });
}

// GET /api/productos/codigo/:codigo  (escaneo en el POS)
async function obtenerPorCodigo(req, res) {
  const datos = await servicio.obtenerPorCodigo(req.params.codigo);
  res.json({ ok: true, datos });
}

// GET /api/productos/:id
async function obtener(req, res) {
  const datos = await servicio.obtener(req.params.id);
  res.json({ ok: true, datos });
}

// POST /api/productos
async function crear(req, res) {
  const datos = await servicio.crear(req.body);
  res.status(201).json({
    ok: true,
    mensaje: 'Producto creado correctamente',
    datos,
  });
}

// PUT /api/productos/:id
async function actualizar(req, res) {
  const datos = await servicio.actualizar(req.params.id, req.body);
  res.json({
    ok: true,
    mensaje: 'Producto actualizado correctamente',
    datos,
  });
}

// DELETE /api/productos/:id  (baja logica)
async function desactivar(req, res) {
  const datos = await servicio.desactivar(req.params.id);
  res.json({
    ok: true,
    mensaje: 'Producto desactivado correctamente',
    datos,
  });
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
