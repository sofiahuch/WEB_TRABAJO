import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { seedCatalogue } from "../database/seed.js";

export function openDatabase(
  path = process.env.DATABASE_PATH || "./data/entretiempo.sqlite",
  seed = true,
) {
  if (path !== ":memory:")
    mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  db.exec(
    readFileSync(new URL("../database/schema.sql", import.meta.url), "utf8"),
  );
  // The schema version distinguishes first setup from an intentionally empty catalogue.
  if (db.prepare("PRAGMA user_version").get().user_version === 0) {
    if (seed) seedCatalogue(db);
    db.exec("PRAGMA user_version = 1");
  }
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
  return db;
}
