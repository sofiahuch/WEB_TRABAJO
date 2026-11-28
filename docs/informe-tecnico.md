# Entretiempo

Informe técnico - Programación de Servidores Web - CUNEF Universidad

## 1. Descripción del sistema

Entretiempo permite descubrir películas, libros, series y videojuegos a partir del tiempo disponible y del tipo de plan. Resuelve una necesidad concreta: elegir una propuesta cultural sin dedicar todo el rato a buscar entre catálogos.

El visitante consulta fichas y reseñas. Con una cuenta puede guardar propuestas en una estantería, cambiar su estado y publicar una opinión. El administrador mantiene el catálogo y modera reseñas. La selección inicial contiene 16 fichas sin valoraciones ficticias.

La identidad combina cubiertas gráficas propias, filtros por sesión y una estantería con estados. El tiempo se acompaña de una explicación: una película completa, un episodio orientativo, un rato de lectura o una sesión de juego. Los planes son una clasificación editorial; no se analiza el comportamiento del usuario ni se usa aprendizaje automático.

## 2. Arquitectura

La arquitectura es cliente-servidor. Express sirve frontend y API desde el mismo origen. El navegador solicita JSON con Fetch y actualiza la interfaz con JavaScript. HTML aporta la estructura y CSS adapta las vistas a distintos anchos.

| Capa          | Implementación   | Responsabilidad               |
| ------------- | ---------------- | ----------------------------- |
| Vista         | public/          | Interfaz y formularios        |
| Rutas         | src/routes/      | Relacionar URLs y operaciones |
| Controladores | src/controllers/ | Validar y coordinar           |
| Modelos       | src/models/      | Consultas SQL                 |
| Middleware    | src/middleware/  | Sesiones y permisos           |
| Persistencia  | SQLite           | Tablas y almacenamiento       |

Una escritura pasa por la comprobación de seguridad, la ruta, el controlador y la consulta parametrizada antes de devolver JSON. Un middleware de Express concentra los errores para mantener respuestas uniformes. El endpoint de salud también consulta la base de datos.

Se utiliza Node.js 24 y su módulo node:sqlite. El diseño inicial contemplaba PostgreSQL, pero no existía una base de datos implementada. SQLite permite arrancar y demostrar el proyecto sin configurar otro servicio. Se plantea una sola instancia del servidor, adecuada para la escala de la práctica.

## 3. Base de datos

| Tabla    | Contenido                            | Restricción principal       |
| -------- | ------------------------------------ | --------------------------- |
| users    | Identidad, contraseña derivada y rol | Correo único                |
| items    | Fichas, plan y tiempo por sesión     | Tipos y límites validados   |
| reviews  | Nota, comentario y spoilers          | Una por usuario y propuesta |
| shelf    | Guardados y estado                   | Clave usuario/propuesta     |
| sessions | Token derivado, CSRF y caducidad     | Referencia al usuario       |

Una persona puede escribir varias reseñas y guardar varias propuestas. Una propuesta puede recibir opiniones y aparecer en varias estanterías. Guardar y reseñar son operaciones independientes. La media y el contador se calculan con AVG y COUNT, evitando valores duplicados que pudieran quedar desactualizados.

Las claves foráneas están activadas. Borrar una ficha elimina sus reseñas y guardados con ON DELETE CASCADE. La interfaz informa de esa consecuencia y pide confirmación. CHECK limita notas, tipos y estados; UNIQUE impide correos y reseñas duplicadas.

Las fechas usan ISO 8601 en UTC. WAL y una espera de cinco segundos gestionan bloqueos breves. Una marca de versión evita repetir la selección inicial si se vacía el catálogo. Los cambios futuros de esquema necesitarán migraciones explícitas.

## 4. Autenticación y autorización

El registro público crea usuarios normales. Las contraseñas se derivan con scrypt y una sal aleatoria por cuenta; no se almacenan en claro. Se utilizan N=32768, r=8, p=1 y una clave de 64 bytes. La comparación de claves usa timingSafeEqual.

Al entrar, el navegador recibe un token aleatorio en una cookie HttpOnly y SameSite=Lax. SQLite conserva su hash SHA-256, el usuario, un token CSRF separado y una caducidad de siete días. Cerrar sesión elimina la fila y limpia la cookie. El navegador no guarda el token de autenticación en localStorage.

El servidor comprueba sesión, rol y propiedad. Cada persona gestiona su estantería y edita sus reseñas. El administrador mantiene fichas y puede eliminar reseñas ajenas, pero no reescribirlas. Un script prepara la cuenta administradora con valores elegidos por el grupo; no hay credenciales predeterminadas.

## 5. Seguridad web

| Riesgo                | Medida implementada                                        |
| --------------------- | ---------------------------------------------------------- |
| Inyección SQL         | Consultas parametrizadas y ordenación en lista cerrada     |
| XSS                   | Escape de texto y Content Security Policy del mismo origen |
| CSRF                  | Token por sesión, origen validado y JSON obligatorio       |
| Acceso a datos ajenos | Usuario tomado de la sesión y comprobación de propiedad    |
| Intentos masivos      | Límites por IP para API y autenticación                    |
| Datos inválidos       | Tipos, longitudes y dominios; máximo 16 KB de JSON         |
| Exposición interna    | Errores sin trazas; .env y base de datos fuera de Git      |

Helmet configura cabeceras y Express no envía X-Powered-By. La API responde con Cache-Control: no-store. El aviso de spoilers es una ayuda de lectura; no limita el acceso a una reseña pública.

Para un despliegue público deben configurarse HTTPS, APP_ORIGIN y COOKIE_SECURE=true. El contenedor local sirve HTTP. No se incluye recuperación de contraseña, verificación de correo, varios servidores compartiendo datos ni una auditoría externa.

## 6. Instalación y Docker

El arranque requiere Node.js 24.x. npm ci instala las versiones fijadas y npm start inicia Express. El primer arranque crea tablas y fichas iniciales. No se necesitan claves ni APIs externas.

Dockerfile utiliza Node 24, instala dependencias de ejecución y arranca con el usuario node. Compose publica el puerto 3000 y guarda SQLite en un volumen. Detener el contenedor conserva ese volumen. El healthcheck consulta /health.

El workflow ejecuta pruebas, construye la imagen y espera una respuesta correcta del contenedor. Docker no estaba disponible en el entorno de desarrollo local; su ejecución real debe verificarse en el workflow o en el equipo de demostración.

## 7. Validación

Diez pruebas con node:test cubren filtros, registro, contraseñas y tokens almacenados, login, logout, caducidad, CSRF y origen, estanterías privadas, unicidad y propiedad de reseñas, validación, permisos de administrador y borrado en cascada. También verifican persistencia al reabrir SQLite y el bloqueo de intentos repetidos.

La revisión visual verificó portada, búsqueda por autoría, filtros combinados y fichas públicas. Antes de exponer, el grupo debe ensayar el recorrido autenticado y revisar el diseño en sus dispositivos. Estas comprobaciones no se sustituyen por las pruebas de API.

## 8. Conclusiones

El proyecto reúne frontend, API, persistencia, autenticación, autorización y contenedores alrededor de una necesidad concreta. La estantería y el tiempo por sesión dan continuidad al uso: descubrir, guardar, disfrutar y compartir una opinión.

Separar vista, rutas, controladores y modelos ayuda a localizar responsabilidades. Las restricciones de la base de datos y los controles del servidor complementan la validación del navegador. Como mejoras futuras se plantean paginación, migraciones versionadas y recuperación de contraseña.

## Referencias técnicas

- Node.js SQLite: https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html
- Node.js Crypto: https://nodejs.org/docs/latest-v24.x/api/crypto.html
- Express: https://expressjs.com/en/advanced/best-practice-security/
- Docker Compose: https://docs.docker.com/reference/cli/docker/compose/run/
