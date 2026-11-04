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
-- PRODUCTOS
--  Los precios de venta YA INCLUYEN IGV (18%).
--  Los codigos de barras son ficticios pero con formato real (EAN-13).
-- ------------------------------------------------------------
INSERT INTO productos (id, codigo_barras, nombre, categoria, precio_venta, costo) VALUES
  ( 1, '7751234000011', 'Arroz Costeno 1 kg',              'Abarrotes',  4.50, 3.60),
  ( 2, '7751234000028', 'Aceite Primor 1 L',               'Abarrotes',  9.90, 8.20),
  ( 3, '7751234000035', 'Leche Gloria tarro 400 g',        'Lacteos',    5.20, 4.30),
  ( 4, '7751234000042', 'Pan frances (unidad)',            'Panaderia',  0.50, 0.30),
  ( 5, '7751234000059', 'Coca-Cola 500 ml',                'Bebidas',    3.00, 2.10),
  ( 6, '7751234000066', 'Agua San Luis 625 ml',            'Bebidas',    1.50, 0.90),
  ( 7, '7751234000073', 'Papel higienico Elite x 4',       'Limpieza',   6.90, 5.40),
  ( 8, '7751234000080', 'Detergente Bolivar 780 g',        'Limpieza',   8.50, 6.80),
  ( 9, '7751234000097', 'Galleta Soda Field',              'Snacks',     1.20, 0.80),
  (10, '7751234000103', 'Atun Florida 170 g',              'Abarrotes',  4.80, 3.70);

-- ------------------------------------------------------------
-- INVENTARIO (stock por sucursal)
--  A proposito hay casos "interesantes" para la demo:
--   - producto 7: stock bajo en las dos tiendas (4 y 2, minimo 6)
--   - producto 9: stock 0 en la sucursal 2  -> no se puede vender ahi
--   - producto 10: stock bajo (3 y 1)       -> aparece en stock bajo
-- ------------------------------------------------------------
INSERT INTO inventario (producto_id, sucursal_id, stock, stock_minimo) VALUES
  -- Sucursal 1 (Principal)
  ( 1, 1, 50, 10), ( 2, 1, 30, 10), ( 3, 1, 40, 10), ( 4, 1, 100, 20), ( 5, 1, 60, 12),
  ( 6, 1, 80, 12), ( 7, 1,  4,  6), ( 8, 1, 18, 10), ( 9, 1,  25, 10), (10, 1,  3,  8),
  -- Sucursal 2 (Yanahuara)
  ( 1, 2, 20, 10), ( 2, 2, 15, 10), ( 3, 2, 25, 10), ( 4, 2,  60, 20), ( 5, 2, 30, 12),
  ( 6, 2, 40, 12), ( 7, 2,  2,  6), ( 8, 2,  9, 10), ( 9, 2,   0, 10), (10, 2,  1,  8);

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
