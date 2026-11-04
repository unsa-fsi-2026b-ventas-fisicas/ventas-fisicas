// ============================================================
//  RUTAS DE USUARIOS
// ------------------------------------------------------------
//  Todo este modulo es solo para administradores.
//  El control de token y rol se aplica al montar la ruta en
//  app.js:  app.use('/api/usuarios', verificarToken, soloRoles('administrador'), ...)
// ============================================================

const { Router } = require('express');
const controlador = require('./usuarios.controller');

const rutas = Router();

rutas.get('/', controlador.listar);
rutas.get('/:id', controlador.obtener);
rutas.post('/', controlador.crear);
rutas.put('/:id', controlador.actualizar);
rutas.delete('/:id', controlador.desactivar);

module.exports = rutas;
