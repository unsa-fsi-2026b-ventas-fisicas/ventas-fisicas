// ============================================================
//  SERVICIO DE CLIENTES
// ------------------------------------------------------------
//  El cliente es OPCIONAL en la venta:
//   - venta sin cliente  -> cliente generico (cliente_id NULL)
//   - boleta con DNI     -> cliente con DNI
//   - factura            -> cliente con RUC (se valida en ventas)
//
//  No hay borrado de clientes: una venta historica lo referencia.
// ============================================================

const { query } = require('../../config/db');
const { ErrorHttp } = require('../../utils/http');

const CAMPOS = 'id, tipo_documento, numero_documento, nombre, telefono, creado_en';
const TIPOS_DOCUMENTO = ['DNI', 'RUC'];

// ------------------------------------------------------------
// Validacion del documento segun su tipo
// ------------------------------------------------------------
function validarDocumento(tipo, numero) {
  if (!TIPOS_DOCUMENTO.includes(tipo)) {
    throw new ErrorHttp(400, 'El tipo de documento debe ser DNI o RUC.');
  }

  const limpio = String(numero ?? '').trim();

  if (tipo === 'DNI' && !/^\d{8}$/.test(limpio)) {
    throw new ErrorHttp(400, 'El DNI debe tener exactamente 8 digitos.');
  }

  if (tipo === 'RUC' && !/^\d{11}$/.test(limpio)) {
    throw new ErrorHttp(400, 'El RUC debe tener exactamente 11 digitos.');
  }

  return limpio;
}

function validarNombre(nombre) {
  const limpio = String(nombre ?? '').trim();
  if (limpio.length < 2) {
    throw new ErrorHttp(400, 'El nombre del cliente debe tener al menos 2 caracteres.');
  }
  return limpio;
}

function validarTelefono(telefono) {
  if (telefono === undefined || telefono === null) return null;

  const limpio = String(telefono).trim();
  if (limpio === '') return null;

  // Acepta numeros, espacios, guiones y el signo + (ej. 054-123456)
  if (!/^[0-9+\-\s]{6,20}$/.test(limpio)) {
    throw new ErrorHttp(400, 'El telefono no tiene un formato valido.');
  }

  return limpio;
}

// ------------------------------------------------------------
// LISTAR / BUSCAR
//  ?q= busca por nombre o numero de documento
// ------------------------------------------------------------
async function listar(filtros = {}) {
  let sql = `SELECT ${CAMPOS} FROM clientes`;
  const parametros = [];

  if (filtros.q) {
    parametros.push(`%${filtros.q}%`);
    sql += ` WHERE nombre ILIKE $${parametros.length}
                OR numero_documento ILIKE $${parametros.length}`;
  }

  sql += ' ORDER BY nombre';

  const { rows } = await query(sql, parametros);
  return rows;
}

// ------------------------------------------------------------
// OBTENER
// ------------------------------------------------------------
async function obtener(id) {
  const { rows } = await query(
    `SELECT ${CAMPOS} FROM clientes WHERE id = $1`,
    [id]
  );

  if (!rows[0]) {
    throw new ErrorHttp(404, 'Cliente no encontrado.');
  }

  return rows[0];
}

// ------------------------------------------------------------
// CREAR
// ------------------------------------------------------------
async function crear(datos) {
  const tipo = datos.tipo_documento;
  const numero = validarDocumento(tipo, datos.numero_documento);
  const nombre = validarNombre(datos.nombre);
  const telefono = validarTelefono(datos.telefono);

  try {
    const { rows } = await query(
      `INSERT INTO clientes (tipo_documento, numero_documento, nombre, telefono)
            VALUES ($1, $2, $3, $4)
         RETURNING ${CAMPOS}`,
      [tipo, numero, nombre, telefono]
    );
    return rows[0];
  } catch (error) {
    if (error.code === '23505') {
      throw new ErrorHttp(409, 'Ya existe un cliente con ese numero de documento.');
    }
    throw error;
  }
}

// ------------------------------------------------------------
// ACTUALIZAR (parcial)
// ------------------------------------------------------------
async function actualizar(id, datos) {
  const actual = await obtener(id);

  const cambios = [];
  const valores = [];

  function agregar(columna, valor) {
    valores.push(valor);
    cambios.push(`${columna} = $${valores.length}`);
  }

  // Si cambia el tipo o el numero, validamos la pareja completa
  // (usando lo que ya estaba guardado para el dato que no vino).
  if (datos.tipo_documento !== undefined || datos.numero_documento !== undefined) {
    const tipoFinal = datos.tipo_documento ?? actual.tipo_documento;
    const numeroFinal = validarDocumento(
      tipoFinal,
      datos.numero_documento ?? actual.numero_documento
    );
    agregar('tipo_documento', tipoFinal);
    agregar('numero_documento', numeroFinal);
  }

  if (datos.nombre !== undefined) {
    agregar('nombre', validarNombre(datos.nombre));
  }

  if (datos.telefono !== undefined) {
    agregar('telefono', validarTelefono(datos.telefono));
  }

  if (cambios.length === 0) {
    throw new ErrorHttp(400, 'No enviaste ningun campo para actualizar.');
  }

  valores.push(id);

  try {
    const { rows } = await query(
      `UPDATE clientes
          SET ${cambios.join(', ')}
        WHERE id = $${valores.length}
    RETURNING ${CAMPOS}`,
      valores
    );
    return rows[0];
  } catch (error) {
    if (error.code === '23505') {
      throw new ErrorHttp(409, 'Ya existe otro cliente con ese numero de documento.');
    }
    throw error;
  }
}

module.exports = { listar, obtener, crear, actualizar };
