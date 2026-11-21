# Backend — Estructura prevista

Servidor del módulo Ventas Físicas. Se implementará usando **Python, Django y Django REST Framework**, con **PostgreSQL** como base de datos.

> **Estado:** solo se han creado las carpetas y archivos vacíos. La configuración, lógica y pruebas todavía están pendientes.

## Estructura

```text
backend/
├── README.md
├── .env.example         # Variables de entorno previstas
├── manage.py            # Utilidad de administración Django
├── requirements.txt     # Dependencias Python
├── config/
│   ├── __init__.py
│   ├── settings.py       # Configuración del proyecto y PostgreSQL
│   ├── urls.py           # Enrutamiento general
│   └── wsgi.py           # Entrada del servidor WSGI
└── ventas/
    ├── __init__.py
    ├── apps.py           # Configuración de la app Ventas
    ├── models.py         # Modelos de venta y detalle
    ├── serializers.py    # Validación y serialización de datos
    ├── views.py          # Lógica de endpoints REST
    ├── urls.py           # Rutas específicas del módulo
    ├── stock_mock.py     # Simulación prevista de Almacén
    └── tests.py          # Pruebas automáticas
```

## Funcionalidades previstas

1. Definir modelos básicos de venta física y detalle de venta.
2. Exponer servicios REST para registrar y consultar ventas.
3. Calcular subtotal, impuestos y total con decimales exactos.
4. Validar cantidades y disponibilidad mediante un contrato a coordinar con Almacén.
5. Simular temporalmente las respuestas de Almacén cuando el otro módulo aún no esté disponible.
6. Incorporar control de estados, historial, validaciones y pruebas de forma incremental.

## Integración y dependencias

Se deberá coordinar el intercambio de artículos y stock con **Almacén**, las reglas compartidas con **Ventas Virtuales** y, cuando aplique, el despacho con **Distribución**. Ninguna de estas integraciones se considera implementada todavía.

## Pendiente

Completar las dependencias, configurar Django/PostgreSQL, crear migraciones, desarrollar endpoints y ejecutar pruebas. No es posible levantar el backend con los archivos vacíos de esta entrega.
