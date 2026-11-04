// ============================================================
//  Configuracion de Express
// ------------------------------------------------------------
//  Este archivo arma la aplicacion: middlewares, rutas y manejo
//  de errores. No abre el puerto; de eso se encarga server.js.
// ------------------------------------------------------------
//  Nota: las variables del archivo .env las carga config/db.js,
//  que es el primer modulo que necesita la configuracion.
// ============================================================

const express = require('express');
const cors = require('cors');
const { query } = require('./config/db');
const { noEncontrada, manejadorErrores } = require('./middlewares/errores');
const { verificarToken, soloRoles } = require('./middlewares/auth');
const rutasAuth = require('./modules/auth/auth.routes');
const rutasUsuarios = require('./modules/usuarios/usuarios.routes');
const rutasProductos = require('./modules/productos/productos.routes');
const rutasInventario = require('./modules/inventario/inventario.routes');
const rutasClientes = require('./modules/clientes/clientes.routes');
const rutasCajas = require('./modules/cajas/cajas.routes');
const rutasSucursales = require('./modules/sucursales/sucursales.routes');
const rutasVentas = require('./modules/ventas/ventas.routes');

const app = express();

// 1) CORS: permite que el frontend (React en http://localhost:5173)
//    llame a esta API que corre en otro puerto. Sin esto, el navegador
//    bloquea la peticion por seguridad.
app.use(cors());

// 2) Lee el cuerpo de las peticiones en formato JSON.
//    Gracias a esto, en los controladores tenemos req.body.
app.use(express.json());

// 3) Ruta de salud: sirve para comprobar que el servidor esta vivo
//    y que la base de datos responde.
app.get('/api/health', async (req, res) => {
  let baseDatos = 'ok';
  try {
    await query('SELECT 1');
  } catch (error) {
    baseDatos = 'sin conexion';
  }

  const estado = baseDatos === 'ok' ? 200 : 503;
  res.status(estado).json({
    ok: baseDatos === 'ok',
    mensaje: 'API de Ventas Fisicas funcionando',
    baseDatos,
    hora: new Date().toISOString(),
  });
});

// 4) Rutas de los modulos.
//    Ojo con el orden de los middlewares: primero se verifica el
//    token (quien sos) y despues el rol (que podes hacer).
app.use('/api/auth', rutasAuth);

// Todo el CRUD de usuarios es exclusivo del administrador.
app.use('/api/usuarios', verificarToken, soloRoles('administrador'), rutasUsuarios);

// Productos e inventario: el token se exige para todo el modulo,
// y adentro de cada archivo de rutas se decide que accion pide admin.
app.use('/api/productos', verificarToken, rutasProductos);
app.use('/api/inventario', verificarToken, rutasInventario);

// Clientes, cajas y sucursales: cajero y administrador.
// Las reglas finas (quien puede ver que caja) viven en el servicio.
app.use('/api/clientes', verificarToken, rutasClientes);
app.use('/api/cajas', verificarToken, rutasCajas);
app.use('/api/sucursales', verificarToken, rutasSucursales);

// Ventas: cajero y administrador. El servicio decide que ve cada uno.
app.use('/api/ventas', verificarToken, rutasVentas);

// 5) Si ninguna ruta coincidio, respondemos 404 en JSON.
app.use(noEncontrada);

// 6) Manejador central de errores (siempre al final).
app.use(manejadorErrores);

module.exports = app;
