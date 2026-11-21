# Frontend — Estructura prevista

Interfaz del módulo Ventas Físicas. Se desarrollará con **React, Vite y TypeScript**, usando **Tailwind CSS** para los estilos.

> **Estado:** solo se han creado las carpetas y archivos vacíos. La interfaz y sus dependencias aún no están implementadas.

## Estructura

```text
frontend/
├── README.md
├── index.html          # Documento HTML de entrada
├── package.json        # Dependencias y scripts npm
├── tsconfig.json       # Configuración TypeScript
├── vite.config.ts      # Configuración Vite y Tailwind
└── src/
    ├── main.tsx        # Punto de entrada React
    ├── App.tsx         # Componente principal de la aplicación
    └── style.css       # Importación de Tailwind y estilos globales
```

## Pantallas y funciones previstas

1. Visualización inicial del módulo y formulario de venta presencial.
2. Selección de artículo, precio y cantidad; cálculo preliminar de importes.
3. Consulta de disponibilidad contra los servicios REST del backend.
4. Mensajes para casos de stock suficiente, insuficiente o servicio no disponible.
5. Consulta del estado de las ventas registradas.
6. Soporte futuro para flujos que requieran despacho o integración externa.

## Integración con backend

El frontend deberá consumir la API de Django REST Framework mediante peticiones HTTP y mostrar sus respuestas. El contrato, las rutas y el manejo de errores deben acordarse conforme avance el backend.

## Pendiente

Definir dependencias en `package.json`, configurar Vite y Tailwind, implementar React, conectar API y probar el flujo. No es posible ejecutar el frontend con los archivos vacíos de esta entrega.
