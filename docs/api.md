# API Veteran Achieve (draft v0.3)

Base URL: `/api`. Format JSON. Sesi: JWT di cookie `httpOnly` (`SameSite=Lax`).
Auth: `-` publik, `U` login, `H` host lobby, `M` mentor, `A` admin.
Prioritas mengikuti PRD (M = Must, S = Should, C = Could). Tandai di sini sebelum dipakai FE (NFR-12).

**Status:** yang sudah bisa dipakai: Auth dan akun, Kegiatan (termasuk bookmark dan admin), Lobby (tanpa chat dan rekomendasi). Mentoring, Membership, dan Admin (mentor, transaksi) **belum dibuat**.

## Konvensi

- Sukses: `{ "data": ... }`; daftar berhalaman menambah `"meta": { "page", "limit", "total", "totalPages" }`. `204` tanpa body.
- Pagination: `?page=1&limit=12` (maks. 50; daftar admin default 20).
- Error: `{ "error": { "code": "...", "message": "...", "fields": { "nama": "..." } } }` (`fields` hanya untuk error validasi).
- FE wajib mengirim cookie: `fetch(url, { credentials: "include" })`.

| Status | `code` | Kapan |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Input salah |
| 400 | `INVALID_JSON` | Body bukan JSON valid |
| 401 | `UNAUTHORIZED` | Belum login atau sesi tidak berlaku |
| 403 | `FORBIDDEN` | Peran tidak cukup |
| 403 | `PROFILE_INCOMPLETE` | Role utama belum diisi; arahkan ke halaman profil (FR-3) |
| 403 | `QUOTA_EXCEEDED` | Batas paket tercapai; tampilkan ajakan upgrade (FR-42) |
| 404 | `NOT_FOUND` | Data atau endpoint tidak ada |
| 409 | `CONFLICT` | Bentrok dengan keadaan data |
| 413 | `PAYLOAD_TOO_LARGE` | Body terlalu besar |
| 429 | `RATE_LIMITED` | Terlalu banyak percobaan |
| 500 | `INTERNAL_ERROR` | Kesalahan server |

## Auth dan akun

| Method | Path | Auth | FR | Catatan |
|---|---|---|---|---|
| GET | `/auth/google` | - | FR-1 | Redirect ke Google. `?returnTo=/path` opsional. Rate limit (NFR-13) |
| GET | `/auth/google/callback` | - | FR-1, NFR-1 | Cek signature, aud, `email_verified`, domain; set cookie. Rate limit (NFR-13) |
| POST | `/auth/logout` | U | FR-2 | `204` |
| GET | `/me` | U | FR-3 | Profil, peran, paket aktif, `usage.bookmarks` |
| PATCH | `/me/profile` | U | FR-3, 46 | Kirim hanya kolom yang diubah; balasan sama dengan `GET /me` |
| DELETE | `/me` | U | FR-46 | `204`; akun dianonimkan, cookie dihapus |
| GET | `/users` | U | FR-16, 48 | Cari orang untuk diundang: `q` (nama), `facultyId`, `studyProgramId`; hanya peserta dengan role utama, tanpa diri sendiri |
| GET | `/users/:id` | U | FR-3 | Profil publik (tanpa email) |
| GET | `/master/faculties` | U | NFR-22 | `[{ id, name, code, programs: [{ id, name, level }] }]`, sebatas kampus pengguna |

Login gagal dialihkan ke `WEB_ORIGIN/login?error=<kode>`: `google_denied`, `state_mismatch`, `google_failed`, `email_unverified`, `domain_not_allowed`, `mentor_pending`, `account_deleted`.

### `PATCH /me/profile`

| Kolom | Aturan |
|---|---|
| `facultyId` | angka atau `null`; harus milik kampus pengguna |
| `studyProgramId` | angka atau `null`; `facultyId` terisi otomatis. Ganti fakultas mengosongkan prodi lama |
| `angkatan` | 2000 sampai tahun depan, atau `null` |
| `mainRole` | 2-50 karakter; **wajib** saat pertama kali mengisi skill, portofolio, atau riwayat |
| `skills` | maks. 20, tiap item 1-40 karakter; kembar dibuang |
| `portfolio` | URL `http`/`https` atau `null` |
| `history` | maks. 2000 karakter atau `null` |

Kolom lain ditolak. `profileComplete` bernilai `true` bila `mainRole` terisi.

### `DELETE /me`

Data pribadi, profil skill, bookmark, notifikasi, peran, dan pengajuan mentor dihapus; transaksi dan langganan tetap ada. Login lagi dengan email yang sama membuat akun baru yang kosong (status Pro tidak ikut). Pengguna keluar dari semua lobby aktif (status host berpindah bila perlu) dan permintaan yang menunggu dibatalkan; tim yang sudah terkunci tetap tercatat. Pembatalan sesi mentoring menyusul bersama modul mentoring.

## Kegiatan (lomba dan seminar)

| Method | Path | Auth | FR | Catatan |
|---|---|---|---|---|
| GET | `/kegiatan` | - | FR-5-7, 11 | `jenis` (default `LOMBA`), `q`, `categoryId`, `tingkat`, `mode`, `fee=free\|paid`, `tipePeserta`, `deadlineBefore`, `sort=deadline\|newest`. Hanya `published` dan `visibleUntil >= now` |
| GET | `/kegiatan/:id` | - | FR-8 | Detail + lobby OPEN untuk lomba tim |
| GET | `/categories` | - | FR-6 | |
| POST | `/kegiatan/:id/bookmark` | U | FR-9 | `201` baru, `200` sudah ada; `{ kegiatanId, quota: { used, max } }`. Hanya lomba yang tayang |
| DELETE | `/kegiatan/:id/bookmark` | U | FR-9 | `204`, juga bila belum di-bookmark |
| GET | `/me/bookmarks` | U | FR-9 | Terbaru dulu; item = kartu lomba + `bookmarkedAt`, `expired`; `meta.quota` |
| GET | `/admin/kegiatan` | A | FR-45 | Semua status, filter `jenis`, `published` |
| GET | `/admin/kegiatan/:id` | A | FR-45 | |
| POST | `/admin/kegiatan` | A | FR-45 | Kolom mengikuti `jenis`; selalu tersimpan sebagai draf |
| PATCH | `/admin/kegiatan/:id` | A | FR-45 | |
| DELETE | `/admin/kegiatan/:id` | A | FR-45 | Ditolak bila sudah ada lobby |
| POST | `/admin/kegiatan/:id/publish` | A | FR-45 | `{ "published": true }` |

Bookmark: `max: null` berarti tanpa batas. Free dibatasi `Plan.maxBookmarks` (5). Lomba yang sudah lewat tetap memakan kuota sampai dihapus; yang ditarik admin disembunyikan dan tidak dihitung. Seminar belum bisa di-bookmark (menunggu keputusan produk).

Kolom `POST /admin/kegiatan`: umum `title`, `organizer`, `description`, `mode`, `fee`, `registerUrl`, `posterUrl`; LOMBA `categoryId`, `tingkat`, `deadline`, `prize`, `tipePeserta`, `teamSizeMax` (wajib bila `TIM`); SEMINAR `startsAt`, `location`, `speaker`. Link harus `http`/`https`.

## Lobby

Aturan lengkap dan transisi status ada di [lobby.md](lobby.md). Semua aksi `POST` membalas **detail lobby** terbaru, kecuali disebut lain.

| Method | Path | Auth | FR | Body / catatan |
|---|---|---|---|---|
| GET | `/lobbies` | U | FR-13, 48 | Hanya `OPEN`. `kegiatanId`, `role` (tulisan persis seperti di `openRoles`), `facultyId` dan `studyProgramId` (milik host), `page`, `limit` |
| POST | `/lobbies` | U | FR-12, 21 | `{ kegiatanId, teamName, slots, rolesNeeded }`; `rolesNeeded` berisi `slots - 1` role. `201` |
| GET | `/lobbies/:id` | U | FR-20 | Detail; dipakai polling |
| GET | `/lobbies/by-code/:code` | - | tautan | Pratinjau: `id, teamName, status, slots, filledSlots, openRoles, kegiatan`. Rate limit |
| POST | `/lobbies/:id/join-requests` | U | FR-14 | `{ role }`. `201`. Juga dipakai dari tautan undangan |
| POST | `/lobbies/:id/join-requests/:userId/accept` | H | FR-15 | |
| POST | `/lobbies/:id/join-requests/:userId/reject` | H | FR-15 | |
| POST | `/lobbies/:id/invites` | H | FR-16 | `{ userId, role }`. `201` |
| POST | `/lobbies/:id/invites/accept` | U | FR-16 | Oleh yang diundang |
| POST | `/lobbies/:id/invites/reject` | U | FR-16 | Oleh yang diundang |
| POST | `/lobbies/:id/invite-code/regenerate` | H | tautan | Kode lama tidak berlaku |
| POST | `/lobbies/:id/leave` | U | FR-17 | Anggota keluar, atau peminta membatalkan permintaan. Host keluar = status host pindah |
| POST | `/lobbies/:id/kick/:userId` | H | FR-17 | Keluarkan anggota, atau batalkan undangan |
| POST | `/lobbies/:id/ready` | U | FR-18 | `{ ready: true \| false }` (default `true`). Hanya saat `FULL` |
| POST | `/lobbies/:id/disband` | H | FR-19 | |
| GET | `/me/lobbies` | U | FR-21 | Berhalaman; lobby yang saya ikuti atau tunggu (termasuk undangan). Item = kartu + `me` |
| GET | `/lobbies/:id/messages` | U | FR-22 (S) | Belum dibuat |
| POST | `/lobbies/:id/messages` | U | FR-22 (S) | Belum dibuat |
| GET | `/me/recommendations` | U | FR-41 (C) | Belum dibuat |

### Bentuk data

Kartu (`GET /lobbies`):

```json
{ "id": "...", "teamName": "...", "status": "OPEN", "slots": 3, "filledSlots": 1,
  "openRoles": ["Frontend", "UI/UX"], "createdAt": "...",
  "kegiatan": { "id": "...", "title": "...", "deadline": "..." },
  "host": { "id": "...", "name": "...", "avatarUrl": null, "faculty": null, "studyProgram": null } }
```

Detail (`GET /lobbies/:id`): kolom kartu (tanpa `host`) ditambah `hostId`, `rolesNeeded`, `updatedAt`, dan:

- `members`: `[{ userId, name, avatarUrl, faculty, studyProgram, role, ready, isHost }]` (yang sudah diterima)
- `me`: `null`, atau `{ isHost, status, origin, role }`. `status`: `PENDING`, `ACCEPTED`, `REJECTED`, `KICKED`, `LEFT`. `origin`: `HOST`, `REQUEST`, `INVITE`
- Hanya untuk host: `inviteCode`, dan `pending`: `[{ userId, name, ..., role, origin }]`

Tombol di FE: `me.status = PENDING` dan `origin = INVITE` berarti tampilkan Terima/Tolak; tombol Siap aktif bila `status = FULL` dan `me.status = ACCEPTED`.

### Error khusus lobby

- `403 PROFILE_INCOMPLETE`: role utama belum diisi.
- `403 QUOTA_EXCEEDED`: batas lobby aktif milik sendiri tercapai.
- `409 CONFLICT`: lobby penuh/terkunci/bubar, role sudah terisi, sudah punya tim untuk lomba itu, atau (saat host menerima) peminta sudah mencapai batas. Tampilkan `message`, lalu muat ulang detail.

### Polling

Panggil `GET /lobbies/:id` tiap 3-5 detik dengan `fetch` biasa. Browser mengurus `ETag` sendiri. **Jangan memasang header `If-None-Match` secara manual**: `fetch` lalu menambahkan `Cache-Control: no-cache` dan server selalu membalas data penuh.

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
- Semua aksi lobby memakai transaksi dengan kunci baris pada `Lobby`, lalu `User` untuk cek kuota (NFR-6).
- Webhook dipasang sebelum `express.json()` agar raw body tersedia untuk signature.
- `returnTo` pada login hanya menerima path internal (cegah open redirect).
