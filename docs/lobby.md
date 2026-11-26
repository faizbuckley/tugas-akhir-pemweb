# Aturan Lobby Tim

Acuan untuk BE, FE, dan QA. Sumber: PRD v0.5 FR-12 sampai FR-21, FR-48, NFR-6, NFR-11. Keputusan yang tidak ada di PRD disetujui japs (BE) pada 26 November 2026.

## Tujuan

Mahasiswa membentuk tim resmi untuk satu lomba tim: buat atau cari lobby, isi semua slot, semua Siap, lobby terkunci.

Di luar cakupan: chat (FR-22, Should), rekomendasi (FR-41, Could), WebSocket.

## Status

| Dari | Ke | Pemicu |
|---|---|---|
| `OPEN` | `FULL` | Semua slot terisi; permintaan dan undangan yang menunggu otomatis ditolak |
| `FULL` | `OPEN` | Anggota keluar atau di-kick; semua status Siap di-reset |
| `FULL` | `LOCKED` | Semua anggota Siap. Final, tidak bisa diubah |
| `OPEN` / `FULL` | `DISBANDED` | Host membubarkan, lomba lewat deadline, atau host keluar saat sendirian |

"Lobby aktif" berarti `OPEN` atau `FULL`.

## Aturan

1. Hanya lomba `TIM` yang tayang dan belum lewat deadline.
2. Yang boleh membuat atau masuk lobby: akun berperan `PARTICIPANT` dengan role utama terisi (FR-3).
3. Batas lobby aktif diambil dari `Plan.maxActiveLobbies` (Free 1, Pro 5), dihitung sebagai host maupun anggota. Dicek saat membuat, meminta gabung, dan saat diterima. Pro yang berakhir tidak mengeluarkan siapa pun.
4. Satu orang hanya boleh punya satu lobby untuk satu lomba (`OPEN`, `FULL`, atau `LOCKED`).
5. Jumlah slot 2 sampai `teamSizeMax` lomba. Host menempati satu slot; tiap slot lain punya satu role yang dicari.
6. Permintaan gabung dan undangan memilih salah satu role yang masih kosong. Keduanya tidak mengisi slot sampai diterima.
7. Satu permintaan atau undangan aktif per orang per lobby. Setelah ditolak, keluar, atau di-kick, boleh mengajukan lagi.
8. Permintaan gabung bisa dibatalkan peminta lewat "keluar"; undangan bisa dibatalkan host lewat "kick".
9. **Host keluar:** status host pindah ke anggota yang paling lama bergabung. Role lama host menjadi slot kosong. Bila sendirian, lobby bubar.
10. Tidak ada batas waktu ready check; host bisa kick anggota yang tidak merespons.
11. Lobby `LOCKED` tidak bisa ditinggalkan, dibubarkan, atau diubah.
12. Tautan undangan (`inviteCode`) hanya menampilkan pratinjau tanpa data anggota. Pembukanya tetap meminta gabung dan menunggu host. Kode hanya terlihat oleh host dan bisa dibuat ulang.
13. Hapus akun: keluar dari semua lobby aktif (aturan 9 berlaku) dan permintaan yang menunggu dibatalkan. Tim yang sudah `LOCKED` tetap tercatat dengan nama yang dianonimkan.

## Polling (FR-20)

FE memanggil `GET /api/lobbies/:id` tiap 3-5 detik. Server mengirim `ETag`; bila tidak ada perubahan, jawabannya `304` tanpa body. Interval masih perlu disepakati dengan FE.

## Pendekatan untuk aturan bersamaan (NFR-6)

| Pendekatan | Untung rugi |
|---|---|
| **Dipakai:** transaksi dengan kunci baris (`SELECT ... FOR UPDATE`) pada `Lobby`, lalu `User` | Aturan ditulis berurutan dan mudah dijelaskan; permintaan ke lobby yang sama antre sebentar |
| Isolasi `SERIALIZABLE` dengan coba ulang | Tanpa kunci manual, tetapi butuh logika coba ulang di setiap aksi |
| Kolom versi (optimistic locking) | Tidak menahan antrean, tetapi tidak menjaga kuota yang melibatkan beberapa lobby |

Urutan kunci selalu lobby dulu baru pengguna, supaya tidak terjadi deadlock.

Penutupan lobby yang lewat deadline dijalankan saat ada permintaan terkait lobby, tanpa cron.
