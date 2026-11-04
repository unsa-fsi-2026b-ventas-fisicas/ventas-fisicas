# Guion de defensa — 2 minutos

> Leerlo una vez, practicarlo con cronómetro y decirlo con naturalidad.
> No memorizar palabra por palabra: memorizar el **orden de las ideas**.

---

## Guion (2:00)

### 0:00 – 0:20 · Qué es y con qué está hecho

"Este es el backend del módulo de **ventas físicas** de nuestro ERP.
Está hecho con **Node.js, Express y PostgreSQL**, sin ORM: usamos SQL directo porque
necesitábamos controlar y explicar cada transacción. La API resuelve autenticación por roles,
catálogo, inventario por sucursal, cajas, ventas, devoluciones y reportes."

### 0:20 – 0:45 · El modelo de datos

"El corazón son **doce tablas**. La venta se guarda en `ventas`, sus productos en
`venta_detalle` y los pagos en `pagos`. Hay dos decisiones importantes:
el **stock no está en el producto**, sino en `inventario`, porque cada tienda tiene su propio
stock; y el **precio se copia** a `venta_detalle` como *snapshot*, para que la boleta de ayer
no cambie si hoy sube el precio."

### 0:45 – 1:20 · La venta

"Una venta toca cinco tablas y todo ocurre en **una sola transacción**: o se guarda todo, o no
se guarda nada. Primero verificamos que el cajero tenga **caja abierta**. Después leemos los
productos: el **precio sale de la base**, nunca del frontend. Calculamos el **IGV línea por
línea**, respetando si el producto está afecto o exonerado. Pedimos el **correlativo** de forma
atómica, descontamos stock con un `UPDATE` condicional y recién ahí insertamos la venta.
Si el stock no alcanza, la transacción hace **rollback** y no queda ni la venta ni el número
quemado."

### 1:20 – 1:40 · La caja

"Cada cajero abre su caja con un monto inicial. La base garantiza **una sola caja abierta por
usuario** con un índice único parcial. Al cerrar, el arqueo calcula
`esperado = monto inicial + ventas en efectivo − devoluciones en efectivo`,
y compara con lo contado: **cuadrada, sobrante o faltante**. Solo el efectivo entra al arqueo;
las tarjetas no están en el cajón."

### 1:40 – 2:00 · Cierre

"Para corregir errores están las **anulaciones**, que restituyen stock y sacan la venta de los
reportes, y las **devoluciones parciales**, que reponen stock y acumulan el monto devuelto.
Los reportes son solo para el administrador y siempre trabajan con ventas emitidas y netas de
devoluciones. Eso es todo: un backend simple, transaccional y defendible."

---

## Preguntas frecuentes (para después del guion)

**¿Por qué no usaron un ORM?**
Porque la defensa es sobre el modelo y las transacciones. Con SQL directo mostramos exactamente
qué consulta se ejecuta, qué índice se usa y dónde está el bloqueo. Un ORM lo escondería.

**¿Cómo evitan vender el último producto dos veces?**
El descuento es `UPDATE inventario SET stock = stock - $1 WHERE ... AND stock >= $1`.
La base decide si alcanza. Si no toca ninguna fila, respondemos 409. No hacemos un `SELECT`
previo, porque entre la lectura y la escritura otro cajero podría vender.

**¿Qué pasa si se corta la luz a mitad de una venta?**
La transacción no se confirma: PostgreSQL hace rollback. No queda cabecera sin detalle,
ni stock descontado sin venta.

**¿Por qué el precio no lo manda el frontend?**
Porque cualquiera podría modificar la petición y vender un producto a un sol. El frontend manda
`producto_id` y `cantidad`; el precio y el IGV los pone el backend.

**¿Cómo calculan el IGV si el precio ya lo incluye?**
Por línea: si el producto está afecto, `base = importe / 1.18` e `igv = importe − base`.
Si está exonerado, todo el importe es base. El IGV se calcula por resta para que
`subtotal + igv` sea exactamente `total`, sin diferencias de un céntimo.

**¿Por qué el vuelto se guarda aparte?**
Porque en `pagos` guardamos el monto **aplicado** a la venta. Si el cliente paga 20 por un total
de 13.50, en `pagos` van 13.50 y en `ventas.vuelto` van 6.50. Si guardáramos 20, el arqueo
esperaría 20 en el cajón y aparecería un faltante falso.

**¿Cómo garantizan una sola caja abierta?**
Con un índice único parcial:
`CREATE UNIQUE INDEX ... ON cajas (usuario_id) WHERE estado = 'abierta'`.
Un `if` en el código puede fallar con dos peticiones simultáneas; el índice no.

**¿Qué pasa si anulan una venta que ya tuvo una devolución parcial?**
Se restituye al stock solo lo que falta devolver (`cantidad − cantidad_devuelta`), no todo.
Así no se suma dos veces el mismo producto. La venta sale del arqueo y de los reportes.

**¿Por qué no borran productos ni usuarios?**
Porque las ventas históricas los referencian. Si borramos el producto, la boleta de ayer queda
rota. Se desactivan con `activo = false`.

**¿Qué limitaciones tiene?**
No emite comprobantes electrónicos a SUNAT, no maneja notas de crédito ni precios distintos por
sucursal. La devolución solo se permite con la caja de la venta abierta, para no descuadrar un
arqueo ya cerrado. Son mejoras posibles, no fallas del alcance.

---

## Demo en vivo (4 comandos)

```bash
# 1. login del cajero
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"usuario":"cajero1","password":"cajero123"}' | jq -r .datos.token)

# 2. abrir caja
curl -s -X POST http://localhost:3001/api/cajas/abrir \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"monto_inicial":100}' | jq

# 3. vender (2 arroz + 1 coca, paga 20)
curl -s -X POST http://localhost:3001/api/ventas \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"tipo_comprobante":"boleta","items":[{"producto_id":1,"cantidad":2},{"producto_id":2,"cantidad":1}],"pagos":[{"metodo":"efectivo","monto":20}]}' | jq

# 4. ver mi caja (debe mostrar el efectivo neto y el esperado)
curl -s http://localhost:3001/api/cajas/abierta \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Números para la demo:** 2 arroz (4.50 c/u, exonerado) + 1 coca (3.00, afecto) =
**total 12.00**, **subtotal 11.54**, **IGV 0.46**, paga 20 → **vuelto 8.00**.
La caja debe mostrar **esperado 112.00**.
