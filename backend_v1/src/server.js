// ============================================================
//  Arranque del servidor
// ------------------------------------------------------------
//  1. Prueba la conexion a la base de datos.
//  2. Si todo esta bien, abre el puerto y queda escuchando.
//  Asi, si la base no responde, nos enteramos al arrancar y no
//  cuando el primer cajero intenta vender.
// ============================================================

require('dotenv').config({ quiet: true });
const app = require('./app');
const { pool } = require('./config/db');

const PUERTO = Number(process.env.PORT) || 3001;

async function arrancar() {
  // Sin clave secreta no se pueden firmar tokens: mejor fallar al arrancar.
  if (!process.env.JWT_SECRET) {
    console.error('[api] Falta JWT_SECRET en el archivo .env');
    process.exit(1);
  }

  try {
    await pool.query('SELECT 1'); // consulta minima: solo prueba la conexion
    console.log('[db]  Conectado a PostgreSQL');
  } catch (error) {
    console.error('[db]  No se pudo conectar a PostgreSQL:', error.message);
    console.error('      Revisa el archivo .env y que el servicio de PostgreSQL este encendido.');
    process.exit(1); // sin base de datos no tiene sentido seguir
  }

  app.listen(PUERTO, () => {
    console.log(`[api] Servidor escuchando en http://localhost:${PUERTO}`);
    console.log(`[api] Prueba de vida:   http://localhost:${PUERTO}/api/health`);
  });
}

arrancar();
