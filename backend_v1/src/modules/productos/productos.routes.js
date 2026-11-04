// ============================================================
//  RUTAS DE PRODUCTOS
// ------------------------------------------------------------
//  Lectura: cajero y administrador (el POS necesita el catalogo).
//  Escritura: solo administrador.
//
//  OJO CON EL ORDEN: las rutas fijas ("/categorias", "/codigo/:x")
//  van ANTES de "/:id". Si pusieramos "/:id" primero, Express
//  tomaria "categorias" como si fuera un id.
// ============================================================

const { Router } = require('express');
const controlador = require('./productos.controller');
const { soloRoles } = require('../../middlewares/auth');

const rutas = Router();

// --- Lectura (cajero y administrador) ---
rutas.get('/', controlador.listar);
rutas.get('/categorias', controlador.categorias);
rutas.get('/codigo/:codigo', controlador.obtenerPorCodigo);
rutas.get('/:id', controlador.obtener);

// --- Escritura (solo administrador) ---
rutas.post('/', soloRoles('administrador'), controlador.crear);
rutas.put('/:id', soloRoles('administrador'), controlador.actualizar);
rutas.delete('/:id', soloRoles('administrador'), controlador.desactivar);

module.exports = rutas;
