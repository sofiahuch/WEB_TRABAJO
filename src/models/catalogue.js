const columns = [
  "title",
  "type",
  "creator",
  "year",
  "description",
  "minutes",
  "session_label",
  "mood",
];

export function listItems(db, filters = {}, userId = null) {
  const conditions = [];
  const values = [userId];
  if (filters.q) {
    conditions.push("(i.title LIKE ? OR i.creator LIKE ?)");
    values.push(`%${filters.q}%`, `%${filters.q}%`);
  }
  if (filters.type) {
    conditions.push("i.type = ?");
    values.push(filters.type);
  }
  if (filters.mood) {
    conditions.push("i.mood = ?");
    values.push(filters.mood);
  }
  if (filters.maxMinutes) {
    conditions.push("i.minutes <= ?");
    values.push(filters.maxMinutes);
  }
  if (filters.shelf) {
    conditions.push("s.status IS NOT NULL");
  }
  const order =
    filters.sort === "rating"
      ? "average_rating DESC, review_count DESC, i.id DESC"
      : filters.sort === "short"
        ? "i.minutes ASC, i.id DESC"
        : "i.id ASC";
  return db
    .prepare(
      `SELECT i.*, ROUND(AVG(r.rating), 1) AS average_rating, COUNT(r.id) AS review_count,
    s.status AS shelf_status FROM items i
    LEFT JOIN shelf s ON s.item_id = i.id AND s.user_id = ?
    LEFT JOIN reviews r ON r.item_id = i.id
    ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
    GROUP BY i.id ORDER BY ${order} LIMIT 100`,
    )
    .all(...values);
}

export function getItem(db, itemId, userId = null) {
  return db
    .prepare(
      `SELECT i.*, ROUND(AVG(r.rating), 1) AS average_rating, COUNT(r.id) AS review_count,
    s.status AS shelf_status FROM items i LEFT JOIN reviews r ON r.item_id = i.id
    LEFT JOIN shelf s ON s.item_id = i.id AND s.user_id = ? WHERE i.id = ? GROUP BY i.id`,
    )
    .get(userId, itemId);
}

export function createItem(db, item) {
  return Number(
    db
      .prepare(
        `INSERT INTO items (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
      )
      .run(...columns.map((key) => item[key])).lastInsertRowid,
  );
}

export function updateItem(db, itemId, item) {
  return db
    .prepare(
      `UPDATE items SET ${columns.map((key) => `${key} = ?`).join(", ")} WHERE id = ?`,
    )
    .run(...columns.map((key) => item[key]), itemId);
}

export function deleteItem(db, itemId) {
  return db.prepare("DELETE FROM items WHERE id = ?").run(itemId);
}
