import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { fileURLToPath } from "node:url";
import { openDatabase } from "./config/database.js";
import { apiRoutes } from "./routes/api.js";
import { loadSession } from "./middleware/session.js";

export function createApp(options = {}) {
  const app = express();
  app.locals.db = openDatabase(options.databasePath, options.seed ?? true);
  app.locals.secureCookies =
    options.secureCookies ?? process.env.COOKIE_SECURE === "true";
  app.locals.appOrigin = options.appOrigin ?? process.env.APP_ORIGIN;
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", "data:"],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: null,
        },
      },
      strictTransportSecurity: app.locals.secureCookies ? undefined : false,
    }),
  );
  app.get("/health", (req, res) => {
    app.locals.db.prepare("SELECT 1").get();
    res.json({ status: "ok" });
  });
  app.use(
    "/api",
    rateLimit({
      windowMs: 60 * 1000,
      limit: 240,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        error: "Demasiadas solicitudes. Vuelve a intentarlo en un minuto.",
      },
    }),
  );
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use(express.json({ limit: "16kb" }));
  app.use(loadSession);
  app.use("/api", apiRoutes());
  app.use(
    express.static(fileURLToPath(new URL("../public", import.meta.url)), {
      index: "index.html",
    }),
  );
  app.use((req, res) => res.status(404).json({ error: "Ruta no encontrada." }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status || 500;
    if (status >= 500)
      console.error("Error del servidor:", error.code || error.name);
    const message =
      error.type === "entity.parse.failed"
        ? "El JSON no es válido."
        : error.type === "entity.too.large"
          ? "La solicitud es demasiado grande."
          : status < 500
            ? error.message
            : "No se pudo completar la solicitud.";
    res.status(status).json({ error: message });
  });
  return app;
}
