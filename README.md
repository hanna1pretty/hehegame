# BlockWorld v2 - Mini Voxel Game

BlockWorld v2 adalah game voxel 3D sederhana berbasis browser. Project ini siap deploy gratis di GitHub Pages.

> Catatan: ini bukan Minecraft resmi dan tidak memakai aset Minecraft. Ini hanya game block-building sederhana untuk belajar.

## Update besar v2.0

- Kontrol mobile diperbaiki.
- Tombol jalan kiri dibuat aktif memakai pointer events.
- UI teks besar di atas layar dihapus supaya layar game lebih bersih.
- Map dibuat lebih hidup: bukit, pantai, kolam air, pohon, bunga, pasir, batu, tanah, dan rumput.
- Ditambahkan matahari dan awan bergerak.
- Pilihan item/block diperbaiki dan bisa dipilih di HP maupun desktop.
- Ditambahkan tombol Tilt untuk membuat kamera sedikit miring.
- Tombol Break/Place mobile bisa ditekan tahan.
- Ditambahkan Pause, Reset Dunia, dan pesan kecil/toast.

## Kontrol

### Mobile

- Geser layar: melihat arah.
- Tombol kiri: jalan maju, mundur, kiri, kanan.
- Jump: lompat.
- Break: hancurkan block.
- Place: pasang block.
- Tilt: kamera miring.
- Pilih block dari bar kanan bawah.

### Desktop

- WASD / Arrow Keys: jalan.
- Space: lompat.
- Mouse: lihat arah.
- Klik kiri: hancurkan block.
- Klik kanan: pasang block.
- 1-8: pilih block.
- C: tilt kamera.
- Esc: pause.

## Deploy gratis ke GitHub Pages

1. Upload semua file ini langsung ke root repository.
2. Masuk ke `Settings` -> `Pages`.
3. Pada `Build and deployment`, pilih:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
4. Klik Save.
5. Tunggu sampai muncul link live.

Jika repo bernama `hehegame`, link biasanya:

```txt
https://hanna1pretty.github.io/hehegame/
```

## Audit v2.0

Audit dasar yang sudah dilakukan:

- Validasi struktur file utama: `index.html`, `style.css`, `game.js`, `README.md`, `package.json`.
- Syntax check JavaScript dengan `node --check`.
- Cek referensi ID HTML yang dipakai JavaScript.
- Cek import module Three.js.
- Cek tidak ada backend, database, atau build step.
- Cek fitur mobile: tombol gerak, break, place, jump, tilt, dan selector block.

## Keterbatasan

- Membutuhkan internet untuk mengambil Three.js dari CDN.
- Belum ada save/load world permanen.
- Belum ada crafting, monster, inventory kompleks, multiplayer, atau sistem survival.
- Performa bergantung pada browser dan spesifikasi HP.
