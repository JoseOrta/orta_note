Registro de Cambios (Changelog)
[v1.1.3] - 2026-03-15
Nuevas Características:

Control Nativo de Ventana: Implementación de comunicación IPC para sincronizar el nombre del archivo en edición directamente en la barra de título de Windows.

Identidad de Versión: Formato de título estandarizado: NombreArchivo.json - Orta Note Lite Version.

Correcciones:

Prioridad de Título: Bloqueo de actualizaciones automáticas del HTML para mantener el control del proceso principal sobre el marco de la ventana.

[v1.1.2] - 2026-03-15
Nuevas Características:

Motor de Búsqueda Dinámico: Añadida barra de búsqueda con resaltado visual (Cyan/Black) y navegación infinita mediante la tecla Enter.

Contador de Coincidencias: Visualización en tiempo real de la posición actual y total de resultados (0/0).

Correcciones de Estabilidad (Hotfixes):

Filtro Anti-Rebote (Mouse): Implementado debounce de 300ms en el botón central (rueda) para evitar duplicación de texto al pegar.

GPU & Render: Desactivación de la aceleración por hardware (disableHardwareAcceleration) para eliminar parpadeos verdes y errores de caché en sistemas Windows.

I/O Error Fix: Optimización de rutas de datos de usuario para evitar errores de "Acceso Denegado (0x5)" en unidades secundarias.