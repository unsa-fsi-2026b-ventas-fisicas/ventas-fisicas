// ============================================================
//  SERVICIO DE SUCURSALES
//  Por ahora solo lectura: el frontend necesita la lista para
//  elegir tienda al abrir caja o crear un usuario.
// ============================================================

const { query } = require('../../config/db');

async function listar() {
  const { rows } = await query(
    `SELECT id, nombre, direccion
       FROM sucursales
      WHERE activo = TRUE
      ORDER BY id`
  );
  return rows;
}

module.exports = { listar };
