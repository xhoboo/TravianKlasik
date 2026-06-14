'use strict';
/* ================= DATA WILWATIKTA (rumus = Travian Klasik) ================= */
const RES_KEYS = ['wood','clay','iron','crop'];
const RES_ICON = {wood:'🪵', clay:'🧱', iron:'⛏️', crop:'🌾'};
const RES_NAMA = {wood:'Kayu', clay:'Lempung', iron:'Besi', crop:'Padi'};

// Produksi ladang per jam per tingkat (0-10) — tabel asli Travian
const FIELD_PROD = [3,7,13,21,31,46,70,98,140,203,280];
const FIELD_MAX = 10;

// Kapasitas gudang/lumbung per tingkat (0-20)
const STORE_CAP = [800,1200,1700,2300,3100,4000,5000,6300,7800,9600,11800,14400,17600,21400,25900,31300,37900,45700,55100,66400,80000];
// Kapasitas luweng per tingkat (0-10)
const CRANNY_CAP = [0,100,130,170,220,280,360,460,600,770,1000];

// Jenis ladang sumber daya  (cost = biaya tingkat 1, k = waktu dasar dtk, faktor biaya 1.67)
const FIELD_TYPES = {
  wood:{nama:'Hutan Jati',     res:'wood', icon:'🌲', cost:[40,100,50,60],  k:300},
  clay:{nama:'Galian Lempung', res:'clay', icon:'🧱', cost:[80,40,80,50],  k:270},
  iron:{nama:'Tambang Besi',   res:'iron', icon:'⛏️', cost:[100,80,30,60],  k:450},
  crop:{nama:'Sawah Padi',     res:'crop', icon:'🌾', cost:[70,90,70,20],  k:220},
};

// Bangunan pusat desa (gaya Jawa). cost = tingkat 1, faktor 1.28; t = waktu dasar; pop per tingkat
const B = {
  main:     {nama:'Pendopo Agung',     icon:'🏛️', cost:[70,40,60,20],    t:2200, max:20, pop:2, desc:'Balai utama desa — mempercepat semua pembangunan (−4% per tingkat).'},
  warehouse:{nama:'Gudang',            icon:'📦', cost:[130,160,90,40],  t:2000, max:20, pop:1, multi:true, desc:'Menyimpan kayu, lempung, dan besi.'},
  granary:  {nama:'Lumbung Padi',      icon:'🍚', cost:[80,100,70,20],   t:1600, max:20, pop:1, multi:true, desc:'Menyimpan padi hasil panen sawah.'},
  rally:    {nama:'Alun-Alun',         icon:'🚩', cost:[110,160,90,70],  t:1800, max:20, pop:1, desc:'Lapangan tempat prajurit berkumpul. Dibutuhkan untuk mengirim serangan.'},
  barracks: {nama:'Ksatrian',          icon:'⚔️', cost:[210,140,260,120],t:2200, max:20, pop:4, req:{main:3,rally:1}, desc:'Asrama prajurit jalan kaki. Tiap tingkat mempercepat pelatihan.'},
  stable:   {nama:'Gedogan Kuda',      icon:'🐎', cost:[260,140,220,100],t:2600, max:20, pop:5, req:{smithy:3,academy:5}, desc:'Melatih prajurit berkuda.'},
  workshop: {nama:'Bengkel Perang',    icon:'🛠️', cost:[460,510,600,320],t:3500, max:20, pop:4, req:{academy:10,main:5}, desc:'Membuat pendobrak dan pelontar pengepungan.'},
  academy:  {nama:'Padepokan',         icon:'🎓', cost:[220,160,90,40],  t:2400, max:20, pop:4, req:{barracks:3,main:3}, desc:'Tempat berguru — meriset jenis prajurit baru.'},
  smithy:   {nama:'Besalen Empu',      icon:'⚒️', cost:[170,200,380,130],t:2400, max:20, pop:4, req:{main:3,academy:1}, desc:'Tempaan sang empu: +1,5% kekuatan serang & bertahan prajurit per tingkat.'},
  market:   {nama:'Pasar',             icon:'⚖️', cost:[80,70,120,70],   t:2000, max:20, pop:4, req:{main:3,warehouse:1,granary:1}, desc:'Menukar dan mengirim sumber daya.'},
  embassy:  {nama:'Bale Agung',        icon:'🏳️', cost:[180,130,150,80], t:2000, max:20, pop:3, desc:'Balai pertemuan para utusan. (Hiasan — aliansi tidak tersedia di mode offline.)'},
  cranny:   {nama:'Luweng',            icon:'🕳️', cost:[40,50,30,10],    t:350,  max:10, pop:0, multi:true, desc:'Lubang rahasia yang menyembunyikan sumber daya dari perampok. (Mataram: kapasitas ×1,5)'},
  residence:{nama:'Kraton',            icon:'🏰', cost:[580,460,350,180],t:3000, max:20, pop:1, req:{main:5}, desc:'Istana kecil — di tingkat 10 dapat melatih pemukim untuk mendirikan desa baru.'},
  sawmill:  {nama:'Penggergajian Jati',icon:'🪚', cost:[520,380,290,90], t:3000, max:100,pop:4, req:{main:5}, boost:'wood', desc:'+5% produksi kayu per tingkat (bisa sampai tk.100).'},
  brick:    {nama:'Pembakaran Bata',   icon:'🧱', cost:[440,480,320,50], t:3200, max:100,pop:3, req:{main:5}, boost:'clay', desc:'+5% produksi lempung per tingkat (bisa sampai tk.100).'},
  foundry:  {nama:'Peleburan Besi',    icon:'🔥', cost:[200,450,510,120],t:3600, max:100,pop:6, req:{main:5}, boost:'iron', desc:'+5% produksi besi per tingkat (bisa sampai tk.100).'},
  mill:     {nama:'Lesung Padi',       icon:'🌾', cost:[500,440,380,1240],t:3400,max:100,pop:3, req:{main:5}, boost:'crop', desc:'+5% produksi padi per tingkat (bisa sampai tk.100).'},
  trough:   {nama:'Sendang Turangga',  icon:'🐴', cost:[780,420,660,300],t:3000, max:20, pop:2, tribe:'roman', req:{stable:3}, desc:'Sendang tempat kuda minum, khas Majapahit — mengurangi konsumsi padi pasukan berkuda (−1,25% per tingkat).'},
};
// Bangunan dengan kapasitas penyimpanan & yang bisa melampaui tk.20 (hingga 100)
B.warehouse.max = 100; B.granary.max = 100; B.market.max = 100;
const WALL_DEF = {cost:[70,90,170,70], t:1900, max:20, pop:0};
const SLOT_COUNT = 20;

/* Kerajaan (rumus & angka identik dengan suku Travian Klasik — hanya nama yang berubah).
   Unit: att, di (bertahan vs infanteri), dc (vs kavaleri), spd (petak/jam), carry, up (konsumsi padi),
   cost, t (detik latih dasar), b (bangunan pelatih), cav, scout, req (syarat riset) */
const TRIBE_DATA = {
  roman: {
    nama:'Majapahit', icon:'🌞', wallName:'Kuta Bata', wallBonus:1.030,
    desc:'Seimbang. Dapat membangun ladang dan gedung bersamaan. Prajurit elit tapi mahal.',
    units:[
      {nama:'Prajurit Tamtama',  icon:'⚔️', att:40, di:35, dc:50, spd:6,  carry:50,  up:1, cost:[120,100,150,30],  t:1600, b:'barracks'},
      {nama:'Penjaga Kuta',      icon:'🛡️', att:30, di:65, dc:35, spd:5,  carry:20,  up:1, cost:[100,130,160,70],  t:1760, b:'barracks', req:{academy:1,smithy:1}},
      {nama:'Bhayangkara',       icon:'🗡️', att:70, di:40, dc:25, spd:7,  carry:50,  up:1, cost:[150,160,210,80],  t:1920, b:'barracks', req:{academy:5,smithy:1}},
      {nama:'Telik Sandi',       icon:'🕵️', att:0,  di:20, dc:10, spd:16, carry:0,   up:2, cost:[140,160,20,40],   t:1360, b:'stable', cav:true, scout:true, req:{academy:5,stable:1}},
      {nama:'Turangga Yudha',    icon:'🐎', att:120,di:65, dc:50, spd:14, carry:100, up:3, cost:[550,440,320,100], t:2640, b:'stable', cav:true, req:{academy:5,stable:5}},
      {nama:'Senopati Berkuda',  icon:'🏇', att:180,di:80, dc:105,spd:10, carry:70,  up:4, cost:[550,640,800,180], t:3520, b:'stable', cav:true, req:{academy:15,stable:10}},
      {nama:'Gajah Pendobrak',   icon:'🐘', att:60, di:30, dc:75, spd:4,  carry:0,   up:3, cost:[900,360,500,70],  t:4600, b:'workshop', req:{academy:10,workshop:1}},
      {nama:'Meriam Cetbang',    icon:'☄️', att:75, di:60, dc:10, spd:3,  carry:0,   up:6, cost:[950,1350,600,90], t:9000, b:'workshop', req:{academy:15,workshop:10}},
      {nama:'Pemukim',           icon:'🚚', att:0,  di:80, dc:80, spd:5,  carry:3000,up:1, cost:[4600,4200,5800,4400], t:22000, b:'residence'},
    ]
  },
  teuton: {
    nama:'Singasari', icon:'🗡️', wallName:'Benteng Kayu', wallBonus:1.020,
    desc:'Agresif. Prajurit murah dan cepat dilatih — cocok untuk merampok sejak awal.',
    units:[
      {nama:'Prajurit Gada',     icon:'🏏', att:40, di:20, dc:5,  spd:7,  carry:60,  up:1, cost:[95,75,40,40],     t:720,  b:'barracks'},
      {nama:'Prajurit Tumbak',   icon:'🔱', att:10, di:35, dc:60, spd:7,  carry:40,  up:1, cost:[145,70,85,40],    t:1120, b:'barracks', req:{academy:1}},
      {nama:'Prajurit Klewang',  icon:'🪓', att:60, di:30, dc:30, spd:6,  carry:50,  up:1, cost:[130,120,170,70],  t:1200, b:'barracks', req:{academy:3,smithy:1}},
      {nama:'Caraka Sandi',      icon:'🕵️', att:0,  di:10, dc:5,  spd:9,  carry:0,   up:1, cost:[160,100,50,50],   t:1120, b:'barracks', scout:true, req:{academy:1}},
      {nama:'Ksatria Turangga',  icon:'🐎', att:55, di:100,dc:40, spd:10, carry:110, up:2, cost:[370,270,290,75],  t:2400, b:'stable', cav:true, req:{academy:5,stable:3}},
      {nama:'Ksatria Singasari', icon:'🏇', att:150,di:50, dc:75, spd:9,  carry:80,  up:3, cost:[450,515,480,80],  t:2960, b:'stable', cav:true, req:{academy:15,stable:10}},
      {nama:'Banteng Pendobrak', icon:'🐃', att:65, di:30, dc:80, spd:4,  carry:0,   up:3, cost:[1000,300,350,70], t:4200, b:'workshop', req:{academy:10,workshop:1}},
      {nama:'Pelontar Batu',     icon:'☄️', att:50, di:60, dc:10, spd:3,  carry:0,   up:6, cost:[900,1200,600,60], t:9000, b:'workshop', req:{academy:15,workshop:10}},
      {nama:'Pemukim',           icon:'🚚', att:10, di:80, dc:80, spd:5,  carry:3000,up:1, cost:[5800,4400,4600,5200], t:25000, b:'residence'},
    ]
  },
  gaul: {
    nama:'Mataram', icon:'🛡️', wallName:'Pagar Bambu', wallBonus:1.025,
    desc:'Bertahan. Luweng besar, kavaleri tercepat. Cocok untuk pemain damai.',
    units:[
      {nama:'Prajurit Tameng',    icon:'🛡️', att:15, di:40, dc:50, spd:7,  carry:35,  up:1, cost:[100,130,55,30],   t:1040, b:'barracks'},
      {nama:'Prajurit Keris',     icon:'⚔️', att:65, di:35, dc:20, spd:6,  carry:45,  up:1, cost:[140,150,185,60],  t:1440, b:'barracks', req:{academy:3,smithy:1}},
      {nama:'Telik Turangga',     icon:'🕵️', att:0,  di:20, dc:10, spd:17, carry:0,   up:2, cost:[170,150,20,40],   t:1360, b:'stable', cav:true, scout:true, req:{academy:5,stable:1}},
      {nama:'Kilat Turangga',     icon:'⚡', att:90, di:25, dc:40, spd:19, carry:75,  up:2, cost:[350,450,230,60],  t:2480, b:'stable', cav:true, req:{academy:5,stable:3}},
      {nama:'Ksatria Pengawal',   icon:'🐎', att:45, di:115,dc:55, spd:16, carry:35,  up:2, cost:[360,330,280,120], t:2560, b:'stable', cav:true, req:{academy:5,stable:5}},
      {nama:'Senopati Pamungkas', icon:'🏇', att:140,di:60, dc:165,spd:13, carry:65,  up:3, cost:[500,620,675,170], t:3120, b:'stable', cav:true, req:{academy:15,stable:10}},
      {nama:'Pendobrak Jati',     icon:'🐏', att:50, di:30, dc:105,spd:4,  carry:0,   up:3, cost:[950,555,330,75],  t:5000, b:'workshop', req:{academy:10,workshop:1}},
      {nama:'Lontar Api',         icon:'☄️', att:70, di:45, dc:10, spd:3,  carry:0,   up:6, cost:[960,1450,630,90], t:9000, b:'workshop', req:{academy:15,workshop:10}},
      {nama:'Pemukim',            icon:'🚚', att:0,  di:80, dc:80, spd:5,  carry:3000,up:1, cost:[4400,5600,4200,3900], t:20000, b:'residence'},
    ]
  }
};
const U_RAM = 6, U_CATA = 7, U_SETTLER = 8;

// Susunan 18 ladang awal (4 kayu, 4 lempung, 4 besi, 6 padi) — pola klasik
const START_FIELDS = ['wood','crop','clay','iron','clay','crop','wood','crop','iron','wood','crop','clay','iron','wood','crop','iron','clay','crop'];

const MAP_R = 50; // peta 101x101 (dari -50 s/d 50)
const FIELD_MAX_EXT = 100; // ladang sumber daya bisa ditingkatkan hingga tk.100

const BOT_NAMES = ['Arjuna','Bima','Gatotkaca','Srikandi','Nakula','Sadewa','Krisna','Rama','Shinta','Hanoman','Wisanggeni','Antareja','Baladewa','Karna','Drupadi','Abimanyu','Sengkuni','Duryudana','Pandu','Kunti','Sumbadra','Larasati','Ekalaya','Aswatama','Parikesit','Wibisana','Sugriwa','Subali','Indrajit','Kumbakarna','Trijata','Lesmana','Janaka','Rahwana','xXWarriorXx','PetaniSakti','RajaPerang','SiPenjarah','PendekarMalam','BangJago','KsatriaBaja','SultanAgung','PangeranGelap','DewaPerang','SiBolang','AnakSultan','PrajuritKecil','PemburuHadiah','TukangRampok','JagoanKampung','SatriaPiningit','BocahTua','KakekLegenda','PetarungSenja','RatuNgamuk','MbahDukun','KopralJono','MasBro99','DikJarwo','PakLurah'];
// Nama desa dibangun dari kombinasi awalan+akhiran (352+ nama unik) + nama klasik
const VN_PRE = ['Karang','Sido','Suko','Banyu','Tegal','Wono','Argo','Giri','Kali','Watu','Jati','Kedung','Banjar','Mekar','Sumber','Ngadi','Purwo','Tirto','Selo','Gunung','Margo','Pondok'];
const VN_SUF = ['rejo','mulyo','sari','agung','asri','harjo','makmur','jaya','wangi','gede','kidul','lor','wetan','kulon','anyar','tengah'];
const BOT_VNAMES = (() => {
  const a = ['Wonogiri','Banyuwangi','Cikarang','Plumbon','Gombong','Kaliwungu','Ambarawa','Parakan','Secang','Muntilan','Salaman','Borobudur','Prambanan','Imogiri','Pundong','Srandakan','Galur','Wates','Nanggulan','Samigaluh','Kokap','Temon','Panjatan','Trowulan','Singosari','Kotagede','Plered','Kartasura'];
  for (const p of VN_PRE) for (const s of VN_SUF) a.push(p + s);
  return a;
})();
const BOT_TAGS = ['MJPHT','SGSRI','MTRAM','KDIRI','JNGGL','BLMBN','DEMAK','PJANG','GRDA','JAWA','',''];

// Oasis yang bisa ditaklukkan memberi bonus produksi (persis Travian: +50% satu jenis, atau +25%+25%)
const OASIS_TYPES = [
  {icon:'🌳', nama:'Alas Jati',      bonus:{wood:0.5}},
  {icon:'🌾', nama:'Padang Ilalang', bonus:{crop:0.5}},
  {icon:'⛰️', nama:'Gunung Kapur',   bonus:{iron:0.5}},
  {icon:'🏞️', nama:'Lembah Hijau',   bonus:{clay:0.25, crop:0.25}},
  {icon:'🐗', nama:'Alas Liar',      bonus:{crop:0.5}},
];
const MAX_OASIS_PER_VILLAGE = 3; // batas oasis yang bisa dikuasai tiap desa

// Candi Agung (World Wonder) — tujuan menamatkan dunia mode Wonder
const CANDI_MAX = 100;
const CANDI_BASE = [6000, 6000, 6000, 4000];

const DIFFS = {
  easy:   {nama:'Mudah',  def:0.5, raidCh:0.5, raidSz:0.6},
  normal: {nama:'Normal', def:1.0, raidCh:1.0, raidSz:1.0},
  hard:   {nama:'Sulit',  def:1.5, raidCh:2.0, raidSz:1.5},
};
