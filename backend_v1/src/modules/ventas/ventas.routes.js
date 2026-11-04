// ============================================================
//  RUTAS DE VENTAS
// ------------------------------------------------------------
//  Vender y consultar: cajero y administrador.
//  Los permisos finos (el cajero solo ve sus ventas) se
//  resuelven en el servicio, porque dependen del dueno del dato
//  y no solo del rol. Un middleware no puede saber eso sin
//  consultar la base.
// ============================================================

const { Router } = require('express');
const controlador = require('./ventas.controller');
const { soloRoles } = require('../../middlewares/auth');

const rutas = Router();

rutas.post('/', controlador.crear);
rutas.get('/', controlador.listar);

// Anular y devolver mueven plata y stock: solo el administrador.
// El cajero vende, pero no se auto-autoriza una devolucion.
rutas.post('/:id/anular', soloRoles('administrador'), controlador.anular);
rutas.post('/:id/devoluciones', soloRoles('administrador'), controlador.devolver);

rutas.get('/:id', controlador.obtener);

module.exports = rutas;
