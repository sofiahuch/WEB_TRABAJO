import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import * as auth from "../controllers/auth.js";
import * as catalogue from "../controllers/catalogue.js";
import * as personal from "../controllers/personal.js";
import {
  protectMutation,
  requireAdmin,
  requireUser,
} from "../middleware/session.js";

export function apiRoutes() {
  const api = Router();
  const authLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error:
        "Demasiados intentos. Espera 15 minutos antes de volver a intentarlo.",
    },
  });
  api.use(protectMutation);
  api.get("/session", auth.session);
  api.post("/auth/register", authLimit, auth.register);
  api.post("/auth/login", authLimit, auth.login);
  api.post("/auth/logout", requireUser, auth.logout);
  api.get("/items", catalogue.index);
  api.get("/items/:id", catalogue.show);
  api.post("/items", requireUser, requireAdmin, catalogue.create);
  api.put("/items/:id", requireUser, requireAdmin, catalogue.update);
  api.delete("/items/:id", requireUser, requireAdmin, catalogue.destroy);
  api.get("/shelf", requireUser, personal.shelf);
  api.put("/shelf/:id", requireUser, personal.save);
  api.delete("/shelf/:id", requireUser, personal.remove);
  api.post("/items/:id/reviews", requireUser, personal.createReview);
  api.put("/reviews/:id", requireUser, personal.updateReview);
  api.delete("/reviews/:id", requireUser, personal.deleteReview);
  return api;
}
