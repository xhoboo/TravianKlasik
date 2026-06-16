'use strict';
/* ================= MESIN GAME ================= */
let S = null;          // state tersimpan
let TIDX = {};         // indeks petak peta (dibangun ulang saat load)
let dirty = false;     // ada kejadian -> render ulang
let liveMode = true;   // false saat simulasi susulan offline
let offlineLog = {reports:0, builds:0, raidsIn:0};

const now = () => Date.now() / 1000;
const r5 = x => Math.max(5, Math.round(x / 5) * 5);
const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const dist = (x1, y1, x2, y2) => Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtN = n => Math.floor(n).toLocaleString('id-ID');
function fmtT(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}
const TR = t => TRIBE_DATA[t || S.tribe];
const AV = () => S.villages[S.active];
const key = (x, y) => x + '|' + y;

/* ---------- state baru ---------- */
function newVillage(name, x, y) {
  return {
    name, x, y,
    res: {wood:750, clay:750, iron:750, crop:750},
    fields: START_FIELDS.map(t => ({t, lvl:0})),
    slots: Array(SLOT_COUNT).fill(null),
    wall: 0,
    troops: {},
    researched: TR().units.map((u,i) => !u.req),
    researching: null,
    bq: [],                       // antrian bangunan
    tq: {barracks:[], stable:[], workshop:[], residence:[]},  // antrian latih
  };
}
function newGame(name, tribe, speed, diff, mode, slot) {
  usedVNames = null;
  S = {
    v:6, slot: slot || 0, name: name || 'Pemain', tribe, speed, diff,
    wonder: mode === 'wonder', wonderLvl: 0, candiQ: null, ended: null,
    plus: {prod:0, instant:0, train:0},
    botRaids: true,
    created: now(), last: now(), botAcc: 0,
    villages: [], active: 0,
    movs: [], reps: [], unread: 0, seq: 1,
    bots: [], oases: [],
    stats: {att:0, def:0, raid:0, destroy:0},
  };
  S.villages.push(newVillage('Desa ' + S.name, 0, 0));
  AV().slots[0] = {b:'main', lvl:1};
  makeWorld();
  buildTIDX();
  save();
}

/* ---------- Wilwatikta Plus (beli dengan sumber daya) ---------- */
// Harga per hari (dikali jumlah hari); dibayar dari desa aktif
const PLUS_PROD_COST = [3000, 3000, 3000, 2000];
const PLUS_INSTANT_COST = [4000, 3500, 4000, 2500];
const PLUS_TRAIN_COST = [3500, 3000, 4500, 2500];
function plusCost(kind, days) {
  return ({prod:PLUS_PROD_COST, instant:PLUS_INSTANT_COST, train:PLUS_TRAIN_COST}[kind]).map(c => c * days);
}
function buyPlus(kind, days) {
  const v = AV(), cost = plusCost(kind, days);
  if (!canAfford(v, cost)) { toast('Sumber daya tidak cukup!'); return false; }
  pay(v, cost);
  const base = Math.max(S.last, S.plus[kind] || 0);
  S.plus[kind] = base + days * 86400;
  save();
  return true;
}

/* ---------- Candi Agung / World Wonder ---------- */
function candiCost(lvl) { return CANDI_BASE.map(c => r5(c * Math.pow(1.07, lvl))); }
function candiTime(lvl) { return Math.max(20, 800 * Math.pow(1.035, lvl) / S.speed); }
function startCandi() {
  if (!S.wonder || S.ended) return false;
  if (S.candiQ) { toast('Candi sedang dibangun!'); return false; }
  if (S.wonderLvl >= CANDI_MAX) return false;
  const v = AV(), cost = candiCost(S.wonderLvl);
  if (!canAfford(v, cost)) { toast('Sumber daya tidak cukup!'); return false; }
  pay(v, cost);
  S.candiQ = {to: S.wonderLvl + 1, cost, done: now() + candiTime(S.wonderLvl)};
  save();
  return true;
}
function finishCandiNow() {
  if (!S.candiQ || !plusInstantActive()) { toast('Butuh berkah ⚡ Tangan Dewata yang aktif!'); return; }
  S.candiQ.done = S.last;
}
// progres Candi para bot pesaing
const candiLeader = () => {
  let best = null;
  S.bots.forEach(b => { if (b.wcomp && (!best || b.wl > best.wl)) best = b; });
  return best;
};
function checkEnd() {
  if (!S.wonder || S.ended) return;
  if (S.wonderLvl >= CANDI_MAX) { S.ended = {who:'me', nm:S.name, time:S.last}; dirty = true; return; }
  const champ = S.bots.find(b => b.wcomp && b.wl >= CANDI_MAX);
  if (champ) { S.ended = {who:'bot', nm:champ.nm, time:S.last}; dirty = true; }
}

/* ---------- dunia & bot ---------- */
// Registry nama desa — menjamin tidak ada dua desa bernama sama di seluruh dunia
let usedVNames = null;
function regVNames() {
  usedVNames = new Set();
  S.villages.forEach(v => usedVNames.add(v.name));
  S.bots.forEach(b => (b.villages || []).forEach(v => usedVNames.add(v.vn)));
}
function uniqueVName() {
  if (!usedVNames) regVNames();
  for (let t = 0; t < 80; t++) {
    const n = BOT_VNAMES[ri(0, BOT_VNAMES.length - 1)];
    if (!usedVNames.has(n)) { usedVNames.add(n); return n; }
  }
  for (let i = 2; ; i++) for (const base of BOT_VNAMES) {
    const n = base + ' ' + i;
    if (!usedVNames.has(n)) { usedVNames.add(n); return n; }
  }
}
const vResCap = v => 800 + v.pop * 30;
const botPop = b => b.villages.reduce((a, v) => a + v.pop, 0);
const maxBotV = b => clamp(Math.round(b.cap / 450), 2, 6);

function makeWorld() {
  const used = {'0|0': 1};
  const place = (rMin, rMax, cx, cy) => {
    cx = cx || 0; cy = cy || 0;
    for (let tries = 0; tries < 200; tries++) {
      const a = Math.random() * 2 * Math.PI, r = rnd(rMin, rMax);
      const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
      if (Math.abs(x) > MAP_R || Math.abs(y) > MAP_R) continue;
      if (!used[key(x, y)]) { used[key(x, y)] = 1; return {x, y}; }
    }
    return null;
  };
  const usedNm = new Set([S.name]);
  regVNames();
  const N = 250;
  for (let i = 0; i < N; i++) {
    const p = i < 55 ? place(3.5, 12) : place(5, MAP_R);
    if (!p) continue;
    S.bots.push(createBot(i + 1, p, Math.random(), usedNm, place));
  }
  // oasis (peta lebih luas -> lebih banyak; tiap oasis punya pasukan alam liar)
  for (let i = 0; i < 150; i++) {
    const p = place(2, MAP_R);
    if (p) S.oases.push({x:p.x, y:p.y, t: ri(0, OASIS_TYPES.length - 1), def: ri(150, 900), owner: -1});
  }
  // mode Wonder: tunjuk sejumlah bot kuat sebagai pesaing pembangun Candi
  if (S.wonder) {
    S.bots.slice().sort((a, b) => botPop(b) - botPop(a)).slice(0, 14).forEach(b => {
      b.wcomp = true; b.wl = 0; b.wrate = rnd(0.12, 0.42);  // tingkat Candi per jam-game (×kecepatan)
    });
  }
}
// Cetak satu bot lengkap (dipakai pembuatan dunia & migrasi save lama)
function createBot(id, p, sk, usedNm, place) {
  const tribes = ['roman','teuton','gaul'];
  const pop = Math.round(30 + sk * sk * 270);     // banyak bot kecil, sedikit besar
  let nm = '';
  for (let t = 0; t < 80 && !nm; t++) {           // nama pemain bot juga unik
    const c = BOT_NAMES[ri(0, BOT_NAMES.length - 1)] + (Math.random() < 0.4 ? ri(1, 99) : '');
    if (!usedNm.has(c)) { usedNm.add(c); nm = c; }
  }
  if (!nm) { nm = 'Pemain' + (1000 + id); usedNm.add(nm); }
  const bot = {
    id, nm,
    tag: BOT_TAGS[ri(0, BOT_TAGS.length - 1)],
    tribe: tribes[ri(0, 2)],
    gr: rnd(8, 32),               // pertumbuhan penduduk / hari (1x)
    cap: ri(700, 2200),           // batas penduduk per desa
    aggr: Math.random() * Math.random(),  // mayoritas pasif
    defR: rnd(0.35, 0.95),
    offR: rnd(0.15, 0.6),
    villages: [],
    stA: 0, stD: 0, stR: 0, stX: 0,  // statistik: serang / bertahan / jarahan / desa dihancurkan
  };
  addBotVillage(bot, p.x, p.y, pop);
  // bot "lama" mulai dengan 2-3 desa, seperti server yang sudah berjalan
  const extra = sk > 0.92 ? 2 : sk > 0.78 ? 1 : 0;
  for (let e = 0; e < extra; e++) {
    const p2 = place(2.5, 7, p.x, p.y);
    if (p2) addBotVillage(bot, p2.x, p2.y, Math.round(pop * rnd(0.35, 0.6)));
  }
  // riwayat perang awal — dunia terasa sudah berjalan
  bot.stA = Math.round(pop * bot.aggr * rnd(2, 8));
  bot.stD = Math.round(pop * rnd(1, 5));
  bot.stR = Math.round(pop * bot.aggr * rnd(20, 80));
  return bot;
}
function addBotVillage(b, x, y, popN) {
  const v = {vn: uniqueVName(), x, y, pop: popN, wall: Math.min(20, Math.floor(popN / 55)),
    res: {wood:0, clay:0, iron:0, crop:0}, tr: {}};
  for (const k of RES_KEYS) v.res[k] = rnd(0.3, 0.9) * vResCap(v);
  b.villages.push(v);
  botFillTroops(b, v, 1);
  return v;
}
function buildTIDX() {
  TIDX = {};
  S.bots.forEach(b => b.villages.forEach((v, i) => TIDX[key(v.x, v.y)] = {k:'bot', ref:b, bv:v, bvi:i}));
  S.oases.forEach(o => TIDX[key(o.x, o.y)] = {k:'oasis', ref:o});
  S.villages.forEach((v, i) => TIDX[key(v.x, v.y)] = {k:'me', ref:v, vi:i});
}
const botAt = (x, y) => { const t = TIDX[key(x, y)]; return t && t.k === 'bot' ? t : null; };
const BOT_MIX = { // [unit bertahan utama, sekunder], [unit serang utama, kavaleri]
  roman:  {def:[1,0], off:[2,4]},
  teuton: {def:[1,0], off:[0,4]},
  gaul:   {def:[0,4], off:[1,3]},
};
function botTargets(b, v) {
  const d = DIFFS[S.diff];
  const mix = BOT_MIX[b.tribe];
  const def = v.pop * b.defR * d.def, off = v.pop * b.offR;
  return {
    [mix.def[0]]: Math.round(def * 0.7),
    [mix.def[1]]: Math.round(def * 0.3),
    [mix.off[0]]: Math.round(off * 0.8),
    [mix.off[1]]: Math.round(off * 0.2 / 3),
  };
}
function botFillTroops(b, v, frac) {
  const tg = botTargets(b, v);
  for (const u in tg) {
    const cur = v.tr[u] || 0;
    if (cur < tg[u]) v.tr[u] = Math.min(tg[u], cur + Math.max(1, Math.round((tg[u] - cur) * frac)));
  }
}
// Perang antar bot — diselesaikan seketika (abstrak, tanpa pergerakan di peta)
function botBattle(b, bv, tb, tv) {
  const mix = BOT_MIX[b.tribe];
  const size = Math.round(clamp(bv.pop * 0.15, 8, 200));
  const army = {};
  army[mix.off[0]] = Math.min(bv.tr[mix.off[0]] || 0, size);
  if ((bv.tr[mix.off[1]] || 0) > 4) army[mix.off[1]] = Math.min(bv.tr[mix.off[1]], Math.round(size / 8));
  if (sumU(army) < 5) return;
  const res = battle(army, b.tribe, tv.tr, tb.tribe, 0, true, 1, 1);
  for (const u in res.aLoss) { bv.tr[u] -= res.aLoss[u]; if (bv.tr[u] <= 0) delete bv.tr[u]; }
  for (const u in res.dLoss) { tv.tr[u] -= res.dLoss[u]; if (tv.tr[u] <= 0) delete tv.tr[u]; }
  b.stA = (b.stA || 0) + sumL(res.dLoss);
  tb.stD = (tb.stD || 0) + sumL(res.aLoss);
  if (res.win) {
    const surv = survivors(army, res.aLoss);
    const loot = takeLoot(tv.res, carryOf(surv, b.tribe), 0);
    RES_KEYS.forEach(k => bv.res[k] = Math.min(vResCap(bv), bv.res[k] + loot[k]));
    b.stR = (b.stR || 0) + sumL(loot);
    // sesekali bot kuat & agresif meratakan desa kecil musuh (saling menghancurkan, jarang)
    if (tv.pop < 55 && b.aggr > 0.55 && Math.random() < 0.06) {
      tv.pop = Math.max(0, tv.pop - 30);
      if (tv.pop < 10) { b.stX = (b.stX || 0) + 1; razeBotVillage(tb, tv); }
    }
  }
}
// Ekspansi bot: dirikan desa baru di dekat desa pertamanya (petak harus kosong)
function botSettle(b) {
  const first = b.villages[0];
  for (let t = 0; t < 50; t++) {
    const a = Math.random() * 2 * Math.PI, r = rnd(2.5, 8 + t / 6);
    const x = Math.round(first.x + Math.cos(a) * r), y = Math.round(first.y + Math.sin(a) * r);
    if (Math.abs(x) > MAP_R || Math.abs(y) > MAP_R || TIDX[key(x, y)]) continue;
    const v = addBotVillage(b, x, y, ri(28, 42));
    TIDX[key(x, y)] = {k:'bot', ref:b, bv:v, bvi:b.villages.length - 1};
    dirty = true;
    return;
  }
}

/* ---------- helper kurva lanjutan (di luar batas asli memakai faktor lebih landai) ---------- */
// Eksponen tetap identik dengan Travian dalam rentang asli; di atas softLvl memakai faktor lebih landai
function expSoft(base, lvl, softLvl, soft) {
  if (lvl <= softLvl) return Math.pow(base, lvl);
  return Math.pow(base, softLvl) * Math.pow(soft, lvl - softLvl);
}
function fieldProd(lvl) {
  if (lvl <= 10) return FIELD_PROD[lvl];
  return Math.round(FIELD_PROD[10] * Math.pow(1.15, lvl - 10));  // lanjut eksponensial (+15%/tk)
}
function storeCap(lvl) {
  if (lvl <= 20) return STORE_CAP[lvl];
  return Math.round(STORE_CAP[20] * Math.pow(1.2, lvl - 20));
}
// Wilwatikta Plus
const plusProdActive = () => S.plus && S.plus.prod > S.last;
const plusInstantActive = () => S.plus && S.plus.instant > S.last;
const plusTrainActive = () => S.plus && S.plus.train > S.last;
// selesaikan SEMUA antrian pelatihan seketika (berkah Gemblengan Kilat)
function finishAllTraining(v) {
  if (!plusTrainActive()) { toast('Butuh berkah 🎯 Gemblengan Kilat yang aktif!'); return; }
  let any = false;
  for (const b in v.tq) {
    v.tq[b].forEach(q => { v.troops[q.u] = (v.troops[q.u] || 0) + q.n; any = true; });
    v.tq[b] = [];
  }
  if (any) { dirty = true; save(); toast('🎯 Semua pelatihan diselesaikan seketika!'); }
}
// Bonus oasis yang dikuasai sebuah desa
function oasisBonus(v, boost) {
  const vi = S.villages.indexOf(v);
  if (vi < 0) return;
  S.oases.forEach(o => {
    if (o.owner === vi) { const bn = OASIS_TYPES[o.t].bonus; for (const k in bn) boost[k] += bn[k]; }
  });
}
const ownedOasisCount = vi => S.oases.filter(o => o.owner === vi).length;

/* ---------- ekonomi desa ---------- */
function pop(v) {
  let p = 0;
  v.fields.forEach(f => p += f.lvl);
  v.slots.forEach(s => { if (s) p += B[s.b].pop * s.lvl; });
  p += v.wall;
  return p;
}
function troopUpkeep(v) {
  const cavRed = 1 - Math.min(0.5, bLvl(v, 'trough') * 0.0125);  // Sendang Turangga (Majapahit)
  let u = 0;
  for (const k in v.troops) {
    const ud = TR().units[k];
    u += ud.up * v.troops[k] * (ud.cav ? cavRed : 1);
  }
  return Math.round(u);   // konsumsi padi selalu dibulatkan
}
function prodOf(v) {
  const p = {wood:0, clay:0, iron:0, crop:0};
  v.fields.forEach(f => p[FIELD_TYPES[f.t].res] += fieldProd(f.lvl));
  const boost = {wood:0, clay:0, iron:0, crop:0};
  v.slots.forEach(s => { if (s && B[s.b].boost) boost[B[s.b].boost] += 0.05 * s.lvl; });
  oasisBonus(v, boost);
  const plusM = plusProdActive() ? 1.25 : 1;
  for (const k of RES_KEYS) p[k] = p[k] * (1 + boost[k]) * plusM * S.speed;
  p.cropNet = p.crop - (pop(v) + troopUpkeep(v));
  return p;
}
function capOf(v) {
  let store = 0, gran = 0;
  v.slots.forEach(s => {
    if (!s) return;
    if (s.b === 'warehouse') store += storeCap(s.lvl);
    if (s.b === 'granary') gran += storeCap(s.lvl);
  });
  return {store: Math.max(800, store), gran: Math.max(800, gran)};
}
function crannyOf(v) {
  let c = 0;
  v.slots.forEach(s => { if (s && s.b === 'cranny') c += CRANNY_CAP[s.lvl]; });
  return c * (S.tribe === 'gaul' ? 1.5 : 1);
}
// Daya angkut pasar per tingkat — skala dengan kecepatan (100x => 10.000 / tingkat)
function marketPerLevel() { return Math.max(1000, S.speed * 100); }
function marketCap(v) { return bLvl(v, 'market') * marketPerLevel(); }
function bLvl(v, b) {
  let m = 0;
  v.slots.forEach(s => { if (s && s.b === b) m = Math.max(m, s.lvl); });
  return m;
}
const canAfford = (v, c) => RES_KEYS.every((k, i) => v.res[k] >= c[i]);
const pay = (v, c) => RES_KEYS.forEach((k, i) => v.res[k] -= c[i]);
const refund = (v, c) => { const cap = capOf(v); RES_KEYS.forEach((k, i) => v.res[k] = Math.min(k==='crop'?cap.gran:cap.store, v.res[k] + c[i])); };

/* ---------- pembangunan ---------- */
// Rentang asli (ladang ≤10, gedung ≤20) memakai faktor Travian; di atasnya faktor landai agar tetap tercapai
function fieldCost(t, lvl) { return FIELD_TYPES[t].cost.map(c => r5(c * expSoft(1.67, lvl, 10, 1.12))); }
function fieldTime(v, t, lvl) { return Math.max(15, FIELD_TYPES[t].k * expSoft(1.5, lvl, 10, 1.05) * Math.pow(0.96, bLvl(v,'main')) / S.speed); }
function bldCost(b, lvl) { return B[b].cost.map(c => r5(c * expSoft(1.28, lvl, 20, 1.12))); }
function bldTime(v, b, lvl) { return Math.max(15, B[b].t * expSoft(1.22, lvl, 20, 1.04) * Math.pow(0.96, bLvl(v,'main')) / S.speed); }
function wallCost(lvl) { return WALL_DEF.cost.map(c => r5(c * Math.pow(1.28, lvl))); }
function wallTime(v, lvl) { return Math.max(15, WALL_DEF.t * Math.pow(1.22, lvl) * Math.pow(0.96, bLvl(v,'main')) / S.speed); }
function reqOk(v, req) {
  if (!req) return true;
  for (const b in req) if (bLvl(v, b) < req[b]) return false;
  return true;
}
function reqText(req) {
  return Object.entries(req).map(([b, l]) => B[b].nama + ' tk.' + l).join(', ');
}
// Romawi: 1 ladang + 1 gedung bersamaan; lainnya: 1 total
function queueFree(v, isField) {
  if (S.tribe === 'roman') return !v.bq.some(q => (q.kind === 'field') === isField);
  return v.bq.length === 0;
}
function startBuild(v, kind, idx, b) {
  let cost, dur, to;
  if (kind === 'field') {
    const f = v.fields[idx];
    if (f.lvl >= FIELD_MAX_EXT) return false;
    to = f.lvl + 1; cost = fieldCost(f.t, f.lvl); dur = fieldTime(v, f.t, f.lvl);
  } else if (kind === 'wall') {
    if (v.wall >= WALL_DEF.max) return false;
    to = v.wall + 1; cost = wallCost(v.wall); dur = wallTime(v, v.wall);
  } else {
    const s = v.slots[idx];
    const lvl = s ? s.lvl : 0;
    b = s ? s.b : b;
    if (lvl >= B[b].max) return false;
    if (!s && !reqOk(v, B[b].req)) return false;
    to = lvl + 1; cost = bldCost(b, lvl); dur = bldTime(v, b, lvl);
  }
  if (!queueFree(v, kind === 'field')) { toast('Antrian pembangunan penuh!'); return false; }
  if (!canAfford(v, cost)) { toast('Sumber daya tidak cukup!'); return false; }
  pay(v, cost);
  v.bq.push({kind, idx, b, to, cost, done: now() + dur});
  save();
  return true;
}
function cancelBuild(v, i) {
  const q = v.bq[i];
  if (!q) return;
  refund(v, q.cost);
  v.bq.splice(i, 1);
  save();
}
// Wilwatikta Plus: selesaikan pembangunan seketika (gratis selama masa aktif)
function finishNow(v, i) {
  if (!plusInstantActive()) { toast('Butuh berkah ⚡ Tangan Dewata yang aktif!'); return; }
  const q = v.bq[i];
  if (!q) return;
  q.done = S.last;
  applyBuild(v, q);
  v.bq.splice(i, 1);
  dirty = true; save();
}
// Pendopo Agung tk.20 dapat merobohkan bangunan desa sendiri (1 tingkat per klik, tanpa kembali biaya)
const canDemolish = v => bLvl(v, 'main') >= 20;
function demolish(v, idx) {
  if (!canDemolish(v)) { toast('Pendopo Agung harus tingkat 20!'); return; }
  const s = v.slots[idx];
  if (!s || s.b === 'main') { toast('Pendopo Agung tidak bisa dirobohkan!'); return; }
  const nm = B[s.b].nama;
  s.lvl--;
  if (s.lvl <= 0) v.slots[idx] = null;
  dirty = true; save();
  toast('🔨 ' + nm + (s.lvl > 0 ? ' diturunkan ke tk.' + s.lvl : ' dirobohkan habis'));
}
function demolishWall(v) {
  if (!canDemolish(v) || v.wall <= 0) return;
  v.wall--;
  dirty = true; save();
  toast('🔨 ' + TR().wallName + (v.wall > 0 ? ' diturunkan ke tk.' + v.wall : ' dirobohkan habis'));
}
function applyBuild(v, q) {
  if (q.kind === 'field') v.fields[q.idx].lvl = q.to;
  else if (q.kind === 'wall') v.wall = q.to;
  else {
    if (v.slots[q.idx]) v.slots[q.idx].lvl = q.to;
    else v.slots[q.idx] = {b: q.b, lvl: q.to};
  }
  if (liveMode) toast('🏗️ ' + (q.kind==='field' ? FIELD_TYPES[v.fields[q.idx].t].nama : q.kind==='wall' ? TR().wallName : B[q.b].nama) + ' tingkat ' + q.to + ' selesai');
  else offlineLog.builds++;
}

/* ---------- pelatihan & riset ---------- */
function trainTime(v, u) {
  const unit = TR().units[u];
  return Math.max(8, unit.t * Math.pow(0.964, Math.max(0, bLvl(v, unit.b) - 1)) / S.speed);
}
function startTrain(v, u, n) {
  const unit = TR().units[u];
  n = Math.floor(n);
  if (n < 1) return false;
  if (u === U_SETTLER && bLvl(v, 'residence') < 10) { toast('Butuh ' + B.residence.nama + ' tingkat 10!'); return false; }
  const cost = unit.cost.map(c => c * n);
  if (!canAfford(v, cost)) { toast('Sumber daya tidak cukup!'); return false; }
  pay(v, cost);
  const Q = v.tq[unit.b], each = trainTime(v, u);
  const start = Q.length ? Q[Q.length - 1].next + Q[Q.length - 1].each * (Q[Q.length - 1].n - 1) : now();
  Q.push({u, n, each, next: start + each});
  save();
  return true;
}
function researchCost(u) { return TR().units[u].cost.map(c => c * 5); }
function startResearch(v, u) {
  if (v.researching) { toast('Akademi sedang meriset!'); return false; }
  const cost = researchCost(u);
  if (!canAfford(v, cost)) { toast('Sumber daya tidak cukup!'); return false; }
  pay(v, cost);
  const dur = TR().units[u].t * 3 * Math.pow(0.964, Math.max(0, bLvl(v,'academy') - 1)) / S.speed;
  v.researching = {u, done: now() + dur};
  save();
  return true;
}

/* ---------- pertempuran (formula Travian) ---------- */
function battle(attU, attTribe, defU, defTribe, wall, raid, aBonus, dBonus) {
  const aUnits = TRIBE_DATA[attTribe].units, dUnits = TRIBE_DATA[defTribe].units;
  let aInf = 0, aCav = 0;
  for (const u in attU) { const n = attU[u], ud = aUnits[u]; if (ud.cav) aCav += n * ud.att; else aInf += n * ud.att; }
  let dI = 0, dC = 0;
  for (const u in defU) { const n = defU[u], ud = dUnits[u]; dI += n * ud.di; dC += n * ud.dc; }
  const aTot = Math.max(1, (aInf + aCav) * aBonus);
  const w = (aInf + aCav) > 0 ? aInf / (aInf + aCav) : 1;
  const wallB = Math.pow(TRIBE_DATA[defTribe].wallBonus, wall);
  const def = Math.max(1, ((dI * w + dC * (1 - w)) * dBonus + 10 + 5 * wall) * wallB);
  const win = aTot > def;
  const m = Math.pow(def / aTot, 1.5);     // <1 jika penyerang lebih kuat
  let aLoss, dLoss;
  if (raid) { aLoss = m / (1 + m); dLoss = 1 / (1 + m); }
  else if (win) { aLoss = Math.min(1, m); dLoss = 1; }
  else { aLoss = 1; dLoss = Math.min(1, Math.pow(aTot / def, 1.5)); }
  const lost = (units, frac) => {
    const l = {};
    for (const u in units) l[u] = Math.min(units[u], Math.round(units[u] * frac));
    return l;
  };
  return {win, aLoss: lost(attU, aLoss), dLoss: lost(defU, dLoss), aPow: Math.round(aTot), dPow: Math.round(def)};
}
function survivors(units, losses) {
  const s = {};
  for (const u in units) { const n = units[u] - (losses[u] || 0); if (n > 0) s[u] = n; }
  return s;
}
function carryOf(units, tribe) {
  let c = 0;
  for (const u in units) c += units[u] * TRIBE_DATA[tribe].units[u].carry;
  return c;
}
function takeLoot(resObj, capacity, protect) {
  const loot = {wood:0, clay:0, iron:0, crop:0};
  let left = capacity;
  for (let round = 0; round < 3 && left > 0; round++) {
    const av = RES_KEYS.filter(k => resObj[k] - (protect||0) - loot[k] > 1);
    if (!av.length) break;
    const share = left / av.length;
    av.forEach(k => {
      const take = Math.min(share, resObj[k] - (protect||0) - loot[k]);
      loot[k] += take; left -= take;
    });
  }
  for (const k of RES_KEYS) { loot[k] = Math.floor(loot[k]); resObj[k] -= loot[k]; }
  return loot;
}
const sumU = u => Object.values(u).reduce((a, b) => a + b, 0);
const sumL = l => Object.values(l).reduce((a, b) => a + b, 0);

/* ---------- laporan (maks. 100; yang di-star ⭐ tidak ikut terhapus) ---------- */
const REP_MAX = 100;
function addReport(rep) {
  rep.id = S.seq++; rep.time = S.last; rep.unread = true; rep.star = false;
  S.reps.unshift(rep);
  // buang laporan TERLAMA yang tidak di-star sampai total <= 100
  while (S.reps.length > REP_MAX) {
    let idx = -1;
    for (let i = S.reps.length - 1; i >= 0; i--) { if (!S.reps[i].star) { idx = i; break; } }
    if (idx < 0) break;   // semua di-star — biarkan
    S.reps.splice(idx, 1);
  }
  S.unread++;
  if (!liveMode) offlineLog.reports++;
  dirty = true;
}
function toggleStar(id) {
  const r = S.reps.find(rr => rr.id === id);
  if (r) { r.star = !r.star; save(); }
}

/* ---------- pergerakan pasukan ---------- */
function travelSec(d, spd) { return d / (spd * S.speed) * 3600; }
function slowest(units, tribe) {
  let s = 99;
  for (const u in units) s = Math.min(s, TRIBE_DATA[tribe].units[u].spd);
  return s === 99 ? 5 : s;
}
function sendTroops(vi, x, y, units, kind) {
  const v = S.villages[vi];
  const total = sumU(units);
  if (!total) { toast('Pilih pasukan dulu!'); return false; }
  if (bLvl(v, 'rally') < 1) { toast('Bangun Titik Kumpul dulu!'); return false; }
  for (const u in units) {
    if ((v.troops[u] || 0) < units[u]) { toast('Pasukan tidak cukup!'); return false; }
  }
  for (const u in units) { v.troops[u] -= units[u]; if (!v.troops[u]) delete v.troops[u]; }
  const d = dist(v.x, v.y, x, y);
  const dur = travelSec(d, slowest(units, S.tribe));
  S.movs.push({id:S.seq++, kind, vi, x, y, units, depart:now(), arrive:now() + dur});
  save();
  return true;
}
function pushReturn(m, units, loot) {
  if (!sumU(units)) return;
  const dur = m.arrive - m.depart;
  S.movs.push({id:S.seq++, kind:'return', vi:m.vi, x:m.x, y:m.y, units, loot, depart:m.arrive, arrive:m.arrive + dur});
}
function processMov(m) {
  const unitName = (tribe, u) => TRIBE_DATA[tribe].units[u].nama;
  if (m.kind === 'return') {
    const v = S.villages[m.vi];
    for (const u in m.units) v.troops[u] = (v.troops[u] || 0) + m.units[u];
    if (m.loot) {
      const cap = capOf(v);
      RES_KEYS.forEach(k => v.res[k] = Math.min(k==='crop'?cap.gran:cap.store, v.res[k] + (m.loot[k] || 0)));
    }
    if (liveMode) toast('🏠 Pasukan telah kembali ke ' + esc(v.name));
    return;
  }
  if (m.kind === 'settle') {
    if (TIDX[key(m.x, m.y)]) { pushReturn(m, m.units, null); addReport({type:'sys', title:'Pendirian desa gagal — petak sudah terisi', body:'Pemukim kembali pulang.'}); return; }
    const nv = newVillage('Desa Baru ' + S.villages.length, m.x, m.y);
    nv.slots[0] = {b:'main', lvl:1};
    S.villages.push(nv);
    buildTIDX();
    addReport({type:'sys', title:'🎉 Desa baru didirikan di (' + m.x + '|' + m.y + ')', body:'Para pemukim membangun desa baru. Buka lewat pengalih desa di atas.'});
    return;
  }
  if (m.kind === 'trade') {
    const v = S.villages[m.tvi];
    const cap = capOf(v);
    RES_KEYS.forEach(k => v.res[k] = Math.min(k==='crop'?cap.gran:cap.store, v.res[k] + (m.loot[k] || 0)));
    if (liveMode) toast('⚖️ Pengiriman sumber daya tiba di ' + esc(v.name));
    return;
  }
  if (m.kind === 'botraid') { resolveBotRaid(m); return; }
  if (m.kind === 'botatk') { resolveBotAtk(m); return; }
  // serangan pemain -> oasis
  const ot = TIDX[key(m.x, m.y)];
  if (ot && ot.k === 'oasis') { resolveOasisAtk(m, ot.ref); return; }
  // serangan pemain -> petak
  const hit = botAt(m.x, m.y);
  if (!hit) {
    pushReturn(m, m.units, null);
    addReport({type:'sys', title:'Target di (' + m.x + '|' + m.y + ') kosong', body:'Tidak ada desa di sana. Pasukan kembali.'});
    return;
  }
  const bot = hit.ref, bv = hit.bv;
  if (m.kind === 'scout') {
    pushReturn(m, m.units, null);
    addReport({type:'scout', title:'🕵️ Hasil pengintaian ' + esc(bv.vn) + ' (' + m.x + '|' + m.y + ')',
      bot: {nm:bot.nm, vn:bv.vn, tribe:bot.tribe, pop:Math.round(bv.pop), wall:bv.wall},
      res: {...bv.res}, tr: {...bv.tr}});
    return;
  }
  // atk / raid
  const v = S.villages[m.vi];
  const aBonus = 1 + 0.015 * bLvl(v, 'smithy');
  const dBonus = 1 + Math.min(0.2, bv.pop / 4000);
  const res = battle(m.units, S.tribe, bv.tr, bot.tribe, m.kind === 'raid' ? 0 : bv.wall, m.kind === 'raid', aBonus, dBonus);
  // korban bot
  for (const u in res.dLoss) { bv.tr[u] -= res.dLoss[u]; if (bv.tr[u] <= 0) delete bv.tr[u]; }
  S.stats.att += sumL(res.dLoss);
  bot.stD = (bot.stD || 0) + sumL(res.aLoss);
  const surv = survivors(m.units, res.aLoss);
  let loot = null, extra = [], razed = false;
  if (res.win) {
    loot = takeLoot(bv.res, carryOf(surv, S.tribe), 0);
    S.stats.raid += sumL(loot);
    if (m.kind === 'atk') {
      const rams = surv[U_RAM] || 0, catas = surv[U_CATA] || 0;
      if (rams && bv.wall) {
        const down = Math.min(bv.wall, Math.floor(Math.sqrt(rams)));
        if (down) { bv.wall -= down; extra.push('🐏 Pendobrak merobohkan ' + TRIBE_DATA[bot.tribe].wallName + ' sebanyak ' + down + ' tingkat.'); }
      }
      if (catas) {
        const before = Math.round(bv.pop);
        const dmg = Math.min(bv.pop, catas * 5);   // tiap meriam menghancurkan bangunan ≈5 penduduk
        bv.pop = Math.max(0, bv.pop - dmg);
        extra.push('☄️ Meriam menghancurkan bangunan ' + esc(bv.vn) + ' (penduduk −' + Math.round(Math.min(before, dmg)) + ').');
        if (bv.pop < 10) {
          extra.push('💥 Desa ' + esc(bv.vn) + ' hancur total dan lenyap dari peta!');
          S.stats.destroy = (S.stats.destroy || 0) + 1;
          razed = true;
        }
      }
    }
  }
  addReport({type:'battle', win:res.win,
    title:(razed ? '💥 Desa ' + esc(bv.vn) + ' DIHANCURKAN!' : (res.win ? '⚔️ Kemenangan' : '💀 Kekalahan') + (m.kind==='raid' ? ' (rampokan)' : '') + ' di ' + esc(bv.vn)) + ' (' + m.x + '|' + m.y + ')',
    att:{nm:S.name, vn:v.name, tribe:S.tribe, units:{...m.units}, loss:res.aLoss},
    def:{nm:bot.nm, vn:bv.vn, tribe:bot.tribe, loss:res.dLoss, wall:bv.wall},
    defBefore: addBack(bv.tr, res.dLoss),
    loot, extra, pow:[res.aPow, res.dPow]});
  if (razed) razeBotVillage(bot, bv);
  pushReturn(m, surv, loot);
}
function addBack(after, losses) {
  const before = {...after};
  for (const u in losses) before[u] = (before[u] || 0) + losses[u];
  return before;
}
function resolveBotRaid(m) {
  const bot = S.bots.find(b => b.id === m.bot);
  const v = S.villages[m.vi];
  if (!bot || !v) return;
  const bv = bot.villages[m.bvi || 0] || bot.villages[0];
  if (!liveMode) offlineLog.raidsIn++;
  const dBonus = 1 + 0.015 * bLvl(v, 'smithy');
  const res = battle(m.units, bot.tribe, v.troops, S.tribe, v.wall, true, 1, dBonus);
  for (const u in res.dLoss) { v.troops[u] -= res.dLoss[u]; if (v.troops[u] <= 0) delete v.troops[u]; }
  for (const u in res.aLoss) { bv.tr[u] = Math.max(0, (bv.tr[u] || 0) - res.aLoss[u]); }
  S.stats.def += sumL(res.aLoss);
  bot.stA = (bot.stA || 0) + sumL(res.dLoss);
  const surv = survivors(m.units, res.aLoss);
  let loot = null;
  if (res.win) {
    loot = takeLoot(v.res, carryOf(surv, bot.tribe), crannyOf(v));
    RES_KEYS.forEach(k => bv.res[k] = Math.min(vResCap(bv), bv.res[k] + loot[k]));
    bot.stR = (bot.stR || 0) + sumL(loot);
  }
  addReport({type:'battle', win:!res.win, defending:true,
    title:(res.win ? '🔥 Desa Anda dirampok oleh ' : '🛡️ Serangan berhasil ditahan dari ') + esc(bot.nm),
    att:{nm:bot.nm, vn:bv.vn, tribe:bot.tribe, units:{...m.units}, loss:res.aLoss},
    def:{nm:S.name, vn:v.name, tribe:S.tribe, loss:res.dLoss},
    defBefore: addBack(v.troops, res.dLoss),
    loot, extra:[], pow:[res.aPow, res.dPow]});
  if (liveMode) toast(res.win ? '🔥 Desa Anda dirampok ' + esc(bot.nm) + '!' : '🛡️ Serangan ' + esc(bot.nm) + ' berhasil ditahan!');
}

/* ---------- penghancuran desa (meriam) ---------- */
// Hapus desa bot dari peta; jika bot tak punya desa lagi, bot lenyap
function razeBotVillage(bot, bv) {
  const i = bot.villages.indexOf(bv);
  if (i < 0) return;
  bot.villages.splice(i, 1);
  S.movs = S.movs.filter(m => !((m.kind === 'botraid' || m.kind === 'botatk') && m.bot === bot.id));
  if (bot.villages.length === 0) S.bots = S.bots.filter(x => x !== bot);
  buildTIDX(); dirty = true;
}
// Hapus desa pemain (kecuali desa terakhir); rapikan indeks pergerakan, oasis, & desa aktif
function razePlayerVillage(vi) {
  if (S.villages.length <= 1) return false;
  S.villages.splice(vi, 1);
  S.movs = S.movs.filter(m => m.vi !== vi && m.tvi !== vi);
  S.movs.forEach(m => {
    if (m.vi !== undefined && m.vi > vi) m.vi--;
    if (m.tvi !== undefined && m.tvi > vi) m.tvi--;
  });
  S.oases.forEach(o => { if (o.owner === vi) o.owner = -1; else if (o.owner > vi) o.owner--; });
  if (S.active > vi) S.active--;
  if (S.active >= S.villages.length) S.active = S.villages.length - 1;
  buildTIDX(); dirty = true;
  return true;
}
// Meriam menghancurkan bangunan/ladang/tembok desa pemain (acak); kembalikan jumlah yang rusak
function catapultPlayerVillage(v, catas, keepMain) {
  const drop = 1 + Math.floor(catas / 12);
  const hits = Math.min(10, Math.floor(Math.sqrt(catas)) + 1);
  const pool = [];
  v.slots.forEach((s, i) => { if (s && s.lvl > 0 && !(keepMain && s.b === 'main')) pool.push(() => { s.lvl -= drop; if (s.lvl <= 0) v.slots[i] = null; }); });
  v.fields.forEach(f => { if (f.lvl > 0) pool.push(() => { f.lvl = Math.max(0, f.lvl - drop); }); });
  if (v.wall > 0) pool.push(() => { v.wall = Math.max(0, v.wall - drop); });
  let destroyed = 0;
  for (let h = 0; h < hits && pool.length; h++) {
    const idx = ri(0, pool.length - 1);
    pool[idx](); pool.splice(idx, 1); destroyed++;
  }
  return destroyed;
}
// Gempuran bot ke pemain (serangan penuh + meriam) — bisa menghancurkan bangunan & meratakan desa
function resolveBotAtk(m) {
  const bot = S.bots.find(b => b.id === m.bot);
  const v = S.villages[m.vi];
  if (!bot || !v) return;
  const bv = bot.villages[m.bvi || 0] || bot.villages[0];
  if (!liveMode) offlineLog.raidsIn++;
  const dBonus = 1 + 0.015 * bLvl(v, 'smithy');
  const res = battle(m.units, bot.tribe, v.troops, S.tribe, v.wall, false, 1, dBonus);  // serangan penuh
  for (const u in res.dLoss) { v.troops[u] -= res.dLoss[u]; if (v.troops[u] <= 0) delete v.troops[u]; }
  if (bv) for (const u in res.aLoss) { bv.tr[u] = Math.max(0, (bv.tr[u] || 0) - res.aLoss[u]); }
  S.stats.def += sumL(res.aLoss);
  bot.stA = (bot.stA || 0) + sumL(res.dLoss);
  const surv = survivors(m.units, res.aLoss);
  let loot = null, extra = [], razed = false;
  if (res.win) {
    loot = takeLoot(v.res, carryOf(surv, bot.tribe), crannyOf(v));
    if (bv) RES_KEYS.forEach(k => bv.res[k] = Math.min(vResCap(bv), bv.res[k] + loot[k]));
    bot.stR = (bot.stR || 0) + sumL(loot);
    const catas = m.units[U_CATA] || 0;
    if (catas) {
      const last = S.villages.length <= 1;
      const dn = catapultPlayerVillage(v, catas, last);
      extra.push('☄️ Meriam ' + esc(bot.nm) + ' menghancurkan ' + dn + ' bangunan di ' + esc(v.name) + '!');
      if (pop(v) < 10 && !last) {
        extra.push('💥 Desa ' + esc(v.name) + ' Anda hancur total dan lenyap dari peta!');
        bot.stX = (bot.stX || 0) + 1;
        razed = true;
      }
    }
  }
  addReport({type:'battle', win:!res.win, defending:true,
    title:(razed ? '💥 Desa ' + esc(v.name) + ' Anda DIHANCURKAN oleh ' + esc(bot.nm) + '!' :
      (res.win ? '🔥 Gempuran ' + esc(bot.nm) + ' menghantam ' + esc(v.name) : '🛡️ Gempuran ditahan dari ' + esc(bot.nm))),
    att:{nm:bot.nm, vn:bv ? bv.vn : '', tribe:bot.tribe, units:{...m.units}, loss:res.aLoss},
    def:{nm:S.name, vn:v.name, tribe:S.tribe, loss:res.dLoss},
    defBefore: addBack(v.troops, res.dLoss),
    loot, extra, pow:[res.aPow, res.dPow]});
  if (liveMode) toast(razed ? '💥 Desa ' + esc(v.name) + ' Anda dihancurkan ' + esc(bot.nm) + '!' :
    res.win ? '🔥 ' + esc(v.name) + ' digempur ' + esc(bot.nm) + '!' : '🛡️ Gempuran ' + esc(bot.nm) + ' ditahan!');
  if (razed) razePlayerVillage(S.villages.indexOf(v));
}

// Penaklukan oasis (pasukan alam liar = kekuatan pertahanan datar)
function resolveOasisAtk(m, o) {
  const v = S.villages[m.vi];
  const ob = OASIS_TYPES[o.t];
  if (m.kind === 'scout') {
    pushReturn(m, m.units, null);
    addReport({type:'sys', title:'🕵️ Pengintaian ' + ob.nama + ' (' + m.x + '|' + m.y + ')',
      body:'Kekuatan pasukan alam liar diperkirakan ±' + fmtN(o.def) + '. ' +
        (o.owner === m.vi ? 'Oasis ini sudah Anda kuasai.' : o.owner >= 0 ? 'Oasis ini dikuasai desa lain.' : 'Belum dikuasai siapa pun.')});
    return;
  }
  const aBonus = 1 + 0.015 * bLvl(v, 'smithy');
  let aPow = 0; for (const u in m.units) aPow += m.units[u] * TR().units[u].att;
  aPow = Math.max(1, aPow * aBonus);
  const def = Math.max(1, o.def || 0);
  const win = aPow > def;
  const ratio = def / aPow;
  const aLossFrac = win ? Math.min(0.9, Math.pow(ratio, 1.5) * 0.8) : 1;
  const aLoss = {}; for (const u in m.units) aLoss[u] = Math.min(m.units[u], Math.round(m.units[u] * aLossFrac));
  const surv = survivors(m.units, aLoss);
  let extra = [];
  if (win) {
    const owned = ownedOasisCount(m.vi);
    if (o.owner === m.vi) extra.push('Oasis ini memang sudah Anda kuasai.');
    else if (owned >= MAX_OASIS_PER_VILLAGE) extra.push('⚠️ Desa ini sudah menguasai ' + MAX_OASIS_PER_VILLAGE + ' oasis (batas maksimum) — penaklukan gagal.');
    else {
      o.owner = m.vi; o.def = 0;
      const bn = Object.entries(ob.bonus).map(([k, val]) => '+' + Math.round(val * 100) + '% ' + RES_NAMA[k]).join(', ');
      extra.push('🌴 Oasis ditaklukkan! Desa Anda kini mendapat ' + bn + '.');
      buildTIDX();
    }
  } else {
    o.def = Math.max(0, def - Math.round(aPow * 0.6));  // pasukan alam berkurang walau gagal
    extra.push('💀 Pasukan alam liar terlalu kuat. Coba lagi dengan pasukan lebih banyak.');
  }
  addReport({type:'battle', win,
    title:(win ? '🌴 Oasis ditaklukkan' : '💀 Penaklukan gagal') + ' di ' + ob.nama + ' (' + m.x + '|' + m.y + ')',
    att:{nm:S.name, vn:v.name, tribe:S.tribe, units:{...m.units}, loss:aLoss},
    def:{nm:'Alam Liar', vn:ob.nama, tribe:S.tribe, loss:{}},
    defBefore:{}, loot:null, extra, pow:[Math.round(aPow), def]});
  pushReturn(m, surv, null);
}

/* ---------- AI bot (berdetak tiap 10 detik saat game terbuka) ---------- */
function botTick(dtSec, tNow) {
  const d = DIFFS[S.diff];
  const dtH = dtSec / 3600;
  const totalPop = S.villages.reduce((a, v) => a + pop(v), 0);
  const protect = (S.last - S.created < 8 * 3600) || totalPop < 80;
  for (const b of S.bots) {
    let total = 0;
    // pesaing Candi (mode Wonder) — bangun Candi pelan-pelan setelah cukup besar.
    // Saat pemain sedang away (susulan offline), progres Candi bot melambat 100x
    // supaya pemain tetap punya kesempatan mengejar perlombaan Candi.
    if (b.wcomp && botPop(b) > 400 && b.wl < CANDI_MAX) {
      const awayFactor = liveMode ? 1 : 0.01;
      b.wl = Math.min(CANDI_MAX, b.wl + b.wrate * S.speed * dtH * awayFactor);
    }
    for (const v of b.villages) {
      // tumbuh terus-menerus seperti pemain asli
      v.pop += b.gr * S.speed / 24 * dtH * Math.max(0.05, 1 - v.pop / b.cap);
      const cap = vResCap(v);
      for (const k of RES_KEYS) v.res[k] = Math.min(cap, v.res[k] + v.pop * 1.4 * S.speed * dtH);
      v.wall = Math.max(v.wall, Math.min(20, Math.floor(v.pop / 55)));
      botFillTroops(b, v, Math.min(1, 0.03 * S.speed * dtH));  // bangun ulang pasukan pelan-pelan
      total += v.pop;
    }
    // dirikan desa ke-2, ke-3, dst. setelah cukup besar — seperti pemain asli
    if (b.villages.length < maxBotV(b) && total >= 280 * b.villages.length &&
        Math.random() < 0.03 * S.speed * dtH) {
      botSettle(b);
    }
    // perang antar bot — intensitas rendah; hanya merebut sumber daya & pasukan,
    // populasi korban tidak tersentuh sehingga bot terbelakang tetap bisa tumbuh
    if (total >= 150 && Math.random() < b.aggr * 0.03 * S.speed * dtH) {
      const bv = b.villages[ri(0, b.villages.length - 1)];
      for (let t = 0; t < 8; t++) {
        const tb = S.bots[ri(0, S.bots.length - 1)];
        if (tb === b) continue;
        const tv = tb.villages[ri(0, tb.villages.length - 1)];
        if (tv.pop < 80 || dist(bv.x, bv.y, tv.x, tv.y) > 15) continue;
        botBattle(b, bv, tb, tv);
        break;
      }
    }
    // gempuran bot ke pemain (serangan penuh + meriam) — sangat jarang, hanya bot besar & agresif
    if (S.botRaids && !protect && total >= 450 && Math.random() < b.aggr * b.aggr * 0.02 * d.raidCh * dtH) {
      let av = null, avi = 0, pvi = 0, bd = 1e9;
      b.villages.forEach((vv, bi) => S.villages.forEach((pv, pi) => {
        const dd = dist(vv.x, vv.y, pv.x, pv.y);
        if (dd < bd) { bd = dd; av = vv; avi = bi; pvi = pi; }
      }));
      if (av && bd <= 28 && av.pop >= 200) {
        const mix = BOT_MIX[b.tribe];
        const army = {};
        army[mix.off[0]] = Math.min(av.tr[mix.off[0]] || 0, Math.round(av.pop * 0.35));
        if ((army[mix.off[0]] || 0) >= 10) {
          for (const u in army) av.tr[u] -= army[u];
          army[U_CATA] = clamp(Math.round(av.pop / 45), 1, 18);   // meriam (sintetis, tak dipotong stok)
          const pv = S.villages[pvi];
          S.movs.push({id:S.seq++, kind:'botatk', bot:b.id, bvi:avi, vi:pvi, x:pv.x, y:pv.y, units:army, depart:tNow, arrive:tNow + travelSec(bd, 3)});
          dirty = true;
        }
      }
    }
    // rampokan ke pemain (jarang & kecil = difficulty rendah)
    if (!S.botRaids || protect || total < 120) continue;
    if (Math.random() > b.aggr * 0.05 * d.raidCh * b.villages.length * dtH) continue;
    let bv = null, bvi = 0, pvi = 0, bd = 1e9;
    b.villages.forEach((v, bi) => S.villages.forEach((pv, pi) => {
      const dd = dist(v.x, v.y, pv.x, pv.y);
      if (dd < bd) { bd = dd; bv = v; bvi = bi; pvi = pi; }
    }));
    if (bd > 20 || bv.pop < 100) continue;
    const mix = BOT_MIX[b.tribe];
    const size = Math.round(clamp(bv.pop * 0.18 * d.raidSz, 8, 250));
    const u0 = mix.off[0], u1 = mix.off[1];
    const army = {};
    army[u0] = Math.min(bv.tr[u0] || 0, size);
    if ((bv.tr[u1] || 0) > 4 && bv.pop > 300) army[u1] = Math.min(bv.tr[u1], Math.round(size / 8));
    if (sumU(army) < 5) continue;
    for (const u in army) bv.tr[u] -= army[u];
    const pv = S.villages[pvi];
    const dur = travelSec(bd, slowest(army, b.tribe));
    S.movs.push({id:S.seq++, kind:'botraid', bot:b.id, bvi, vi:pvi, x:pv.x, y:pv.y, units:army, depart:tNow, arrive:tNow + dur});
    dirty = true;
  }
}

/* ---------- simulasi waktu ---------- */
function sim(step) {
  const t1 = S.last + step;
  for (const v of S.villages) {
    for (let i = v.bq.length - 1; i >= 0; i--) {
      if (v.bq[i].done <= t1) { applyBuild(v, v.bq[i]); v.bq.splice(i, 1); dirty = true; }
    }
    for (const k in v.tq) {
      const Q = v.tq[k];
      while (Q.length && Q[0].next <= t1) {
        const q = Q[0];
        v.troops[q.u] = (v.troops[q.u] || 0) + 1;
        q.n--;
        if (q.n <= 0) Q.shift(); else q.next += q.each;
        dirty = true;
      }
    }
    if (v.researching && v.researching.done <= t1) {
      v.researched[v.researching.u] = true;
      if (liveMode) toast('🎓 Riset ' + TR().units[v.researching.u].nama + ' selesai!');
      v.researching = null;
      dirty = true;
    }
    const p = prodOf(v), cap = capOf(v);
    v.res.wood = Math.min(cap.store, v.res.wood + p.wood * step / 3600);
    v.res.clay = Math.min(cap.store, v.res.clay + p.clay * step / 3600);
    v.res.iron = Math.min(cap.store, v.res.iron + p.iron * step / 3600);
    v.res.crop = clamp(v.res.crop + p.cropNet * step / 3600, 0, cap.gran);
  }
  const due = S.movs.filter(mm => mm.arrive <= t1).sort((a, b) => a.arrive - b.arrive);
  if (due.length) {
    S.movs = S.movs.filter(mm => mm.arrive > t1);
    due.forEach(processMov);
    dirty = true;
  }
  // Candi Agung pemain
  if (S.candiQ && S.candiQ.done <= t1) {
    S.wonderLvl = S.candiQ.to;
    if (liveMode) toast('🛕 Candi Agung mencapai tingkat ' + S.wonderLvl + '!');
    S.candiQ = null; dirty = true;
  }
  S.botAcc += step;
  const bt = liveMode ? 10 : 600;   // detak halus saat dibuka, kasar saat susulan offline
  while (S.botAcc >= bt) { botTick(bt, t1); S.botAcc -= bt; }
  if (S.wonder && !S.ended) checkEnd();
  S.last = t1;
}
function tick() {
  if (!S) return;
  let dt = now() - S.last;
  if (dt <= 0) return;
  if (dt > 7 * 86400) { S.last = now() - 7 * 86400; dt = 7 * 86400; }  // batas susulan 7 hari
  liveMode = dt < 300;
  while (dt > 0) {
    const step = Math.min(dt, liveMode ? dt : 60);
    sim(step);
    dt -= step;
  }
  liveMode = true;
}

/* ---------- simpan / muat ---------- */
function save() { if (S) localStorage.setItem('wilwatiktaSlot' + (S.slot || 0), JSON.stringify(S)); }
// Migrasi save versi lama: bot satu-desa -> multi-desa + jaminan nama unik
function migrate() {
  if (S.v >= 2) return;
  const usedNm = new Set([S.name]);
  usedVNames = new Set(S.villages.map(v => v.name));
  S.bots.forEach(b => {
    if (!b.villages) {
      b.villages = [{vn: b.vn, x: b.x, y: b.y, pop: b.pop, wall: b.wall, res: b.res, tr: b.tr}];
      delete b.vn; delete b.x; delete b.y; delete b.pop; delete b.wall; delete b.res; delete b.tr;
    }
    b.villages.forEach(v => {
      let n = v.vn, i = 2;
      while (usedVNames.has(n)) n = v.vn + ' ' + i++;
      v.vn = n; usedVNames.add(n);
    });
    let n = b.nm, i = 2;
    while (usedNm.has(n)) n = b.nm + i++;
    b.nm = n; usedNm.add(n);
  });
  S.movs.forEach(m => { if (m.kind === 'botraid' && m.bvi === undefined) m.bvi = 0; });
  S.v = 2;
}
// v3: statistik perang + dunia diisi hingga 250 bot
function migrateV3() {
  if (S.v >= 3) return;
  if (!S.stats) S.stats = {att:0, def:0, raid:0};
  S.bots.forEach(b => {
    if (b.stA === undefined) {
      const tp = botPop(b);
      b.stA = Math.round(tp * b.aggr * rnd(2, 8));
      b.stD = Math.round(tp * rnd(1, 5));
      b.stR = Math.round(tp * b.aggr * rnd(20, 80));
    }
  });
  const occ = {};
  S.bots.forEach(b => b.villages.forEach(v => occ[key(v.x, v.y)] = 1));
  S.oases.forEach(o => occ[key(o.x, o.y)] = 1);
  S.villages.forEach(v => occ[key(v.x, v.y)] = 1);
  const place = (rMin, rMax, cx, cy) => {
    cx = cx || 0; cy = cy || 0;
    for (let tries = 0; tries < 200; tries++) {
      const a = Math.random() * 2 * Math.PI, r = rnd(rMin, rMax);
      const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
      if (Math.abs(x) > MAP_R || Math.abs(y) > MAP_R) continue;
      if (!occ[key(x, y)]) { occ[key(x, y)] = 1; return {x, y}; }
    }
    return null;
  };
  const usedNm = new Set([S.name]);
  S.bots.forEach(b => usedNm.add(b.nm));
  let id = S.bots.reduce((a, b) => Math.max(a, b.id), 0);
  while (S.bots.length < 250) {
    const p = place(5, MAP_R);
    if (!p) break;
    S.bots.push(createBot(++id, p, Math.random(), usedNm, place));
  }
  S.v = 3;
}
// v4: Wilwatikta Plus, oasis bisa ditaklukkan, mode Wonder, multi-akun
function migrateV4() {
  if (S.v >= 4) return;
  if (!S.plus) S.plus = {prod:0, instant:0};
  if (S.wonder === undefined) S.wonder = false;   // dunia lama = tanpa Wonder
  if (S.wonderLvl === undefined) S.wonderLvl = 0;
  if (S.candiQ === undefined) S.candiQ = null;
  if (S.ended === undefined) S.ended = null;
  if (S.slot === undefined) S.slot = 0;
  S.oases.forEach(o => { if (o.def === undefined) o.def = ri(150, 900); if (o.owner === undefined) o.owner = -1; });
  S.v = 4;
}
// v5: berkah Plus instant-pelatihan + laporan bisa di-star (maks. 100)
function migrateV5() {
  if (S.v >= 5) return;
  if (S.plus && S.plus.train === undefined) S.plus.train = 0;
  S.reps.forEach(r => { if (r.star === undefined) r.star = false; });
  if (S.reps.length > 100) S.reps.length = 100;
  S.v = 5;
}
// v6: penghancuran desa (meriam) + statistik penghancur
function migrateV6() {
  if (S.v >= 6) return;
  if (!S.stats) S.stats = {att:0, def:0, raid:0};
  if (S.stats.destroy === undefined) S.stats.destroy = 0;
  S.bots.forEach(b => { if (b.stX === undefined) b.stX = 0; });
  S.v = 6;
}
function applyMigrations() { usedVNames = null; migrate(); migrateV3(); migrateV4(); migrateV5(); migrateV6(); }

/* ---------- multi-akun (maks. 2) ---------- */
const OLD_KEY = 'travianKlasikOffline';
const ACTIVE_KEY = 'wilwatiktaActive';
const MAX_ACCOUNTS = 2;
const slotKey = s => 'wilwatiktaSlot' + s;
function migrateOldKey() {
  const old = localStorage.getItem(OLD_KEY);
  if (old && !localStorage.getItem(slotKey(0))) {
    localStorage.setItem(slotKey(0), old);
    localStorage.removeItem(OLD_KEY);
  }
}
function loadSlot(slot) {
  const raw = localStorage.getItem(slotKey(slot));
  if (!raw) return false;
  try {
    S = JSON.parse(raw); S.slot = slot; applyMigrations(); buildTIDX();
    localStorage.setItem(ACTIVE_KEY, slot);
    return true;
  } catch (e) { console.error(e); return false; }
}
function deleteSlot(slot) {
  localStorage.removeItem(slotKey(slot));
  if (+localStorage.getItem(ACTIVE_KEY) === slot) localStorage.removeItem(ACTIVE_KEY);
}
function slotInfo(slot) {
  const raw = localStorage.getItem(slotKey(slot));
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    let p = 0;
    (o.villages || []).forEach(v => {
      (v.fields || []).forEach(f => p += f.lvl);
      (v.slots || []).forEach(s => { if (s && B[s.b]) p += B[s.b].pop * s.lvl; });
      p += v.wall || 0;
    });
    return {name:o.name, tribe:o.tribe, wonder:!!o.wonder, ended:o.ended, villages:(o.villages||[]).length, pop:p};
  } catch (e) { return {name:'(rusak)', broken:true}; }
}
function load() {  // dipertahankan untuk kompatibilitas — muat slot aktif
  migrateOldKey();
  const a = localStorage.getItem(ACTIVE_KEY);
  if (a !== null && loadSlot(+a)) return true;
  return false;
}
function hardReset() { if (S) deleteSlot(S.slot); S = null; location.reload(); }
