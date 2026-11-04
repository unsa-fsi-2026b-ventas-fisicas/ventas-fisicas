// ============================================================
//  RUTAS DE CAJAS
// ------------------------------------------------------------
//  Abrir / consultar / cerrar: cajero y administrador.
//  Historial completo: solo administrador.
//
//  OJO CON EL ORDEN: "/abierta" va antes de "/:id", si no
//  Express intentaria leer "abierta" como un id numerico.
// ============================================================

const { Router } = require('express');
const controlador = require('./cajas.controller');
const { soloRoles } = require('../../middlewares/auth');

const rutas = Router();

rutas.post('/abrir', controlador.abrir);
rutas.get('/abierta', controlador.abierta);
rutas.post('/:id/cerrar', controlador.cerrar);

rutas.get('/', soloRoles('administrador'), controlador.listar);
rutas.get('/:id', controlador.obtener);

module.exports = rutas;
