// ============================================================
//  RUTAS DE SUCURSALES (solo lectura)
// ============================================================

const { Router } = require('express');
const controlador = require('./sucursales.controller');

const rutas = Router();

rutas.get('/', controlador.listar);

module.exports = rutas;
