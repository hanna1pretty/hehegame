# BlockWorld - Mini Voxel Game

BlockWorld adalah game voxel 3D sederhana berbasis browser. Project ini dibuat untuk deploy gratis di GitHub Pages.

> Catatan: ini bukan Minecraft resmi dan tidak memakai aset Minecraft. Ini hanya game block-building sederhana untuk belajar.

## Fitur

- Dunia 3D berbasis block.
- Jalan dengan keyboard desktop: `W A S D`.
- Lompat: `Space`.
- Lihat sekitar: mouse pada desktop, geser layar pada mobile.
- Hancurkan block: klik kiri desktop atau tombol `Break` mobile.
- Pasang block: klik kanan desktop atau tombol `Place` mobile.
- Pilih block: tombol `1-4` desktop atau tombol Grass/Dirt/Stone/Sand mobile.
- UI responsif untuk layar HP.
- Aman untuk GitHub Pages karena hanya memakai file static HTML/CSS/JS.

## Cara menjalankan lokal

Cara paling mudah:

1. Buka folder project.
2. Jalankan static server lokal, misalnya dengan Python:

```bash
python -m http.server 8080
```

3. Buka browser ke:

```text
http://localhost:8080
```

Jangan menjalankan langsung dari `file://` karena browser dapat membatasi module JavaScript.

## Cara deploy gratis ke GitHub Pages

1. Buat repository baru di GitHub, misalnya `blockworld`.
2. Upload semua file project ke repository tersebut.
3. Masuk ke `Settings` → `Pages`.
4. Pada `Build and deployment`, pilih:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. Klik `Save`.
6. Tunggu hingga GitHub memberi link Pages.

## Audit versi ini

Audit dasar yang sudah dilakukan:

- Validasi struktur file utama: `index.html`, `style.css`, `game.js`, `README.md`, `package.json`.
- Syntax check JavaScript menggunakan `node --check`.
- Cek referensi ID HTML yang dipakai di JavaScript.
- Cek import module Three.js.
- Cek kesiapan GitHub Pages: tidak perlu backend, database, atau build step.
- Perbaikan mobile: kontrol touch, pemilih block mobile, tampilan safe-area, dan pencegahan tombol UI ikut memicu aksi game.

## Keterbatasan

- Game membutuhkan koneksi internet untuk mengambil Three.js dari CDN.
- Performa tergantung HP/browser. Dunia dibuat kecil supaya ringan.
- Belum ada save/load world.
- Belum ada inventory kompleks, crafting, monster, atau multiplayer.

## File penting

- `index.html`: struktur halaman game.
- `style.css`: tampilan desktop dan mobile.
- `game.js`: logic game, movement, block placement, collision, dan touch control.
