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
function newGame(name, tribe, speed, diff) {
  S = {
    v:1, name: name || 'Pemain', tribe, speed, diff,
    botRaids: true,
    created: now(), last: now(), botAcc: 0,
    villages: [], active: 0,
    movs: [], reps: [], unread: 0, seq: 1,
    bots: [], oases: [],
  };
  S.villages.push(newVillage('Desa ' + S.name, 0, 0));
  AV().slots[0] = {b:'main', lvl:1};
  makeWorld();
  buildTIDX();
  save();
}

/* ---------- dunia & bot ---------- */
function makeWorld() {
  const used = {'0|0': 1};
  const place = (rMin, rMax) => {
    for (let tries = 0; tries < 200; tries++) {
      const a = Math.random() * 2 * Math.PI, r = rnd(rMin, rMax);
      const x = Math.round(Math.cos(a) * r), y = Math.round(Math.sin(a) * r);
      if (Math.abs(x) > MAP_R || Math.abs(y) > MAP_R) continue;
      if (!used[key(x, y)]) { used[key(x, y)] = 1; return {x, y}; }
    }
    return null;
  };
  const tribes = ['roman','teuton','gaul'];
  const N = 170;
  for (let i = 0; i < N; i++) {
    const p = i < 45 ? place(3.5, 12) : place(5, MAP_R);
    if (!p) continue;
    const sk = Math.random();                       // "keahlian" bot
    const pop = Math.round(30 + sk * sk * 270);     // banyak bot kecil, sedikit besar
    const bot = {
      id: i + 1,
      nm: BOT_NAMES[ri(0, BOT_NAMES.length - 1)] + (Math.random() < 0.4 ? ri(1, 99) : ''),
      vn: BOT_VNAMES[ri(0, BOT_VNAMES.length - 1)],
      tag: BOT_TAGS[ri(0, BOT_TAGS.length - 1)],
      tribe: tribes[ri(0, 2)],
      x: p.x, y: p.y,
      pop,
      gr: rnd(8, 32),               // pertumbuhan penduduk / hari (1x)
      cap: ri(700, 2200),           // batas penduduk
      res: {wood:0, clay:0, iron:0, crop:0},
      tr: {},
      wall: 0,
      aggr: Math.random() * Math.random(),  // mayoritas pasif
      defR: rnd(0.35, 0.95),
      offR: rnd(0.15, 0.6),
    };
    for (const k of RES_KEYS) bot.res[k] = rnd(0.3, 0.9) * botResCap(bot);
    bot.wall = Math.min(20, Math.floor(bot.pop / 50));
    botFillTroops(bot, 1);          // pasukan awal langsung penuh
    S.bots.push(bot);
  }
  // oasis
  for (let i = 0; i < 60; i++) {
    const p = place(2, MAP_R);
    if (p) S.oases.push({x:p.x, y:p.y, t: ri(0, OASIS_TYPES.length - 1)});
  }
}
function buildTIDX() {
  TIDX = {};
  S.bots.forEach(b => TIDX[key(b.x, b.y)] = {k:'bot', ref:b});
  S.oases.forEach(o => TIDX[key(o.x, o.y)] = {k:'oasis', ref:o});
  S.villages.forEach((v, i) => TIDX[key(v.x, v.y)] = {k:'me', ref:v, vi:i});
}
const botAt = (x, y) => { const t = TIDX[key(x, y)]; return t && t.k === 'bot' ? t.ref : null; };
const botResCap = b => 800 + b.pop * 30;
const BOT_MIX = { // [unit bertahan utama, sekunder], [unit serang utama, kavaleri]
  roman:  {def:[1,0], off:[2,4]},
  teuton: {def:[1,0], off:[0,4]},
  gaul:   {def:[0,4], off:[1,3]},
};
function botTargets(b) {
  const d = DIFFS[S.diff];
  const mix = BOT_MIX[b.tribe];
  const def = b.pop * b.defR * d.def, off = b.pop * b.offR;
  return {
    [mix.def[0]]: Math.round(def * 0.7),
    [mix.def[1]]: Math.round(def * 0.3),
    [mix.off[0]]: Math.round(off * 0.8),
    [mix.off[1]]: Math.round(off * 0.2 / 3),
  };
}
function botFillTroops(b, frac) {
  const tg = botTargets(b);
  for (const u in tg) {
    const cur = b.tr[u] || 0;
    if (cur < tg[u]) b.tr[u] = Math.min(tg[u], cur + Math.max(1, Math.round((tg[u] - cur) * frac)));
  }
}

/* ---------- ekonomi desa ---------- */
function pop(v) {
  let p = 0;
  v.fields.forEach(f => p += f.lvl);
  v.slots.forEach(s => { if (s) p += B[s.b].pop * s.lvl; });
  p += v.wall;
  return p;
}
function troopUpkeep(v) {
  let u = 0;
  for (const k in v.troops) u += TR().units[k].up * v.troops[k];
  return u;
}
function prodOf(v) {
  const p = {wood:0, clay:0, iron:0, crop:0};
  v.fields.forEach(f => p[FIELD_TYPES[f.t].res] += FIELD_PROD[f.lvl]);
  const boost = {wood:0, clay:0, iron:0, crop:0};
  v.slots.forEach(s => { if (s && B[s.b].boost) boost[B[s.b].boost] += 0.05 * s.lvl; });
  for (const k of RES_KEYS) p[k] = p[k] * (1 + boost[k]) * S.speed;
  p.cropNet = p.crop - (pop(v) + troopUpkeep(v));
  return p;
}
function capOf(v) {
  let store = 0, gran = 0;
  v.slots.forEach(s => {
    if (!s) return;
    if (s.b === 'warehouse') store += STORE_CAP[s.lvl];
    if (s.b === 'granary') gran += STORE_CAP[s.lvl];
  });
  return {store: Math.max(800, store), gran: Math.max(800, gran)};
}
function crannyOf(v) {
  let c = 0;
  v.slots.forEach(s => { if (s && s.b === 'cranny') c += CRANNY_CAP[s.lvl]; });
  return c * (S.tribe === 'gaul' ? 1.5 : 1);
}
function bLvl(v, b) {
  let m = 0;
  v.slots.forEach(s => { if (s && s.b === b) m = Math.max(m, s.lvl); });
  return m;
}
const canAfford = (v, c) => RES_KEYS.every((k, i) => v.res[k] >= c[i]);
const pay = (v, c) => RES_KEYS.forEach((k, i) => v.res[k] -= c[i]);
const refund = (v, c) => { const cap = capOf(v); RES_KEYS.forEach((k, i) => v.res[k] = Math.min(k==='crop'?cap.gran:cap.store, v.res[k] + c[i])); };

/* ---------- pembangunan ---------- */
function fieldCost(t, lvl) { return FIELD_TYPES[t].cost.map(c => r5(c * Math.pow(1.67, lvl))); }
function fieldTime(v, t, lvl) { return Math.max(15, FIELD_TYPES[t].k * Math.pow(1.5, lvl) * Math.pow(0.96, bLvl(v,'main')) / S.speed); }
function bldCost(b, lvl) { return B[b].cost.map(c => r5(c * Math.pow(1.28, lvl))); }
function bldTime(v, b, lvl) { return Math.max(15, B[b].t * Math.pow(1.22, lvl) * Math.pow(0.96, bLvl(v,'main')) / S.speed); }
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
    if (f.lvl >= FIELD_MAX) return false;
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
  if (u === U_SETTLER && bLvl(v, 'residence') < 10) { toast('Butuh Kediaman tingkat 10!'); return false; }
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

/* ---------- laporan ---------- */
function addReport(rep) {
  rep.id = S.seq++; rep.time = S.last; rep.unread = true;
  S.reps.unshift(rep);
  if (S.reps.length > 60) S.reps.length = 60;
  S.unread++;
  if (!liveMode) offlineLog.reports++;
  dirty = true;
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
  // serangan pemain -> petak
  const bot = botAt(m.x, m.y);
  if (!bot) {
    pushReturn(m, m.units, null);
    addReport({type:'sys', title:'Target di (' + m.x + '|' + m.y + ') kosong', body:'Tidak ada desa di sana. Pasukan kembali.'});
    return;
  }
  if (m.kind === 'scout') {
    pushReturn(m, m.units, null);
    addReport({type:'scout', title:'🕵️ Hasil pengintaian ' + esc(bot.vn) + ' (' + m.x + '|' + m.y + ')',
      bot: {nm:bot.nm, vn:bot.vn, tribe:bot.tribe, pop:Math.round(bot.pop), wall:bot.wall},
      res: {...bot.res}, tr: {...bot.tr}});
    return;
  }
  // atk / raid
  const v = S.villages[m.vi];
  const aBonus = 1 + 0.015 * bLvl(v, 'smithy');
  const dBonus = 1 + Math.min(0.2, bot.pop / 4000);
  const res = battle(m.units, S.tribe, bot.tr, bot.tribe, m.kind === 'raid' ? 0 : bot.wall, m.kind === 'raid', aBonus, dBonus);
  // korban bot
  for (const u in res.dLoss) { bot.tr[u] -= res.dLoss[u]; if (bot.tr[u] <= 0) delete bot.tr[u]; }
  const surv = survivors(m.units, res.aLoss);
  let loot = null, extra = [];
  if (res.win) {
    loot = takeLoot(bot.res, carryOf(surv, S.tribe), 0);
    if (m.kind === 'atk') {
      const rams = surv[U_RAM] || 0, catas = surv[U_CATA] || 0;
      if (rams && bot.wall) {
        const down = Math.min(bot.wall, Math.floor(Math.sqrt(rams)));
        if (down) { bot.wall -= down; extra.push('🐏 Pendobrak merobohkan ' + TRIBE_DATA[bot.tribe].wallName + ' sebanyak ' + down + ' tingkat.'); }
      }
      if (catas) {
        const dmg = Math.min(5, Math.floor(catas / 5) + 1);
        bot.pop = Math.max(20, bot.pop - dmg * 8);
        extra.push('☄️ Katapel menghancurkan bangunan (penduduk −' + dmg * 8 + ').');
      }
    }
  }
  addReport({type:'battle', win:res.win,
    title:(res.win ? '⚔️ Kemenangan' : '💀 Kekalahan') + (m.kind==='raid' ? ' (rampokan)' : '') + ' di ' + esc(bot.vn) + ' (' + m.x + '|' + m.y + ')',
    att:{nm:S.name, vn:v.name, tribe:S.tribe, units:{...m.units}, loss:res.aLoss},
    def:{nm:bot.nm, vn:bot.vn, tribe:bot.tribe, loss:res.dLoss, wall:bot.wall},
    defBefore: addBack(bot.tr, res.dLoss),
    loot, extra, pow:[res.aPow, res.dPow]});
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
  if (!liveMode) offlineLog.raidsIn++;
  const dBonus = 1 + 0.015 * bLvl(v, 'smithy');
  const res = battle(m.units, bot.tribe, v.troops, S.tribe, v.wall, true, 1, dBonus);
  for (const u in res.dLoss) { v.troops[u] -= res.dLoss[u]; if (v.troops[u] <= 0) delete v.troops[u]; }
  for (const u in res.aLoss) { bot.tr[u] = Math.max(0, (bot.tr[u] || 0) - res.aLoss[u]); }
  const surv = survivors(m.units, res.aLoss);
  let loot = null;
  if (res.win) {
    loot = takeLoot(v.res, carryOf(surv, bot.tribe), crannyOf(v));
    RES_KEYS.forEach(k => bot.res[k] = Math.min(botResCap(bot), bot.res[k] + loot[k]));
  }
  addReport({type:'battle', win:!res.win, defending:true,
    title:(res.win ? '🔥 Desa Anda dirampok oleh ' : '🛡️ Serangan berhasil ditahan dari ') + esc(bot.nm),
    att:{nm:bot.nm, vn:bot.vn, tribe:bot.tribe, units:{...m.units}, loss:res.aLoss},
    def:{nm:S.name, vn:v.name, tribe:S.tribe, loss:res.dLoss},
    defBefore: addBack(v.troops, res.dLoss),
    loot, extra:[], pow:[res.aPow, res.dPow]});
  if (liveMode) toast(res.win ? '🔥 Desa Anda dirampok ' + esc(bot.nm) + '!' : '🛡️ Serangan ' + esc(bot.nm) + ' berhasil ditahan!');
}

/* ---------- AI bot per jam-game ---------- */
function botHour(t) {
  const d = DIFFS[S.diff];
  const totalPop = S.villages.reduce((a, v) => a + pop(v), 0);
  const protect = (S.last - S.created < 8 * 3600) || totalPop < 80;
  for (const b of S.bots) {
    // tumbuh seperti pemain asli
    b.pop += b.gr * S.speed / 24 * Math.max(0.05, 1 - b.pop / b.cap);
    const cap = botResCap(b);
    for (const k of RES_KEYS) b.res[k] = Math.min(cap, b.res[k] + b.pop * 1.4 * S.speed);
    b.wall = Math.max(b.wall, Math.min(20, Math.floor(b.pop / 55)));
    botFillTroops(b, 0.03 * S.speed);   // bangun ulang pasukan pelan-pelan
    // rampokan ke pemain (jarang & kecil = difficulty rendah)
    if (!S.botRaids || protect || b.pop < 120) continue;
    if (Math.random() > b.aggr * 0.05 * d.raidCh) continue;
    let best = null, bd = 1e9;
    S.villages.forEach((v, vi) => { const dd = dist(b.x, b.y, v.x, v.y); if (dd < bd) { bd = dd; best = vi; } });
    if (bd > 20) continue;
    const mix = BOT_MIX[b.tribe];
    const size = Math.round(clamp(b.pop * 0.18 * d.raidSz, 8, 250));
    const u0 = mix.off[0], u1 = mix.off[1];
    const army = {};
    army[u0] = Math.min(b.tr[u0] || 0, size);
    if ((b.tr[u1] || 0) > 4 && b.pop > 300) army[u1] = Math.min(b.tr[u1], Math.round(size / 8));
    if (sumU(army) < 5) continue;
    for (const u in army) b.tr[u] -= army[u];
    const v = S.villages[best];
    const dur = travelSec(bd, slowest(army, b.tribe));
    S.movs.push({id:S.seq++, kind:'botraid', bot:b.id, vi:best, x:v.x, y:v.y, units:army, depart:t, arrive:t + dur});
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
  S.botAcc += step;
  while (S.botAcc >= 3600) { botHour(t1); S.botAcc -= 3600; }
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
const SAVE_KEY = 'travianKlasikOffline';
function save() { if (S) localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }
function load() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;
  try { S = JSON.parse(raw); buildTIDX(); return true; }
  catch (e) { console.error(e); return false; }
}
function hardReset() { localStorage.removeItem(SAVE_KEY); location.reload(); }
