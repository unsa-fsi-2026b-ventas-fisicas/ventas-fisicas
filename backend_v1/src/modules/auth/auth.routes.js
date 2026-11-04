// ============================================================
//  RUTAS DE AUTH
// ------------------------------------------------------------
//  POST /api/auth/login   -> publico
//  GET  /api/auth/yo      -> requiere token
// ============================================================

const { Router } = require('express');
const controlador = require('./auth.controller');
const { verificarToken } = require('../../middlewares/auth');

const rutas = Router();

// Login: no lleva verificarToken porque justamente sirve para obtenerlo.
rutas.post('/login', controlador.login);

// "Quien soy": sirve para que el frontend restaure la sesion al recargar.
rutas.get('/yo', verificarToken, controlador.yo);

module.exports = rutas;
