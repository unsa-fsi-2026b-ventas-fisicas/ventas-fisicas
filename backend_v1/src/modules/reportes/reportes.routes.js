// ============================================================
//  RUTAS DE REPORTES
// ------------------------------------------------------------
//  Solo administrador: un cajero no debe ver la facturacion
//  de la empresa ni la de sus companeros.
// ============================================================

const { Router } = require('express');
const controlador = require('./reportes.controller');

const rutas = Router();

rutas.get('/resumen', controlador.resumen);
rutas.get('/productos', controlador.productos);
rutas.get('/por-sucursal', controlador.porSucursal);
rutas.get('/por-cajero', controlador.porCajero);
rutas.get('/por-dia', controlador.porDia);

module.exports = rutas;
