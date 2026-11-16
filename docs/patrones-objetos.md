# Patrones de Objetos - Ventas Físicas

## ¿Qué vamos a resolver?

En el punto de venta, una operación pasa por varias etapas: el cajero agrega productos, consulta disponibilidad, registra un pago y confirma la venta. Además, los datos deben compartirse con otros módulos del ERP.

La idea de aplicar patrones es separar estas responsabilidades para que el código no termine concentrado en una sola clase o lleno de condiciones difíciles de mantener.

> Este diseño es una propuesta inicial. Los estados, las interfaces y los nombres de las clases se ajustarán cuando el equipo acuerde la tecnología y los contratos con los demás módulos.

## 1. State: estados de una venta

**Problema:** una venta no debería poder realizar cualquier operación en cualquier momento. Por ejemplo, una venta anulada no debe cobrarse y una venta ya pagada no debe confirmarse por segunda vez.

**Propuesta:** representar el comportamiento de cada estado por separado, en lugar de usar muchos `if` para manejar todas las transiciones.

Estados iniciales propuestos:

- `Borrador`: el cajero puede agregar, modificar o quitar productos.
- `PendientePago`: ya se preparó la venta y se espera el resultado del cobro.
- `Pagada`: el pago se confirmó y la venta puede vincularse con los registros comunes.
- `Anulada`: la operación se canceló y no puede confirmarse como pagada.

Transiciones de ejemplo:

```text
Borrador ──solicitar cobro──> PendientePago ──pago confirmado──> Pagada
   │                              │
   └──────anular───────────────────┴──────────> Anulada
```

El caso de una devolución será analizado por separado, porque todavía no están acordadas sus reglas.

## 2. Strategy: formas de pago

**Problema:** el proceso de registrar un pago cambia según el medio elegido. No conviene que toda la lógica esté mezclada en el servicio de ventas.

**Propuesta:** una interfaz común para procesar pagos de demostración y una estrategia para cada medio de pago habilitado:

```text
EstrategiaPago
    ├── PagoEfectivoSimulado
    └── PagoTarjetaSimulado
```

Cada estrategia recibe los datos necesarios del pago y devuelve un resultado uniforme: estado (`confirmado` o `rechazado`), monto y referencia de operación.

Para la primera versión, **los pagos son simulados**. No se harán cargos bancarios reales ni se guardarán números completos de tarjetas, CVV u otros datos sensibles.

## 3. Factory: seleccionar la estrategia de pago (opcional)

Si el sistema necesita crear estrategias de pago según un código de medio de pago, una fábrica sencilla puede encargarse de esa selección. No hace falta introducir una jerarquía de fábricas si con una función o clase pequeña se resuelve.

## 4. Adapter: integración con otros módulos (cuando haga falta)

El módulo de Ventas Físicas debe consultar existencias en Almacén, enlazar ventas con el registro común y notificar los cobros a Caja/Finanzas. Si sus interfaces no coinciden con las que necesita nuestro módulo, se puede usar un adaptador para traducirlas.

Esto **no** significa crear nuestros propios maestros de artículos, stock, clientes o registros contables.

Responsabilidades propuestas:

- **Almacén:** catálogo y disponibilidad de artículos; salida de stock cuando corresponda.
- **Ventas compartidas:** identificador oficial de venta, detalle y comprobante.
- **Caja/Finanzas:** cobro confirmado e ingreso asociado a la venta.
- **Distribución:** despacho, solo si la venta requiere entrega a domicilio.

## Reglas que debemos respetar

1. Toda operación debe tener identificado su `empresa_id` para separar información de empresas diferentes.
2. El módulo de caja no debe descontar stock por su cuenta: solicita esa operación al responsable de Almacén.
3. Un cobro confirmado debe estar vinculado con una venta y con la información requerida por Caja/Finanzas.
4. Las operaciones de pago deben tener una referencia identificable, incluso si son simuladas.
5. Los nombres de tablas, endpoints y estructuras no se consideran definitivos hasta que se coordinen con el equipo.

## Casos para demostrar

**Caso correcto:** el cajero arma una venta, se valida la disponibilidad, elige pago en efectivo simulado, recibe una confirmación y la venta pasa a `Pagada`. La operación conserva las referencias necesarias para comunicarla a los demás módulos.

**Caso fallido:** el pago simulado se rechaza o no hay disponibilidad. La venta no debe terminar como `Pagada` ni registrar un ingreso confirmado.

## Acuerdos pendientes con el equipo

- Estados oficiales que utilizarán ventas y pagos.
- Momento en que Almacén reservará o descontará existencias.
- Contratos de comunicación con Ventas compartidas y Caja/Finanzas.
- Reglas para anulaciones, devoluciones y operaciones con varios medios de pago.
