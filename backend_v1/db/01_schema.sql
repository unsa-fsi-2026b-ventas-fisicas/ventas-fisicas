-- ============================================================
--  BASE DE DATOS: ventas_fisicas
--  Modulo "Ventas Fisicas" (POS) - ERP Academico UNSA
-- ------------------------------------------------------------
--  Como ejecutarlo (desde la carpeta backend_v1):
--      createdb ventas_fisicas
--      psql -d ventas_fisicas -f db/01_schema.sql
--      psql -d ventas_fisicas -f db/02_seed.sql
--
--  OJO: este script borra y vuelve a crear las tablas.
--  Sirve para reiniciar la demo las veces que haga falta.
--
--  Regla de oro del dinero: los montos se guardan con NUMERIC
--  (nunca con float), porque NUMERIC es exacto y float no.
-- ============================================================

-- ------------------------------------------------------------
--  LIMPIEZA
--  Se borran en orden inverso a las dependencias: primero las
--  tablas "hijas" y al final las "padres". CASCADE elimina los
--  objetos que dependan de ellas.
-- ------------------------------------------------------------
DROP TABLE IF EXISTS devolucion_detalle CASCADE;
DROP TABLE IF EXISTS devoluciones        CASCADE;
DROP TABLE IF EXISTS pagos               CASCADE;
DROP TABLE IF EXISTS venta_detalle       CASCADE;
DROP TABLE IF EXISTS ventas              CASCADE;
DROP TABLE IF EXISTS correlativos        CASCADE;
DROP TABLE IF EXISTS cajas               CASCADE;
DROP TABLE IF EXISTS inventario          CASCADE;
DROP TABLE IF EXISTS productos           CASCADE;
DROP TABLE IF EXISTS clientes            CASCADE;
DROP TABLE IF EXISTS usuarios            CASCADE;
DROP TABLE IF EXISTS sucursales          CASCADE;

-- ============================================================
-- 1. SUCURSALES (las tiendas fisicas)
-- ============================================================
CREATE TABLE sucursales (
  id         SERIAL PRIMARY KEY,
  nombre     VARCHAR(100) NOT NULL,
  direccion  VARCHAR(200),
  activo     BOOLEAN      NOT NULL DEFAULT TRUE,
  creado_en  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. USUARIOS Y ROLES
--  La contrasena nunca se guarda en texto plano: se guarda su
--  hash (bcrypt). Ni el administrador puede leer la original.
--
--  sucursal_id: la tienda donde trabaja el usuario.
--   - Un CAJERO siempre debe tener sucursal: abre su caja ahi
--     y todas sus ventas pertenecen a esa tienda.
--   - Un ADMINISTRADOR puede no tenerla (trabaja en varias).
-- ============================================================
CREATE TABLE usuarios (
  id             SERIAL PRIMARY KEY,
  nombre         VARCHAR(120) NOT NULL,
  usuario        VARCHAR(50)  NOT NULL UNIQUE,  -- nombre de login
  password_hash  VARCHAR(100) NOT NULL,
  rol            VARCHAR(20)  NOT NULL CHECK (rol IN ('cajero', 'administrador')),
  sucursal_id    INT          REFERENCES sucursales(id),
  activo         BOOLEAN      NOT NULL DEFAULT TRUE,
  creado_en      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. PRODUCTOS
--  Campos pensados para cubrir varios escenarios de tienda:
--   - codigo_barras : lo que lee el escaner (unico)
--   - marca / categoria / presentacion : para buscar y mostrar
--   - unidad_medida : como se vende (unidad, kg, litro, caja...)
--   - afecto_igv    : FALSE si el producto esta exonerado del IGV
--                     (ej. arroz, pan, leche: alimentos basicos)
--   - activo        : baja logica, nunca se borra un producto
--  El precio de venta incluye IGV cuando afecto_igv = TRUE.
--  Si afecto_igv = FALSE, el precio es el total (no lleva IGV).
-- ============================================================
CREATE TABLE productos (
  id             SERIAL PRIMARY KEY,
  codigo_barras  VARCHAR(50)   NOT NULL UNIQUE,
  nombre         VARCHAR(150)  NOT NULL,
  descripcion    VARCHAR(250),
  marca          VARCHAR(80),
  categoria      VARCHAR(80),
  presentacion   VARCHAR(50),   -- texto para el ticket: "1 kg", "500 ml", "x4"
  unidad_medida  VARCHAR(10)   NOT NULL DEFAULT 'unidad'
                 CHECK (unidad_medida IN ('unidad', 'kg', 'litro', 'caja', 'paquete')),
  precio_venta   NUMERIC(10,2) NOT NULL CHECK (precio_venta >= 0),
  costo          NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (costo >= 0),
  afecto_igv     BOOLEAN       NOT NULL DEFAULT TRUE,
  activo         BOOLEAN       NOT NULL DEFAULT TRUE,
  creado_en      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. INVENTARIO (stock por producto y por sucursal)
--  La clave primaria es compuesta: un producto tiene UNA fila
--  por cada sucursal donde se vende.
-- ============================================================
CREATE TABLE inventario (
  producto_id   INT     NOT NULL REFERENCES productos(id),
  sucursal_id   INT     NOT NULL REFERENCES sucursales(id),
  stock         INT     NOT NULL DEFAULT 0 CHECK (stock >= 0),
  stock_minimo  INT     NOT NULL DEFAULT 5 CHECK (stock_minimo >= 0),
  PRIMARY KEY (producto_id, sucursal_id)
);

-- ============================================================
-- 5. CLIENTES
--  La venta puede ser con "cliente generico": en ese caso la
--  venta guarda cliente_id = NULL. Si es factura, el backend
--  exige un cliente con RUC (se valida en el servicio de ventas).
-- ============================================================
CREATE TABLE clientes (
  id               SERIAL PRIMARY KEY,
  tipo_documento   VARCHAR(3)   NOT NULL CHECK (tipo_documento IN ('DNI', 'RUC')),
  numero_documento VARCHAR(20)  NOT NULL UNIQUE,
  nombre           VARCHAR(150) NOT NULL,
  telefono         VARCHAR(20),
  creado_en        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. CAJAS (turnos de caja)
--  Cada cajero abre una caja con un monto inicial y la cierra
--  contando el dinero. La diferencia es el "arqueo".
-- ============================================================
CREATE TABLE cajas (
  id              SERIAL PRIMARY KEY,
  usuario_id      INT           NOT NULL REFERENCES usuarios(id),
  sucursal_id     INT           NOT NULL REFERENCES sucursales(id),
  monto_inicial   NUMERIC(10,2) NOT NULL CHECK (monto_inicial >= 0),
  estado          VARCHAR(10)   NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'cerrada')),
  abierta_en      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  cerrada_en      TIMESTAMPTZ,
  total_efectivo  NUMERIC(10,2),  -- ventas cobradas en efectivo durante el turno
  total_esperado  NUMERIC(10,2),  -- monto_inicial + total_efectivo
  monto_contado   NUMERIC(10,2),  -- lo que el cajero conto fisicamente
  diferencia      NUMERIC(10,2)   -- contado - esperado
);

-- Regla: un cajero no puede tener dos cajas abiertas a la vez.
-- Este indice UNIQUE "parcial" solo vigila las filas con estado 'abierta'.
CREATE UNIQUE INDEX ux_caja_abierta_por_usuario
  ON cajas (usuario_id)
  WHERE estado = 'abierta';

-- ============================================================
-- 7. CORRELATIVOS (numeracion de comprobantes)
--  Por cada tipo de comprobante y serie guardamos el ultimo
--  numero usado. Se incrementa DENTRO de la transaccion de venta,
--  asi dos cajeros nunca obtienen el mismo numero.
--  Ejemplo: ticket T001 -> 00000001, 00000002...
-- ============================================================
CREATE TABLE correlativos (
  tipo_comprobante VARCHAR(10) NOT NULL CHECK (tipo_comprobante IN ('ticket', 'boleta', 'factura')),
  serie            VARCHAR(4)  NOT NULL,
  ultimo_numero    INT         NOT NULL DEFAULT 0,
  PRIMARY KEY (tipo_comprobante, serie)
);

-- ============================================================
-- 8. VENTAS (cabecera del comprobante)
--  subtotal = base imponible (total SIN IGV)
--  igv      = 18% del valor de venta
--  total    = lo que paga el cliente (con IGV)
--  Como los precios ya incluyen IGV:
--      total    = suma de las lineas
--      subtotal = total / 1.18
--      igv      = total - subtotal
-- ============================================================
CREATE TABLE ventas (
  id                SERIAL PRIMARY KEY,
  tipo_comprobante  VARCHAR(10)   NOT NULL CHECK (tipo_comprobante IN ('ticket', 'boleta', 'factura')),
  serie             VARCHAR(4)    NOT NULL,
  numero            INT           NOT NULL,
  cliente_id        INT           REFERENCES clientes(id),   -- NULL = cliente generico
  usuario_id        INT           NOT NULL REFERENCES usuarios(id),
  caja_id           INT           NOT NULL REFERENCES cajas(id),
  sucursal_id       INT           NOT NULL REFERENCES sucursales(id),
  subtotal          NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
  igv               NUMERIC(10,2) NOT NULL CHECK (igv >= 0),
  total             NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  estado            VARCHAR(10)   NOT NULL DEFAULT 'emitida' CHECK (estado IN ('emitida', 'anulada')),
  motivo_anulacion  VARCHAR(300),
  anulada_por       INT           REFERENCES usuarios(id),
  anulada_en        TIMESTAMPTZ,
  creada_en         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  -- Dos comprobantes no pueden repetir tipo + serie + numero
  UNIQUE (tipo_comprobante, serie, numero)
);

-- ============================================================
-- 9. DETALLE DE VENTA (los items del comprobante)
--  Guardamos el precio_unitario COPIADO del producto: es un
--  "snapshot". Si manana cambia el precio, la venta de hoy no
--  se altera.
-- ============================================================
CREATE TABLE venta_detalle (
  id                SERIAL PRIMARY KEY,
  venta_id          INT           NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id       INT           NOT NULL REFERENCES productos(id),
  cantidad          INT           NOT NULL CHECK (cantidad > 0),
  precio_unitario   NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0),
  total_linea       NUMERIC(10,2) NOT NULL CHECK (total_linea >= 0), -- cantidad * precio_unitario
  afecto_igv        BOOLEAN       NOT NULL DEFAULT TRUE,             -- copiado del producto (snapshot)
  cantidad_devuelta INT           NOT NULL DEFAULT 0 CHECK (cantidad_devuelta >= 0),
  CHECK (cantidad_devuelta <= cantidad)
);

-- ============================================================
-- 10. PAGOS
--  Una venta puede tener varios pagos (pago mixto simple):
--  por ejemplo 20 en efectivo + 10 con tarjeta.
-- ============================================================
CREATE TABLE pagos (
  id        SERIAL PRIMARY KEY,
  venta_id  INT           NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  metodo    VARCHAR(10)   NOT NULL CHECK (metodo IN ('efectivo', 'tarjeta', 'billetera')),
  monto     NUMERIC(10,2) NOT NULL CHECK (monto > 0)
);

-- ============================================================
-- 11. DEVOLUCIONES
--  Se permite devolucion parcial (algunos items) o total.
--  No se borra nada: se registra el hecho y sube el stock.
-- ============================================================
CREATE TABLE devoluciones (
  id          SERIAL PRIMARY KEY,
  venta_id    INT           NOT NULL REFERENCES ventas(id),
  usuario_id  INT           NOT NULL REFERENCES usuarios(id),
  motivo      VARCHAR(300)  NOT NULL,
  total       NUMERIC(10,2) NOT NULL DEFAULT 0,
  creada_en   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE devolucion_detalle (
  id                SERIAL PRIMARY KEY,
  devolucion_id     INT           NOT NULL REFERENCES devoluciones(id) ON DELETE CASCADE,
  venta_detalle_id  INT           NOT NULL REFERENCES venta_detalle(id),
  cantidad          INT           NOT NULL CHECK (cantidad > 0),
  monto             NUMERIC(10,2) NOT NULL CHECK (monto >= 0) -- cantidad * precio_unitario
);

-- ============================================================
--  INDICES BASICOS
--  PostgreSQL indexa solo las PRIMARY KEY y las UNIQUE.
--  Las llaves foraneas NO se indexan solas, y las usamos mucho
--  para reportes, asi que las creamos a mano.
-- ============================================================
CREATE INDEX idx_usuarios_sucursal       ON usuarios (sucursal_id);
CREATE INDEX idx_productos_nombre        ON productos (nombre);        -- busqueda por nombre
CREATE INDEX idx_productos_marca         ON productos (marca);         -- busqueda por marca
CREATE INDEX idx_productos_categoria     ON productos (categoria);     -- filtro del catalogo
CREATE INDEX idx_productos_activo        ON productos (activo);        -- filtro de vigentes
CREATE INDEX idx_inventario_sucursal     ON inventario (sucursal_id);  -- stock por tienda
CREATE INDEX idx_ventas_fecha            ON ventas (creada_en);        -- ventas del dia
CREATE INDEX idx_ventas_usuario          ON ventas (usuario_id);       -- ventas por cajero
CREATE INDEX idx_ventas_estado           ON ventas (estado);           -- solo emitidas
CREATE INDEX idx_venta_detalle_venta     ON venta_detalle (venta_id);
CREATE INDEX idx_venta_detalle_producto  ON venta_detalle (producto_id); -- mas vendidos
CREATE INDEX idx_pagos_venta             ON pagos (venta_id);
CREATE INDEX idx_clientes_nombre         ON clientes (nombre);
