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

const rutas = Router();

rutas.post('/', controlador.crear);
rutas.get('/', controlador.listar);
rutas.get('/:id', controlador.obtener);

module.exports = rutas;
