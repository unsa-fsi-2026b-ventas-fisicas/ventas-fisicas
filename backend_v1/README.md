# Backend — Ventas Físicas (POS)

API REST del módulo de **ventas físicas** de un ERP académico (UNSA — Ingeniería de Sistemas).
Cubre autenticación por roles, catálogo, inventario por sucursal, clientes, cajas con arqueo,
ventas con IGV, anulaciones, devoluciones y reportes.

> Todo el dinero se maneja con `NUMERIC(10,2)` en PostgreSQL. Los precios de lista **ya incluyen IGV**.
> El backend calcula el impuesto; el frontend nunca manda precios ni totales.

---

## Stack

| Pieza | Para qué |
|---|---|
| **Node.js + Express 5** | Servidor HTTP y ruteo |
| **PostgreSQL** | Base de datos relacional |
| **pg** | Driver oficial; SQL crudo, sin ORM |
| **cors** | Permite llamadas desde el frontend (otro puerto) |
| **dotenv** | Variables de entorno desde `.env` |
| **bcryptjs** | Hash de contraseñas |
| **jsonwebtoken** | Tokens JWT para sesión |
| **nodemon** (dev) | Reinicio automático al guardar |

**¿Por qué sin ORM?** Porque en la defensa se puede explicar cada consulta SQL, cada transacción
y cada índice directamente en la pizarra. El ORM esconde justo lo que hay que demostrar.

---

## Estructura

```
backend_v1/
├── db/
│   ├── 01_schema.sql          # tablas, llaves, CHECKs, índices
│   └── 02_seed.sql            # datos de prueba (2 sucursales, 8 productos...)
├── docs/
│   ├── diagrama-bd.md         # diagrama ER + explicación de cada tabla
│   ├── diagrama-bd.png/.svg   # modelo ER exportado (y .mmd como fuente)
│   ├── flujo-venta.png/.svg   # secuencia de una venta (y .mmd)
│   ├── guion-defensa.md       # guion de 2 minutos
│   └── coleccion-postman.json # colección importable
├── scripts/
│   └── generar-hash.js        # genera hash bcrypt para el seed
├── src/
│   ├── config/db.js           # pool + helper de transacción
│   ├── middlewares/           # auth (JWT/roles) y errores
│   ├── modules/               # un módulo por dominio
│   │   ├── auth/
│   │   ├── usuarios/
│   │   ├── productos/
│   │   ├── inventario/
│   │   ├── clientes/
│   │   ├── sucursales/
│   │   ├── cajas/
│   │   ├── ventas/
│   │   └── reportes/
│   ├── utils/http.js          # ErrorHttp
│   ├── app.js                 # Express: middlewares y rutas
│   └── server.js              # abre el puerto
├── .env.example
└── package.json
```

Cada módulo respeta la misma división:

- `*.routes.js` → define rutas y quién puede entrar.
- `*.controller.js` → recibe `req`, llama al servicio, responde.
- `*.service.js` → reglas de negocio y SQL.

---

## Puesta en marcha en 5 pasos

Requisitos: Node.js 18+, PostgreSQL 14+ y `psql` en el PATH.

### 1. Crear la base de datos

```bash
createdb ventas_fisicas
```

Si tu usuario no tiene permisos:

```bash
sudo -u postgres createdb ventas_fisicas
```

### 2. Cargar el esquema y los datos de prueba

```bash
cd backend_v1
psql -d ventas_fisicas -f db/01_schema.sql
psql -d ventas_fisicas -f db/02_seed.sql
```

Ambos scripts son idempotentes: se pueden volver a ejecutar (borran y recrean las tablas).

### 3. Configurar las variables de entorno

```bash
cp .env.example .env
```

Edita `.env` con tu usuario y contraseña de PostgreSQL:

```env
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=ventas_fisicas
JWT_SECRET=una_clave_larga_y_secreta
JWT_EXPIRA=8h
```

### 4. Instalar dependencias

```bash
npm install
```

### 5. Arrancar el servidor

```bash
npm run dev      # con reinicio automático
# o
npm start        # modo normal
```

Comprobar que está vivo:

```bash
curl http://localhost:3001/api/health
```

```json
{ "ok": true, "mensaje": "API de Ventas Fisicas funcionando", "baseDatos": "ok" }
```

---

## Usuarios de prueba

| Usuario | Contraseña | Rol | Sucursal |
|---|---|---|---|
| `admin` | `admin123` | administrador | — (todas) |
| `cajero1` | `cajero123` | cajero | 1 — Tienda Principal |
| `cajero2` | `cajero123` | cajero | 2 — Yanahuara |

El login devuelve un token JWT. En Postman se guarda automáticamente como variable de colección.
En `curl`:

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"usuario":"admin","password":"admin123"}' | jq -r .datos.token)
```

---

## Endpoints

Roles: **P** = público, **C** = cajero, **A** = administrador.

### Autenticación

| Método | Ruta | Rol | Body / query |
|---|---|---|---|
| POST | `/api/auth/login` | P | `{"usuario":"admin","password":"admin123"}` |
| GET | `/api/auth/yo` | C, A | — |

### Usuarios (solo admin)

| Método | Ruta | Rol | Body / query |
|---|---|---|---|
| GET | `/api/usuarios` | A | `?rol=cajero&activo=true` |
| GET | `/api/usuarios/:id` | A | — |
| POST | `/api/usuarios` | A | `{"nombre":"Ana","usuario":"ana","password":"clave123","rol":"cajero","sucursal_id":1}` |
| PUT | `/api/usuarios/:id` | A | `{"nombre":"Ana Perez","activo":true}` |
| DELETE | `/api/usuarios/:id` | A | — (desactiva, no borra) |

### Productos e inventario

| Método | Ruta | Rol | Body / query |
|---|---|---|---|
| GET | `/api/productos` | C, A | `?q=coca&categoria=Bebidas&activo=true` |
| GET | `/api/productos/categorias` | C, A | — |
| GET | `/api/productos/codigo/:codigo` | C, A | — |
| GET | `/api/productos/:id` | C, A | — |
| POST | `/api/productos` | A | `{"codigo_barras":"7501234567890","nombre":"Agua 600 ml","precio_venta":2.50,"afecto_igv":true,"unidad_medida":"unidad"}` |
| PUT | `/api/productos/:id` | A | `{"precio_venta":2.80}` |
| DELETE | `/api/productos/:id` | A | — (desactiva) |
| GET | `/api/inventario` | C, A | `?sucursal_id=1&solo_bajo=true` |
| PUT | `/api/inventario/:productoId/:sucursalId` | A | `{"stock":12,"stock_minimo":5}` (conteo físico: fija el valor) |

### Clientes y sucursales

| Método | Ruta | Rol | Body / query |
|---|---|---|---|
| GET | `/api/clientes` | C, A | `?q=pedro` |
| GET | `/api/clientes/:id` | C, A | — |
| POST | `/api/clientes` | C, A | `{"tipo_documento":"DNI","numero_documento":"70123456","nombre":"Pedro Castillo","telefono":"958741236"}` |
| PUT | `/api/clientes/:id` | C, A | `{"telefono":"054-123456"}` |
| GET | `/api/sucursales` | C, A | — |

### Cajas

| Método | Ruta | Rol | Body / query |
|---|---|---|---|
| POST | `/api/cajas/abrir` | C, A | `{"monto_inicial":100}` (el admin agrega `"sucursal_id":2`) |
| GET | `/api/cajas/abierta` | C, A | — (devuelve `datos: null` si no abrió) |
| POST | `/api/cajas/:id/cerrar` | C, A (dueño) | `{"monto_contado":114.50}` |
| GET | `/api/cajas` | A | `?estado=cerrada&desde=2026-11-01&hasta=2026-11-30` |
| GET | `/api/cajas/:id` | A o dueño | — |

### Ventas

| Método | Ruta | Rol | Body / query |
|---|---|---|---|
| POST | `/api/ventas` | C, A | ver ejemplo abajo |
| GET | `/api/ventas` | C, A | `?estado=emitida&desde=2026-11-01&hasta=2026-11-30` |
| GET | `/api/ventas/:id` | C, A (dueño) | — |
| POST | `/api/ventas/:id/anular` | A | `{"motivo":"Cliente devolvio todo el pedido"}` |
| POST | `/api/ventas/:id/devoluciones` | A | `{"motivo":"Producto en mal estado","metodo":"efectivo","items":[{"venta_detalle_id":1,"cantidad":1}]}` |

**Crear venta (boleta con pago mixto):**

```json
{
  "tipo_comprobante": "boleta",
  "cliente_id": 1,
  "items": [
    { "producto_id": 1, "cantidad": 2 },
    { "producto_id": 2, "cantidad": 1 },
    { "producto_id": 3, "cantidad": 3 }
  ],
  "pagos": [
    { "metodo": "efectivo", "monto": 10 },
    { "metodo": "tarjeta", "monto": 3.50 }
  ]
}
```

`tipo_comprobante`: `ticket` | `boleta` | `factura`.
La **factura exige** un cliente con RUC. El cliente es opcional en ticket y boleta.

### Reportes (solo admin)

| Método | Ruta | Rol | Body / query |
|---|---|---|---|
| GET | `/api/reportes/resumen` | A | `?desde=2026-11-01&hasta=2026-11-30` |
| GET | `/api/reportes/productos` | A | `?desde=2026-11-01&hasta=2026-11-30&limite=10` |
| GET | `/api/reportes/por-sucursal` | A | `?desde=2026-11-01&hasta=2026-11-30` |
| GET | `/api/reportes/por-cajero` | A | `?desde=2026-11-01&hasta=2026-11-30` |
| GET | `/api/reportes/por-dia` | A | `?desde=2026-11-01&hasta=2026-11-30` |

Sin fechas, todos los reportes usan **el día de hoy**.

---

## Reglas de negocio que implementa el backend

1. **IGV por línea.** El precio incluye IGV. Si el producto está afecto:
   `base = importe / 1.18`, `igv = importe - base`. Si está exonerado (`afecto_igv = false`),
   todo el importe es base. Se guarda `subtotal`, `igv` y `total` en la venta.
2. **Los precios salen de la base.** El frontend manda producto y cantidad; nunca el precio.
   Además se copia el precio a `venta_detalle` como *snapshot*: si mañana cambia, la boleta de
   ayer no se altera.
3. **No se vende sin caja abierta.** Un cajero solo puede tener una caja abierta (índice único
   parcial en la base) y la venta hereda su sucursal.
4. **Sin sobreventa.** El stock se descuenta con
   `UPDATE ... WHERE stock >= cantidad`. Si no alcanza, no se toca ninguna fila y se responde 409.
5. **Todo o nada.** Cabecera, detalle, pagos, stock y correlativo se guardan en una sola
   transacción. Si algo falla, revierte completo.
6. **Correlativo atómico.** `INSERT ... ON CONFLICT DO UPDATE ultimo_numero + 1`, series
   `T001` / `B001` / `F001`.
7. **Vuelto.** Los pagos se guardan por el monto **aplicado** a la venta. Si el cliente paga de
   más y hay efectivo, el excedente se registra en `ventas.vuelto` y se descuenta del pago en
   efectivo, para que el arqueo cuadre.
8. **Arqueo.**
   `esperado = monto_inicial + ventas en efectivo - devoluciones en efectivo`;
   `diferencia = contado - esperado` → `cuadrada` / `sobrante` / `faltante`.
9. **Anulación.** Solo administrador. Marca la venta como `anulada`, restituye al stock lo que
   aún no se había devuelto y la saca del arqueo y de los reportes.
10. **Devoluciones.** Solo administrador, parciales por ítem, con tope
    `cantidad - cantidad_devuelta`. Restituyen stock y acumulan `ventas.total_devuelto`.
    Solo las devoluciones en **efectivo** restan del arqueo.
11. **Borrados lógicos.** Productos y usuarios se desactivan (`activo = false`), no se borran.
    Los clientes nunca se borran porque una venta histórica los referencia.

---

## Documentación adicional

- [`docs/diagrama-bd.md`](docs/diagrama-bd.md) — diagrama ER, propósito de cada tabla y flujo de una venta.
- [`docs/diagrama-bd.png`](docs/diagrama-bd.png) / [`docs/diagrama-bd.svg`](docs/diagrama-bd.svg) — el modelo ER listo para diapositivas e informe (el `.mmd` es la fuente editable).
- [`docs/flujo-venta.png`](docs/flujo-venta.png) / [`docs/flujo-venta.svg`](docs/flujo-venta.svg) — diagrama de secuencia de una venta.
- [`docs/guion-defensa.md`](docs/guion-defensa.md) — guion de 2 minutos y preguntas frecuentes.
- [`docs/coleccion-postman.json`](docs/coleccion-postman.json) — importar en Postman y ejecutar el flujo completo.

---

## Verificación rápida

```bash
# 1. login
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"usuario":"cajero1","password":"cajero123"}' | jq -r .datos.token)

# 2. abrir caja
curl -X POST http://localhost:3001/api/cajas/abrir \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"monto_inicial":100}'

# 3. vender
curl -X POST http://localhost:3001/api/ventas \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"tipo_comprobante":"boleta","items":[{"producto_id":1,"cantidad":2},{"producto_id":2,"cantidad":1}],"pagos":[{"metodo":"efectivo","monto":20}]}'
```
