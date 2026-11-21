# ERP Ingresos — Módulo de Ventas Físicas

**FSI 2026-B | Tribu 2 – Grupo B (Ingresos) | Equipo 3: Ventas Físicas**

Este repositorio contiene la **estructura inicial prevista** del módulo. En esta entrega se incluye la organización de carpetas y la documentación de referencia; **el código fuente todavía no ha sido implementado**. Los archivos de programación están vacíos a propósito. La carpeta `docs/` se reserva para documentación futura y solo contiene `.gitkeep` para que Git la conserve.

## Objetivo del módulo

Registrar operaciones de ventas presenciales, sus detalles e importes, y coordinar mediante servicios REST la disponibilidad de artículos y el stock con Almacén. Las integraciones con los demás módulos se acordarán durante el desarrollo.

## Stack previsto

- Backend: Python + Django + Django REST Framework (DRF)
- Frontend: React + Vite + TypeScript
- Base de datos: PostgreSQL
- Estilos: Tailwind CSS

## Estructura prevista

```text
ventas-fisicas/
├── README.md
├── backend/
│   ├── README.md
│   ├── .env.example
│   ├── manage.py
│   ├── requirements.txt
│   ├── config/
│   │   ├── __init__.py
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   └── ventas/
│       ├── __init__.py
│       ├── apps.py
│       ├── models.py
│       ├── serializers.py
│       ├── views.py
│       ├── urls.py
│       ├── stock_mock.py
│       └── tests.py
├── frontend/
│   ├── README.md
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       └── style.css
├── docs/
│   └── .gitkeep
└── .gitignore
```

## Organización

- [`backend/README.md`](backend/README.md): estructura y funciones previstas del backend.
- [`frontend/README.md`](frontend/README.md): estructura y funciones previstas del frontend.
- `docs/`: carpeta reservada para documentar avances, integraciones y reuniones más adelante.

## Estado actual

**Etapa: estructura de repositorio.** Las carpetas y archivos están creados, pero aún no existe una aplicación funcional, una base de datos configurada ni integraciones reales. Este repositorio es el punto de partida para implementar el módulo en incrementos posteriores.
