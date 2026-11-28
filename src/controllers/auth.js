import { credentials, fail } from "../middleware/validation.js";
import { startSession, endSession } from "../middleware/session.js";
import { createUser, findByEmail, publicUser } from "../models/users.js";
import { hashPassword, verifyPassword } from "../services/password.js";

export function session(req, res) {
  res.json({
    user: req.user || null,
    csrfToken: req.session?.csrfToken || null,
  });
}

export async function register(req, res) {
  const input = credentials(req.body, true);
  const db = req.app.locals.db;
  const passwordHash = await hashPassword(input.password);
  let user;
  try {
    user = createUser(db, input.username, input.email, passwordHash);
  } catch (error) {
    if (error.code?.startsWith("ERR_SQLITE") && findByEmail(db, input.email))
      fail(409, "Ya existe una cuenta con ese correo.");
    throw error;
  }
  const csrfToken = startSession(req, res, user.id);
  res.status(201).json({ user, csrfToken });
}

export async function login(req, res) {
  const input = credentials(req.body);
  const user = findByEmail(req.app.locals.db, input.email);
  const correct = await verifyPassword(input.password, user?.password_hash);
  if (!user || !correct) fail(401, "Correo o contraseña incorrectos.");
  const csrfToken = startSession(req, res, user.id);
  res.json({ user: publicUser(user), csrfToken });
}

export function logout(req, res) {
  endSession(req, res);
  res.status(204).end();
}
