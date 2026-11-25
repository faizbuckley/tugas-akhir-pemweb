# API Veteran Achieve (draft v0.1)

Base URL: `/api`. Format JSON. Sesi: JWT di cookie `httpOnly` (`SameSite=Lax`).
Auth: `-` publik, `U` login, `H` host lobby, `M` mentor, `A` admin.
Pagination: `?page=1&limit=12`. Error: `{ "error": { "code": "...", "message": "...", "fields": { "nama": "..." } } }`.
Prioritas mengikuti PRD (M = Must, S = Should, C = Could). Tandai di sini sebelum dipakai FE (NFR-12).

## Auth dan akun

| Method | Path | Auth | FR | Catatan |
|---|---|---|---|---|
| GET | `/auth/google` | - | FR-1 | Redirect ke Google |
| GET | `/auth/google/callback` | - | FR-1, NFR-1 | Cek signature, aud, `email_verified`, domain; set cookie. Rate limit (NFR-13) |
| POST | `/auth/logout` | U | FR-2 | |
| GET | `/me` | U | FR-3 | Profil, peran, paket aktif, kuota terpakai |
| PATCH | `/me/profile` | U | FR-3, 46 | Profil skill |
| DELETE | `/me` | U | FR-46 | Soft delete |
| GET | `/users/:id` | U | FR-3 | Profil publik (tanpa email) |
| GET | `/master/faculties` | U | NFR-22 | Fakultas dan prodi |

## Kegiatan (lomba dan seminar)

| Method | Path | Auth | FR | Catatan |
|---|---|---|---|---|
| GET | `/kegiatan` | - | FR-5-7, 11 | `jenis` (default `LOMBA`), `q`, `category`, `tingkat`, `mode`, `fee`, `tipePeserta`, `sort=deadline\|newest`. Hanya `published` dan `visibleUntil >= now` |
| GET | `/kegiatan/:id` | - | FR-8 | Detail + lobby OPEN untuk lomba tim |
| GET | `/categories` | - | FR-6 | |
| POST | `/kegiatan/:id/bookmark` | U | FR-9 | Kuota dari `Plan.maxBookmarks` |
| DELETE | `/kegiatan/:id/bookmark` | U | FR-9 | |
| GET | `/me/bookmarks` | U | FR-9 | |
| GET | `/admin/kegiatan` | A | FR-45 | Semua status, filter `jenis`, `published` |
| POST | `/admin/kegiatan` | A | FR-45 | zod discriminated union berdasarkan `jenis` |
| PATCH | `/admin/kegiatan/:id` | A | FR-45 | |
| DELETE | `/admin/kegiatan/:id` | A | FR-45 | Ditolak bila sudah ada lobby |
| POST | `/admin/kegiatan/:id/publish` | A | FR-45 | `{ "published": true }` |

## Lobby

| Method | Path | Auth | FR | Catatan |
|---|---|---|---|---|
| POST | `/lobbies` | U | FR-12, 21 | Wajib `mainRole`; hanya lomba tim; cek kuota lobby aktif |
| GET | `/lobbies` | U | FR-13, 48 | `kegiatanId`, `role`, `status=OPEN`, `faculty` |
| GET | `/lobbies/:id` | U | FR-20 | Dukung `If-None-Match` / `updatedAt` untuk polling |
| GET | `/lobbies/by-code/:code` | - | tautan | Pratinjau tanpa data anggota |
| POST | `/lobbies/:id/join-requests` | U | FR-14 | Juga dipakai dari tautan undangan |
| POST | `/lobbies/:id/join-requests/:userId/accept` | H | FR-15 | Transaksi + lock baris |
| POST | `/lobbies/:id/join-requests/:userId/reject` | H | FR-15 | |
| POST | `/lobbies/:id/invites` | H | FR-16 | `{ "userId" }` |
| POST | `/lobbies/:id/invites/accept` | U | FR-16 | Oleh yang diundang |
| POST | `/lobbies/:id/invites/reject` | U | FR-16 | |
| POST | `/lobbies/:id/invite-code/regenerate` | H | tautan | Kode lama tidak berlaku |
| POST | `/lobbies/:id/leave` | U | FR-17 | Reset semua `ready` |
| POST | `/lobbies/:id/kick/:userId` | H | FR-17 | Reset semua `ready` |
| POST | `/lobbies/:id/ready` | U | FR-18 | Hanya saat FULL; semua ready -> LOCKED |
| POST | `/lobbies/:id/disband` | H | FR-19 | |
| GET | `/me/lobbies` | U | FR-21 | Host dan anggota |
| GET | `/lobbies/:id/messages` | U | FR-22 (S) | |
| POST | `/lobbies/:id/messages` | U | FR-22 (S) | |
| GET | `/me/recommendations` | U | FR-41 (C) | Berbasis aturan role cocok |

## Mentoring

| Method | Path | Auth | FR | Catatan |
|---|---|---|---|---|
| POST | `/mentor-applications` | - / U | FR-23, 50 | Upload CV dan foto (multer), rate limit |
| GET | `/mentors` | - | FR-24 | Hanya terverifikasi dan aktif |
| GET | `/mentors/:id` | - | FR-24 | Profil, rating, slot kosong |
| POST | `/mentors/me/slots` | M | FR-25 | Slot tanggal spesifik |
| DELETE | `/mentors/me/slots/:id` | M | FR-25 | Hanya slot belum dibooking |
| POST | `/sessions` | U (Pro) | FR-25, 42 | `{ slotId, lobbyId? }`; unik `slotId`; kuota per periode |
| GET | `/me/sessions` | U | FR-26 | Link meet tampil setelah booking |
| POST | `/sessions/:id/cancel` | U / M | FR-28 (S) | |
| POST | `/sessions/:id/review` | U | FR-27 | Sekali, setelah jadwal lewat |

## Membership dan pembayaran

| Method | Path | Auth | FR | Catatan |
|---|---|---|---|---|
| GET | `/plans` | - | FR-29 | |
| POST | `/checkout` | U | FR-30 | Buat transaksi PENDING, kembalikan URL bayar |
| POST | `/webhooks/payment` | - | FR-31, NFR-3 | Raw body; verifikasi signature; idempoten lewat `WebhookEvent.eventKey` |
| GET | `/transactions/:orderId` | U | FR-33 | Status dari server |
| GET | `/me/transactions` | U | FR-34 | |
| GET | `/me/notifications` | U | FR-39, 43 (S) | |

## Admin

| Method | Path | Auth | FR | Catatan |
|---|---|---|---|---|
| GET | `/admin/mentor-applications` | A | FR-36 | Filter `status` |
| POST | `/admin/mentor-applications/:id/approve` | A | FR-36 | Tambah peran MENTOR, buat `Mentor`, sambung ke akun bila email kampus |
| POST | `/admin/mentor-applications/:id/reject` | A | FR-36 | |
| GET | `/admin/transactions` | A | FR-37 | Hanya baca, filter `status` |

## Catatan implementasi

- Kuota (bookmark, lobby aktif, sesi per periode) dibaca dari `Plan`, tidak ditulis di kode.
- Akun Free dihitung memakai plan `FREE`; Pro aktif bila `Subscription.endsAt > now`.
- `POST /lobbies/:id/join-requests`, accept, ready, leave, dan kick memakai transaksi dengan `SELECT ... FOR UPDATE` pada baris `Lobby` (NFR-6).
- Webhook dipasang sebelum `express.json()` agar raw body tersedia untuk signature.
- `returnTo` pada login hanya menerima path internal (cegah open redirect).
