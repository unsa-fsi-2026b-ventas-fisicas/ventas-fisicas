# Backend — Ventas Físicas

**Tribu 2 · Grupo B (Ingresos) · Equipo 3**  
**Responsable de Backend:** Quenta Ahumada, Paulo Estefano.  
**Stack:** Python, Django REST Framework, PostgreSQL y `psycopg`.

Este backend es un **prototipo académico inicial**. Existen algunos modelos y endpoints de demostración, pero faltan requisitos esenciales para una venta real. Las conexiones con otros módulos están simuladas o pendientes.

## Estructura actual

```text
backend/
├── README.md               Documentación del backend
├── .env.example            Nombres de variables de configuración
├── manage.py               CLI de Django
├── requirements.txt        Django, DRF y controlador PostgreSQL
├── config/
│   ├── __init__.py
│   ├── settings.py          Apps, conexión PostgreSQL, zona horaria y ajustes
│   ├── urls.py              Enruta /api/ a la app ventas
│   └── wsgi.py              Entrada WSGI
└── ventas/
    ├── __init__.py
    ├── apps.py              Registro de aplicación
    ├── models.py            Venta y DetalleVenta (versión simplificada)
    ├── serializers.py       Serializadores de lectura/respuesta
    ├── views.py             Registro/listado y consulta de stock mock
    ├── urls.py              Rutas de los endpoints
    ├── stock_mock.py        Catálogo ficticio y errores simulados
    └── tests.py             Dos pruebas iniciales del mock
```

**No se incluye aún `ventas/migrations/`.** Django generará esa carpeta y los archivos de migración cuando se ejecute `makemigrations ventas`.

## Estado de implementación

| Componente | Situación real |
|---|---|
| Configuración Django y DRF | Archivos existentes; arranque local aún no verificado aquí |
| Conexión a PostgreSQL | Configurada en `config/settings.py`; requiere base y credenciales reales |
| Modelos de ventas | `Venta` y `DetalleVenta` simplificados; falta adaptar nombres y restricciones al diccionario |
| API de registro/listado | Rutas y vistas escritas; falta validación completa y transacción `atomic` |
| Cálculos | `Decimal`, subtotal, IGV **referencial** de 18% y total |
| Almacén | `stock_mock.py`, sin comunicación ni descuento real de inventario |
| Historial, anulaciones y pagos | No implementados |
| API OpenAPI / Swagger | No configurada |
| Pruebas | Dos pruebas del mock escritas; no cubren todo el flujo |

## Preparación del entorno

**Requisitos:** Python compatible con Django 5, PostgreSQL operativo, entorno virtual y acceso a `pip`.

1. Crear una base PostgreSQL de desarrollo llamada `ventas_fisicas` (o utilizar otro nombre mediante variables de entorno).
2. Crear y activar un entorno virtual dentro de `backend/`.
3. Instalar dependencias:

```bash
python -m venv .venv
python -m pip install -r requirements.txt
```

Activar el entorno antes del `pip install` y de los comandos Django:

- Windows (PowerShell): `.venv\Scripts\Activate.ps1`
- macOS/Linux: `source .venv/bin/activate`

4. Definir `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST` y `DB_PORT` en el **entorno del proceso**. `.env.example` es una plantilla: `settings.py` usa `os.getenv` y **no carga automáticamente un archivo `.env`**. No subir contraseñas reales al repositorio.
5. Crear y aplicar migraciones, luego iniciar el servicio:

```bash
python manage.py makemigrations ventas
python manage.py migrate
python manage.py runserver
```

El backend escucharía normalmente en `http://127.0.0.1:8000/`, si el entorno y PostgreSQL están correctamente configurados. Estos comandos son instrucciones, no evidencia de que ya se hayan ejecutado.

## Endpoints existentes en el código

| Método | Ruta | Comportamiento |
|---|---|---|
| GET | `/api/stock/ART001/` | Consulta el stock **ficticio** del artículo |
| GET | `/api/ventas/` | Lista ventas almacenadas en la BD configurada |
| POST | `/api/ventas/` | Intenta crear una venta con cabecera y detalle |

Ejemplo de petición para `POST /api/ventas/`:

```json
{
  "cliente": "Cliente de mostrador",
  "items": [
    {
      "articulo_codigo": "ART001",
      "descripcion": "Teclado",
      "cantidad": 2,
      "precio_unitario": "45.00"
    }
  ],
  "solicitar_despacho": false
}
```

La cabecera de prueba `X-Mock-Stock-Mode` permite elegir:

- `normal`: consulta ficticia exitosa.
- `insuficiente`: disponibilidad reducida; al crear una venta que la supera se devuelve `409`.
- `caido`: simula indisponibilidad de Almacén con respuesta `503`.

Otros errores iniciales: `400` para algunas entradas inválidas y `404` al consultar artículo desconocido. **No todos los datos inválidos están controlados todavía.** La cantidad se procesa como entero y el precio `0` no está prohibido; ambas decisiones deben revisarse frente al diccionario de datos. Repetir una venta mock no disminuye el stock ficticio.

## Riesgos de la implementación actual

1. El POST guarda cabecera y detalle sin `transaction.atomic`: podría persistir parcialmente ante una falla de escritura.
2. El registro usa `CONFIRMADA` con un stock consultado por mock; no implica pago, comprobante ni salida física confirmados.
3. `serializers.py` define principalmente el formato de respuesta; las validaciones de entrada se realizan de manera incompleta en la vista.
4. No existen autenticación, permisos ni pruebas suficientes. No usar este prototipo con clientes o pagos reales.
5. Modelos y campos todavía no siguen completamente `I1T_VENTA_FIS`, `I1T_VENTA_FIS_DET` y el resto del diccionario.


Para dependencias externas, consultar [integración](../docs/INTEGRACION_TRIBU_INGRESOS.md).
