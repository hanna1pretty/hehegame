# BlockWorld v4 Final

BlockWorld adalah game voxel 3D sederhana berbasis browser. Project ini dibuat agar bisa dimainkan gratis melalui GitHub Pages tanpa backend.

Catatan: ini bukan Minecraft resmi, tidak memakai nama/aset Minecraft, dan hanya dibuat sebagai game block-building sederhana untuk belajar.

## Fitur v4 Final

- Hotbar item ala game voxel di bagian bawah layar.
- Tap slot hotbar untuk memilih block.
- Scroll mouse atau tombol angka 1-9 untuk pilih item di desktop.
- Target block berada di tengah layar memakai crosshair.
- Block yang sedang ditarget diberi outline putih.
- Break dan Place mengikuti target di tengah layar.
- Joystick analog untuk mobile.
- Pilihan kamera: 1P, Normal, Jauh, Cinematic, Top.
- Collision lebih kuat agar player tidak mudah tembus tembok/block.
- Kamera third-person lebih aman supaya tidak gampang masuk ke tanah/block.
- Dunia lebih hidup: bukit, pantai, air, pohon, bunga, rumput kecil, batu, matahari, awan bergerak, dan burung sederhana.
- Tetap static HTML/CSS/JS, cocok untuk GitHub Pages.

## Kontrol Mobile

- Analog kiri: jalan.
- Geser layar kanan: lihat sekitar.
- Hotbar bawah: pilih item/block.
- Jump: lompat.
- Break: hancurkan block yang ditarget di tengah layar.
- Place: pasang block di sisi block yang ditarget.
- Angle: ganti kamera.
- Reset: buat ulang dunia.
- Pause: jeda game.

## Kontrol Desktop

- WASD / Arrow: jalan.
- Mouse: lihat sekitar.
- Space: lompat.
- Klik kiri: hancurkan block.
- Klik kanan: pasang block.
- Angka 1-9: pilih item.
- Scroll mouse / Q / E: ganti item.
- C: ganti kamera.
- R: reset dunia.

## Cara deploy ke GitHub Pages

1. Upload semua file project ke root repository.
2. Pastikan `index.html`, `style.css`, dan `game.js` terlihat langsung di halaman utama repository.
3. Masuk ke `Settings -> Pages`.
4. Pilih:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. Klik Save.
6. Tunggu 1-5 menit.

Jika nama repository adalah `hehegame`, link biasanya:

```text
https://hanna1pretty.github.io/hehegame/
```

Untuk memaksa browser mengambil versi baru, buka:

```text
https://hanna1pretty.github.io/hehegame/?v=4
```

## Audit v4

Audit dasar yang dilakukan:

- `node --check game.js` lolos.
- Semua file utama tersedia.
- ID HTML yang dipakai JavaScript tersedia.
- ZIP berhasil dibuat dan dites strukturnya.
- Tidak memakai backend/server.
- Tidak memakai build step.
- Aman untuk GitHub Pages static hosting.

## Keterbatasan

- Game membutuhkan koneksi internet untuk mengambil Three.js dari CDN.
- Performa tergantung HP/browser.
- Collision sudah diperkuat, tetapi di HP yang sangat lag masih mungkin terasa kurang sempurna.
- Belum ada save/load world, crafting, monster, atau multiplayer.
