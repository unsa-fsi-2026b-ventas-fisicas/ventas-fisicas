# Análisis de patrones de objetos para Ventas Físicas

**Proyecto:** ERP académico UNSA — módulo de Ventas Físicas  
**Responsabilidad:** Patrones de Objetos  
**Estado:** Propuesta inicial para revisión del equipo

## 1. Introducción

El módulo de Ventas Físicas busca apoyar el trabajo de una tienda o punto de venta. En su primera versión, el cajero podrá consultar artículos, preparar una venta, registrar un pago de demostración y dejar constancia de la operación. También será necesario consultar la disponibilidad de los productos en Almacén y mantener la información de la venta relacionada con los demás procesos del ERP.

Aunque el recorrido parece sencillo, hay decisiones que conviene ordenar desde el diseño. Por ejemplo, no debería ser posible marcar una venta como pagada si el pago no fue confirmado, ni descontar existencias dos veces por una misma operación. Los patrones de objetos pueden ayudar a definir estas responsabilidades sin concentrar todas las reglas en una sola clase.

Este análisis identifica dónde serían útiles esos patrones. **No pretende definir la arquitectura final ni reemplazar los acuerdos del equipo.**

## 2. Contexto del proyecto

De acuerdo con los documentos de planificación, el primer prototipo contempla:

- Consulta de artículos, precios y disponibilidad desde Almacén.
- Registro de los artículos, cantidades y total de una venta en caja.
- Identificación del cliente mediante datos compartidos, sin crear un registro duplicado.
- Pago simulado en efectivo o tarjeta, con una referencia de la operación.
- Registro de la venta y su estado, considerando la empresa a la que pertenece.
- Comunicación de los artículos vendidos para actualizar las existencias.
- Solicitud de entrega a Distribución únicamente cuando corresponda.

Para la coordinación actual del equipo se consideran **cuatro módulos: Ventas Físicas, Ventas Virtuales, Almacén y Distribución**. Los documentos originales también mencionan procesos de caja y finanzas; sin embargo, no se asumirán aquí como un quinto módulo. El destino de la información monetaria deberá aclararse con el equipo y el docente.

Además, el ERP debe distinguir los datos de cada empresa. Por eso, la propuesta contempla una referencia a `empresa_id` en las operaciones que lo requieran, sin decidir todavía cómo se implementará el aislamiento.

## 3. Problemas que conviene resolver

### 3.1. Estados de una venta

Una venta no conserva la misma condición durante todo su recorrido: primero se prepara, luego se intenta cobrar y finalmente puede confirmarse o cancelarse. Si estas decisiones se dispersan entre muchas condiciones, será más difícil saber qué operaciones están permitidas.

**Necesidad:** establecer reglas claras para cambiar de estado y evitar transiciones contradictorias.

**Patrón candidato:** *State*, porque permite organizar el comportamiento según la situación actual de la venta.

### 3.2. Diferentes métodos de pago

El alcance inicial incluye pagos simulados en efectivo y tarjeta. Aunque ambos deberían producir un resultado comparable, su validación puede ser distinta. En efectivo, por ejemplo, interesa comprobar el monto recibido; en una tarjeta simulada interesa registrar si la prueba fue aceptada o rechazada.

**Necesidad:** evitar que el proceso general de venta dependa de todas las particularidades de cada medio de pago.

**Patrón candidato:** *Strategy*, para tratar cada modalidad como una forma distinta de ejecutar el cobro.

### 3.3. Selección del objeto que procesa el pago

Si se incorporan varias estrategias de pago, alguien deberá elegir la apropiada según el medio seleccionado. Esa decisión puede quedar repartida por la aplicación si no se establece un punto común.

**Necesidad:** centralizar la selección del procesador cuando realmente aporte claridad.

**Patrón candidato:** una *fábrica simple* de procesadores de pago. Es una propuesta complementaria, no una obligación de usar un patrón adicional.

### 3.4. Coordinación con Almacén y otros módulos

Ventas Físicas necesita consultar productos y existencias, pero no debería mantener un segundo inventario. También debe evitar registrar una segunda venta oficial si Ventas Físicas y Ventas Virtuales comparten un registro. En el caso de entregas a domicilio, Distribución se encargaría del despacho.

**Necesidad:** acordar qué información se solicita, quién es responsable de ella y qué ocurre cuando otro módulo no confirma una operación.

**Posible patrón futuro:** *Adapter*, pero únicamente si los equipos establecen interfaces incompatibles que deban conectarse. Proponerlo desde ahora como obligatorio sería adelantarse a los contratos de integración.

## 4. Relación con las historias de usuario

| Historia | Necesidad que plantea | Aporte posible desde patrones de objetos |
| --- | --- | --- |
| HU-01: consultar productos y disponibilidad | Mostrar artículos sin duplicar existencias. | Definir el límite de integración con Almacén; no exige un patrón específico todavía. |
| HU-02: armar una venta y calcular el total | Conservar una venta en preparación. | *State* puede diferenciar una venta en borrador de una venta lista para cobrar. |
| HU-03: registrar datos del cliente | Usar datos coherentes para el comprobante. | Se relaciona más con datos compartidos que con los patrones propuestos. |
| HU-04: vincular la venta pagada al registro de ventas | Confirmar únicamente operaciones válidas. | *State* ayuda a distinguir una venta pagada de otra aún pendiente. |
| HU-05: informar artículos vendidos a Almacén | Actualizar existencias en el momento acordado. | Reglas de transición e integración deben impedir confirmaciones duplicadas. |
| HU-06: consultar ventas del día | Reconocer qué ventas se concretaron. | Estados consistentes facilitan consultas y cierres posteriores. |

La tabla muestra que **no todas las historias necesitan un patrón de diseño**. En algunos casos resulta más importante respetar los datos compartidos y los acuerdos entre equipos.

## 5. Reglas preliminares que habría que validar

1. Una venta comienza en preparación y solo puede considerarse pagada después de recibir un resultado positivo del pago simulado.
2. Si el pago falla, la venta permanece pendiente y se registra el intento; no se informa como pagada.
3. Una venta no pagada podría cancelarse. El tratamiento de anulaciones después del pago y de devoluciones queda fuera de esta propuesta inicial.
4. La disponibilidad se consulta en Almacén. El instante exacto en que se descuenta el stock todavía requiere un acuerdo.
5. La información de venta y pago debe mantener una referencia común, además de la empresa a la que pertenece la operación.
6. La posible entrega a domicilio se solicita a Distribución; el punto de venta no administra los estados del reparto.

Estas reglas son **hipótesis de diseño**, no funcionalidades ya implementadas ni decisiones aprobadas.

## 6. Alcance de este trabajo

Este rol puede aportar la selección de patrones, la explicación de las responsabilidades, los diagramas UML y recomendaciones que después sirvan al equipo de desarrollo. La primera entrega no necesita integraciones bancarias reales, emisión electrónica certificada ni lógica de transporte. Tampoco corresponde inventar tablas o endpoints sin coordinación con Backend y DevOps/Arquitectura.

Por ahora, la prioridad es documentar *State* y *Strategy*. La fábrica simple se considera un complemento opcional si se decide utilizar varias estrategias de pago.

## 7. Puntos pendientes de coordinación

- Confirmar los nombres y las reglas de los estados de venta con Backend, QA y el Product Owner.
- Acordar cuándo se confirma la venta y cuándo se descuenta el stock en Almacén.
- Definir cómo se comparte el registro de ventas con Ventas Virtuales.
- Precisar qué datos de un pago simulado deben almacenarse y quién los consulta.
- Confirmar si habrá entregas a domicilio dentro del primer prototipo.
- Acordar el lenguaje, el repositorio definitivo y los contratos de integración.

## 8. Cierre

Los patrones de objetos pueden aportar orden al módulo sin complicarlo innecesariamente. *State* permitiría expresar mejor las reglas de una venta y *Strategy* separaría el procesamiento de cada modalidad de pago. La fábrica simple solo tendría sentido si ayuda a seleccionar esas estrategias de manera consistente. Lo importante es que las decisiones de diseño acompañen el alcance real del proyecto y puedan ser revisadas con el resto del equipo.

### Documentos internos utilizados

- `01_Organizacion_Tribu_Ventas_Fisicas.docx`: organización, alcance inicial y responsabilidad del rol.
- `02_Modulos_y_Tablas_Compartidas_Ventas_Fisicas.docx`: información compartida e integraciones propuestas.
- `03_Propuesta_y_Preguntas_Ventas_Fisicas.docx`: funciones del prototipo, historias HU-01 a HU-06 y decisiones pendientes.
