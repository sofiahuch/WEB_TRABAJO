# API de Entretiempo

Base local: `http://localhost:3000/api`. Respuestas JSON; un borrado correcto devuelve `204` sin cuerpo. Errores: `{"error":"mensaje"}`. `GET /health` queda fuera de `/api`.

## Autenticación

La sesión viaja en la cookie HttpOnly y SameSite=Lax `entretiempo_session`. Registro, login y consulta de sesión devuelven `csrfToken`. El frontend lo conserva en memoria y lo envía en `X-CSRF-Token` en las escrituras autenticadas. No se utilizan tokens en localStorage.

Todas las escrituras requieren `Content-Type: application/json` y un objeto JSON. Borrados y logout reciben `{}`. Se rechazan orígenes ajenos y solicitudes declaradas cross-site. No se habilita CORS para otros sitios.

| Método | Ruta           | Acceso  | Resultado                                 |
| ------ | -------------- | ------- | ----------------------------------------- |
| GET    | /session       | Público | {user, csrfToken}; ambos null sin sesión  |
| POST   | /auth/register | Público | Crea usuario normal y sesión; 201         |
| POST   | /auth/login    | Público | Comprueba credenciales y crea sesión; 200 |
| POST   | /auth/logout   | Sesión  | Revoca la sesión actual; 204              |

Registro:

```json
{
  "username": "Lucia",
  "email": "lucia@example.com",
  "password": "elige-tu-propia-contraseña"
}
```

Login usa solo email y password. Nombre: 3-30 caracteres. Contraseña: 10-128, sin recortarla. El correo se normaliza a minúsculas. Enviar role no permite registrarse como administrador.

## Catálogo

| Método | Ruta       | Acceso        | Resultado                                    |
| ------ | ---------- | ------------- | -------------------------------------------- |
| GET    | /items     | Público       | {items: [...]}; máximo 100 fichas            |
| GET    | /items/:id | Público       | {item, reviews}                              |
| POST   | /items     | Administrador | {item}; 201                                  |
| PUT    | /items/:id | Administrador | Reemplaza todos los campos editables; {item} |
| DELETE | /items/:id | Administrador | Borra ficha, reseñas y guardados; 204        |

Filtros combinables:

| Parámetro  | Valores                           |
| ---------- | --------------------------------- |
| q          | Título o autoría; 1-80 caracteres |
| type       | movie, book, series, game         |
| mood       | pausa, curioso, ligero, intenso   |
| maxMinutes | Entero 5-600; máximo por sesión   |
| sort       | selection, rating, short          |

Ejemplo: `/api/items?type=game&maxMinutes=25&mood=ligero`.

Las fichas incluyen average_rating, review_count y shelf_status. El último corresponde solo al usuario autenticado o es null. Sin opiniones, la media es null.

Cuerpo completo de creación o edición:

```json
{
  "title": "Una propuesta",
  "type": "book",
  "creator": "Una autora",
  "year": 2026,
  "description": "Descripción de la propuesta con al menos diez caracteres.",
  "minutes": 25,
  "session_label": "Un rato de lectura",
  "mood": "pausa"
}
```

Límites: título 1-150 caracteres; autoría 1-120; año entero 1800-2100; descripción 10-800; tipo de sesión 1-60. El servidor vuelve a validar los datos del formulario.

## Estantería

| Método | Ruta       | Acceso | Resultado                                  |
| ------ | ---------- | ------ | ------------------------------------------ |
| GET    | /shelf     | Sesión | {items: [...]} de esa persona              |
| PUT    | /shelf/:id | Sesión | Crea o actualiza estado; {item_id, status} |
| DELETE | /shelf/:id | Sesión | Retira el guardado propio; 204             |

Cuerpo de guardado: `{"status":"pending"}`. Estados: pending, in_progress, finished. La identidad se obtiene de la sesión; un user_id en el cuerpo no permite cambiar otra estantería.

## Reseñas

| Método | Ruta               | Acceso                | Resultado                 |
| ------ | ------------------ | --------------------- | ------------------------- |
| POST   | /items/:id/reviews | Sesión                | Crea reseña; {id}, 201    |
| PUT    | /reviews/:id       | Autor                 | Actualiza la reseña; {id} |
| DELETE | /reviews/:id       | Autor o administrador | Borra reseña; 204         |

```json
{
  "rating": 4,
  "comment": "Una buena historia para una tarde tranquila.",
  "spoiler": false
}
```

Nota entera de 1 a 5, texto de 10 a 1200 caracteres y spoiler booleano. Una reseña por usuario y propuesta. El administrador puede eliminar reseñas ajenas, pero no editarlas.

El aviso de spoilers oculta el texto con un elemento details. La reseña sigue siendo pública y aparece en el JSON: no es una medida de privacidad.

## Errores y límites

| Código | Situación                                      |
| ------ | ---------------------------------------------- |
| 400    | Datos, identificador, filtro o JSON inválido   |
| 401    | Sin sesión válida o credenciales incorrectas   |
| 403    | Sin permiso, CSRF incorrecto u origen ajeno    |
| 404    | Ficha, reseña o ruta inexistente               |
| 409    | Correo registrado o reseña duplicada           |
| 413    | Cuerpo superior a 16 KB                        |
| 415    | Escritura sin application/json                 |
| 429    | Límite de solicitudes o intentos               |
| 500    | Error interno sin consultas ni trazas públicas |

Límites por dirección IP: 240 solicitudes de API por minuto y 20 intentos de registro/login por 15 minutos. Los contadores viven en memoria del proceso; las sesiones se guardan en SQLite.
