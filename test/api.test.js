import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { createHash } from "node:crypto";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/config/database.js";

let app;
let server;
let base;
let alice;
let bob;
let admin;
const password = "contraseña-de-prueba-2026";

function client() {
  let cookie;
  let csrfToken;
  return {
    get cookie() {
      return cookie;
    },
    async request(
      path,
      { method = "GET", body, csrf = true, headers = {} } = {},
    ) {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(cookie ? { Cookie: cookie } : {}),
          ...(csrf && csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const setCookie = response.headers.get("set-cookie");
      if (setCookie) cookie = setCookie.split(";")[0];
      const data = response.status === 204 ? null : await response.json();
      if (data?.csrfToken) csrfToken = data.csrfToken;
      return { status: response.status, data, headers: response.headers };
    },
  };
}

async function register(name) {
  const session = client();
  const result = await session.request("/api/auth/register", {
    method: "POST",
    body: {
      username: name,
      email: `${name}@example.test`,
      password,
      role: "admin",
    },
  });
  assert.equal(result.status, 201);
  assert.equal(result.data.user.role, "user");
  return session;
}

before(async () => {
  app = createApp({ databasePath: ":memory:", secureCookies: false });
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
  alice = await register("alice");
  bob = await register("bobby");
  admin = await register("admin");
  app.locals.db
    .prepare("UPDATE users SET role = 'admin' WHERE email = ?")
    .run("admin@example.test");
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  app.locals.db.close();
});

test("el catálogo público permite combinar tiempo, formato y plan y muestra medias reales", async () => {
  const guest = client();
  assert.equal((await guest.request("/health")).data.status, "ok");
  const result = await guest.request(
    "/api/items?type=game&maxMinutes=25&mood=ligero",
  );
  assert.equal(result.status, 200);
  assert.equal(result.data.items.length, 1);
  assert.equal(result.data.items[0].title, "A Short Hike");
  assert.equal(result.data.items[0].review_count, 0);
  assert.equal(result.data.items[0].average_rating, null);
  assert.equal(result.headers.get("x-powered-by"), null);
  assert.ok(
    result.headers.get("content-security-policy").includes("script-src 'self'"),
  );
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.equal((await guest.request("/api/items?sort=unknown")).status, 400);
  assert.equal(
    (await guest.request("/api/items?type=game&type=book")).status,
    400,
  );
  assert.equal((await guest.request("/api/items?maxMinutes=-1")).status, 400);
  assert.equal(
    (await guest.request("/api/items?q=%27%20OR%201%3D1%20--")).data.items
      .length,
    0,
  );
});

test("el registro protege contraseñas y sesiones y no permite asignarse un rol", async () => {
  const stored = app.locals.db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get("alice@example.test");
  assert.equal(stored.role, "user");
  assert.notEqual(stored.password_hash, password);
  const token = alice.cookie.split("=")[1];
  assert.equal(
    app.locals.db
      .prepare("SELECT token_hash FROM sessions WHERE token_hash = ?")
      .get(token),
    undefined,
  );
  const hash = createHash("sha256").update(token).digest("hex");
  assert.ok(
    app.locals.db
      .prepare("SELECT token_hash FROM sessions WHERE token_hash = ?")
      .get(hash),
  );
  const session = await alice.request("/api/session");
  assert.equal(session.data.user.username, "alice");
  assert.equal(session.data.user.password_hash, undefined);
  const duplicate = await client().request("/api/auth/register", {
    method: "POST",
    body: { username: "otra", email: "ALICE@example.test", password },
  });
  assert.equal(duplicate.status, 409);
});

test("login, expiración y logout invalidan las sesiones en el servidor", async () => {
  const account = client();
  const bad = await account.request("/api/auth/login", {
    method: "POST",
    body: { email: "alice@example.test", password: "incorrecta-pero-larga" },
  });
  assert.equal(bad.status, 401);
  const login = await account.request("/api/auth/login", {
    method: "POST",
    body: { email: "alice@example.test", password },
  });
  assert.equal(login.status, 200);
  assert.ok(login.headers.get("set-cookie").includes("HttpOnly"));
  assert.ok(login.headers.get("set-cookie").includes("SameSite=Lax"));
  const oldCookie = account.cookie;
  assert.equal(
    (await account.request("/api/auth/logout", { method: "POST", body: {} }))
      .status,
    204,
  );
  assert.equal(
    (await client().request("/api/shelf", { headers: { Cookie: oldCookie } }))
      .status,
    401,
  );
  const expired = await register("expired");
  const token = expired.cookie.split("=")[1];
  app.locals.db
    .prepare("UPDATE sessions SET expires_at = ? WHERE token_hash = ?")
    .run(Date.now() - 1, createHash("sha256").update(token).digest("hex"));
  assert.equal((await expired.request("/api/shelf")).status, 401);
});

test("las mutaciones rechazan peticiones sin CSRF, de otro origen o con cuerpos inválidos", async () => {
  assert.equal(
    (
      await alice.request("/api/shelf/1", {
        method: "PUT",
        body: { status: "pending" },
        csrf: false,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await alice.request("/api/shelf/1", {
        method: "PUT",
        body: { status: "pending" },
        headers: { Origin: "https://another.example" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await alice.request("/api/shelf/1", {
        method: "PUT",
        body: { status: "pending" },
        headers: { "Sec-Fetch-Site": "cross-site" },
      })
    ).status,
    403,
  );
  assert.equal(
    (await client().request("/api/auth/register", { method: "POST", body: [] }))
      .status,
    400,
  );
  assert.equal(
    (
      await client().request("/api/auth/register", {
        method: "POST",
        body: { email: "bad" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await client().request("/api/auth/login", {
        method: "POST",
        body: {},
        headers: { "Content-Type": "text/plain" },
      })
    ).status,
    415,
  );
  const malformed = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{no",
  });
  assert.equal(malformed.status, 400);
});

test("la estantería es privada y permite cambiar de estado y retirar propuestas", async () => {
  assert.equal((await client().request("/api/shelf")).status, 401);
  assert.equal(
    (
      await alice.request("/api/shelf/2", {
        method: "PUT",
        body: { status: "pending" },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await alice.request("/api/shelf/2", {
        method: "PUT",
        body: { status: "in_progress" },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await alice.request("/api/shelf/2", {
        method: "PUT",
        body: { status: "finished" },
      })
    ).status,
    200,
  );
  assert.equal(
    (await alice.request("/api/shelf")).data.items[0].shelf_status,
    "finished",
  );
  assert.equal((await bob.request("/api/shelf")).data.items.length, 0);
  assert.equal(
    (
      await alice.request("/api/shelf/2", {
        method: "PUT",
        body: { status: "inventado" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await alice.request("/api/shelf/9999", {
        method: "PUT",
        body: { status: "pending" },
      })
    ).status,
    404,
  );
  assert.equal(
    (await alice.request("/api/shelf/2", { method: "DELETE", body: {} }))
      .status,
    204,
  );
  assert.equal((await alice.request("/api/shelf")).data.items.length, 0);
});

test("cada usuario tiene una reseña por ficha y solo su autor puede editarla", async () => {
  const review = {
    rating: 4,
    comment: "Un buen plan para bajar el ritmo un rato.",
    spoiler: false,
  };
  const created = await alice.request("/api/items/3/reviews", {
    method: "POST",
    body: review,
  });
  assert.equal(created.status, 201);
  const reviewId = created.data.id;
  assert.equal(
    (
      await alice.request("/api/items/3/reviews", {
        method: "POST",
        body: review,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await bob.request(`/api/reviews/${reviewId}`, {
        method: "PUT",
        body: { ...review, rating: 1 },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await bob.request(`/api/reviews/${reviewId}`, {
        method: "DELETE",
        body: {},
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await admin.request(`/api/reviews/${reviewId}`, {
        method: "PUT",
        body: review,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await alice.request(`/api/reviews/${reviewId}`, {
        method: "PUT",
        body: {
          rating: 5,
          comment: "<img src=x onerror=alert(1)> Una opinión en texto.",
          spoiler: true,
        },
      })
    ).status,
    200,
  );
  const detail = await client().request("/api/items/3");
  assert.equal(detail.data.item.average_rating, 5);
  assert.equal(detail.data.reviews[0].spoiler, 1);
  assert.ok(detail.data.reviews[0].comment.startsWith("<img"));
  assert.equal(
    (
      await admin.request(`/api/reviews/${reviewId}`, {
        method: "DELETE",
        body: {},
      })
    ).status,
    204,
  );
  assert.equal(
    (await client().request("/api/items/3")).data.item.review_count,
    0,
  );
});

test("la API valida notas, textos e identificadores y permite al autor borrar su reseña", async () => {
  const review = {
    rating: 4,
    comment: "Una reseña de prueba suficientemente larga.",
    spoiler: false,
  };
  assert.equal(
    (
      await alice.request("/api/items/4/reviews", {
        method: "POST",
        body: { ...review, rating: 6 },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await alice.request("/api/items/4/reviews", {
        method: "POST",
        body: { ...review, rating: 3.5 },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await alice.request("/api/items/4/reviews", {
        method: "POST",
        body: { ...review, spoiler: "false" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await alice.request("/api/items/4/reviews", {
        method: "POST",
        body: { ...review, comment: "corta" },
      })
    ).status,
    400,
  );
  assert.equal((await alice.request("/api/items/4abc")).status, 400);
  assert.equal((await alice.request("/api/items/9999")).status, 404);
  const result = await alice.request("/api/items/4/reviews", {
    method: "POST",
    body: review,
  });
  assert.equal(
    (
      await alice.request(`/api/reviews/${result.data.id}`, {
        method: "DELETE",
        body: {},
      })
    ).status,
    204,
  );
});

test("solo el administrador gestiona el catálogo y el borrado conserva la integridad referencial", async () => {
  const item = {
    title: "Propuesta de prueba",
    type: "book",
    creator: "Autora de prueba",
    year: 2026,
    description:
      "Una descripción propia creada para esta prueba de integración.",
    minutes: 20,
    session_label: "Un rato de lectura",
    mood: "pausa",
  };
  assert.equal(
    (await client().request("/api/items", { method: "POST", body: item }))
      .status,
    401,
  );
  assert.equal(
    (await alice.request("/api/items", { method: "POST", body: item })).status,
    403,
  );
  const created = await admin.request("/api/items", {
    method: "POST",
    body: item,
  });
  assert.equal(created.status, 201);
  const itemId = created.data.item.id;
  assert.equal(
    (
      await admin.request(`/api/items/${itemId}`, {
        method: "PUT",
        body: { ...item, minutes: 25 },
      })
    ).status,
    200,
  );
  await alice.request(`/api/shelf/${itemId}`, {
    method: "PUT",
    body: { status: "pending" },
  });
  await alice.request(`/api/items/${itemId}/reviews`, {
    method: "POST",
    body: {
      rating: 3,
      comment: "Reseña de una propuesta temporal.",
      spoiler: false,
    },
  });
  assert.equal(
    (
      await alice.request(`/api/items/${itemId}`, {
        method: "DELETE",
        body: {},
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await admin.request(`/api/items/${itemId}`, {
        method: "DELETE",
        body: {},
      })
    ).status,
    204,
  );
  assert.equal(
    app.locals.db
      .prepare("SELECT COUNT(*) AS n FROM shelf WHERE item_id = ?")
      .get(itemId).n,
    0,
  );
  assert.equal(
    app.locals.db
      .prepare("SELECT COUNT(*) AS n FROM reviews WHERE item_id = ?")
      .get(itemId).n,
    0,
  );
});

test("los datos persisten en disco y vaciar el catálogo no vuelve a crear las fichas al reiniciar", () => {
  const dir = mkdtempSync(join(tmpdir(), "entretiempo-test-"));
  const path = join(dir, "test.sqlite");
  try {
    let db = openDatabase(path);
    db.prepare(
      "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
    ).run("persistente", "persist@example.test", "hash-de-prueba");
    db.prepare(
      "INSERT INTO shelf (user_id, item_id, status) VALUES (1, 1, 'finished')",
    ).run();
    db.close();
    db = openDatabase(path);
    assert.equal(
      db.prepare("SELECT status FROM shelf WHERE user_id = 1").get().status,
      "finished",
    );
    assert.equal(
      db.prepare("SELECT username FROM users WHERE id = 1").get().username,
      "persistente",
    );
    db.exec("DELETE FROM items");
    db.close();
    db = openDatabase(path);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM items").get().n, 0);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("el límite de intentos de acceso devuelve 429", async () => {
  const guest = client();
  let status;
  for (let attempt = 0; attempt < 25; attempt++) {
    const result = await guest.request("/api/auth/login", {
      method: "POST",
      body: { email: "no-valido", password: "contraseña-cualquiera" },
    });
    status = result.status;
    if (status === 429) break;
  }
  assert.equal(status, 429);
});
