PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL CHECK(length(username) BETWEEN 3 AND 30),
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 150),
  type TEXT NOT NULL CHECK(type IN ('movie', 'book', 'series', 'game')),
  creator TEXT NOT NULL CHECK(length(creator) BETWEEN 1 AND 120),
  year INTEGER NOT NULL CHECK(year BETWEEN 1800 AND 2100),
  description TEXT NOT NULL CHECK(length(description) BETWEEN 10 AND 800),
  minutes INTEGER NOT NULL CHECK(minutes BETWEEN 5 AND 600),
  session_label TEXT NOT NULL CHECK(length(session_label) BETWEEN 1 AND 60),
  mood TEXT NOT NULL CHECK(mood IN ('pausa', 'curioso', 'ligero', 'intenso')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL CHECK(length(comment) BETWEEN 10 AND 1200),
  spoiler INTEGER NOT NULL DEFAULT 0 CHECK(spoiler IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(user_id, item_id)
);

CREATE TABLE IF NOT EXISTS shelf (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('pending', 'in_progress', 'finished')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY(user_id, item_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS reviews_item ON reviews(item_id);
CREATE INDEX IF NOT EXISTS shelf_user_status ON shelf(user_id, status);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
