'use strict';
/* ================= ANTARMUKA (bag. 2) ================= */

/* ---------- pelatihan pasukan ---------- */
function trainUI(v, b) {
  const units = TR().units;
  let rows = '';
  units.forEach((u, i) => {
    if (u.b !== b) return;
    if (!v.researched[i]) return;
    if (i === U_SETTLER && bLvl(v, 'residence') < 10) {
      rows += '<div class="unitrow"><span class="uic">' + u.icon + '</span><div style="flex:1"><b>' + u.nama + '</b><br><span class="red">Butuh Kediaman tingkat 10</span></div></div>';
      return;
    }
    const maxN = Math.floor(Math.min(...RES_KEYS.map((k, j) => u.cost[j] ? v.res[k] / u.cost[j] : 1e9)));
    rows += '<div class="unitrow"><span class="uic">' + u.icon + '</span><div style="flex:1">' +
      '<b>' + u.nama + '</b> <span class="tag">⚔' + u.att + ' 🛡' + u.di + '/' + u.dc + ' 🏃' + u.spd + ' 🎒' + u.carry + '</span><br>' +
      costHtml(v, u.cost) + ' · ⏱ ' + fmtT(trainTime(v, i)) + '/unit</div>' +
      '<span><input type="number" min="0" max="' + maxN + '" value="0" id="tn_' + i + '" style="width:55px"> ' +
      '<a onclick="document.getElementById(\'tn_' + i + '\').value=' + maxN + '">(' + maxN + ')</a> ' +
      '<button onclick="doTrain(' + i + ')">Latih</button></span></div>';
  });
  const locked = units.filter((u, i) => u.b === b && !v.researched[i]).map(u => u.nama);
  return '<br><h3 style="margin:6px 0">Latih Pasukan</h3>' + (rows || '<p class="muted">Belum ada unit yang bisa dilatih di sini.</p>') +
    (locked.length ? '<p class="muted" style="margin-top:5px">🔒 Perlu riset di Akademi: ' + locked.join(', ') + '</p>' : '');
}
function doTrain(u) {
  const n = +document.getElementById('tn_' + u).value;
  if (startTrain(AV(), u, n)) { closeModal(); render(); toast('🎯 Pelatihan dimulai'); }
}

/* ---------- akademi ---------- */
function academyUI(v) {
  const units = TR().units;
  let rows = '';
  units.forEach((u, i) => {
    if (v.researched[i] || i === U_SETTLER) return;
    const ok = reqOk(v, u.req);
    const cost = researchCost(i);
    const busy = !!v.researching;
    rows += '<div class="unitrow"><span class="uic">' + u.icon + '</span><div style="flex:1"><b>' + u.nama + '</b> ' +
      '<span class="tag">⚔' + u.att + ' 🛡' + u.di + '/' + u.dc + '</span><br>' +
      (ok ? costHtml(v, cost) : '<span class="red">Syarat: ' + reqText(u.req) + '</span>') + '</div>' +
      '<button ' + (ok && !busy && canAfford(v, cost) ? '' : 'disabled') + ' onclick="if(startResearch(AV(),' + i + '))(closeModal(),render())">Riset</button></div>';
  });
  return '<br><h3 style="margin:6px 0">Riset Pasukan</h3>' +
    (v.researching ? '<p>Sedang meriset <b>' + units[v.researching.u].nama + '</b> — ' + cd(v.researching.done) + '</p>' : '') +
    (rows || '<p class="muted">Semua unit sudah diriset.</p>');
}

/* ---------- pasar ---------- */
function marketUI(v) {
  const lvl = bLvl(v, 'market');
  const maxEx = lvl * 1000;
  let h = '<br><h3 style="margin:6px 0">Tukar Sumber Daya (NPC 1:1)</h3>' +
    '<div class="frow"><select id="ex_from">' + RES_KEYS.map(k => '<option value="' + k + '">' + RES_ICON[k] + ' ' + RES_NAMA[k] + '</option>').join('') + '</select> →' +
    '<select id="ex_to">' + RES_KEYS.map((k, i) => '<option value="' + k + '"' + (i === 1 ? ' selected' : '') + '>' + RES_ICON[k] + ' ' + RES_NAMA[k] + '</option>').join('') + '</select>' +
    '<input type="number" id="ex_n" value="100" min="1" max="' + maxEx + '"> <button onclick="doExchange()">Tukar</button></div>' +
    '<p class="muted">Maksimum ' + fmtN(maxEx) + ' per penukaran (1.000 × tingkat pasar).</p>';
  if (S.villages.length > 1) {
    h += '<br><h3 style="margin:6px 0">Kirim ke Desa Sendiri</h3><div class="frow"><select id="tr_to">' +
      S.villages.map((vv, i) => i === S.active ? '' : '<option value="' + i + '">' + esc(vv.name) + '</option>').join('') +
      '</select></div><div class="frow">' +
      RES_KEYS.map(k => RES_ICON[k] + '<input type="number" id="tr_' + k + '" value="0" min="0" style="width:60px">').join(' ') +
      ' <button onclick="doSendRes()">Kirim</button></div>';
  }
  return h;
}
function doExchange() {
  const v = AV(), lvl = bLvl(v, 'market');
  const from = document.getElementById('ex_from').value, to = document.getElementById('ex_to').value;
  let n = Math.floor(+document.getElementById('ex_n').value);
  if (from === to || n < 1) return;
  n = Math.min(n, lvl * 1000, Math.floor(v.res[from]));
  if (n < 1) { toast('Sumber daya tidak cukup!'); return; }
  const cap = capOf(v);
  v.res[from] -= n;
  v.res[to] = Math.min(to === 'crop' ? cap.gran : cap.store, v.res[to] + n);
  save(); closeModal(); render();
  toast('⚖️ Menukar ' + fmtN(n) + ' ' + RES_NAMA[from] + ' → ' + RES_NAMA[to]);
}
function doSendRes() {
  const v = AV();
  const tvi = +document.getElementById('tr_to').value;
  const amounts = {};
  let total = 0;
  RES_KEYS.forEach(k => { amounts[k] = Math.max(0, Math.floor(+document.getElementById('tr_' + k).value || 0)); total += amounts[k]; });
  if (!total) return;
  for (const k of RES_KEYS) if (v.res[k] < amounts[k]) { toast('Sumber daya tidak cukup!'); return; }
  RES_KEYS.forEach(k => v.res[k] -= amounts[k]);
  const tv = S.villages[tvi];
  const dur = travelSec(dist(v.x, v.y, tv.x, tv.y), 16);
  S.movs.push({id:S.seq++, kind:'trade', vi:S.active, tvi, x:tv.x, y:tv.y, loot:amounts, depart:now(), arrive:now() + dur});
  save(); closeModal(); render();
  toast('⚖️ Pedagang berangkat ke ' + esc(tv.name));
}

/* ---------- peta ---------- */
function vMap() {
  const mob = window.innerWidth < 760;
  const W = mob ? 4 : 8, H = mob ? 5 : 5; // 9x11 di ponsel, 17x11 di layar lebar
  let rows = '';
  for (let y = mapC.y - H; y <= mapC.y + H; y++) {
    rows += '<tr>';
    for (let x = mapC.x - W; x <= mapC.x + W; x++) {
      if (Math.abs(x) > MAP_R || Math.abs(y) > MAP_R) { rows += '<td style="background:#3a431a"></td>'; continue; }
      const t = TIDX[key(x, y)];
      let cls = (x + y) % 2 ? 'm-empty' : 'm-empty2', ic = '', nm = '';
      if (t) {
        if (t.k === 'me') { cls = 'm-me'; ic = '🏰'; nm = esc(t.ref.name); }
        else if (t.k === 'bot') { cls = 'm-bot tr-' + t.ref.tribe; ic = '🏘️'; nm = esc(t.ref.vn); }
        else { cls = 'm-oasis'; ic = OASIS_TYPES[t.ref.t].icon; }
      }
      rows += '<td class="' + cls + '" onclick="go(\'tile\',{x:' + x + ',y:' + y + '})" title="(' + x + '|' + y + ')">' +
        (ic ? '<span class="mi">' + ic + '</span>' : '') + (nm ? '<span class="mn">' + nm + '</span>' : '') + '</td>';
    }
    rows += '</tr>';
  }
  return '<div class="mapnav">' +
    '<button class="sec" onclick="mapC.x-=5;render()">⬅</button>' +
    '<button class="sec" onclick="mapC.y-=5;render()">⬆</button>' +
    '<button class="sec" onclick="mapC.y+=5;render()">⬇</button>' +
    '<button class="sec" onclick="mapC.x+=5;render()">➡</button>' +
    '&nbsp; Ke koordinat: <input type="number" id="gx" value="' + mapC.x + '" style="width:50px"> | <input type="number" id="gy" value="' + mapC.y + '" style="width:50px">' +
    '<button class="sec" onclick="mapC.x=clamp(+document.getElementById(\'gx\').value,-MAP_R,MAP_R);mapC.y=clamp(+document.getElementById(\'gy\').value,-MAP_R,MAP_R);render()">OK</button>' +
    '<button class="sec" onclick="mapC.x=AV().x;mapC.y=AV().y;render()">🏰 Desaku</button></div>' +
    '<table id="map"><tbody>' + rows + '</tbody></table>' +
    '<p class="ctr muted" style="margin-top:6px">Klik petak untuk melihat detail. 🏘️ desa bot · 🏰 desa Anda · petak hijau tua = oasis</p>';
}

/* ---------- detail petak ---------- */
function vTile() {
  const {x, y} = VIEW.p;
  const v = AV();
  const d = dist(v.x, v.y, x, y);
  const t = TIDX[key(x, y)];
  let h = '<div class="box" style="max-width:640px;margin:0 auto"><h3>🗺️ Petak (' + x + '|' + y + ') — jarak ' + d.toFixed(1) + ' petak</h3><div class="bd">';
  if (t && t.k === 'me') {
    const vv = t.ref;
    h += '<p><b>' + esc(vv.name) + '</b> — desa Anda sendiri. Penduduk: ' + pop(vv) + '</p><br>' +
      '<button onclick="S.active=' + t.vi + ';save();go(\'dorf1\')">Masuk Desa</button>';
  } else if (t && t.k === 'bot') {
    const b = t.ref;
    h += '<table class="t">' +
      '<tr><th>Desa</th><td>' + esc(b.vn) + '</td></tr>' +
      '<tr><th>Pemain</th><td>' + esc(b.nm) + (b.tag ? ' <span class="tag">[' + b.tag + ']</span>' : '') + '</td></tr>' +
      '<tr><th>Suku</th><td>' + TRIBE_DATA[b.tribe].icon + ' ' + TRIBE_DATA[b.tribe].nama + '</td></tr>' +
      '<tr><th>Penduduk</th><td>' + Math.round(b.pop) + '</td></tr></table><br>' +
      '<button onclick="go(\'rally\',{x:' + x + ',y:' + y + ',kind:\'atk\'})">⚔️ Serang</button> ' +
      '<button onclick="go(\'rally\',{x:' + x + ',y:' + y + ',kind:\'raid\'})">💰 Rampok</button> ' +
      '<button class="sec" onclick="go(\'rally\',{x:' + x + ',y:' + y + ',kind:\'scout\'})">🕵️ Intai</button>';
  } else if (t && t.k === 'oasis') {
    h += '<p>' + OASIS_TYPES[t.ref.t].icon + ' <b>' + OASIS_TYPES[t.ref.t].nama + '</b></p><p class="muted">Wilayah liar yang belum dijamah.</p>';
  } else {
    const settlers = v.troops[U_SETTLER] || 0;
    h += '<p>🌿 <b>Padang rumput kosong</b></p><p class="muted">Petak ini bisa dijadikan desa baru (butuh 3 Pemukim dari Kediaman tk.10).</p><br>' +
      '<button ' + (settlers >= 3 ? '' : 'disabled') + ' onclick="doSettle(' + x + ',' + y + ')">🚚 Dirikan Desa Baru (3 Pemukim' + (settlers < 3 ? ' — punya ' + settlers : '') + ')</button>';
  }
  h += '<br><br><a onclick="go(\'map\')">« kembali ke peta</a></div></div>';
  return h;
}
function doSettle(x, y) {
  const units = {};
  units[U_SETTLER] = 3;
  if (sendTroops(S.active, x, y, units, 'settle')) { go('rally'); toast('🚚 Pemukim berangkat!'); }
}

/* ---------- titik kumpul / kirim pasukan ---------- */
function vRally() {
  const v = AV();
  const p = VIEW.p || {};
  const units = TR().units;
  let urows = '';
  units.forEach((u, i) => {
    const have = v.troops[i] || 0;
    if (i === U_SETTLER) return;
    urows += '<tr><td>' + u.icon + ' ' + u.nama + '</td><td class="ctr">' + have + '</td>' +
      '<td><input type="number" id="su_' + i + '" value="0" min="0" max="' + have + '"> <a onclick="document.getElementById(\'su_' + i + '\').value=' + have + '">semua</a></td></tr>';
  });
  const movs = S.movs.slice().sort((a, b) => a.arrive - b.arrive);
  let mrows = movs.length ? movs.map(mvLine).join('') : '<span class="muted">Tidak ada pergerakan pasukan.</span>';
  return '<div class="cols"><div class="colL">' +
    '<div class="box"><h3>🚩 Kirim Pasukan</h3><div class="bd">' +
    (bLvl(v, 'rally') < 1 ? '<p class="red">Bangun <b>Titik Kumpul</b> di pusat desa untuk mengirim pasukan!</p>' :
      '<div class="scrollx"><table class="t"><tr><th>Unit</th><th class="ctr">Ada</th><th>Kirim</th></tr>' + urows + '</table></div><br>' +
      '<div class="frow"><label>Koordinat tujuan</label>x: <input type="number" id="sx" value="' + (p.x !== undefined ? p.x : 0) + '" style="width:55px"> y: <input type="number" id="sy" value="' + (p.y !== undefined ? p.y : 0) + '" style="width:55px"></div>' +
      '<div class="frow"><label>Jenis misi</label>' +
      '<label style="width:auto;font-weight:normal"><input type="radio" name="mk" value="atk" ' + (p.kind === 'atk' || !p.kind ? 'checked' : '') + '> ⚔️ Serangan</label>' +
      '<label style="width:auto;font-weight:normal"><input type="radio" name="mk" value="raid" ' + (p.kind === 'raid' ? 'checked' : '') + '> 💰 Rampokan</label>' +
      '<label style="width:auto;font-weight:normal"><input type="radio" name="mk" value="scout" ' + (p.kind === 'scout' ? 'checked' : '') + '> 🕵️ Intai</label></div>' +
      '<p class="muted">Serangan: pertempuran penuh (tembok & pendobrak/katapel berlaku). Rampokan: cepat, korban lebih sedikit, fokus menjarah. Intai: hanya unit pengintai.</p><br>' +
      '<button onclick="doSend()">🚩 Berangkat!</button>') +
    '</div></div></div>' +
    '<div class="colR"><div class="box"><h3>🚶 Semua Pergerakan</h3><div class="bd">' + mrows + '</div></div>' + sideTroops(v) + '</div></div>';
}
function doSend() {
  const v = AV();
  const x = +document.getElementById('sx').value, y = +document.getElementById('sy').value;
  const kind = document.querySelector('input[name=mk]:checked').value;
  if (Math.abs(x) > MAP_R || Math.abs(y) > MAP_R) { toast('Koordinat di luar peta!'); return; }
  if (x === v.x && y === v.y) { toast('Itu desa Anda sendiri!'); return; }
  const units = {};
  TR().units.forEach((u, i) => {
    if (i === U_SETTLER) return;
    const n = Math.floor(+(document.getElementById('su_' + i) || {value:0}).value || 0);
    if (n > 0) units[i] = Math.min(n, v.troops[i] || 0);
  });
  if (kind === 'scout') {
    for (const u in units) if (!TR().units[u].scout) { toast('Misi intai hanya boleh unit pengintai!'); return; }
  }
  if (sendTroops(S.active, x, y, units, kind)) { render(); toast('🚩 Pasukan berangkat!'); }
}

/* ---------- laporan ---------- */
function vReports() {
  S.unread = 0; save();
  if (!S.reps.length) return '<div class="box"><h3>📜 Laporan</h3><div class="bd"><span class="muted">Belum ada laporan.</span></div></div>';
  let rows = S.reps.map(r =>
    '<div class="repline ' + (r.unread ? 'unread' : '') + '" onclick="go(\'report\',{id:' + r.id + '})">' +
    '<span class="tag">' + new Date(r.time * 1000).toLocaleString('id-ID') + '</span><br>' + r.title + '</div>'
  ).join('');
  return '<div class="box"><h3>📜 Laporan</h3><div class="bd" style="padding:0">' + rows + '</div></div>';
}
function unitTable(tribe, before, loss) {
  const units = TRIBE_DATA[tribe].units;
  const keys = Object.keys(before || {}).filter(u => before[u] > 0);
  if (!keys.length) return '<p class="muted">Tidak ada pasukan.</p>';
  let h1 = '', h2 = '', h3 = '';
  keys.forEach(u => {
    h1 += '<th class="ctr">' + units[u].icon + '<br><span style="font-weight:normal;font-size:9px">' + units[u].nama + '</span></th>';
    h2 += '<td class="ctr">' + before[u] + '</td>';
    h3 += '<td class="ctr red">' + ((loss && loss[u]) || 0) + '</td>';
  });
  return '<div class="scrollx"><table class="t"><tr><th></th>' + h1 + '</tr><tr><th>Jumlah</th>' + h2 + '</tr><tr><th>Gugur</th>' + h3 + '</tr></table></div>';
}
function vReport() {
  const r = S.reps.find(rr => rr.id === VIEW.p.id);
  if (!r) return vReports();
  r.unread = false; save();
  let h = '<div class="box" style="max-width:700px;margin:0 auto"><h3>' + r.title + '</h3><div class="bd">' +
    '<p class="tag">' + new Date(r.time * 1000).toLocaleString('id-ID') + '</p><br>';
  if (r.type === 'battle') {
    h += '<p><b>⚔️ Penyerang:</b> ' + esc(r.att.nm) + ' — ' + esc(r.att.vn) + ' (' + TRIBE_DATA[r.att.tribe].nama + ')</p>' +
      unitTable(r.att.tribe, r.att.units, r.att.loss) + '<br>' +
      '<p><b>🛡️ Bertahan:</b> ' + esc(r.def.nm) + ' — ' + esc(r.def.vn) + ' (' + TRIBE_DATA[r.def.tribe].nama + ')</p>' +
      unitTable(r.def.tribe, r.defBefore, r.def.loss) + '<br>';
    if (r.loot) h += '<p><b>💰 Jarahan:</b> ' + RES_KEYS.map(k => RES_ICON[k] + ' ' + fmtN(r.loot[k] || 0)).join(' &nbsp; ') + '</p>';
    (r.extra || []).forEach(e => h += '<p>' + e + '</p>');
    h += '<p class="tag">Kekuatan serang ' + fmtN(r.pow[0]) + ' vs pertahanan ' + fmtN(r.pow[1]) + '</p>';
  } else if (r.type === 'scout') {
    h += '<p><b>Desa:</b> ' + esc(r.bot.vn) + ' (' + esc(r.bot.nm) + ', ' + TRIBE_DATA[r.bot.tribe].nama + ') — penduduk ' + r.bot.pop + ', ' + TRIBE_DATA[r.bot.tribe].wallName + ' tk.' + r.bot.wall + '</p><br>' +
      '<p><b>Sumber daya terlihat:</b> ' + RES_KEYS.map(k => RES_ICON[k] + ' ' + fmtN(r.res[k])).join(' &nbsp; ') + '</p><br>' +
      '<p><b>Pasukan:</b></p>' + unitTable(r.bot.tribe, r.tr, {});
  } else {
    h += '<p>' + (r.body || '') + '</p>';
  }
  h += '<br><a onclick="go(\'reports\')">« semua laporan</a></div></div>';
  return h;
}

/* ---------- statistik ---------- */
function vStats() {
  const myPop = S.villages.reduce((a, v) => a + pop(v), 0);
  const all = S.bots.map(b => ({nm:b.nm, tag:b.tag, vn:b.vn, pop:Math.round(b.pop), tribe:b.tribe, me:false}));
  all.push({nm:S.name, tag:'', vn:AV().name, pop:myPop, tribe:S.tribe, me:true});
  all.sort((a, b) => b.pop - a.pop);
  const myRank = all.findIndex(a => a.me) + 1;
  let rows = '';
  all.slice(0, 100).forEach((a, i) => {
    rows += '<tr class="' + (a.me ? 'hl' : '') + '"><td class="ctr">' + (i + 1) + '</td>' +
      '<td>' + TRIBE_DATA[a.tribe].icon + ' ' + esc(a.nm) + (a.tag ? ' <span class="tag">[' + a.tag + ']</span>' : '') + (a.me ? ' <b>(Anda)</b>' : '') + '</td>' +
      '<td>' + esc(a.vn) + '</td><td class="rt">' + fmtN(a.pop) + '</td></tr>';
  });
  return '<div class="box" style="max-width:700px;margin:0 auto"><h3>🏆 Peringkat Pemain — posisi Anda: #' + myRank + ' dari ' + all.length + '</h3><div class="bd">' +
    '<table class="t"><tr><th class="ctr">#</th><th>Pemain</th><th>Desa</th><th class="rt">Penduduk</th></tr>' + rows + '</table>' +
    '<p class="muted" style="margin-top:6px">Para bot terus berkembang seperti pemain asli — pantau peringkat Anda!</p></div></div>';
}

/* ---------- bantuan ---------- */
function vHelp() {
  return '<div class="box" style="max-width:720px;margin:0 auto"><h3>📖 Bantuan & Pengaturan</h3><div class="bd">' +
    '<h3>Cara bermain</h3><ul style="margin:6px 0 12px 18px;line-height:1.7">' +
    '<li><b>Sumber Daya:</b> klik ladang untuk meningkatkannya — kayu, tanah liat, besi, gandum.</li>' +
    '<li><b>Pusat Desa:</b> klik lahan kosong untuk membangun gedung. Gudang & Lumbung menambah kapasitas; Gedung Utama mempercepat pembangunan.</li>' +
    '<li><b>Pasukan:</b> bangun Titik Kumpul + Barak, lalu latih pasukan. Unit lanjutan perlu diriset di Akademi.</li>' +
    '<li><b>Merampok:</b> buka Peta, klik desa bot, pilih 💰 Rampok. Jarahan adalah kunci berkembang cepat!</li>' +
    '<li><b>Bertahan:</b> bot sesekali merampok Anda. Bangun ' + TR().wallName + ', Persembunyian, dan pasukan bertahan.</li>' +
    '<li><b>Ekspansi:</b> Kediaman tk.10 → latih 3 Pemukim → klik petak kosong di peta → dirikan desa baru.</li>' +
    '<li><b>Offline:</b> game terus berjalan saat ditutup (maks. 7 hari) — desa & bot tetap tumbuh, serangan tetap terjadi.</li></ul>' +
    '<h3>Pengaturan</h3>' +
    '<div class="frow"><label>Rampokan bot</label><label style="width:auto;font-weight:normal"><input type="checkbox" ' + (S.botRaids ? 'checked' : '') + ' onchange="S.botRaids=this.checked;save()"> aktif (matikan untuk mode damai)</label></div>' +
    '<div class="frow"><label>Ekspor save</label><button class="sec" onclick="doExport()">Salin data save</button></div>' +
    '<div class="frow"><label>Impor save</label><textarea id="impTxt" rows="2" style="flex:1"></textarea><button class="sec" onclick="doImport()">Muat</button></div>' +
    '<div class="frow"><label>Mulai ulang</label><button class="danger" onclick="if(confirm(\'Hapus seluruh kemajuan dan mulai dari awal?\'))hardReset()">⚠️ Reset Dunia</button></div>' +
    '</div></div>';
}
function doExport() {
  const txt = JSON.stringify(S);
  navigator.clipboard && navigator.clipboard.writeText(txt);
  openModal('<h2><span class="x" onclick="closeModal()">✖</span>💾 Data Save</h2><div class="mbd"><p class="muted">Sudah dicoba salin ke clipboard. Simpan teks ini:</p><textarea rows="8" style="width:100%">' + esc(txt) + '</textarea></div>');
}
function doImport() {
  try {
    const obj = JSON.parse(document.getElementById('impTxt').value);
    if (!obj.villages) throw new Error('format salah');
    S = obj; buildTIDX(); save(); render();
    toast('💾 Save berhasil dimuat!');
  } catch (e) { toast('❌ Data save tidak valid!'); }
}

/* ---------- layar mulai ---------- */
let setupTribe = 'gaul';
function renderSetup() {
  $('nav').innerHTML = ''; $('subbar').innerHTML = ''; $('resbar').innerHTML = ''; $('hinfo').innerHTML = '';
  const opt = t => {
    const td = TRIBE_DATA[t];
    return '<div class="tribeopt ' + (setupTribe === t ? 'sel' : '') + '" onclick="setupTribe=\'' + t + '\';renderSetup()">' +
      '<span class="tic">' + td.icon + '</span><div><b>' + td.nama + '</b><br><span class="muted">' + td.desc + '</span></div></div>';
  };
  $('content').innerHTML = '<div class="setupcard"><h2>⚔️ Selamat datang di Travian Klasik Offline!</h2>' +
    '<p class="muted">Bangun desamu, latih pasukan, rampok tetangga — di dunia berisi 170 bot yang terus tumbuh seperti pemain asli. Semuanya offline, tersimpan otomatis di browser ini.</p><br>' +
    '<div class="frow"><label>Nama pemain</label><input type="text" id="pn" value="Pemain" maxlength="16"></div>' +
    '<div class="frow"><label>Suku</label></div>' + opt('roman') + opt('teuton') + opt('gaul') +
    '<div class="frow"><label>Kecepatan server</label><select id="ps"><option value="1">1x (klasik, sangat lambat)</option><option value="3" selected>3x (disarankan)</option><option value="5">5x (cepat)</option><option value="10">10x (sangat cepat)</option><option value="100">100x (turbo gila!)</option></select></div>' +
    '<div class="frow"><label>Kesulitan bot</label><select id="pd"><option value="easy" selected>Mudah (disarankan)</option><option value="normal">Normal</option><option value="hard">Sulit</option></select></div><br>' +
    '<button style="font-size:14px;padding:8px 24px" onclick="doStart()">🏰 Mulai Bermain!</button></div>';
}
function doStart() {
  const name = document.getElementById('pn').value.trim() || 'Pemain';
  const speed = +document.getElementById('ps').value;
  const diff = document.getElementById('pd').value;
  newGame(name, setupTribe, speed, diff);
  go('dorf1');
  toast('🏰 Selamat datang, Kepala Desa ' + esc(name) + '! Mulailah dengan meningkatkan ladang.');
}
