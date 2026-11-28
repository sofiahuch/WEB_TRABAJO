import { choice, fail, id, reviewInput } from "../middleware/validation.js";
import { listItems } from "../models/catalogue.js";

function existingItem(req) {
  const itemId = id(req.params.id);
  if (
    !req.app.locals.db.prepare("SELECT id FROM items WHERE id = ?").get(itemId)
  )
    fail(404, "Propuesta no encontrada.");
  return itemId;
}

export function shelf(req, res) {
  res.json({
    items: listItems(req.app.locals.db, { shelf: true }, req.user.id),
  });
}

export function save(req, res) {
  const itemId = existingItem(req);
  const status = choice(
    req.body.status,
    ["pending", "in_progress", "finished"],
    "Estado",
  );
  req.app.locals.db
    .prepare(
      `INSERT INTO shelf (user_id, item_id, status) VALUES (?, ?, ?)
    ON CONFLICT(user_id, item_id) DO UPDATE SET status = excluded.status,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    )
    .run(req.user.id, itemId, status);
  res.json({ item_id: itemId, status });
}

export function remove(req, res) {
  req.app.locals.db
    .prepare("DELETE FROM shelf WHERE user_id = ? AND item_id = ?")
    .run(req.user.id, id(req.params.id));
  res.status(204).end();
}

export function createReview(req, res) {
  const itemId = existingItem(req);
  const review = reviewInput(req.body);
  const db = req.app.locals.db;
  if (
    db
      .prepare("SELECT id FROM reviews WHERE user_id = ? AND item_id = ?")
      .get(req.user.id, itemId)
  ) {
    fail(409, "Ya has escrito una reseña. Puedes editarla.");
  }
  const result = db
    .prepare(
      "INSERT INTO reviews (user_id, item_id, rating, comment, spoiler) VALUES (?, ?, ?, ?, ?)",
    )
    .run(req.user.id, itemId, review.rating, review.comment, review.spoiler);
  res.status(201).json({ id: Number(result.lastInsertRowid) });
}

function ownedReview(req, allowAdmin = false) {
  const review = req.app.locals.db
    .prepare("SELECT * FROM reviews WHERE id = ?")
    .get(id(req.params.id));
  if (!review) fail(404, "Reseña no encontrada.");
  if (
    review.user_id !== req.user.id &&
    !(allowAdmin && req.user.role === "admin")
  )
    fail(403, "Solo puedes modificar tus propias reseñas.");
  return review;
}

export function updateReview(req, res) {
  const existing = ownedReview(req);
  const review = reviewInput(req.body);
  req.app.locals.db
    .prepare(
      `UPDATE reviews SET rating = ?, comment = ?, spoiler = ?,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
    )
    .run(review.rating, review.comment, review.spoiler, existing.id);
  res.json({ id: existing.id });
}

export function deleteReview(req, res) {
  const review = ownedReview(req, true);
  req.app.locals.db.prepare("DELETE FROM reviews WHERE id = ?").run(review.id);
  res.status(204).end();
}
