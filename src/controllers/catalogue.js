import * as catalogue from "../models/catalogue.js";
import {
  choice,
  fail,
  id,
  integer,
  itemInput,
  text,
} from "../middleware/validation.js";

export function index(req, res) {
  const filters = {};
  if (req.query.q !== undefined)
    filters.q = text(req.query.q, "Búsqueda", 1, 80);
  if (req.query.type !== undefined)
    filters.type = choice(
      req.query.type,
      ["movie", "book", "series", "game"],
      "Formato",
    );
  if (req.query.mood !== undefined)
    filters.mood = choice(
      req.query.mood,
      ["pausa", "curioso", "ligero", "intenso"],
      "Plan",
    );
  if (req.query.maxMinutes !== undefined)
    filters.maxMinutes = integer(
      Number(req.query.maxMinutes),
      5,
      600,
      "Tiempo",
    );
  if (req.query.sort !== undefined)
    filters.sort = choice(
      req.query.sort,
      ["selection", "rating", "short"],
      "Orden",
    );
  res.json({
    items: catalogue.listItems(req.app.locals.db, filters, req.user?.id),
  });
}

export function show(req, res) {
  const db = req.app.locals.db;
  const item = catalogue.getItem(db, id(req.params.id), req.user?.id);
  if (!item) fail(404, "Esta propuesta ya no está en el catálogo.");
  const reviews = db
    .prepare(
      `SELECT r.*, u.username FROM reviews r JOIN users u ON u.id = r.user_id
    WHERE r.item_id = ? ORDER BY r.created_at DESC, r.id DESC`,
    )
    .all(item.id);
  res.json({ item, reviews });
}

export function create(req, res) {
  const itemId = catalogue.createItem(req.app.locals.db, itemInput(req.body));
  res
    .status(201)
    .json({ item: catalogue.getItem(req.app.locals.db, itemId, req.user.id) });
}

export function update(req, res) {
  const itemId = id(req.params.id);
  const result = catalogue.updateItem(
    req.app.locals.db,
    itemId,
    itemInput(req.body),
  );
  if (!result.changes) fail(404, "Propuesta no encontrada.");
  res.json({ item: catalogue.getItem(req.app.locals.db, itemId, req.user.id) });
}

export function destroy(req, res) {
  if (!catalogue.deleteItem(req.app.locals.db, id(req.params.id)).changes)
    fail(404, "Propuesta no encontrada.");
  res.status(204).end();
}
