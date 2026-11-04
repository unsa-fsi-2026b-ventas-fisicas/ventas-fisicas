// ============================================================
//  SERVICIO DE AUTENTICACION
// ------------------------------------------------------------
//  Aca vive la logica del login:
//   1. Buscar al usuario por su nombre de login.
//   2. Comparar la contrasena escrita con el hash guardado.
//   3. Firmar un token JWT con su identidad y su rol.
//
//  El controlador NO sabe nada de bcrypt ni de JWT: solo llama
//  a estas funciones. Eso es separar responsabilidades.
// ============================================================

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../../config/db');
const { ErrorHttp } = require('../../utils/http');

// ------------------------------------------------------------
// Busca un usuario por su nombre de login.
// Devuelve tambien el hash porque lo necesitamos para comparar.
// (Esta funcion es interna: el hash nunca sale en una respuesta.)
// ------------------------------------------------------------
async function buscarPorUsuario(usuario) {
  const { rows } = await query(
    `SELECT id, nombre, usuario, password_hash, rol, activo
       FROM usuarios
      WHERE usuario = $1`,
    [usuario]
  );
  return rows[0] || null;
}

// ------------------------------------------------------------
// Firma el token. El "payload" es lo que viaja dentro del token:
// id, usuario, nombre y rol. NO se pone la contrasena ni datos
// sensibles, porque el token se puede decodificar (no es secreto,
// solo esta firmado: nadie puede modificarlo sin la clave).
// ------------------------------------------------------------
function generarToken(usuario) {
  const secreto = process.env.JWT_SECRET;
  if (!secreto) {
    throw new Error('Falta JWT_SECRET en el archivo .env');
  }

  return jwt.sign(
    {
      id: usuario.id,
      usuario: usuario.usuario,
      nombre: usuario.nombre,
      rol: usuario.rol,
    },
    secreto,
    { expiresIn: process.env.JWT_EXPIRA || '8h' } // el turno de un cajero
  );
}

// ------------------------------------------------------------
// Login completo
// ------------------------------------------------------------
async function login(usuario, password) {
  if (!usuario || !password) {
    throw new ErrorHttp(400, 'Usuario y contrasena son obligatorios.');
  }

  const encontrado = await buscarPorUsuario(String(usuario).trim());

  // Mensaje generico a proposito: no revelamos si el usuario existe
  // o si lo que esta mal es la contrasena. Eso evita que alguien
  // averigue que usuarios tiene el sistema.
  if (!encontrado) {
    throw new ErrorHttp(401, 'Usuario o contrasena incorrectos.');
  }

  if (!encontrado.activo) {
    throw new ErrorHttp(403, 'El usuario esta desactivado. Contacta al administrador.');
  }

  // bcrypt.compare vuelve a calcular el hash de la contrasena escrita
  // y lo compara con el guardado. Nunca se desencripta nada.
  const coincide = await bcrypt.compare(String(password), encontrado.password_hash);
  if (!coincide) {
    throw new ErrorHttp(401, 'Usuario o contrasena incorrectos.');
  }

  const token = generarToken(encontrado);

  return {
    token,
    usuario: {
      id: encontrado.id,
      nombre: encontrado.nombre,
      usuario: encontrado.usuario,
      rol: encontrado.rol,
    },
  };
}

// ------------------------------------------------------------
// Datos del usuario logueado (para que el frontend sepa quien es
// y que menu mostrar). Sale del id que viene dentro del token.
// ------------------------------------------------------------
async function obtenerPerfil(id) {
  const { rows } = await query(
    `SELECT id, nombre, usuario, rol, sucursal_id, activo, creado_en
       FROM usuarios
      WHERE id = $1`,
    [id]
  );

  if (!rows[0]) {
    throw new ErrorHttp(404, 'El usuario del token ya no existe.');
  }

  return rows[0];
}

module.exports = { login, obtenerPerfil };
