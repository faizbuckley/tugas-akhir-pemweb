import { z } from "zod";
import { pageQuery } from "./pagination.js";

const skills = z
  .array(z.string().trim().min(1, "Skill tidak boleh kosong").max(40))
  .max(20, "Maksimal 20 skill")
  // Kembar tanpa melihat huruf besar kecil dibuang; urutan pertama dipertahankan.
  .transform((list) => [...new Map(list.map((s) => [s.toLowerCase(), s] as const).reverse()).values()].reverse());

export const profileInput = z.strictObject({
  facultyId: z.number().int().positive().nullable().optional(),
  studyProgramId: z.number().int().positive().nullable().optional(),
  angkatan: z
    .number()
    .int()
    .min(2000, "Angkatan tidak valid")
    .max(new Date().getFullYear() + 1, "Angkatan tidak valid")
    .nullable()
    .optional(),
  mainRole: z.string().trim().min(2, "Minimal 2 karakter").max(50).optional(),
  skills: skills.optional(),
  // Hanya http/https: link ini ditampilkan ke pengguna lain.
  portfolio: z.url({ protocol: /^https?$/, error: "URL harus diawali http:// atau https://" }).max(500).nullable().optional(),
  history: z.string().trim().max(2000).nullable().optional(),
});

export type ProfileInput = z.infer<typeof profileInput>;

const masterId = z.coerce.number().int().positive().optional();

export const userSearchQuery = pageQuery.extend({
  q: z.string().trim().max(100).optional(),
  facultyId: masterId,
  studyProgramId: masterId,
});
export type UserSearchQuery = z.infer<typeof userSearchQuery>;
