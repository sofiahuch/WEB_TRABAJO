# Entretiempo

Aplicación de Programación de Servidores Web, CUNEF Universidad.

Entretiempo ayuda a elegir qué ver, leer o jugar según el rato disponible y el tipo de plan. Reúne un catálogo cultural, reseñas y una estantería personal para guardar pendientes y seguir lo que estamos disfrutando.

## Funciones

- Catálogo público de películas, libros, series y videojuegos.
- Búsqueda por título o autoría y filtros combinables de formato, tiempo y plan.
- «Sorpréndeme»: abre una propuesta aleatoria entre los resultados.
- Registro, login y cierre de sesión en el servidor.
- Estantería privada con estados: pendiente, en curso y terminada.
- Una reseña por usuario y propuesta, nota de 1 a 5 y aviso de spoilers.
- Edición y borrado de reseñas propias.
- Gestión del catálogo y moderación para administradores.

El tiempo es **por sesión**: la película completa, un episodio orientativo, un rato de lectura o una sesión de juego. Los planes son una clasificación editorial. Las medias se calculan con reseñas reales. Las cubiertas son composiciones gráficas propias, no carteles oficiales.

## Arranque local

Hace falta **Node.js 24.x**, npm y Git. No hay que instalar un servidor de base de datos.

```bash
git clone https://github.com/sofiahuch/WEB_TRABAJO.git
cd WEB_TRABAJO
git switch feature/entretiempo
npm ci
npm start
```

Abre <http://localhost:3000>. El endpoint <http://localhost:3000/health> responde `{"status":"ok"}` si puede consultar la base de datos.

La primera ejecución crea `data/entretiempo.sqlite` y carga 16 propuestas. Cuentas, sesiones, reseñas y estanterías se conservan al reiniciar. Las fichas iniciales no se vuelven a insertar si un administrador vacía el catálogo.

`npm run dev` reinicia el servidor al modificar el backend. Puedes cambiar el puerto con `PORT` en `.env` o con `npm start -- --port 3001`.

## Cuenta administradora

El registro público siempre crea usuarios normales. No hay cuentas ni contraseñas administradoras predeterminadas.

1. Copia `.env.example` a `.env` desde el explorador o VS Code.
2. Rellena `ADMIN_EMAIL`, `ADMIN_USERNAME` y `ADMIN_PASSWORD` con tus propios valores. La contraseña debe tener entre 10 y 128 caracteres.
3. Ejecuta `npm run admin` y entra con esa cuenta. Aparecerá la pestaña «Gestión».

Si el correo ya existía, el script exige su contraseña actual antes de convertirlo en administrador. Después puedes quitar esos tres valores de `.env`; la cuenta seguirá guardada en SQLite.

## Docker

Con Docker Desktop y una versión actual de Docker Compose:

```bash
docker compose up --build -d
```

Abre <http://localhost:3000>. La base de datos se guarda en el volumen `entretiempo-data`. `docker compose down` detiene la aplicación y conserva los datos.

Para crear el administrador del contenedor, prepara `.env` como en el apartado anterior:

```bash
docker compose run --rm --env-from-file .env web npm run admin
```

Ese comando requiere una versión de Compose que incluya `--env-from-file`. Para consultar estado y registros:

```bash
docker compose ps
docker compose logs web
```

En un despliegue público usa HTTPS, `APP_ORIGIN` con el origen exacto y `COOKIE_SECURE=true`. El contenedor sirve HTTP para desarrollo local; el proxy del despliegue debe terminar TLS.

## Tecnologías y estructura

| Ruta                       | Responsabilidad                                               |
| -------------------------- | ------------------------------------------------------------- |
| `public/`                  | HTML, CSS, SVG y JavaScript del navegador; llamadas con Fetch |
| `src/routes/`              | Endpoints y permisos                                          |
| `src/controllers/`         | Validación y coordinación de operaciones                      |
| `src/models/`              | Consultas SQL parametrizadas                                  |
| `src/middleware/`          | Sesiones, CSRF y autorización                                 |
| `src/services/`            | Derivación y comprobación de contraseñas                      |
| `src/database/`            | Esquema y selección inicial                                   |
| `src/config/`              | Apertura de SQLite                                            |
| `scripts/create-admin.js`  | Creación controlada de administradores                        |
| `test/api.test.js`         | Pruebas de integración con node:test                          |
| `.github/workflows/ci.yml` | Pruebas y arranque del contenedor en GitHub                   |

Express organiza el backend. SQLite se utiliza mediante `node:sqlite`; sustituye al PostgreSQL previsto en el diseño inicial y permite demostrar la aplicación sin servicios externos. La autenticación utiliza sesiones persistentes con cookie HttpOnly.

## Comprobaciones

```bash
npm test
```

Diez pruebas verifican filtros, cuentas, caducidad y revocación de sesiones, permisos, CSRF, validación, estanterías privadas, propiedad de reseñas, moderación, borrado en cascada, persistencia y límite de intentos. Usan bases de datos aisladas.

La revisión visual local cubrió portada, fichas, búsqueda y filtros como visitante. El recorrido autenticado completo en navegador y la revisión en dispositivos físicos quedan para el ensayo del grupo. Docker se comprueba en el workflow, ya que el entorno de desarrollo usado no tiene Docker instalado.

## Documentación y exposición

- [API y ejemplos](docs/api.md).
- [Modelo de datos y permisos](docs/modelo-datos.md).
- [Informe técnico editable](docs/informe-tecnico.md) e [informe en PDF](docs/informe-tecnico.pdf).
- [Guion de 15 minutos y demostración](docs/presentacion.md).

## Equipo

El PDF se puede regenerar desde su Markdown con Python y ReportLab: `python scripts/build-report.py`. Esa herramienta de documentación no es necesaria para arrancar la aplicación.

Cada integrante trabaja en una rama y abre una Pull Request. Otra persona revisa el cambio y comprueba que arranca antes de incorporarlo a `main`.

Integrantes que figuran en el repositorio: Olivia y Sofía. El enunciado actual exige tres personas; falta añadir al tercer integrante y registrar el grupo completo en Canvas.
