import { createHash, randomBytes } from "node:crypto";
import { fail } from "./validation.js";

const cookieName = "entretiempo_session";
const lifetime = 7 * 24 * 60 * 60 * 1000;
const digest = (token) => createHash("sha256").update(token).digest("hex");

export function loadSession(req, res, next) {
  const cookie = (req.headers.cookie || "")
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${cookieName}=`));
  const token = cookie?.slice(cookieName.length + 1);
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    const row = req.app.locals.db
      .prepare(
        `SELECT users.id, users.username, users.email, users.role,
      sessions.csrf_token, sessions.token_hash FROM sessions JOIN users ON users.id = sessions.user_id
      WHERE token_hash = ? AND expires_at > ?`,
      )
      .get(digest(token), Date.now());
    if (row) {
      req.user = {
        id: row.id,
        username: row.username,
        email: row.email,
        role: row.role,
      };
      req.session = { csrfToken: row.csrf_token, tokenHash: row.token_hash };
    }
  }
  next();
}

function cookieOptions(req) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: req.app.locals.secureCookies,
    path: "/",
  };
}

export function startSession(req, res, userId) {
  const db = req.app.locals.db;
  const token = randomBytes(32).toString("hex");
  const csrfToken = randomBytes(24).toString("hex");
  if (req.session)
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(
      req.session.tokenHash,
    );
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
  db.prepare(
    "INSERT INTO sessions (token_hash, user_id, csrf_token, expires_at) VALUES (?, ?, ?, ?)",
  ).run(digest(token), userId, csrfToken, Date.now() + lifetime);
  res.cookie(cookieName, token, { ...cookieOptions(req), maxAge: lifetime });
  return csrfToken;
}

export function endSession(req, res) {
  req.app.locals.db
    .prepare("DELETE FROM sessions WHERE token_hash = ?")
    .run(req.session.tokenHash);
  res.clearCookie(cookieName, cookieOptions(req));
}

export function requireUser(req, res, next) {
  if (!req.user) fail(401, "Inicia sesión para continuar.");
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user.role !== "admin")
    fail(403, "Esta acción es solo para administradores.");
  next();
}

export function protectMutation(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (!req.is("application/json"))
    fail(415, "Envía el contenido como application/json.");
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body))
    fail(400, "Envía un objeto JSON válido.");
  if (req.user && req.get("X-CSRF-Token") !== req.session.csrfToken)
    fail(403, "La sesión necesita actualizarse. Recarga la página.");
  if (req.get("Sec-Fetch-Site") === "cross-site")
    fail(403, "Origen de la solicitud no permitido.");
  const origin = req.get("Origin");
  if (origin) {
    let allowed = false;
    try {
      const expected = req.app.locals.appOrigin;
      const parsed = new URL(origin);
      allowed = expected
        ? parsed.origin === expected
        : parsed.host === req.get("host") &&
          ["http:", "https:"].includes(parsed.protocol);
    } catch {
      /* Invalid origins are rejected below. */
    }
    if (!allowed) fail(403, "Origen de la solicitud no permitido.");
  }
  next();
}
