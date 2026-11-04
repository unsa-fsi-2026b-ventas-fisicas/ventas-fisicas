// ============================================================
//  RUTAS DE CLIENTES
// ------------------------------------------------------------
//  Consultar, crear y editar: cajero y administrador.
//  El cajero necesita registrar al cliente en el mostrador
//  (por ejemplo, para emitir una factura con RUC).
//  No hay DELETE: una venta historica apunta a ese cliente.
// ============================================================

const { Router } = require('express');
const controlador = require('./clientes.controller');

const rutas = Router();

rutas.get('/', controlador.listar);
rutas.get('/:id', controlador.obtener);
rutas.post('/', controlador.crear);
rutas.put('/:id', controlador.actualizar);

module.exports = rutas;
