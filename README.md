# ⚔️ Wilwatikta — Offline

Game strategi bergaya **Travian Classic** bertema kerajaan Jawa, berjalan 100% offline
di browser — tanpa internet, tanpa server. Semua rumus (produksi, biaya, pertempuran)
identik dengan Travian Klasik; hanya nama-namanya yang dijawakan.

## Cara main

**Klik dua kali `index.html`** — selesai. Game terbuka di browser dan tersimpan otomatis
di browser tersebut (localStorage). Gunakan browser yang sama agar kemajuanmu tetap ada.

## Fitur

- **3 kerajaan**: 🌞 Majapahit (seimbang, elit), 🗡️ Singasari (agresif, murah),
  🛡️ Mataram (bertahan, Luweng besar) — masing-masing 9 prajurit dengan statistik asli
  Travian: Bhayangkara, Telik Sandi, Meriam Cetbang, Gajah Pendobrak, Kilat Turangga, dll.
- **18 ladang** (Hutan Jati, Galian Lempung, Tambang Besi, Sawah Padi) + pusat desa dengan
  bangunan Jawa: Pendopo Agung, Lumbung Padi, Alun-Alun, Ksatrian, Gedogan Kuda, Padepokan,
  Besalen Empu, Kraton, Luweng, Pagar Bambu/Kuta Bata/Benteng Kayu, dll.
- **250 bot aktif** (±340 desa, semua namanya unik) yang **hidup seperti pemain asli** —
  penduduk bertambah tiap beberapa detik, prajurit dilatih ulang, **bot mendirikan desa
  ke-2, ke-3, dst.**, **saling menyerang dengan intensitas rendah** (populasi korban tidak
  berkurang, jadi bot tertinggal tetap bisa tumbuh), dan sesekali merampok desamu.
- **Pertempuran formula Travian**: serangan vs rampokan, bonus tembok, pendobrak, pelontar,
  pengintaian, perlindungan Luweng, laporan pertempuran lengkap.
- **Statistik real time**: peringkat penduduk (menyegarkan diri tiap 3 detik, dengan jumlah
  desa & laju pertumbuhan) plus papan **Penyerang Terbanyak**, **Bertahan Terbanyak**, dan
  **Perampok Terbanyak** — kamu ikut dihitung di dalamnya.
- **Ekspansi**: Kraton tk.10 → 3 Pemukim → dirikan desa baru di petak kosong.
- **Peta luas 101×101** berisi 250 bot & 150 oasis.
- **Taklukkan Oasis** (persis Travian): kalahkan pasukan alam liar di oasis untuk bonus
  produksi **+25–50%** sesuai jenisnya — Alas Jati (+50% kayu), Gunung Kapur (+50% lempung),
  Tambang Wesi (+50% besi), Padang Ilalang/Alas Liar (+50% padi), Lembah Hijau (+25% lempung &
  padi). Maks. 3 oasis per desa.
- **⭐ Wilwatikta Plus** — beli berkah memakai sumber daya, berdurasi 1/3/7 hari:
  - 🌾 **Berkah Panen**: +25% seluruh produksi.
  - ⚡ **Tangan Dewata**: selesaikan pembangunan (gedung, ladang, Candi) seketika.
  - 🎯 **Gemblengan Kilat**: selesaikan seluruh antrian pelatihan prajurit seketika.
- **Bangunan tingkat tinggi**: ladang, Gudang, Lumbung Padi, Pasar, Penggergajian,
  Pembakaran Bata, Peleburan Besi, & Lesung Padi bisa naik hingga **tingkat 100**
  (kurva harga tetap rumus Travian sampai batas asli, lalu melandai agar tercapai).
- **🐴 Sendang Turangga** (khas Majapahit): mengurangi konsumsi padi pasukan berkuda.
- **🛕 Mode World Wonder**: bangun **Candi Agung** hingga tk.100 dan berlomba dengan bot —
  siapa pun (pemain/bot) yang menyelesaikannya **lebih dulu menang & dunia berakhir**,
  lalu bisa diulang. Atau pilih **mode bebas** tanpa Wonder dan tanpa batas waktu.
  Saat kamu sedang offline, progres Candi para bot **melambat 100×** agar kamu tetap bisa mengejar.
- **👤 Hingga 2 akun** dengan dunia berbeda (mis. satu Wonder, satu bebas). Ganti lewat
  **Bantuan → Keluar / Pilih Akun**.
- **Statistik real time bertab**: peringkat Penduduk, Penyerang, Bertahan, dan Perampok
  Terbanyak — masing-masing tab tersendiri.
- **Laporan**: 10 per halaman, maks. 100 (yang lama otomatis terhapus saat ada yang baru).
  Klik ⭐ untuk menyimpan laporan penting agar tidak ikut terhapus.
- **Simulasi offline**: tutup game kapan saja — produksi, antrian, pertempuran, perlombaan
  Candi, dan pertumbuhan bot disusulkan saat dibuka lagi (maks. 7 hari).
- **Mobile-first**, kecepatan server 1x–100x, ekspor/impor save. Save versi lama otomatis dimigrasi.

## Tips awal

1. Naikkan ladang sumber daya dulu (terutama 1 dari tiap jenis ke tk.2–3).
2. Bangun Alun-Alun → Ksatrian → latih prajurit dasar.
3. Rampok bot kecil terdekat lewat Peta (klik desa → 💰 Rampok) — jarahan mempercepat segalanya.
4. Bangun Luweng & tembok sebelum pendudukmu lewat 80 (perlindungan pemula berakhir).
5. Taklukkan oasis terdekat untuk dongkrak produksi, lalu beli ⭐ Plus saat sumber daya melimpah.
6. Mode Wonder? Pakai ⚡ Tangan Dewata untuk menyelesaikan Candi seketika dan menyalip para bot.
