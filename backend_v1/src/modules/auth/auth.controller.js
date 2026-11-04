// ============================================================
//  CONTROLADOR DE AUTH
// ------------------------------------------------------------
//  Su unico trabajo es leer la peticion (req) y responder (res).
//  La logica de verdad esta en auth.service.js.
//  Si algo falla, "lanza" el error y el manejador central responde.
// ============================================================

const servicio = require('./auth.service');

// POST /api/auth/login
async function login(req, res) {
  const { usuario, password } = req.body;

  const datos = await servicio.login(usuario, password);

  res.json({
    ok: true,
    mensaje: 'Sesion iniciada',
    datos, // { token, usuario: { id, nombre, usuario, rol } }
  });
}

// GET /api/auth/yo  (requiere token)
async function yo(req, res) {
  // req.usuario lo puso el middleware verificarToken
  const usuario = await servicio.obtenerPerfil(req.usuario.id);

  res.json({ ok: true, datos: usuario });
}

module.exports = { login, yo };
