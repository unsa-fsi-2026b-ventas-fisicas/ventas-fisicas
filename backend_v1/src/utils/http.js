// ============================================================
//  Error controlado de la API
// ------------------------------------------------------------
//  Cuando algo sale mal (por ejemplo "no hay stock"), lanzamos
//  un ErrorHttp con el codigo HTTP y un mensaje claro.
//  El manejador central de errores lo convierte en JSON.
// ============================================================

class ErrorHttp extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.codigo = codigo; // 400, 401, 403, 404, 409...
  }
}

module.exports = { ErrorHttp };
