import { Router } from "express";
import { authRouter } from "./auth.js";
import { meRouter } from "./me.js";
import { categoryRouter, kegiatanRouter } from "./kegiatan.js";
import { adminKegiatanRouter } from "./adminKegiatan.js";
import { userRouter } from "./users.js";
import { masterRouter } from "./master.js";
import { lobbyRouter } from "./lobbies.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/me", meRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/master", masterRouter);
apiRouter.use("/lobbies", lobbyRouter);
apiRouter.use("/kegiatan", kegiatanRouter);
apiRouter.use("/categories", categoryRouter);
apiRouter.use("/admin/kegiatan", adminKegiatanRouter);
