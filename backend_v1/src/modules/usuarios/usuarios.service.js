// ============================================================
//  SERVICIO DE USUARIOS
// ------------------------------------------------------------
//  Toda la logica del CRUD de usuarios y las validaciones.
//  Regla de oro: el password_hash NUNCA sale en una respuesta.
// ============================================================

const bcrypt = require('bcryptjs');
const { query } = require('../../config/db');
const { ErrorHttp } = require('../../utils/http');

const ROLES_VALIDOS = ['cajero', 'administrador'];

// Columnas publicas: las unicas que se devuelven al frontend
const CAMPOS_PUBLICOS = 'id, nombre, usuario, rol, sucursal_id, activo, creado_en';

// ------------------------------------------------------------
// Validaciones reutilizables
// ------------------------------------------------------------
function validarNombre(nombre) {
  if (!nombre || String(nombre).trim().length < 2) {
    throw new ErrorHttp(400, 'El nombre debe tener al menos 2 caracteres.');
  }
}

function validarUsuarioDeLogin(usuario) {
  if (!usuario || String(usuario).trim().length < 3) {
    throw new ErrorHttp(400, 'El nombre de usuario debe tener al menos 3 caracteres.');
  }
  if (/\s/.test(usuario)) {
    throw new ErrorHttp(400, 'El nombre de usuario no puede tener espacios.');
  }
}

function validarPassword(password) {
  if (!password || String(password).length < 6) {
    throw new ErrorHttp(400, 'La contrasena debe tener al menos 6 caracteres.');
  }
}

function validarRol(rol) {
  if (!ROLES_VALIDOS.includes(rol)) {
    throw new ErrorHttp(400, `Rol invalido. Debe ser: ${ROLES_VALIDOS.join(' o ')}.`);
  }
}

// La sucursal es opcional (el administrador puede no tener),
// pero si viene, tiene que existir y estar activa.
async function validarSucursal(sucursalId) {
  if (sucursalId === undefined || sucursalId === null || sucursalId === '') {
    return null;
  }

  const id = Number(sucursalId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ErrorHttp(400, 'El campo sucursal_id debe ser un numero entero.');
  }

  const { rows } = await query(
    'SELECT id FROM sucursales WHERE id = $1 AND activo = TRUE',
    [id]
  );

  if (!rows[0]) {
    throw new ErrorHttp(404, 'La sucursal indicada no existe o esta inactiva.');
  }

  return id;
}

// ------------------------------------------------------------
// LISTAR (con filtros opcionales por texto y por rol)
// ------------------------------------------------------------
async function listar(filtros = {}) {
  let sql = `SELECT ${CAMPOS_PUBLICOS} FROM usuarios WHERE 1 = 1`;
  const parametros = [];

  if (filtros.q) {
    parametros.push(`%${filtros.q}%`);
    sql += ` AND (nombre ILIKE $${parametros.length} OR usuario ILIKE $${parametros.length})`;
  }

  if (filtros.rol) {
    validarRol(filtros.rol);
    parametros.push(filtros.rol);
    sql += ` AND rol = $${parametros.length}`;
  }

  sql += ' ORDER BY id';

  const { rows } = await query(sql, parametros);
  return rows;
}

// ------------------------------------------------------------
// OBTENER UNO
// ------------------------------------------------------------
async function obtener(id) {
  const { rows } = await query(
    `SELECT ${CAMPOS_PUBLICOS} FROM usuarios WHERE id = $1`,
    [id]
  );

  if (!rows[0]) {
    throw new ErrorHttp(404, 'Usuario no encontrado.');
  }

  return rows[0];
}

// ------------------------------------------------------------
// CREAR
// ------------------------------------------------------------
async function crear(datos) {
  const { nombre, usuario, password, rol } = datos;

  validarNombre(nombre);
  validarUsuarioDeLogin(usuario);
  validarPassword(password);
  validarRol(rol);

  const sucursalId = await validarSucursal(datos.sucursal_id);

  // Un cajero sin sucursal no puede abrir caja ni vender.
  if (rol === 'cajero' && !sucursalId) {
    throw new ErrorHttp(400, 'Un cajero debe tener una sucursal asignada.');
  }

  // Guardamos el hash, jamas la contrasena original.
  const hash = await bcrypt.hash(String(password), 10);

  try {
    const { rows } = await query(
      `INSERT INTO usuarios (nombre, usuario, password_hash, rol, sucursal_id)
            VALUES ($1, $2, $3, $4, $5)
         RETURNING ${CAMPOS_PUBLICOS}`,
      [String(nombre).trim(), String(usuario).trim(), hash, rol, sucursalId]
    );
    return rows[0];
  } catch (error) {
    // 23505 = valor duplicado. Lo traducimos a un mensaje util.
    if (error.code === '23505') {
      throw new ErrorHttp(409, 'Ya existe un usuario con ese nombre de login.');
    }
    throw error;
  }
}

// ------------------------------------------------------------
// ACTUALIZAR (parcial: solo cambia lo que llega en el body)
// ------------------------------------------------------------
async function actualizar(id, datos) {
  const actual = await obtener(id); // si no existe, lanza 404

  const cambios = [];
  const valores = [];

  // Pequena ayuda para no repetir el manejo de los parametros $1, $2...
  function agregar(columna, valor) {
    valores.push(valor);
    cambios.push(`${columna} = $${valores.length}`);
  }

  if (datos.nombre !== undefined) {
    validarNombre(datos.nombre);
    agregar('nombre', String(datos.nombre).trim());
  }

  if (datos.rol !== undefined) {
    validarRol(datos.rol);
    agregar('rol', datos.rol);
  }

  // Sucursal: puede venir null para "sin sucursal" (admin)
  let sucursalFinal = actual.sucursal_id;
  if (datos.sucursal_id !== undefined) {
    sucursalFinal = await validarSucursal(datos.sucursal_id);
    agregar('sucursal_id', sucursalFinal);
  }

  // Si despues del cambio el usuario es cajero, no puede quedar sin tienda.
  const rolFinal = datos.rol ?? actual.rol;
  if (rolFinal === 'cajero' && !sucursalFinal) {
    throw new ErrorHttp(400, 'Un cajero debe tener una sucursal asignada.');
  }

  if (datos.activo !== undefined) {
    agregar('activo', Boolean(datos.activo));
  }

  if (datos.password !== undefined) {
    validarPassword(datos.password);
    agregar('password_hash', await bcrypt.hash(String(datos.password), 10));
  }

  if (cambios.length === 0) {
    throw new ErrorHttp(400, 'No enviaste ningun campo para actualizar.');
  }

  valores.push(id);
  const { rows } = await query(
    `UPDATE usuarios
        SET ${cambios.join(', ')}
      WHERE id = $${valores.length}
  RETURNING ${CAMPOS_PUBLICOS}`,
    valores
  );

  return rows[0];
}

// ------------------------------------------------------------
// DESACTIVAR (baja logica)
// ------------------------------------------------------------
async function desactivar(id, idUsuarioLogueado) {
  // Un administrador no deberia poder dejar su propia cuenta sin acceso.
  if (Number(id) === Number(idUsuarioLogueado)) {
    throw new ErrorHttp(400, 'No puedes desactivar tu propia cuenta.');
  }

  await obtener(id);

  const { rows } = await query(
    `UPDATE usuarios
        SET activo = FALSE
      WHERE id = $1
  RETURNING ${CAMPOS_PUBLICOS}`,
    [id]
  );

  return rows[0];
}

module.exports = { listar, obtener, crear, actualizar, desactivar };
