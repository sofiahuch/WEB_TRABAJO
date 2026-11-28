import "dotenv/config";
import { openDatabase } from "../src/config/database.js";
import { credentials } from "../src/middleware/validation.js";
import { hashPassword, verifyPassword } from "../src/services/password.js";
import { createUser, findByEmail } from "../src/models/users.js";

const db = openDatabase();
try {
  const input = credentials(
    {
      email: process.env.ADMIN_EMAIL,
      username: process.env.ADMIN_USERNAME,
      password: process.env.ADMIN_PASSWORD,
    },
    true,
  );
  const existing = findByEmail(db, input.email);
  if (
    existing &&
    !(await verifyPassword(input.password, existing.password_hash))
  ) {
    throw new Error("La contraseña no coincide con la cuenta existente.");
  }
  const user =
    existing ||
    createUser(
      db,
      input.username,
      input.email,
      await hashPassword(input.password),
    );
  db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(user.id);
  console.log("Cuenta administradora preparada. Ya puedes iniciar sesión.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  db.close();
}
