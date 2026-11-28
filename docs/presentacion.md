# Entretiempo - Exposición de 15 minutos

El reparto usa tres personas, como pide el enunciado. Asignad los nombres y ensayad con temporizador. El guion describe la implementación; no hace falta leer el código línea a línea.

| Tiempo      | Persona | Contenido                 | Material                  |
| ----------- | ------- | ------------------------- | ------------------------- |
| 0:00-1:00   | 1       | Problema y propuesta      | Portada                   |
| 1:00-3:00   | 1       | Recorrido visitante       | Filtros, búsqueda y ficha |
| 3:00-5:00   | 1       | Cuenta y estantería       | Guardar y cambiar estado  |
| 5:00-7:00   | 2       | Reseñas y spoilers        | Publicar y editar         |
| 7:00-9:00   | 2       | Arquitectura y modelo     | Carpetas y esquema        |
| 9:00-11:00  | 2       | Seguridad y permisos      | Roles y pruebas           |
| 11:00-13:00 | 3       | Administración            | Crear o editar una ficha  |
| 13:00-14:00 | 3       | Docker y validación       | Compose y npm test        |
| 14:00-15:00 | 3       | Decisiones y conclusiones | Portada                   |

## Preparación

1. Arrancar la aplicación y comprobar /health.
2. Preparar una cuenta normal y otra administradora en perfiles de navegador distintos.
3. Guardar una propuesta y preparar una reseña de ejemplo del grupo con aviso de spoilers.
4. Ejecutar npm test. Si vais a mostrar Docker, arrancarlo antes en ese equipo.
5. Comprobar el recorrido autenticado y el diseño en los dispositivos que usaréis.

## Persona 1 - Idea y uso

«Entretiempo parte de una situación común: tienes un rato libre y lo gastas decidiendo qué hacer. Reunimos cine, libros, series y videojuegos, pero empezamos por el tiempo y el tipo de plan.»

Seleccionar hasta 25 minutos y algo ligero. Aparecen A Short Hike y Derry Girls. Abrir una ficha. Buscar después Kafka y limpiar los filtros.

«El filtro no dice que un libro se termine en 25 minutos. Propone una sesión. En una película usamos su duración completa; en series, un episodio orientativo. El dato se explica siempre junto al tiempo.»

Entrar como usuario, guardar una propuesta y abrir Mi estantería. Cambiar pendiente por en curso y después por terminada.

«La estantería es personal y está en la base de datos. No depende de mantener la pestaña abierta. Podemos volver otro día o retirar una propuesta.»

## Persona 2 - Reseñas, arquitectura y seguridad

Publicar una reseña, elegir nota y marcar spoilers. Mostrar cómo se oculta el texto y cómo su autor puede editarlo.

«Solo se admite una reseña por persona y propuesta. Esa regla está en el controlador y en UNIQUE de la base de datos. La media se calcula con las reseñas existentes.»

Mostrar rutas, controladores, modelos y esquema SQL.

«Express recibe la petición. La ruta establece la operación y sus permisos. El controlador valida los datos y el modelo consulta SQLite. El navegador recibe JSON y actualiza la interfaz.»

Explicar users, items, reviews, shelf y sessions. Distinguir guardar de reseñar.

«Las contraseñas se derivan con scrypt. La cookie de sesión es HttpOnly y el servidor guarda el hash del token. Comprobamos CSRF para las escrituras y verificamos quién realiza cada operación. Ocultar un botón no basta.»

Mostrar la prueba que impide editar una reseña ajena; no es necesario escribir peticiones manuales durante la exposición.

## Persona 3 - Administración, despliegue y conclusiones

En el otro perfil, entrar como administrador. Crear y editar una ficha. Explicar la moderación desde el detalle. Si se demuestra un borrado, usar solo contenido preparado para la demostración y señalar la confirmación.

«El administrador puede retirar una reseña, pero no cambiar las palabras de otra persona. El borrado en cascada evita referencias a propuestas que ya no existen.»

Mostrar Dockerfile, compose.yaml y las pruebas.

«Docker prepara el entorno y ejecuta la aplicación con el usuario node. SQLite se guarda en un volumen que se conserva al detener el contenedor. El healthcheck verifica que responde la aplicación y la base de datos.»

«Elegimos un frontend con JavaScript sin framework para que sea fácil de seguir. SQLite evita configurar otro servicio para la demostración. Las siguientes mejoras serían paginación y migraciones. El recorrido principal ya está completo: encontrar un plan, guardarlo y compartir qué nos ha parecido.»

## Preguntas para preparar

| Pregunta                                           | Respuesta                                                                    |
| -------------------------------------------------- | ---------------------------------------------------------------------------- |
| ¿Dónde se guardan los datos?                       | En SQLite; en Docker, dentro de un volumen.                                  |
| ¿Autenticación y autorización?                     | Identificar la cuenta y decidir sus permisos, respectivamente.               |
| ¿Por qué sesiones?                                 | Permiten revocarlas al salir y evitan tokens de autenticación en JavaScript. |
| ¿Qué evita reseñas duplicadas?                     | UNIQUE(user_id, item_id) y el controlador.                                   |
| ¿Qué evita SQL injection?                          | Consultas parametrizadas y listas cerradas para ordenar.                     |
| ¿Es una recomendación por IA?                      | No; filtros y clasificación editorial.                                       |
| ¿Puedo cambiar user_id para acceder a otra cuenta? | No; el servidor usa la identidad de la sesión.                               |
| ¿Spoilers significa privado?                       | No; es una reseña pública oculta visualmente hasta abrirla.                  |
