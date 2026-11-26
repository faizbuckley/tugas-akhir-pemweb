import { z } from "zod";
import { pageQuery } from "./pagination.js";

const role = z.string().trim().min(2, "Minimal 2 karakter").max(50);
const id = z.coerce.number().int().positive();

export const createLobbyInput = z.strictObject({
  kegiatanId: z.string().min(1),
  teamName: z.string().trim().min(3, "Minimal 3 karakter").max(50),
  slots: z.number().int().min(2, "Minimal 2 slot").max(20),
  rolesNeeded: z.array(role).max(19),
});
export type CreateLobbyInput = z.infer<typeof createLobbyInput>;

export const joinInput = z.strictObject({ role });
export const inviteInput = z.strictObject({ userId: z.string().min(1), role });
export const readyInput = z.strictObject({ ready: z.boolean().default(true) });

export const browseQuery = pageQuery.extend({
  kegiatanId: z.string().optional(),
  role: z.string().trim().max(50).optional(),
  facultyId: id.optional(),
  studyProgramId: id.optional(),
});
export type BrowseQuery = z.infer<typeof browseQuery>;
