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
const { ErrorHttp } = require('../utils/http');

// ------------------------------------------------------------
// 1) Verifica el token que viene en:
//      Authorization: Bearer <token>
// ------------------------------------------------------------
function verificarToken(req, res, next) {
  const cabecera = req.headers.authorization || '';
  const [tipo, token] = cabecera.split(' ');

  if (tipo !== 'Bearer' || !token) {
    throw new ErrorHttp(401, 'Falta el token. Envia el header: Authorization: Bearer <token>');
  }

  try {
    // jwt.verify lanza error si el token fue modificado o ya vencio.
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new ErrorHttp(401, 'Token invalido o vencido. Inicia sesion de nuevo.');
  }

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
