// ============================================================
//  RUTAS DE INVENTARIO
// ------------------------------------------------------------
//  Consultar stock: cajero y administrador.
//  Ajustar stock:   solo administrador.
// ============================================================

const { Router } = require('express');
const controlador = require('./inventario.controller');
const { soloRoles } = require('../../middlewares/auth');

const rutas = Router();

rutas.get('/', controlador.listar);

// Ajuste por conteo fisico: fija el stock al valor contado.
rutas.put(
  '/:productoId/:sucursalId',
  soloRoles('administrador'),
  controlador.ajustar
);

module.exports = rutas;
