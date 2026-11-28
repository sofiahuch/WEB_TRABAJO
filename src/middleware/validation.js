export function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

export function text(value, label, min, max) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max
  ) {
    fail(400, `${label}: escribe entre ${min} y ${max} caracteres.`);
  }
  return value.trim();
}

export function choice(value, values, label) {
  if (!values.includes(value)) fail(400, `${label} no válido.`);
  return value;
}

export function integer(value, min, max, label) {
  if (!Number.isInteger(value) || value < min || value > max)
    fail(400, `${label}: usa un entero entre ${min} y ${max}.`);
  return value;
}

export function id(value) {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)))
    fail(400, "Identificador no válido.");
  return Number(value);
}

export function credentials(body, registration = false) {
  const email = text(body.email, "Correo", 5, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    fail(400, "Introduce un correo válido.");
  if (
    typeof body.password !== "string" ||
    body.password.length < 10 ||
    body.password.length > 128
  ) {
    fail(400, "La contraseña debe tener entre 10 y 128 caracteres.");
  }
  const result = { email, password: body.password };
  if (registration) {
    result.username = text(body.username, "Nombre", 3, 30);
    if (!/^[\p{L}\p{N}_ .-]+$/u.test(result.username))
      fail(
        400,
        "El nombre admite letras, números, espacios, puntos y guiones.",
      );
  }
  return result;
}

export function itemInput(body) {
  return {
    title: text(body.title, "Título", 1, 150),
    type: choice(body.type, ["movie", "book", "series", "game"], "Formato"),
    creator: text(body.creator, "Autoría", 1, 120),
    year: integer(body.year, 1800, 2100, "Año"),
    description: text(body.description, "Descripción", 10, 800),
    minutes: integer(body.minutes, 5, 600, "Minutos por sesión"),
    session_label: text(body.session_label, "Tipo de sesión", 1, 60),
    mood: choice(body.mood, ["pausa", "curioso", "ligero", "intenso"], "Plan"),
  };
}

export function reviewInput(body) {
  if (typeof body.spoiler !== "boolean")
    fail(400, "Indica si la reseña contiene spoilers.");
  return {
    rating: integer(body.rating, 1, 5, "Puntuación"),
    comment: text(body.comment, "Reseña", 10, 1200),
    spoiler: Number(body.spoiler),
  };
}
