// ============================================================
//  Generador de hash para contrasenas
// ------------------------------------------------------------
//  Uso (desde backend_v1):
//      npm run hash -- "miClaveSegura"
//
//  Sirve para crear usuarios a mano en la base de datos sin
//  guardar la contrasena en texto plano. Copias el resultado y
//  lo pegas en la columna password_hash.
// ============================================================

const bcrypt = require('bcryptjs');

const clave = process.argv[2];

if (!clave) {
  console.error('Uso: npm run hash -- "miClaveSegura"');
  process.exit(1);
}

// 10 "rondas" es el costo del hash: mas rondas = mas seguro pero mas lento.
// 10 es el valor estandar para una aplicacion normal.
bcrypt.hash(clave, 10).then((hash) => {
  console.log('\nHash generado:\n');
  console.log(hash);
  console.log('\nCopia ese texto en la columna password_hash.\n');
});
