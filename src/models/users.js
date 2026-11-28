export function findByEmail(db, email) {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email);
}

export function createUser(db, username, email, passwordHash) {
  const result = db
    .prepare(
      "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
    )
    .run(username, email, passwordHash);
  return { id: Number(result.lastInsertRowid), username, email, role: "user" };
}

export function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  };
}
