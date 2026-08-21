import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { authRouter } from "./modules/auth/auth.routes";
import { demandesRouter } from "./modules/demandes/demandes.routes";
import { categoriesRouter } from "./modules/categories/categories.routes";
import { entitesRouter } from "./modules/entites/entites.routes";
import { budgetsRouter } from "./modules/budgets/budgets.routes";
import { usersRouter } from "./modules/users/users.routes";
import { rapportsRouter } from "./modules/rapports/rapports.routes";
import { notificationsRouter } from "./modules/notifications/notifications.routes";

export const app = express();

// F-16 / section 10 du CDC : en-têtes de sécurité, CORS restreint, HTTPS assuré en amont (reverse proxy).
app.use(helmet());
app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

app.get("/api/sante", (_req, res) => res.json({ statut: "ok" }));

app.use("/api/auth", authRouter);
app.use("/api/demandes", demandesRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/entites", entitesRouter);
app.use("/api/budgets", budgetsRouter);
app.use("/api/utilisateurs", usersRouter);
app.use("/api/rapports", rapportsRouter);
app.use("/api/notifications", notificationsRouter);

app.use(errorHandler);
