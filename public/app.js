const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const types = {
  movie: "Cine",
  book: "Libro",
  series: "Serie",
  game: "Videojuego",
};
const moods = {
  pausa: "Bajar el ritmo",
  curioso: "Descubrir algo",
  ligero: "Algo ligero",
  intenso: "Sentirlo todo",
};
const statuses = {
  pending: "Pendiente",
  in_progress: "En curso",
  finished: "Terminada",
};
const state = {
  user: null,
  csrfToken: null,
  view: "explore",
  items: [],
  shelf: [],
  shelfFilter: "",
  filters: { type: "", q: "", maxMinutes: "", mood: "", sort: "selection" },
};
let catalogueRequest = 0;
let detailRequest = 0;
let authMode = "login";
let afterAuth;
let confirmation;
let toastTimeout;
let currentDetail;
let searchTimeout;

// Text from accounts, catalogue entries and reviews is escaped before entering a template.
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const star =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/></svg>';
const bookmark =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v17l-6-4-6 4Z"/></svg>';
const clock =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg>';

const artwork = {
  movie:
    '<svg viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="86" r="58" fill="var(--cover-accent)"/><path d="M38 155 100 51l62 104Z" fill="currentColor" opacity=".8"/><circle cx="100" cy="104" r="22" fill="var(--cover-bg)"/><path d="M33 167h134M47 177h106" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  book: '<svg viewBox="0 0 200 200" aria-hidden="true"><circle cx="108" cy="88" r="62" fill="var(--cover-accent)"/><path d="M47 40q29-9 54 12v112q-25-21-54-12Zm106 0q-29-9-52 12v112q23-21 52-12Z" fill="currentColor" opacity=".85"/><path d="m58 62 29 6m-29 9 29 6m-29 9 29 6m-29 9 29 6m28-45 25-6m-25 21 25-6m-25 21 25-6m-25 21 25-6" fill="none" stroke="var(--cover-bg)" stroke-width="2"/></svg>',
  series:
    '<svg viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="98" r="67" fill="var(--cover-accent)"/><rect x="39" y="61" width="122" height="88" rx="12" fill="currentColor" opacity=".85"/><rect x="49" y="71" width="88" height="67" rx="8" fill="var(--cover-bg)"/><path d="m75 33 25 27 30-34m-58 123-9 14m64-14 10 14" fill="none" stroke="currentColor" stroke-width="5"/><circle cx="149" cy="88" r="4" fill="var(--cover-bg)"/><path d="m83 87 24 17-24 17Z" fill="var(--cover-accent)"/></svg>',
  game: '<svg viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="90" r="64" fill="var(--cover-accent)"/><path d="M68 76h64q17 0 23 25l10 38q4 19-14 17l-26-24H75l-26 24q-18 2-14-17l10-38q6-25 23-25Z" fill="currentColor" opacity=".85"/><path d="M59 105h25m-12-13v26" stroke="var(--cover-bg)" stroke-width="5"/><circle cx="130" cy="99" r="5" fill="var(--cover-bg)"/><circle cx="143" cy="113" r="5" fill="var(--cover-bg)"/><path d="M100 76V53q0-20 24-20" fill="none" stroke="currentColor" stroke-width="4"/></svg>',
};

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(state.csrfToken ? { "X-CSRF-Token": state.csrfToken } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return null;
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && state.user && path !== "/auth/login") {
      state.user = null;
      state.csrfToken = null;
      state.shelf = [];
      updateAccount();
      renderShelf();
      if ($("#item-dialog").open) $("#item-dialog").close();
      await navigate("explore");
    }
    throw Object.assign(
      new Error(result.error || "No se pudo completar la solicitud."),
      { status: response.status },
    );
  }
  return result;
}

function notify(message) {
  clearTimeout(toastTimeout);
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  toastTimeout = setTimeout(() => {
    $("#toast").hidden = true;
  }, 4500);
}

function poster(item) {
  return `<div class="poster tone-${item.id % 6}"><span class="poster-type">${types[item.type]}</span><div class="poster-art">${artwork[item.type]}</div><span class="poster-name">${escape(item.title)}</span><span class="poster-time">${item.minutes} MIN · ${escape(item.session_label)}</span></div>`;
}

function rating(item) {
  return item.review_count
    ? `<span class="card-rating" aria-label="${item.average_rating} de 5, ${item.review_count} reseñas">${star}${item.average_rating} <span>(${item.review_count})</span></span>`
    : '<span class="card-rating unrated">Por descubrir</span>';
}

function card(item, shelf = false) {
  return `<article class="item-card"><button class="cover-button" data-open="${item.id}" aria-label="Ver ${escape(item.title)}">${poster(item)}</button><div class="card-meta"><span class="mood-label">${moods[item.mood]}</span>${rating(item)}</div><button class="card-title" data-open="${item.id}">${escape(item.title)}</button><p class="card-author">${escape(item.creator)} · ${item.year}</p><div class="card-bottom"><span class="card-time">${clock}${item.minutes} min / sesión</span><button class="save-button ${item.shelf_status ? "saved" : ""}" data-save="${item.id}" aria-label="${item.shelf_status ? "Ver en tu lista" : "Guardar"} ${escape(item.title)}" aria-pressed="${Boolean(item.shelf_status)}">${bookmark}<span>${item.shelf_status ? "En tu lista" : "Guardar"}</span></button></div>${
    shelf
      ? `<div class="shelf-card-controls"><label><span class="sr-only">Estado de ${escape(item.title)}</span><select data-shelf-status="${item.id}">${Object.entries(
          statuses,
        )
          .map(
            ([key, label]) =>
              `<option value="${key}" ${item.shelf_status === key ? "selected" : ""}>${label}</option>`,
          )
          .join("")}</select></label></div>`
      : ""
  }</article>`;
}

function renderFeatured(items) {
  const selection = [
    items.find((item) => item.title === "Perfect Days"),
    items.find((item) => item.title === "La metamorfosis"),
    items.find((item) => item.title === "GRIS"),
  ].filter(Boolean);
  const remaining = items.filter(
    (item) => !selection.some((selected) => selected.id === item.id),
  );
  while (selection.length < 3 && remaining.length)
    selection.push(remaining.shift());
  $("#featured-covers").innerHTML = selection
    .map(
      (item) =>
        `<button class="featured-cover" data-open="${item.id}" aria-label="Descubrir ${escape(item.title)}">${poster(item)}</button>`,
    )
    .join("");
}

function updateAccount() {
  $("#admin-link").hidden = state.user?.role !== "admin";
  $("#account").innerHTML = state.user
    ? `<span class="account-name">Hola, ${escape(state.user.username)}</span><button class="button button-outline button-small" id="logout">Salir</button>`
    : '<button class="button button-small button-blue" id="open-login">Entrar / Registrarme</button>';
  $("#shelf-count").hidden = !state.user;
}

async function loadCatalogue() {
  const request = ++catalogueRequest;
  $("#catalogue-grid").setAttribute("aria-busy", "true");
  $("#results-status").textContent = "Buscando propuestas…";
  const query = new URLSearchParams(
    Object.entries(state.filters).filter(([, value]) => value),
  );
  try {
    const { items } = await api(`/items?${query}`);
    if (request !== catalogueRequest) return;
    state.items = items;
    $("#catalogue-grid").innerHTML = items.length
      ? items.map((item) => card(item)).join("")
      : '<div class="empty-state"><h3>Este rato aún no tiene historia.</h3><p>Prueba otro tiempo, cambia el plan o quita algún filtro para encontrar más propuestas.</p><button class="button button-blue" data-reset>Ver todas las propuestas</button></div>';
    $("#results-status").textContent =
      `${items.length} ${items.length === 1 ? "propuesta para tu rato" : "propuestas para tu rato"}`;
    const activeFilters = Boolean(
      state.filters.q ||
      state.filters.type ||
      state.filters.maxMinutes ||
      state.filters.mood ||
      state.filters.sort !== "selection",
    );
    $("#reset-filters").hidden = !activeFilters;
    if (!activeFilters) renderFeatured(items);
  } catch (error) {
    if (request !== catalogueRequest) return;
    $("#results-status").textContent = "No se pudo cargar la selección.";
    $("#catalogue-grid").innerHTML =
      '<div class="empty-state"><h3>Se nos ha quedado el rato en pausa.</h3><p>Comprueba la conexión e inténtalo otra vez.</p><button class="button button-blue" data-retry>Volver a cargar</button></div>';
  } finally {
    if (request === catalogueRequest)
      $("#catalogue-grid").setAttribute("aria-busy", "false");
  }
}

function renderShelf() {
  $("#shelf-count").textContent = state.shelf.length;
  $("#pending-count").textContent = state.shelf.filter(
    (item) => item.shelf_status === "pending",
  ).length;
  $("#progress-count").textContent = state.shelf.filter(
    (item) => item.shelf_status === "in_progress",
  ).length;
  $("#finished-count").textContent = state.shelf.filter(
    (item) => item.shelf_status === "finished",
  ).length;
  const items = state.shelf.filter(
    (item) => !state.shelfFilter || item.shelf_status === state.shelfFilter,
  );
  $("#shelf-status").textContent =
    `${items.length} ${items.length === 1 ? "historia en este apartado" : "historias en este apartado"}`;
  $("#shelf-grid").innerHTML = items.length
    ? items.map((item) => card(item, true)).join("")
    : `<div class="empty-state"><h3>${state.shelf.length ? "Aquí todavía no hay historias." : "Deja una historia para después."}</h3><p>Guarda lo que te llame la atención y vuelve cuando tengas un rato. Podrás marcar cada propuesta como pendiente, en curso o terminada.</p><a class="button button-blue" href="#explorar">Encontrar una historia</a></div>`;
}

async function loadShelf() {
  if (!state.user) {
    state.shelf = [];
    renderShelf();
    return;
  }
  $("#shelf-status").textContent = "Cargando tu estantería…";
  const { items } = await api("/shelf");
  state.shelf = items;
  renderShelf();
}

async function loadAdmin() {
  if (state.user?.role !== "admin") return;
  const { items } = await api("/items");
  $("#admin-status").textContent = `${items.length} propuestas`;
  $("#admin-items").innerHTML = items
    .map(
      (item) =>
        `<tr><td>${escape(item.title)}<br><small>${escape(item.creator)}</small></td><td>${types[item.type]}</td><td><button class="table-action" data-edit-item="${item.id}" aria-label="Editar ${escape(item.title)}">Editar</button><button class="table-action danger" data-delete-item="${item.id}" aria-label="Eliminar ${escape(item.title)}">Eliminar</button></td></tr>`,
    )
    .join("");
  renderFeatured(items);
}

async function refresh() {
  await Promise.all([
    loadCatalogue(),
    loadShelf(),
    state.view === "admin" ? loadAdmin() : Promise.resolve(),
  ]);
}

async function navigate(view) {
  if (view === "shelf" && !state.user) return openAuth(() => navigate("shelf"));
  if (view === "admin" && state.user?.role !== "admin") {
    notify("Esta página es solo para administradores.");
    return;
  }
  state.view = view;
  $("#explore-view").hidden = view !== "explore";
  $("#shelf-view").hidden = view !== "shelf";
  $("#admin-view").hidden = view !== "admin";
  $$("[data-view]").forEach((link) => {
    link.classList.toggle("active", link.dataset.view === view);
    if (link.dataset.view === view) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  const hash = {
    explore: "#explorar",
    shelf: "#estanteria",
    admin: "#gestion",
  }[view];
  if (location.hash !== hash) history.replaceState(null, "", hash);
  window.scrollTo({ top: 0, behavior: "instant" });
  if (view === "shelf") await loadShelf();
  if (view === "admin") await loadAdmin();
}

function setAuthMode(mode) {
  authMode = mode;
  const registration = mode === "register";
  $("#auth-title").textContent = registration
    ? "Haz sitio a tu próxima historia."
    : "Qué bien verte por aquí.";
  $("#auth-description").textContent = registration
    ? "Crea tu cuenta y reúne todos esos planes que no quieres olvidar."
    : "Entra para guardar tus próximos planes y compartir lo que te han parecido.";
  $("#username-label").hidden = !registration;
  $("#auth-form").elements.username.required = registration;
  $("#auth-form").elements.password.autocomplete = registration
    ? "new-password"
    : "current-password";
  $("#auth-submit").textContent = registration ? "Crear mi cuenta" : "Entrar";
  $("#auth-switch-text").textContent = registration
    ? "¿Ya tienes cuenta?"
    : "¿Primera vez?";
  $("#auth-switch").textContent = registration ? "Entrar" : "Crear una cuenta";
  $("#auth-form .form-status").textContent = "";
}

function openAuth(callback) {
  if ($("#item-dialog").open) $("#item-dialog").close();
  afterAuth = callback;
  $("#auth-form").reset();
  setAuthMode("login");
  if (!$("#auth-dialog").open) $("#auth-dialog").showModal();
}

async function saveItem(itemId, status = "pending") {
  if (!state.user) return openAuth(() => saveItem(itemId, status));
  await api(`/shelf/${itemId}`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
  await refresh();
  notify(`En tu estantería: ${statuses[status].toLowerCase()}.`);
}

function reviewEntry(review) {
  const mine = state.user?.id === review.user_id;
  const canDelete = mine || state.user?.role === "admin";
  const date = new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(review.created_at));
  const comment = `<p>${escape(review.comment)}</p>`;
  return `<article class="review-entry"><div class="review-heading"><strong>${escape(review.username)}${mine ? " · Tú" : ""}</strong><span class="card-rating">${star}${review.rating}/5</span></div><time datetime="${escape(review.created_at)}">${date}</time>${review.spoiler ? `<details><summary>Contiene spoilers · Mostrar reseña</summary>${comment}</details>` : comment}${canDelete ? `<button class="text-button" data-delete-review="${review.id}">${mine ? "Eliminar mi reseña" : "Eliminar reseña (moderación)"}</button>` : ""}</article>`;
}

function reviewForm(review) {
  if (!state.user)
    return '<div class="review-login"><h4>¿Ya la conoces?</h4><p>Tu experiencia puede ayudar a alguien a elegir su próximo rato.</p><button class="button button-blue button-small" data-login-review>Entrar y escribir</button></div>';
  return `<form class="review-form" id="review-form" data-review="${review?.id || ""}"><h4>${review ? "Tu reseña, a tu manera" : "¿Qué te ha parecido?"}</h4><fieldset class="rating-fieldset"><legend>Tu puntuación</legend><div class="rating-choices">${[1, 2, 3, 4, 5].map((number) => `<label><input type="radio" name="rating" value="${number}" aria-label="${number} de 5" required ${review?.rating === number ? "checked" : ""}><span>${number}</span></label>`).join("")}</div></fieldset><label>Cuéntalo con tus palabras<textarea name="comment" minlength="10" maxlength="1200" rows="4" required placeholder="¿Para qué momento la recomendarías?">${escape(review?.comment || "")}</textarea></label><label class="check-label"><input name="spoiler" type="checkbox" ${review?.spoiler ? "checked" : ""}>Mi reseña contiene spoilers</label><p class="form-status" role="alert"></p><button class="button button-blue button-small full-width" type="submit">${review ? "Actualizar mi reseña" : "Publicar reseña"}</button></form>`;
}

async function openItem(itemId) {
  const request = ++detailRequest;
  const result = await api(`/items/${itemId}`);
  if (request !== detailRequest) return;
  currentDetail = result;
  const { item, reviews } = result;
  const ownReview = reviews.find((review) => review.user_id === state.user?.id);
  $("#item-detail").innerHTML =
    `<div class="detail-top"><div class="detail-cover">${poster(item)}</div><div class="detail-intro"><p class="eyebrow">${types[item.type]} · ${moods[item.mood]}</p><h2>${escape(item.title)}</h2><p class="detail-creator">${escape(item.creator)} · ${item.year}</p>${rating(item)}<p class="detail-description">${escape(item.description)}</p><div class="detail-tags"><span class="detail-tag">${item.minutes} min</span><span class="detail-tag">${escape(item.session_label)}</span></div><small>Tiempo orientativo por sesión. En libros y juegos puedes parar y volver cuando quieras.</small><div class="detail-save"><label>En mi estantería<select id="detail-shelf-status">${Object.entries(
      statuses,
    )
      .map(
        ([key, label]) =>
          `<option value="${key}" ${item.shelf_status === key ? "selected" : ""}>${label}</option>`,
      )
      .join(
        "",
      )}</select></label><button class="button button-blue" id="detail-save">${item.shelf_status ? "Actualizar estado" : "Guardar para mí"}</button></div>${item.shelf_status ? '<button class="detail-unsave" id="detail-remove">Quitar de mi estantería</button>' : ""}</div></div><section class="detail-reviews"><h3>Otros ratos, otras miradas <span>(${reviews.length})</span></h3><div class="review-layout"><div class="review-list">${reviews.length ? reviews.map(reviewEntry).join("") : '<p class="review-empty">Todavía no hay reseñas. Si ya conoces esta historia, puedes abrir la conversación.</p>'}</div>${reviewForm(ownReview)}</div></section>`;
  if (!$("#item-dialog").open) $("#item-dialog").showModal();
}

function confirmRemoval(message, action) {
  confirmation = action;
  $("#confirm-message").textContent = message;
  $("#confirm-dialog .form-status").textContent = "";
  $("#confirm-dialog").showModal();
}

async function editItem(itemId) {
  const { item } = await api(`/items/${itemId}`);
  const form = $("#item-form");
  for (const [key, value] of Object.entries(item))
    if (form.elements.namedItem(key))
      form.elements.namedItem(key).value = value;
  $("#item-form-title").textContent = "Editar propuesta";
  $("#cancel-edit").hidden = false;
  form.querySelector(".form-status").textContent = "";
  form.scrollIntoView({ behavior: "instant", block: "start" });
  form.elements.title.focus({ preventScroll: true });
}

function resetItemForm() {
  $("#item-form").reset();
  $("#item-form").elements.id.value = "";
  $("#item-form-title").textContent = "Nueva propuesta";
  $("#cancel-edit").hidden = true;
  $("#item-form .form-status").textContent = "";
}

async function resetFilters() {
  state.filters = {
    type: "",
    q: "",
    maxMinutes: "",
    mood: "",
    sort: "selection",
  };
  clearTimeout(searchTimeout);
  $("#search").value = "";
  $("#time-filter").value = "";
  $("#mood-filter").value = "";
  $("#sort-filter").value = "selection";
  $$("[data-type]").forEach((button) => {
    button.classList.toggle("active", !button.dataset.type);
    button.setAttribute("aria-pressed", String(!button.dataset.type));
  });
  await loadCatalogue();
}

document.addEventListener("click", async (event) => {
  const target = event.target.closest("button, a");
  if (!target) return;
  try {
    if (target.hasAttribute("data-close")) target.closest("dialog").close();
    else if (target.dataset.view) {
      event.preventDefault();
      await navigate(target.dataset.view);
    } else if (target.hasAttribute("data-open"))
      await openItem(Number(target.dataset.open));
    else if (target.hasAttribute("data-save")) {
      const itemId = Number(target.dataset.save);
      if (state.shelf.some((item) => item.id === itemId))
        await openItem(itemId);
      else {
        target.disabled = true;
        try {
          await saveItem(itemId);
        } finally {
          target.disabled = false;
        }
      }
    } else if (target.hasAttribute("data-type")) {
      state.filters.type = target.dataset.type;
      $$("[data-type]").forEach((button) => {
        button.classList.toggle("active", button === target);
        button.setAttribute("aria-pressed", String(button === target));
      });
      await loadCatalogue();
    } else if (target.hasAttribute("data-status")) {
      state.shelfFilter = target.dataset.status;
      $$("[data-status]").forEach((button) => {
        button.classList.toggle("active", button === target);
        button.setAttribute("aria-pressed", String(button === target));
      });
      renderShelf();
    } else if (target.id === "open-login") openAuth();
    else if (target.id === "auth-switch")
      setAuthMode(authMode === "login" ? "register" : "login");
    else if (target.id === "logout") {
      await api("/auth/logout", { method: "POST", body: "{}" });
      state.user = null;
      state.csrfToken = null;
      updateAccount();
      resetItemForm();
      await navigate("explore");
      await refresh();
      notify("Hasta tu próximo rato.");
    } else if (target.id === "surprise") {
      if (!state.items.length) {
        notify("Prueba a quitar un filtro para encontrar una propuesta.");
        return;
      }
      await openItem(
        state.items[Math.floor(Math.random() * state.items.length)].id,
      );
    } else if (
      target.id === "reset-filters" ||
      target.hasAttribute("data-reset")
    )
      await resetFilters();
    else if (target.hasAttribute("data-retry")) await loadCatalogue();
    else if (target.id === "detail-save") {
      const itemId = currentDetail.item.id;
      const status = $("#detail-shelf-status").value;
      if (!state.user)
        return openAuth(async () => {
          await saveItem(itemId, status);
          await openItem(itemId);
        });
      target.disabled = true;
      try {
        await saveItem(itemId, status);
        await openItem(itemId);
      } finally {
        target.disabled = false;
      }
    } else if (target.id === "detail-remove") {
      const itemId = currentDetail.item.id;
      await api(`/shelf/${itemId}`, { method: "DELETE", body: "{}" });
      await refresh();
      await openItem(itemId);
      notify("Propuesta retirada de tu estantería.");
    } else if (target.hasAttribute("data-login-review")) {
      const itemId = currentDetail.item.id;
      openAuth(() => openItem(itemId));
    } else if (target.hasAttribute("data-delete-review")) {
      const itemId = currentDetail.item.id;
      confirmRemoval(
        "Se eliminará esta reseña y su puntuación. Esta acción no se puede deshacer.",
        async () => {
          await api(`/reviews/${target.dataset.deleteReview}`, {
            method: "DELETE",
            body: "{}",
          });
          await refresh();
          await openItem(itemId);
          notify("Reseña eliminada.");
        },
      );
    } else if (target.hasAttribute("data-edit-item"))
      await editItem(Number(target.dataset.editItem));
    else if (target.hasAttribute("data-delete-item")) {
      confirmRemoval(
        "Se borrará la propuesta junto con todas sus reseñas y sus entradas en estanterías. Esta acción no se puede deshacer.",
        async () => {
          await api(`/items/${target.dataset.deleteItem}`, {
            method: "DELETE",
            body: "{}",
          });
          if ($("#item-form").elements.id.value === target.dataset.deleteItem)
            resetItemForm();
          await refresh();
          notify("Propuesta eliminada.");
        },
      );
    } else if (target.id === "cancel-edit") resetItemForm();
    else if (target.id === "confirm-action") {
      target.disabled = true;
      try {
        await confirmation();
        $("#confirm-dialog").close();
      } catch (error) {
        $("#confirm-dialog .form-status").textContent = error.message;
      } finally {
        target.disabled = false;
      }
    }
  } catch (error) {
    notify(error.message || "Revisa la conexión y vuelve a intentarlo.");
  }
});

$("#auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = $("#auth-submit");
  button.disabled = true;
  form.querySelector(".form-status").textContent = "";
  try {
    const payload = {
      email: form.elements.email.value,
      password: form.elements.password.value,
    };
    if (authMode === "register")
      payload.username = form.elements.username.value;
    const result = await api(`/auth/${authMode}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    state.user = result.user;
    state.csrfToken = result.csrfToken;
    form.reset();
    $("#auth-dialog").close();
    updateAccount();
    await refresh();
    notify(
      authMode === "register"
        ? "Tu estantería empieza aquí. Bienvenida, bienvenido."
        : `Ya estás dentro, ${state.user.username}.`,
    );
    const callback = afterAuth;
    afterAuth = undefined;
    if (callback) await callback();
  } catch (error) {
    form.querySelector(".form-status").textContent =
      error.message || "No se pudo conectar con el servidor.";
  } finally {
    button.disabled = false;
  }
});

document.addEventListener("submit", async (event) => {
  if (event.target.id !== "review-form") return;
  event.preventDefault();
  const form = event.target;
  const button = form.querySelector("[type=submit]");
  const reviewId = form.dataset.review;
  const itemId = currentDetail.item.id;
  button.disabled = true;
  form.querySelector(".form-status").textContent = "";
  try {
    await api(reviewId ? `/reviews/${reviewId}` : `/items/${itemId}/reviews`, {
      method: reviewId ? "PUT" : "POST",
      body: JSON.stringify({
        rating: Number(form.elements.rating.value),
        comment: form.elements.comment.value,
        spoiler: form.elements.spoiler.checked,
      }),
    });
    await refresh();
    await openItem(itemId);
    notify(
      reviewId
        ? "Tu reseña se ha actualizado."
        : "Gracias por compartir tu rato.",
    );
  } catch (error) {
    form.querySelector(".form-status").textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$("#item-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("[type=submit]");
  const itemId = form.elements.id.value;
  const payload = Object.fromEntries(new FormData(form));
  delete payload.id;
  payload.minutes = Number(payload.minutes);
  payload.year = Number(payload.year);
  button.disabled = true;
  form.querySelector(".form-status").textContent = "";
  try {
    await api(itemId ? `/items/${itemId}` : "/items", {
      method: itemId ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });
    resetItemForm();
    await refresh();
    notify(itemId ? "Ficha actualizada." : "Nueva propuesta publicada.");
  } catch (error) {
    form.querySelector(".form-status").textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$("#plan-filter").addEventListener("submit", (event) => event.preventDefault());
$("#plan-filter").addEventListener("change", () => {
  state.filters.maxMinutes = $("#time-filter").value;
  state.filters.mood = $("#mood-filter").value;
  loadCatalogue().catch((error) => notify(error.message));
});
$("#sort-filter").addEventListener("change", (event) => {
  state.filters.sort = event.target.value;
  loadCatalogue().catch((error) => notify(error.message));
});
$("#search").addEventListener("input", (event) => {
  clearTimeout(searchTimeout);
  state.filters.q = event.target.value.trim();
  searchTimeout = setTimeout(
    () => loadCatalogue().catch((error) => notify(error.message)),
    250,
  );
});
document.addEventListener("change", async (event) => {
  if (!event.target.hasAttribute("data-shelf-status")) return;
  event.target.disabled = true;
  try {
    await saveItem(
      Number(event.target.dataset.shelfStatus),
      event.target.value,
    );
  } catch (error) {
    notify(error.message);
    renderShelf();
  } finally {
    event.target.disabled = false;
  }
});
window.addEventListener("hashchange", () => {
  const view = {
    "#explorar": "explore",
    "#estanteria": "shelf",
    "#gestion": "admin",
  }[location.hash];
  if (view && state.view !== view)
    navigate(view).catch((error) => notify(error.message));
});

async function start() {
  try {
    const session = await api("/session");
    state.user = session.user;
    state.csrfToken = session.csrfToken;
    updateAccount();
    await refresh();
    const initialView = { "#estanteria": "shelf", "#gestion": "admin" }[
      location.hash
    ];
    if (initialView) await navigate(initialView);
  } catch (error) {
    await loadCatalogue();
    notify(
      "No se pudo recuperar tu sesión. Recarga la página para volver a intentarlo.",
    );
  }
}

start();
