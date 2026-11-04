// ============================================================
//  Manejo central de errores
// ------------------------------------------------------------
//  TODOS los errores terminan aca. Esto tiene una ventaja grande:
//  los controladores solo se preocupan por la logica, y el formato
//  de las respuestas de error queda igual en toda la API.
//
//  Express 5 tiene una ayuda enorme: si un controlador "async"
//  lanza un error (o una promesa se rechaza), Express lo manda
//  automaticamente a este manejador. No hace falta try/catch en
//  cada controlador.
// ============================================================

const { ErrorHttp } = require('../utils/http');

// ------------------------------------------------------------
// 404: nadie atendio esa ruta
// ------------------------------------------------------------
function noEncontrada(req, res) {
  res.status(404).json({
    ok: false,
    mensaje: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
}

// ------------------------------------------------------------
// Manejador central (siempre lleva 4 parametros: err, req, res, next)
// ------------------------------------------------------------
function manejadorErrores(error, req, res, next) {
  // 1. Errores que nosotros lanzamos a proposito
  if (error instanceof ErrorHttp) {
    return res.status(error.codigo).json({ ok: false, mensaje: error.message });
  }

  // 2. El frontend mando un JSON mal formado
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, mensaje: 'El cuerpo de la peticion no es un JSON valido.' });
  }

  // 3. Errores de PostgreSQL: los traducimos a algo entendible.
  //    Estos son los codigos SQLSTATE mas comunes.
  const erroresPostgres = {
    '23505': 'Ese dato ya existe (valor duplicado).',
    '23503': 'El registro relacionado no existe.',
    '23514': 'Un valor no cumple las reglas permitidas.',
    '22P02': 'El formato de un dato es invalido.',
    '23502': 'Falta un dato obligatorio.',
  };
  if (erroresPostgres[error.code]) {
    return res.status(400).json({ ok: false, mensaje: erroresPostgres[error.code] });
  }

  // 4. Cualquier otra cosa: error nuestro, no del usuario.
  //    Se registra completo en consola, pero al cliente no se le
  //    muestran detalles internos.
  console.error('[error]', error);
  return res.status(500).json({ ok: false, mensaje: 'Error interno del servidor.' });
}

module.exports = { noEncontrada, manejadorErrores };
