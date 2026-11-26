import { env } from "./lib/env.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { apiRouter } from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./lib/errors.js";

// Dipisah dari index.ts supaya test bisa memakai app tanpa membuka port tetap.
export const app = express();
app.use(helmet());
app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);
