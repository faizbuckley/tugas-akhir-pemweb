import { Router } from "express";
import { authRouter } from "./auth.js";
import { meRouter } from "./me.js";
import { categoryRouter, kegiatanRouter } from "./kegiatan.js";
import { adminKegiatanRouter } from "./adminKegiatan.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/me", meRouter);
apiRouter.use("/kegiatan", kegiatanRouter);
apiRouter.use("/categories", categoryRouter);
apiRouter.use("/admin/kegiatan", adminKegiatanRouter);
