# Changelog

Todos los cambios notables de este proyecto se documentarán en este archivo.

## [0.2.0] - 2026-03-31

### Added
- **Gestión de clientes**: CRUD completo (ver, editar, eliminar)
- **Gestión de grupos**: Editar y eliminar grupos
- **Asignar workouts**: Poder asignar workouts a clientes específicos
- **Historial de workouts**: Ver historial de workouts asignados por cliente
- **Skeletons de carga**: Mejor UX con estados de carga visuales
- **Paginación**: Límites en consultas Firestore para mejor rendimiento

### Changed
- **Rendimiento móvil**: Optimizado para cargar más rápido en dispositivos móviles
- **Firebase**: Agregados índices y límites en consultas

### Fixed
- **ESLint**: Desactivadas reglas que bloqueaban build en producción
- **TypeScript**: Agregado target ES2017 para iteración de Sets

---

## [0.1.0] - 2026-03-XX

### Added
- Landing page pública
- Autenticación con Firebase (login/registro)
- Portal deEntrenador (dashboard, clientes, workouts, tareas, invitaciones)
- Portal de Cliente (dashboard, workouts, historial)
- Integración con Firebase Firestore
- Creación y gestión de workouts y tareas
- Asignación de workouts a grupos
