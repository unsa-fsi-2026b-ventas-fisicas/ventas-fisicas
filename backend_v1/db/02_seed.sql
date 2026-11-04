-- ============================================================
--  DATOS DE PRUEBA
--  Modulo "Ventas Fisicas" (POS) - ERP Academico UNSA
-- ------------------------------------------------------------
--  Ejecutar SIEMPRE despues de 01_schema.sql:
--      psql -d ventas_fisicas -f db/02_seed.sql
--
--  Usuarios para iniciar sesion:
--      admin    / admin123     (rol administrador)
--      cajero1  / cajero123    (rol cajero)
--      cajero2  / cajero123    (rol cajero)
--
--  Las contrasenas estan guardadas como hash bcrypt, no en texto
--  plano. Para generar otra:  npm run hash -- "miClave"
-- ============================================================

-- ------------------------------------------------------------
-- SUCURSALES
-- ------------------------------------------------------------
INSERT INTO sucursales (id, nombre, direccion) VALUES
  (1, 'Tienda Principal - Arequipa', 'Av. Independencia 123'),
  (2, 'Sucursal Yanahuara',          'Calle Mercaderes 456');

-- ------------------------------------------------------------
-- USUARIOS
-- ------------------------------------------------------------
INSERT INTO usuarios (id, nombre, usuario, password_hash, rol) VALUES
  (1, 'Administrador del Sistema', 'admin',
      '$2b$10$fV3B9HWHmTrdyQSrcWXX/OgMyEPIAQQZDf/XDWG5cVRgoqc8qHR86', 'administrador'),
  (2, 'Maria Quispe', 'cajero1',
      '$2b$10$9vUvna10l0mQiVnlSXDl/.pm1ks/HwcBLdmODCQSe9YPqoXwnNwOa', 'cajero'),
  (3, 'Luis Huaman', 'cajero2',
      '$2b$10$9vUvna10l0mQiVnlSXDl/.pm1ks/HwcBLdmODCQSe9YPqoXwnNwOa', 'cajero');

-- ------------------------------------------------------------
-- PRODUCTOS (solo 8, pero cada uno cubre un escenario distinto)
--
--   #   Escenario que demuestra
--   1   Exonerado de IGV (alimento basico)
--   2   Afecto a IGV
--   3   Precio bajo (0.50) para vender varias unidades
--   4   Stock bajo en la tienda principal
--   5   Stock bajo en las dos tiendas
--   6   Stock 0 en la sucursal 2 (no se puede vender ahi)
--   7   Producto INACTIVO (baja logica: no aparece en el POS)
--   8   Exonerado, con marca y presentacion completas
--
--   Las marcas son reales; los codigos de barras son ficticios
--   pero con formato EAN-13 valido.
-- ------------------------------------------------------------
INSERT INTO productos
  (id, codigo_barras, nombre, descripcion, marca, categoria, presentacion, unidad_medida, precio_venta, costo, afecto_igv, activo)
VALUES
  (1, '7751234000011', 'Arroz Costeno 1 kg',
      'Bolsa de arroz extra de 1 kg', 'Costeno', 'Abarrotes', '1 kg', 'unidad', 4.50, 3.60, FALSE, TRUE),
  (2, '7751234000059', 'Coca-Cola 500 ml',
      NULL, 'Coca-Cola', 'Bebidas', '500 ml', 'unidad', 3.00, 2.10, TRUE, TRUE),
  (3, '7751234000042', 'Pan frances (unidad)',
      NULL, 'Panaderia propia', 'Panaderia', 'unidad', 'unidad', 0.50, 0.30, FALSE, TRUE),
  (4, '7751234000073', 'Papel higienico Elite x 4',
      'Paquete de 4 rollos doble hoja', 'Elite', 'Limpieza', 'x 4 rollos', 'paquete', 6.90, 5.40, TRUE, TRUE),
  (5, '7751234000103', 'Atun Florida 170 g',
      NULL, 'Florida', 'Abarrotes', '170 g', 'unidad', 4.80, 3.70, FALSE, TRUE),
  (6, '7751234000097', 'Galleta Soda Field',
      NULL, 'Field', 'Snacks', '1 unidad', 'unidad', 1.20, 0.80, TRUE, TRUE),
  (7, '7751234000080', 'Detergente Bolivar 780 g',
      NULL, 'Bolivar', 'Limpieza', '780 g', 'unidad', 8.50, 6.80, TRUE, FALSE),
  (8, '7751234000035', 'Leche Gloria tarro 400 g',
      'Leche evaporada entera', 'Gloria', 'Lacteos', '400 g', 'unidad', 5.20, 4.30, FALSE, TRUE);

-- ------------------------------------------------------------
-- INVENTARIO (stock por sucursal)
--  Dos filas por producto (una por tienda) = 16 filas.
--  Casos armados para la demo:
--   - producto 4: stock 4 < minimo 6   -> stock bajo
--   - producto 5: stock 3 < minimo 8   -> stock bajo en ambas tiendas
--   - producto 6: stock 0 en sucursal 2 -> no se puede vender ahi
-- ------------------------------------------------------------
INSERT INTO inventario (producto_id, sucursal_id, stock, stock_minimo) VALUES
  -- Sucursal 1 (Principal)
  (1, 1, 50, 10), (2, 1, 36, 12), (3, 1,  80, 20), (4, 1, 4, 6),
  (5, 1,  3,  8), (6, 1, 25, 10), (7, 1,  18, 10), (8, 1, 40, 10),
  -- Sucursal 2 (Yanahuara)
  (1, 2, 20, 10), (2, 2, 18, 12), (3, 2,  50, 20), (4, 2, 9, 6),
  (5, 2,  5,  8), (6, 2,  0, 10), (7, 2,   9, 10), (8, 2, 22, 10);

-- ------------------------------------------------------------
-- CLIENTES
-- ------------------------------------------------------------
INSERT INTO clientes (id, tipo_documento, numero_documento, nombre, telefono) VALUES
  (1, 'DNI', '45678912',    'Ana Torres Ramos',           '987654321'),
  (2, 'DNI', '12345678',    'Carlos Mendoza Ruiz',        '912345678'),
  (3, 'RUC', '20123456789', 'Comercial San Martin S.A.C.', '054-123456');

-- ------------------------------------------------------------
-- CORRELATIVOS
--  Arrancan en 0: la primera venta de cada tipo sera la 1.
-- ------------------------------------------------------------
INSERT INTO correlativos (tipo_comprobante, serie, ultimo_numero) VALUES
  ('ticket',  'T001', 0),
  ('boleta',  'B001', 0),
  ('factura', 'F001', 0);

-- ------------------------------------------------------------
-- AJUSTE DE SECUENCIAS
--  Insertamos con id manual para que la demo sea predecible.
--  Con setval le avisamos a PostgreSQL cual fue el ultimo id,
--  para que las proximas inserciones (por la API) no choquen.
-- ------------------------------------------------------------
SELECT setval('sucursales_id_seq', (SELECT MAX(id) FROM sucursales));
SELECT setval('usuarios_id_seq',   (SELECT MAX(id) FROM usuarios));
SELECT setval('productos_id_seq',  (SELECT MAX(id) FROM productos));
SELECT setval('clientes_id_seq',   (SELECT MAX(id) FROM clientes));
