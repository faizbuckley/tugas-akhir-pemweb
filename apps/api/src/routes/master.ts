import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

export const masterRouter = Router();

// Fakultas dan prodi untuk form profil (NFR-22). Dibatasi ke kampus pengguna bila ada.
masterRouter.get("/faculties", requireAuth, async (req, res) => {
  const { campusId } = await prisma.user.findUniqueOrThrow({
    where: { id: req.user!.id },
    select: { campusId: true },
  });
  const data = await prisma.faculty.findMany({
    where: campusId === null ? {} : { campusId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      programs: {
        orderBy: [{ level: "asc" }, { name: "asc" }],
        select: { id: true, name: true, level: true },
      },
    },
  });
  res.json({ data });
});
