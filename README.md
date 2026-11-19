# Tugas Akhir Pemrograman Web

Repo tugas akhir mata kuliah Pemrograman Web.

## Tim

| Peran | Anggota |
| --- | --- |
| Frontend | irsyad, ayman |
| Backend | japs |
| UI/UX | zahran, faiz |
| PM & QA | paji |

## Struktur

```
client/   Frontend (Vite + HTML/CSS/JS)
server/   Backend (Node.js + Express)
.github/  CI, template PR & issue
```

Stack ini titik awal yang ringan dan masih bisa diganti (misalnya ke React atau framework lain) kalau tim sepakat.

## Menjalankan di lokal

Butuh Node.js 20 ke atas.

```bash
# Terminal 1: backend di http://localhost:3000
cd server
npm install
npm run dev

# Terminal 2: frontend di http://localhost:5173
cd client
npm install
npm run dev
```

Request dari frontend ke `/api/...` otomatis diteruskan ke backend (lihat `client/vite.config.js`). Cek koneksinya di halaman awal, atau buka http://localhost:3000/api/health.

Tes backend: `cd server && npm test`.

## Alur kerja

1. Ambil issue di board GitHub Projects, pindahkan ke **In Progress**.
2. Bikin branch dari `main`, contoh `feat/halaman-login` atau `fix/validasi-form`.
3. Commit, push, lalu buka Pull Request (template-nya otomatis muncul). Tulis `Closes #nomor-issue`.
4. Pindahkan issue ke **Review**. Minimal 1 anggota lain review, dan CI harus hijau.
5. Setelah di-merge, issue pindah ke **Done**.

Jangan push langsung ke `main`, dan jangan commit file `.env`.
