// ============================================================
//  Middlewares de autenticacion y permisos
// ------------------------------------------------------------
//  verificarToken: revisa que la peticion traiga un token JWT
//  valido y guarda los datos del usuario en req.usuario.
//
//  soloRoles: deja pasar solo a los roles indicados.
//
//  Se usan en cadena, por ejemplo:
//      router.get('/', verificarToken, soloRoles('administrador'), listar)
// ============================================================

const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { ErrorHttp } = require('../utils/http');

// ------------------------------------------------------------
// 1) Verifica el token que viene en:
//      Authorization: Bearer <token>
//
//  Despues de validar la firma, consultamos la base para saber
//  si el usuario sigue activo y cual es su rol ACTUAL.
//  ¿Por que? Porque el token dura 8 horas: si el administrador
//  desactiva a un cajero, no queremos que siga entrando con el
//  token viejo. La base de datos siempre tiene la ultima palabra.
// ------------------------------------------------------------
async function verificarToken(req, res, next) {
  const cabecera = req.headers.authorization || '';
  const [tipo, token] = cabecera.split(' ');

  if (tipo !== 'Bearer' || !token) {
    throw new ErrorHttp(401, 'Falta el token. Envia el header: Authorization: Bearer <token>');
  }

  let datosToken;
  try {
    // jwt.verify lanza error si el token fue modificado o ya vencio.
    datosToken = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new ErrorHttp(401, 'Token invalido o vencido. Inicia sesion de nuevo.');
  }

  // El token dice quien sos; la base dice si podes seguir y con que rol.
  const { rows } = await query(
    'SELECT id, nombre, usuario, rol, sucursal_id, activo FROM usuarios WHERE id = $1',
    [datosToken.id]
  );

  const usuario = rows[0];
  if (!usuario || !usuario.activo) {
    throw new ErrorHttp(401, 'Tu sesion ya no es valida. Inicia sesion de nuevo.');
  }

  // Usamos los datos frescos de la base, no los del token.
  req.usuario = {
    id: usuario.id,
    nombre: usuario.nombre,
    usuario: usuario.usuario,
    rol: usuario.rol,
    sucursal_id: usuario.sucursal_id,
  };

  next();
}

// ------------------------------------------------------------
// 2) Restringe el acceso por rol.
//    Uso: soloRoles('administrador')
//        soloRoles('cajero', 'administrador')
// ------------------------------------------------------------
function soloRoles(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      throw new ErrorHttp(401, 'Debes iniciar sesion.');
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      throw new ErrorHttp(
        403,
        `Acceso denegado. Esta accion es solo para: ${rolesPermitidos.join(', ')}.`
      );
    }

    next();
  };
}

module.exports = { verificarToken, soloRoles };
