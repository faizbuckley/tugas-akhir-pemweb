import { z } from "zod";

const mode = z.enum(["ONLINE", "OFFLINE", "HYBRID"]);
const tingkat = z.enum(["KAMPUS", "REGIONAL", "NASIONAL", "INTERNASIONAL"]);
const tipePeserta = z.enum(["INDIVIDU", "TIM"]);

// Hanya http/https: link ini diklik pengguna.
const webUrl = z.url({ protocol: /^https?$/, error: "URL tidak valid" }).max(500);

const common = {
  title: z.string().trim().min(3, "Minimal 3 karakter").max(150),
  organizer: z.string().trim().min(2, "Minimal 2 karakter").max(120),
  description: z.string().trim().min(10, "Minimal 10 karakter").max(5000),
  mode,
  fee: z.coerce.number().int().min(0, "Tidak boleh negatif").default(0),
  registerUrl: webUrl,
  posterUrl: webUrl.nullish(),
};

export const lombaSchema = z
  .strictObject({
    jenis: z.literal("LOMBA"),
    ...common,
    categoryId: z.coerce.number().int().positive("Pilih kategori"),
    tingkat,
    deadline: z.coerce.date({ error: "Tanggal tidak valid" }),
    prize: z.string().trim().max(200).nullish(),
    tipePeserta,
    teamSizeMax: z.coerce.number().int().min(2).max(20).nullish(),
  })
  .refine((v) => v.tipePeserta !== "TIM" || v.teamSizeMax != null, {
    path: ["teamSizeMax"],
    message: "Wajib diisi untuk lomba tim (2-20)",
  });

export const seminarSchema = z.strictObject({
  jenis: z.literal("SEMINAR"),
  ...common,
  startsAt: z.coerce.date({ error: "Tanggal tidak valid" }),
  location: z.string().trim().min(2).max(200),
  speaker: z.string().trim().max(200).nullish(),
});

export const kegiatanInput = z.discriminatedUnion("jenis", [lombaSchema, seminarSchema]);
export type KegiatanInput = z.infer<typeof kegiatanInput>;

export const publishInput = z.strictObject({ published: z.boolean() });

export const listQuery = z.object({
  jenis: z.enum(["LOMBA", "SEMINAR"]).default("LOMBA"),
  q: z.string().trim().max(100).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  tingkat: tingkat.optional(),
  mode: mode.optional(),
  tipePeserta: tipePeserta.optional(),
  fee: z.enum(["free", "paid"]).optional(),
  deadlineBefore: z.coerce.date().optional(),
  sort: z.enum(["deadline", "newest"]).default("deadline"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export const adminListQuery = z.object({
  jenis: z.enum(["LOMBA", "SEMINAR"]).optional(),
  published: z.enum(["true", "false"]).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// Kolom yang boleh diisi per jenis; sisanya dipaksa null supaya data tidak tercampur.
const LOMBA_ONLY = ["categoryId", "tingkat", "deadline", "prize", "tipePeserta", "teamSizeMax"] as const;
const SEMINAR_ONLY = ["startsAt", "location", "speaker"] as const;

export function toDbData(input: KegiatanInput) {
  const base = {
    title: input.title,
    organizer: input.organizer,
    description: input.description,
    mode: input.mode,
    fee: input.fee,
    registerUrl: input.registerUrl,
    posterUrl: input.posterUrl ?? null,
  };

  if (input.jenis === "LOMBA") {
    return {
      ...base,
      jenis: "LOMBA" as const,
      categoryId: input.categoryId,
      tingkat: input.tingkat,
      deadline: input.deadline,
      prize: input.prize ?? null,
      tipePeserta: input.tipePeserta,
      teamSizeMax: input.tipePeserta === "TIM" ? input.teamSizeMax! : null,
      speaker: null,
      location: null,
      startsAt: null,
      // Lomba tayang sampai deadline
      visibleUntil: input.deadline,
    };
  }

  return {
    ...base,
    jenis: "SEMINAR" as const,
    categoryId: null,
    tingkat: null,
    deadline: null,
    prize: null,
    tipePeserta: null,
    teamSizeMax: null,
    speaker: input.speaker ?? null,
    location: input.location,
    startsAt: input.startsAt,
    // Seminar tayang sampai waktu mulai
    visibleUntil: input.startsAt,
  };
}

// Dipakai untuk PATCH: ambil kolom yang relevan dari record lama agar bisa digabung lalu divalidasi ulang.
export function pickEditable(record: Record<string, unknown> & { jenis: "LOMBA" | "SEMINAR" }) {
  const keys = [
    "jenis", "title", "organizer", "description", "mode", "fee", "registerUrl", "posterUrl",
    ...(record.jenis === "LOMBA" ? LOMBA_ONLY : SEMINAR_ONLY),
  ];
  return Object.fromEntries(keys.map((k) => [k, record[k]]));
}
