# Frontend — Ventas Físicas

**Tribu 2 · Grupo B (Ingresos) · Equipo 3**  
**Responsable de Frontend:** Jimenez Paredes, Fabricio Gabriel.  
**Stack:** React + Vite + TypeScript + Tailwind CSS v4.

Este frontend es una **maqueta funcional de interfaz**: permite introducir datos y ver un cálculo preliminar, pero **aún no está conectado a la API de Django**. Pulsar su botón no registra ninguna venta en PostgreSQL.

## Estructura actual

```text
frontend/
├── README.md             Documentación de la interfaz
├── index.html            Documento HTML con el nodo raíz
├── package.json          Scripts y dependencias
├── tsconfig.json         Opciones del compilador TypeScript
├── vite.config.ts        Plugins React y Tailwind CSS para Vite
└── src/
    ├── main.tsx          Montaje de la aplicación React
    ├── App.tsx           Formulario y vista previa de importes
    └── style.css         Importa Tailwind y contiene estilos CSS propios
```

Esta estructura es suficiente para el estado actual del frontend, **sin exigir por ahora** carpetas adicionales de componentes, páginas o servicios.

## Estado de implementación

| Elemento | Estado real |
|---|---|
| React + TypeScript + Vite | Configurado en los archivos de proyecto |
| Tailwind CSS v4 | Plugin presente y `@import "tailwindcss"` en `style.css` |
| Estilos de pantalla | Principalmente CSS propio; aún no migrado a clases utilitarias Tailwind |
| Formulario | Cliente, artículo, cantidad y precio unitario |
| Importe mostrado | Subtotal, IGV referencial (18%) y total calculados en el navegador |
| Botón | **Solo prepara una vista previa** y muestra un mensaje local |
| Comunicación HTTP con Django | No implementada: no hay `fetch` hacia `/api/ventas/` |
| Listado de ventas, validación real y manejo de errores API | Pendientes |

## Instalación y ejecución

Requiere Node.js y npm compatibles con la versión de Vite instalada. Desde `frontend/`:

```bash
npm install
npm run dev
```

Vite normalmente abre `http://localhost:5173/`; confirmar la URL mostrada por la terminal. Para intentar construir el proyecto:

```bash
npm run build
```

**La instalación y el build del frontend están pendientes de verificación.** `package.json` utiliza varias dependencias con versión `latest`; antes de un despliegue se deben fijar versiones y conservar el lockfile generado.

## Comportamiento que se puede mostrar

1. Abrir el formulario de nueva venta.
2. Escribir cliente y código de artículo (ejemplo: `ART001`).
3. Cambiar la cantidad y el precio de ejemplo.
4. Observar el recálculo de subtotal, IGV referencial y total.
5. Pulsar **Preparar venta (demo)** y explicar que **no** se ha enviado nada al backend.

La validación del precio, los impuestos y los permisos comerciales corresponderá principalmente al backend; el valor visual es solo una ayuda preliminar.

## Trabajo pendiente

- Mejorar el formulario, la validación visual, los mensajes de error y el uso de clases Tailwind; revisar el diseño en escritorio y móvil.
- Conectar `POST /api/ventas/` y `GET /api/ventas/`; mostrar los errores HTTP 400/409/503, un indicador de carga y evitar envíos duplicados.
- Realizar pruebas de extremo a extremo una vez que la API y la base de datos estén verificadas.

Una conexión local puede configurarse después mediante proxy de Vite o CORS en Django; **ninguna de esas opciones está implementada aún**.

Consulta el [README general](../README.md) y el [backend](../backend/README.md) para la arquitectura completa.
