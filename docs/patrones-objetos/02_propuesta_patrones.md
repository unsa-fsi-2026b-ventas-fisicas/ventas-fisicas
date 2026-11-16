# Propuesta de patrones de objetos para Ventas Físicas

**Proyecto:** ERP académico UNSA — módulo de Ventas Físicas  
**Responsabilidad:** Patrones de Objetos  
**Estado:** Diseño conceptual por validar

## 1. Propósito

La intención de esta propuesta es organizar algunas responsabilidades del punto de venta antes de comenzar su implementación. Los patrones seleccionados se relacionan con dos tareas centrales del prototipo: controlar el avance de una venta y registrar un pago de demostración.

Se propone aplicar **State** y **Strategy** como patrones principales. Como apoyo, puede emplearse una **fábrica simple** para seleccionar el procesador de pago. No se exige una clase nueva para cada detalle del sistema: solo se plantean separaciones que ayuden a entender las reglas y a modificarlas sin afectar todo el flujo.

## 2. Patrón State: comportamiento según el estado de la venta

### Problema identificado

Una venta en preparación no debería comportarse igual que una venta pagada. Mientras se está armando el detalle, el cajero puede modificar artículos y cantidades. Cuando se registra el cobro, las acciones permitidas cambian. Una venta cancelada, por su parte, no debería volver a procesarse como una venta activa sin una regla explícita.

Si estas reglas se revisan con condiciones repetidas, pueden aparecer resultados inconsistentes. Por eso se propone representar el comportamiento de la venta mediante estados.

### Aplicación propuesta

**Venta** sería el objeto que reúne la información de la operación y mantiene su estado actual. Una abstracción llamada **EstadoVenta** definiría qué acciones se pueden realizar, y cada estado resolvería esas acciones según sus propias reglas.

| Estado propuesto | Significado | Operaciones permitidas, en principio |
| --- | --- | --- |
| `Borrador` | El cajero prepara la venta. | Modificar detalle, solicitar cobro o cancelar. |
| `PendientePago` | La venta espera una confirmación de cobro. | Registrar resultado, reintentar un pago fallido o cancelar. |
| `Pagada` | El pago fue confirmado. | Consultar el resultado y continuar con los registros correspondientes. |
| `Anulada` | La venta se canceló antes de cobrar. | Consultar el historial; no volver a cobrar. |

Esta lista es **provisional**: los documentos del proyecto solicitan registrar estados, pero no fijan sus nombres ni todas sus transiciones.

### Ejemplo de funcionamiento

Un cajero agrega dos productos y obtiene el total. La venta continúa en `Borrador`. Cuando decide cobrar, pasa a `PendientePago`. Si la operación simulada se confirma, la venta cambia a `Pagada`; si se rechaza, permanece pendiente para que el cajero decida qué hacer. Si se cancela antes del cobro, pasa a `Anulada`.

El patrón no debe asumir que una venta pagada se puede anular de inmediato: una devolución podría necesitar reglas distintas, todavía no acordadas.

### Beneficio esperado

Concentrar las reglas en estados identificables facilita explicar el comportamiento del sistema y construir pruebas. También permite que QA verifique si una operación es válida según la situación de la venta.

## 3. Patrón Strategy: distintas formas de registrar un pago

### Problema identificado

La primera versión admite pagos simulados en efectivo o tarjeta. No sería conveniente que la venta tuviera que conocer cada detalle de ambas modalidades. Si se agrega otra forma de pago, esa dependencia obligaría a modificar el proceso principal.

### Aplicación propuesta

La interfaz conceptual **EstrategiaPago** ofrecería una operación común, por ejemplo, `procesarPago`. Las implementaciones propuestas son:

- **PagoEfectivoSimulado:** recibe el importe y valida, como mínimo, que el monto entregado no sea inferior al total. Puede calcular el vuelto para mostrarlo en caja.
- **PagoTarjetaSimulada:** devuelve una confirmación o rechazo de prueba, sin contactar bancos ni almacenar datos sensibles de tarjetas.

Ambas devolverían un **ResultadoPago** con información comparable: si el intento fue aceptado, el importe, el medio utilizado y una referencia de la operación. Los campos exactos deben revisarse con Backend.

### Ejemplo de funcionamiento

El cliente elige efectivo. El punto de venta utiliza `PagoEfectivoSimulado` y verifica que el monto recibido sea suficiente. Si el cliente escoge tarjeta, utiliza `PagoTarjetaSimulada` y registra la aprobación de prueba. En los dos casos, la venta recibe un resultado que puede interpretar sin conocer el detalle del método.

### Beneficio esperado

Se separa la elección del medio de pago de la lógica general de venta. Esto ayuda a probar cada modalidad de forma independiente y evita mezclar validaciones de efectivo con respuestas de una tarjeta simulada.

## 4. Fábrica simple: elección de la estrategia de pago

### ¿Por qué considerarla?

Una vez definidas varias estrategias, el sistema necesita decidir cuál usar. Se puede hacer directamente si la aplicación sigue siendo muy pequeña. Sin embargo, una fábrica simple permitiría mantener la selección en un solo lugar.

### Aplicación propuesta

**FabricaPagos** recibiría el medio seleccionado (`EFECTIVO` o `TARJETA_SIMULADA`) y entregaría un objeto compatible con `EstrategiaPago`.

Ejemplo conceptual:

1. El cajero selecciona efectivo.
2. El punto de venta solicita a `FabricaPagos` una estrategia para ese medio.
3. La fábrica devuelve `PagoEfectivoSimulado`.
4. El punto de venta procesa el pago y recibe `ResultadoPago`.

**Aclaración:** se trata de una *fábrica simple*, no de una afirmación de que se implementará formalmente *Factory Method*. Si solo existen dos métodos y no se repite la lógica de selección, el equipo podría decidir prescindir de ella.

## 5. Cómo se relacionan los patrones

El trabajo de cada patrón sería distinto:

| Elemento | Responsabilidad principal | Lo que no debería hacer |
| --- | --- | --- |
| `Venta` + `EstadoVenta` | Mantener y validar el avance de una venta. | Ejecutar directamente todas las formas de pago. |
| `EstrategiaPago` | Procesar un pago simulado mediante reglas específicas. | Cambiar por sí sola el estado de la venta o actualizar inventario. |
| `FabricaPagos` | Elegir la estrategia indicada. | Confirmar ventas, modificar existencias o generar comprobantes. |
| Servicio de ventas (por definir) | Coordinar el flujo y registrar el resultado de la operación. | Duplicar el inventario que administra Almacén. |

Por ejemplo, `EstrategiaPago` devuelve si el pago fue aceptado, pero la transición a `Pagada` debe producirse a través de las reglas que gobiernan la venta. Así se evita que cualquier parte de la aplicación cambie el estado sin validaciones.

## 6. Integración con los demás módulos

La propuesta se limita a estos vínculos, sujetos a los contratos que acuerde el equipo:

**Almacén.** Se consulta disponibilidad antes de confirmar la operación y se comunica la venta para actualizar existencias. La regla exacta sobre el momento del descuento todavía está pendiente. El módulo de Ventas Físicas no debe mantener un inventario paralelo.

**Ventas Virtuales.** Ambos canales deberían coordinar el registro compartido de ventas y evitar duplicar la información oficial. Por ahora no se ha definido cuál es el servicio responsable ni su interfaz.

**Distribución.** Solo interviene cuando una venta requiere entrega a domicilio y esta función forma parte del alcance aprobado. Sus propias reglas de cobertura y despacho corresponden a ese módulo.

**Ventas Físicas.** Conserva la lógica de preparación de la venta y el registro del pago simulado que necesita su punto de venta. No se incorpora un quinto módulo de Finanzas en esta propuesta; los documentos de origen mencionan procesos monetarios cuya coordinación aún debe aclararse.

## 7. Criterios de prueba sugeridos

| Caso | Resultado esperado |
| --- | --- |
| Se solicita cobrar una venta en borrador. | Pasa al estado que espera la confirmación del pago. |
| Se confirma un pago simulado correcto. | La venta puede pasar a `Pagada` una sola vez. |
| Un pago simulado es rechazado. | La venta no se marca como pagada y permite revisar el intento. |
| Se intenta cobrar una venta anulada. | La operación se rechaza sin modificar su estado. |
| Se recibe efectivo insuficiente. | El resultado de pago indica que no fue aceptado. |
| Se selecciona un medio de pago no admitido. | Se informa un error controlado, sin crear un cobro. |
| Se consulta una venta de otra empresa. | La operación debe respetar las reglas multiempresa que acuerde Arquitectura. |
| Se intenta completar una venta sin stock. | La venta no continúa como una venta confirmada; el manejo exacto depende del contrato con Almacén. |

Estos casos son propuestas para conversar con QA. No sustituyen los criterios de aceptación que apruebe el Product Owner.

## 8. Decisiones que faltan antes de implementar

Antes de convertir este diseño en código, deben confirmarse los nombres de estados, las transiciones autorizadas, la estructura del resultado de pago, la forma de identificar cada venta y el momento de actualización de stock. También es necesario conocer el lenguaje de programación y la organización del repositorio.

Se sugiere mantener los patrones como una solución **proporcional al prototipo**: aplicar primero las separaciones más útiles y evitar agregar interfaces que no resuelvan un problema concreto.

## 9. Conclusión

Los patrones elegidos responden a situaciones que sí aparecen en el alcance del módulo: la venta cambia de condición y los pagos pueden procesarse de más de una forma. *State* contribuye a que esos cambios sigan reglas comprensibles; *Strategy* permite manejar los pagos sin mezclar sus diferencias; y una fábrica simple puede facilitar la selección del procesador cuando sea necesaria. La propuesta podrá ajustarse después de que el equipo acuerde los contratos y el comportamiento final de cada operación.

### Base documental

Propuesta elaborada a partir de `01_Organizacion_Tribu_Ventas_Fisicas.docx`, `02_Modulos_y_Tablas_Compartidas_Ventas_Fisicas.docx` y `03_Propuesta_y_Preguntas_Ventas_Fisicas.docx`. Los estados, nombres de objetos y responsabilidades técnicas descritos aquí son **propuestos**, no definiciones aprobadas por los documentos originales.
