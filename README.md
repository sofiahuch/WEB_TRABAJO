# Reseñas · Web de reseñas de películas, libros, series y videojuegos

Proyecto de la asignatura *Programación de Servidores Web* (CUNEF Universidad). Aplicación web completa con frontend, API REST, base de datos, seguridad y despliegue con Docker.

Los usuarios podrán registrarse, consultar un catálogo y publicar reseñas con una puntuación de 1 a 5. Los administradores gestionarán el catálogo y moderarán reseñas.

## Estado del proyecto

Proyecto en desarrollo. Funcionalidades previstas y su estado:

- [x] Servidor Express básico con endpoint de salud (`/health`)
- [ ] Base de datos PostgreSQL y modelo de datos
- [ ] Registro, login y roles (usuario y administrador)
- [ ] Catálogo de películas, libros, series y juegos
- [ ] Reseñas con control de acceso por propiedad
- [ ] Frontend (HTML, CSS y JavaScript)
- [ ] Medidas de seguridad web
- [ ] Documentación de la API (OpenAPI/Swagger)
- [ ] Despliegue con Docker

El diseño inicial de la base de datos se describe en [docs/modelo-datos.md](docs/modelo-datos.md). Su implementación está pendiente.

## Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | HTML, CSS y JavaScript (Fetch API) |
| Backend | Node.js y Express, arquitectura MVC |
| Base de datos | PostgreSQL |
| Seguridad | Contraseñas con hash, JWT, control de acceso por roles |
| Documentación | OpenAPI y Swagger UI |
| Despliegue | Docker y Docker Compose |

## Cómo arrancar el proyecto

Requisitos: Git y Node.js 20 o superior, con npm.

```bash
git clone https://github.com/sofiahuch/WEB_TRABAJO.git
cd WEB_TRABAJO
npm install
node src/server.js
```

Comprueba que funciona abriendo <http://localhost:3000/health> o con:

```bash
curl http://localhost:3000/health
```

Debe responder:

```json
{"status":"ok"}
```

El servidor usa el puerto `3000` por defecto. Se puede cambiar mediante la variable de entorno `PORT`.

## Estructura del proyecto

| Ruta | Contenido |
|---|---|
| `src/app.js` | Configuración de la aplicación Express |
| `src/server.js` | Arranque del servidor |
| `docs/modelo-datos.md` | Diseño inicial del modelo de datos |
| `package.json` | Configuración del proyecto y dependencias |
| `package-lock.json` | Versiones exactas de las dependencias |
| `README.md` | Presentación e instrucciones del proyecto |

La estructura crecerá con carpetas de rutas, controladores, modelos y frontend.

## Flujo de trabajo en equipo

- Rama `main`: versión estable del proyecto.
- Cada integrante trabaja en su propia rama (`olivia`, `sofia`).
- Los cambios llegan a `main` mediante Pull Requests que revisa la otra persona.
- Commits pequeños y con mensajes descriptivos (`feat:`, `fix:`, `docs:`, `chore:`).

## Autores

- Olivia
- Sofía
