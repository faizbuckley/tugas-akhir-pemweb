# Veteran Achieve

Tugas akhir mata kuliah Pemrograman Web: platform web untuk mencari lomba, membentuk tim lomba lewat lobby ala game, dan ikut mentoring dalam satu tempat. Seminar ada sebagai pelengkap.

## Fitur MVP (target UAS)

- **Akun**: registrasi, login, dan profil skill (role utama, skill, portofolio).
- **Discovery**: daftar lomba dengan filter (kategori, tingkat, deadline, biaya, mode, individu/tim), pencarian, halaman detail, bookmark. Seminar versi sederhana.
- **Lobby tim**: buat lobby untuk satu lomba, browse lobby, join/invite, terima/tolak, ready check sampai lobby terkunci jadi tim.
- **Mentoring**: direktori mentor dan booking sesi (khusus member), sesi lewat video call eksternal.
- **Membership**: satu paket (Pro), bayar lewat payment gateway mode sandbox, status aktif hanya dari webhook yang signature-nya sudah diverifikasi.
- **Admin**: verifikasi lomba dan mentor, lihat transaksi.

Pengguna: peserta, ketua tim (host lobby), mentor, penyelenggara, admin.

## Tim

| Peran | Anggota |
| --- | --- |
| Frontend | iAyman Gavrie Herdian & Irsyaad Yerremia Awwalludin |
| Backend | Muzhaffar Shadiq |
| UI/UX | Muammar Faiz Al Fattah & Zahran Nur Ramadhan |
| PM & QA | Muhammad Faiz Rahman |

## Struktur

```
apps/web/   Frontend: Next.js + React + TypeScript + Tailwind
apps/api/   Backend: Express + TypeScript, database PostgreSQL lewat Prisma
            (skema di apps/api/prisma/schema.prisma)
.github/    CI, template PR & issue
```

## Menjalankan di lokal

Butuh Node.js 20 ke atas dan PostgreSQL.

```bash
npm install                      # sekali, dari root repo
cp apps/api/.env.example apps/api/.env   # lalu sesuaikan DATABASE_URL
npm run db:migrate -w apps/api   # bikin tabel dari skema Prisma
npm run dev                      # jalanin web + api barengan
```

Web jalan di http://localhost:3000, API di http://localhost:4000 (cek http://localhost:4000/health).

Sebelum push, cek dulu: `npm run lint -w apps/web`, `npm run build -w apps/web`, `npm run build -w apps/api`. CI menjalankan cek yang sama di setiap PR.

Test API: `docker compose up -d`, lalu `npm test -w apps/api`. Test memakai database terpisah `veteran_achieve_test` yang isinya dihapus setiap kali jalan (belum dijalankan di CI).

## Alur kerja

1. Ambil issue di board GitHub Projects, pindahkan ke **In Progress**.
2. Bikin branch dari `main`, contoh `feat/halaman-login` atau `fix/validasi-form`.
3. Commit, push, lalu buka Pull Request (template-nya otomatis muncul). Tulis `Closes #nomor-issue`.
4. Pindahkan issue ke **Review**. Minimal 1 anggota lain review, dan CI harus hijau.
5. Setelah di-merge, issue pindah ke **Done**.

Jangan push langsung ke `main`, dan jangan commit file `.env`.
