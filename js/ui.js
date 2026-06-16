'use strict';
/* ================= ANTARMUKA ================= */
let VIEW = {name:'dorf1', p:{}};
let mapC = {x:0, y:0};
let screen = 'accounts';   // layar saat S null: 'accounts' | 'setup'
let pendingSlot = 0;       // slot yang sedang dibuat akunnya
let endShown = false;      // layar kemenangan sudah ditampilkan?

const $ = id => document.getElementById(id);
function go(name, p) { VIEW = {name, p: p || {}}; render(); }
function toast(msg) {
  if (!liveMode) return;
  const t = document.createElement('div');
  t.className = 'toast'; t.innerHTML = msg;
  $('toasts').appendChild(t);
  setTimeout(() => t.remove(), 5000);
}
function openModal(html) { $('modal').innerHTML = html; $('ovl').classList.add('show'); }
function closeModal() { $('ovl').classList.remove('show'); $('modal').innerHTML = ''; }
document.addEventListener('click', e => { if (e.target.id === 'ovl') closeModal(); });

function costHtml(v, cost) {
  return '<span class="cost">' + RES_KEYS.map((k, i) =>
    '<span class="' + (v.res[k] < cost[i] ? 'lack' : '') + '">' + RES_ICON[k] + ' ' + fmtN(cost[i]) + '</span>'
  ).join('') + '</span>';
}
function cd(ts) { return '<span class="cdwrap" data-cd="' + ts + '">' + fmtT(ts - now()) + '</span>'; }

/* ---------- kerangka ---------- */
function render() {
  if (!S) { if (screen === 'setup') renderSetup(); else renderAccounts(); return; }
  renderChrome();
  const f = {dorf1:vDorf1, dorf2:vDorf2, map:vMap, tile:vTile, rally:vRally, reports:vReports, report:vReport, stats:vStats, plus:vPlus, candi:vCandi, help:vHelp}[VIEW.name] || vDorf1;
  $('content').innerHTML = f();
  dirty = false;
}
function renderChrome() {
  const incoming = S.movs.filter(m => m.kind === 'botraid').length;
  const tabs = [
    ['dorf1','Sumber Daya'], ['dorf2','Pusat Desa'], ['map','Peta'], ['rally','Pasukan'],
    ['stats','Statistik'], ['reports','Laporan' + (S.unread ? '<span class="badge">' + S.unread + '</span>' : '')],
    ['plus','⭐ Plus'],
  ];
  if (S.wonder) tabs.push(['candi','🛕 Candi ' + Math.floor(S.wonderLvl) + '/' + CANDI_MAX]);
  tabs.push(['help','Bantuan']);
  $('nav').innerHTML = tabs.map(([k, label]) =>
    '<div class="tab ' + (VIEW.name === k || (VIEW.name==='report'&&k==='reports') || (VIEW.name==='tile'&&k==='map') ? 'act' : '') + '" onclick="go(\'' + k + '\')">' + label + '</div>'
  ).join('');
  const v = AV();
  let sw = '';
  if (S.villages.length > 1) {
    sw = '<select onchange="S.active=+this.value;save();render()">' +
      S.villages.map((vv, i) => '<option value="' + i + '"' + (i === S.active ? ' selected' : '') + '>' + esc(vv.name) + ' (' + vv.x + '|' + vv.y + ')</option>').join('') + '</select>';
  } else {
    sw = '<b>' + esc(v.name) + '</b> (' + v.x + '|' + v.y + ')';
  }
  $('subbar').innerHTML =
    '<span>🏘️ Desa: ' + sw + '</span>' +
    '<span>👥 Penduduk: <b>' + pop(v) + '</b></span>' +
    (incoming ? '<span class="atkwarn">⚔️ ' + incoming + ' serangan masuk!</span>' : '') +
    '<span style="margin-left:auto" class="muted">' + esc(S.name) + ' — ' + TR().icon + ' ' + TR().nama + '</span>';
  const plusTags = [];
  if (plusProdActive()) plusTags.push('🌾');
  if (plusInstantActive()) plusTags.push('⚡');
  if (plusTrainActive()) plusTags.push('🎯');
  $('hinfo').innerHTML = '<b>' + S.speed + 'x</b> ' + (S.wonder ? '🛕' : '♾️') +
    (plusTags.length ? ' <span style="color:#ffe9a8">⭐' + plusTags.join('') + '</span>' : '');
  renderBar();
}
function renderBar() {
  if (!S) return;
  const v = AV(), p = prodOf(v), cap = capOf(v);
  const cell = (k, val, capv, perHr) => {
    const full = val >= capv - 1;
    return '<div class="rbox" title="' + RES_NAMA[k] + ': ' + (perHr >= 0 ? '+' : '') + fmtN(perHr) + '/jam">' +
      '<span>' + RES_ICON[k] + ' <b class="' + (full ? 'full' : '') + '">' + fmtN(val) + '</b></span>' +
      '<span class="rcap">/' + fmtN(capv) + '</span></div>';
  };
  $('resbar').innerHTML =
    cell('wood', v.res.wood, cap.store, p.wood) +
    cell('clay', v.res.clay, cap.store, p.clay) +
    cell('iron', v.res.iron, cap.store, p.iron) +
    cell('crop', v.res.crop, cap.gran, p.cropNet) +
    '<div class="rbox upk" title="Konsumsi gandum penduduk & pasukan">🍽️ <b>' + (pop(v) + troopUpkeep(v)) + '</b></div>';
}

/* ---------- panel samping bersama ---------- */
function sideQueue(v) {
  let h = '<div class="box"><h3>🏗️ Antrian Pembangunan</h3><div class="bd">';
  if (!v.bq.length) h += '<span class="muted">Tidak ada pembangunan.</span>';
  v.bq.forEach((q, i) => {
    const nm = q.kind === 'field' ? FIELD_TYPES[v.fields[q.idx].t].nama : q.kind === 'wall' ? TR().wallName : B[q.b].nama;
    h += '<div class="qrow"><span>' + nm + ' → tk.' + q.to + '</span><span>' + cd(q.done) +
      (plusInstantActive() ? ' <a onclick="finishNow(AV(),' + i + ');render()" title="Selesaikan seketika">⚡</a>' : '') +
      ' <a onclick="cancelBuild(AV(),' + i + ');render()" title="Batalkan">✖</a></span></div>';
  });
  h += '</div></div>';
  // antrian pelatihan
  const rows = [];
  let hasTrain = false;
  for (const b in v.tq) v.tq[b].forEach(q => {
    hasTrain = true;
    rows.push('<div class="qrow"><span>' + TR().units[q.u].icon + ' ' + TR().units[q.u].nama + ' ×' + q.n + '</span><span>' + cd(q.next + q.each * (q.n - 1)) + '</span></div>');
  });
  if (v.researching) rows.push('<div class="qrow"><span>🎓 Riset ' + TR().units[v.researching.u].nama + '</span><span>' + cd(v.researching.done) + '</span></div>');
  if (rows.length) h += '<div class="box"><h3>🎯 Pelatihan & Riset</h3><div class="bd">' + rows.join('') +
    (hasTrain && plusTrainActive() ? '<div style="margin-top:6px"><button class="sec" onclick="finishAllTraining(AV());render()">🎯 Selesaikan semua pelatihan seketika</button></div>' : '') +
    '</div></div>';
  return h;
}
function sideTroops(v) {
  const keys = Object.keys(v.troops);
  let h = '<div class="box"><h3>🛡️ Pasukan di Desa</h3><div class="bd">';
  if (!keys.length) h += '<span class="muted">Tidak ada prajurit. Bangun ' + B.barracks.nama + ' untuk melatih.</span>';
  keys.forEach(u => {
    const ud = TR().units[u];
    h += '<div class="qrow"><span>' + ud.icon + ' ' + ud.nama + '</span><b>' + fmtN(v.troops[u]) + '</b></div>';
  });
  h += '</div></div>';
  return h;
}
function sideMovs() {
  const mine = S.movs.filter(m => m.kind !== 'botraid' ? m.vi !== undefined : true).sort((a, b) => a.arrive - b.arrive).slice(0, 8);
  if (!mine.length) return '';
  let h = '<div class="box"><h3>🚶 Pergerakan Pasukan</h3><div class="bd">';
  mine.forEach(m => { h += mvLine(m); });
  h += '</div></div>';
  return h;
}
function mvLine(m) {
  const KIND = {atk:'⚔️ Serangan ke', raid:'💰 Rampokan ke', scout:'🕵️ Pengintaian ke', return:'🏠 Kembali dari', settle:'🚚 Pemukim ke', trade:'⚖️ Kiriman ke', botraid:'🔻 SERANGAN MASUK dari'};
  let who = '(' + m.x + '|' + m.y + ')';
  if (m.kind === 'botraid') {
    const b = S.bots.find(bb => bb.id === m.bot);
    const bv = b && (b.villages[m.bvi || 0] || b.villages[0]);
    who = (bv ? esc(bv.vn) + ' ' : '') + '→ ' + esc(S.villages[m.vi].name);
  } else if (m.kind === 'trade') {
    who = esc(S.villages[m.tvi].name);
  }
  return '<div class="mvrow ' + (m.kind === 'botraid' ? 'in' : '') + '">' + KIND[m.kind] + ' ' + who + ' — ' + cd(m.arrive) + '</div>';
}

/* ---------- dorf1: sumber daya ---------- */
function vDorf1() {
  const v = AV(), p = prodOf(v);
  let tiles = '';
  v.fields.forEach((f, i) => {
    const busy = v.bq.some(q => q.kind === 'field' && q.idx === i);
    const ft = FIELD_TYPES[f.t];
    tiles += '<div class="tile fld f-' + f.t + (busy ? ' busy' : '') + '" onclick="openField(' + i + ')" title="' + ft.nama + ' tingkat ' + f.lvl + '">' +
      '<span class="picon">' + ft.icon + '</span><span class="lvl">' + (busy ? '🔨 ' : '') + f.lvl + '</span><span class="tnm">' + ft.nama + '</span></div>';
  });
  const prow = (k, val) => '<tr><td>' + RES_ICON[k] + ' ' + RES_NAMA[k] + '</td><td class="rt ' + (val < 0 ? 'red' : '') + '">' + (val >= 0 ? '+' : '') + fmtN(val) + ' /jam</td></tr>';
  return '<div class="cols"><div class="colL">' +
    '<div class="box"><h3>🌄 Ladang Sumber Daya</h3><div class="bd"><div class="fgrid">' + tiles +
    '<div class="tile bld wide" onclick="go(\'dorf2\')" title="Masuk ke pusat desa"><span class="picon">🏰</span><b>Pusat Desa</b><span class="muted">— kelola gedung &raquo;</span></div>' +
    '</div></div></div></div>' +
    '<div class="colR">' +
    '<div class="box"><h3>📊 Produksi per Jam</h3><div class="bd"><table class="t">' +
    prow('wood', p.wood) + prow('clay', p.clay) + prow('iron', p.iron) + prow('crop', p.cropNet) +
    '</table></div></div>' +
    sideQueue(v) + sideTroops(v) + sideMovs() +
    '</div></div>';
}
function openField(i) {
  const v = AV(), f = v.fields[i], ft = FIELD_TYPES[f.t];
  const cost = fieldCost(f.t, f.lvl), dur = fieldTime(v, f.t, f.lvl);
  const maxed = f.lvl >= FIELD_MAX_EXT;
  const cur = fieldProd(f.lvl) * S.speed, nxt = fieldProd(f.lvl + 1) * S.speed;
  openModal('<h2><span class="x" onclick="closeModal()">✖</span>' + ft.icon + ' ' + ft.nama + ' — tingkat ' + f.lvl + '</h2><div class="mbd">' +
    '<p>Produksi sekarang: <b>' + fmtN(cur) + '/jam</b>' + (maxed ? '' : ' → tingkat ' + (f.lvl + 1) + ': <b class="green">' + fmtN(nxt) + '/jam</b>') + '</p><br>' +
    (maxed ? '<p class="muted">Sudah tingkat maksimum.</p>' :
      '<p>Biaya: ' + costHtml(v, cost) + '</p><p>Waktu bangun: <b>' + fmtT(dur) + '</b></p><br>' +
      '<button ' + (canAfford(v, cost) && queueFree(v, true) ? '' : 'disabled') + ' onclick="if(startBuild(AV(),\'field\',' + i + '))(closeModal(),render())">⬆️ Tingkatkan ke ' + (f.lvl + 1) + '</button>') +
    '</div>');
}

/* ---------- dorf2: pusat desa ---------- */
function vDorf2() {
  const v = AV();
  let tiles = '';
  v.slots.forEach((s, i) => {
    const busy = v.bq.some(q => q.kind === 'slot' && q.idx === i);
    if (s) {
      tiles += '<div class="tile bld' + (busy ? ' busy' : '') + '" onclick="openSlot(' + i + ')" title="' + B[s.b].nama + ' tingkat ' + s.lvl + '">' +
        '<span class="picon">' + B[s.b].icon + '</span><span class="lvl">' + (busy ? '🔨 ' : '') + s.lvl + '</span><span class="tnm">' + B[s.b].nama + '</span></div>';
    } else {
      tiles += '<div class="tile empty' + (busy ? ' busy' : '') + '" onclick="openSlot(' + i + ')" title="Lahan kosong">' +
        '<span class="picon">🌿</span>' + (busy ? '<span class="lvl">🔨 …</span>' : '<span class="tnm">Lahan kosong</span>') + '</div>';
    }
  });
  const wallBusy = v.bq.some(q => q.kind === 'wall');
  tiles += '<div class="tile bld wide' + (wallBusy ? ' busy' : '') + '" onclick="openWall()" title="' + TR().wallName + '">' +
    '<span class="picon">🧱</span><b>' + TR().wallName + '</b><span class="lvl">' + (wallBusy ? '🔨 ' : '') + v.wall + '</span>' +
    '<span class="muted">+' + Math.round((Math.pow(TR().wallBonus, v.wall) - 1) * 100) + '% pertahanan</span></div>';
  return '<div class="cols"><div class="colL">' +
    '<div class="box"><h3>🏰 ' + esc(v.name) + ' — Pusat Desa</h3><div class="bd"><div class="fgrid">' + tiles + '</div></div></div></div>' +
    '<div class="colR">' + sideQueue(v) + sideTroops(v) + sideMovs() + '</div></div>';
}
function openWall() {
  const v = AV();
  const cost = wallCost(v.wall), dur = wallTime(v, v.wall), maxed = v.wall >= WALL_DEF.max;
  openModal('<h2><span class="x" onclick="closeModal()">✖</span>🧱 ' + TR().wallName + ' — tingkat ' + v.wall + '</h2><div class="mbd">' +
    '<p>Bonus pertahanan: <b>+' + Math.round((Math.pow(TR().wallBonus, v.wall) - 1) * 100) + '%</b></p><br>' +
    (maxed ? '<p class="muted">Sudah maksimum.</p>' :
      '<p>Biaya: ' + costHtml(v, cost) + '</p><p>Waktu: <b>' + fmtT(dur) + '</b></p><br>' +
      '<button ' + (canAfford(v, cost) && queueFree(v, false) ? '' : 'disabled') + ' onclick="if(startBuild(AV(),\'wall\'))(closeModal(),render())">⬆️ Tingkatkan ke ' + (v.wall + 1) + '</button>') +
    '</div>');
}
function openSlot(i) {
  const v = AV(), s = v.slots[i];
  if (!s) { openBuildList(i); return; }
  const b = s.b, def = B[b];
  const cost = bldCost(b, s.lvl), dur = bldTime(v, b, s.lvl), maxed = s.lvl >= def.max;
  let special = '';
  if (b === 'barracks' || b === 'stable' || b === 'workshop' || b === 'residence') special = trainUI(v, b);
  if (b === 'academy') special = academyUI(v);
  if (b === 'market') special = marketUI(v);
  if (b === 'rally') special = '<br><button class="sec" onclick="closeModal();go(\'rally\')">🚩 Buka Titik Kumpul</button>';
  openModal('<h2><span class="x" onclick="closeModal()">✖</span>' + def.icon + ' ' + def.nama + ' — tingkat ' + s.lvl + '</h2><div class="mbd">' +
    '<p class="muted">' + def.desc + '</p><br>' +
    (maxed ? '<p class="muted">Sudah tingkat maksimum (tk.' + def.max + ').</p>' :
      '<p>Biaya tingkat ' + (s.lvl + 1) + ': ' + costHtml(v, cost) + '</p><p>Waktu: <b>' + fmtT(dur) + '</b>' + (plusInstantActive() ? ' <span style="color:#c80">⚡ bisa diselesaikan seketika di antrian</span>' : '') + '</p><br>' +
      '<button ' + (canAfford(v, cost) && queueFree(v, false) ? '' : 'disabled') + ' onclick="if(startBuild(AV(),\'slot\',' + i + '))(closeModal(),render())">⬆️ Tingkatkan ke ' + (s.lvl + 1) + '</button>') +
    special + '</div>');
}
function openBuildList(i) {
  const v = AV();
  const have = {};
  v.slots.forEach(s => { if (s) have[s.b] = true; });
  let rows = '';
  for (const b in B) {
    if (have[b] && !B[b].multi) continue;
    if (B[b].tribe && B[b].tribe !== S.tribe) continue;  // mis. Sendang Turangga khusus Majapahit
    const ok = reqOk(v, B[b].req);
    const cost = bldCost(b, 0);
    rows += '<div class="unitrow"><span class="uic">' + B[b].icon + '</span><div style="flex:1"><b>' + B[b].nama + '</b><br>' +
      '<span class="muted">' + B[b].desc + '</span><br>' +
      (ok ? costHtml(v, cost) : '<span class="red">Syarat: ' + reqText(B[b].req) + '</span>') + '</div>' +
      '<button ' + (ok && canAfford(v, cost) && queueFree(v, false) ? '' : 'disabled') + ' onclick="if(startBuild(AV(),\'slot\',' + i + ',\'' + b + '\'))(closeModal(),render())">Bangun</button></div>';
  }
  openModal('<h2><span class="x" onclick="closeModal()">✖</span>🌿 Bangun Gedung Baru</h2><div class="mbd">' + rows + '</div>');
}
