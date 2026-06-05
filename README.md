# BlockWorld v4.2 LTS Stable

BlockWorld adalah game voxel 3D sederhana berbasis browser. Project ini dibuat untuk deploy gratis di GitHub Pages.

> Catatan: ini bukan Minecraft resmi dan tidak memakai aset Minecraft. Ini hanya game block-building sederhana untuk belajar.

## Kenapa v4.2 LTS?

Versi ini dibuat supaya tidak perlu terlalu sering update. File utama memakai nama versi baru:

- `game-v42.js`
- `style-v42.css`

Tujuannya agar browser tidak mengambil file lama dari cache.

## Fitur

- Dunia 3D berbasis block.
- Hotbar item ala Minecraft di bagian bawah layar.
- Tap hotbar untuk memilih item/block.
- Target block di tengah layar dengan outline putih.
- Break dan Place mengikuti crosshair/tengah layar.
- Mobile memakai analog joystick kiri.
- Geser layar kanan untuk melihat arah.
- Tombol Jump, Break, Place, Angle, Reset, Pause.
- Kamera: 1P, Normal, Jauh, Cinematic, Top.
- Desktop: WASD, mouse, klik kiri/kanan, angka 1-9, Q/E, C, R.
- Dunia lebih hidup: bukit, pantai, air, pohon, bunga, rumput, batu, matahari, awan, dan burung.
- Collision player diperkuat supaya tidak mudah tembus block.
- Kamera third-person dicegah masuk ke block/tanah.
- Pengaturan pilihan item dan kamera disimpan di browser.
- Ada loading screen dan error box untuk membantu audit.

## Cara update ke GitHub Pages

Upload/replace semua file ini ke root repository:

```text
index.html
game-v42.js
style-v42.css
README.md
package.json
```

File lama seperti `game.js`, `game-v41.js`, `style.css`, dan `style-v41.css` boleh dibiarkan, karena `index.html` v4.2 sudah memanggil file versi baru.

Setelah commit, buka:

```text
https://hanna1pretty.github.io/hehegame/?v=42
```

## Audit v4.2

Audit dasar yang dilakukan:

- Validasi struktur file.
- Syntax check JavaScript dengan `node --check`.
- Pemeriksaan referensi file di `index.html`.
- Pemeriksaan ID HTML yang dipakai JavaScript.
- Pemeriksaan ZIP tidak corrupt.
- Validasi bahwa project tetap static HTML/CSS/JS dan aman untuk GitHub Pages.

## Keterbatasan

- Game membutuhkan koneksi internet untuk mengambil Three.js dari CDN.
- Belum ada crafting, monster kompleks, save/load world penuh, atau multiplayer.
- Performa tetap tergantung HP/browser.
