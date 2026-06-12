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
- **Simulasi offline**: tutup game kapan saja — produksi, antrian, pertempuran, dan
  pertumbuhan bot disusulkan saat dibuka lagi (maks. 7 hari).
- **Mobile-first**, kecepatan server 1x–100x, ekspor/impor save. Save dari versi lama
  otomatis dimigrasi (termasuk penambahan bot hingga 250).

## Tips awal

1. Naikkan ladang sumber daya dulu (terutama 1 dari tiap jenis ke tk.2–3).
2. Bangun Alun-Alun → Ksatrian → latih prajurit dasar.
3. Rampok bot kecil terdekat lewat Peta (klik desa → 💰 Rampok) — jarahan mempercepat segalanya.
4. Bangun Luweng & tembok sebelum pendudukmu lewat 80 (perlindungan pemula berakhir).
