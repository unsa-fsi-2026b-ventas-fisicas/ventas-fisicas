// ============================================================
//  Conexion a PostgreSQL
// ------------------------------------------------------------
//  Usamos un "pool" (piscina) de conexiones.
//  Abrir una conexion nueva a la base de datos es lento; el pool
//  mantiene varias abiertas y las va prestando a cada peticion.
//  Asi la API puede atender a varios cajeros al mismo tiempo.
// ============================================================

require('dotenv').config({ quiet: true });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'ventas_fisicas',
  max: 10,                   // maximo de conexiones simultaneas
  idleTimeoutMillis: 30000,  // cierra una conexion si estuvo 30s sin usarse
});

// Si el pool pierde una conexion (por ejemplo, reiniciaron PostgreSQL),
// avisamos por consola en vez de que el proceso explote sin explicacion.
pool.on('error', (error) => {
  console.error('[db] Error inesperado en una conexion del pool:', error.message);
});

// Atajo para consultas sueltas (sin transaccion).
// Devuelve el resultado de pg: { rows, rowCount }.
function query(texto, parametros) {
  return pool.query(texto, parametros);
}

// ------------------------------------------------------------
// TRANSACCION: "todo o nada"
// ------------------------------------------------------------
// Recibe una funcion y le pasa un cliente dedicado.
// - Si la funcion termina bien  -> COMMIT  (se guarda todo)
// - Si lanza cualquier error    -> ROLLBACK (no se guardo nada)
// - Pase lo que pase           -> release (devuelve la conexion al pool)
//
// La usamos cuando varias escrituras dependen entre si. Por ejemplo:
// crear un producto Y abrir su stock en cada sucursal. Si falla una,
// no queremos la otra a medias.
// ------------------------------------------------------------
async function transaccion(callback) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await callback(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}

module.exports = { pool, query, transaccion };
