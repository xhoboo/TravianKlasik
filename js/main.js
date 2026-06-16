'use strict';
/* ================= LOOP UTAMA ================= */
function updateCDs() {
  let expired = false;
  document.querySelectorAll('[data-cd]').forEach(el => {
    const left = +el.dataset.cd - now();
    el.textContent = fmtT(left);
    if (left <= 0) expired = true;
  });
  return expired;
}
let fc = 0;
function frame() {
  if (!S) return;
  fc++;
  tick();
  if (S.ended && !endShown) { endShown = true; showEndScreen(); }
  renderBar();
  $('fclock').textContent = '🕐 ' + new Date().toLocaleTimeString('id-ID');
  const expired = updateCDs();
  // statistik & candi menyegarkan diri tiap 3 detik agar pertumbuhan/perlombaan terlihat langsung
  const live = (VIEW.name === 'stats' || VIEW.name === 'candi' || VIEW.name === 'plus') && fc % 3 === 0;
  if (dirty || expired || live) {
    const a = document.activeElement;
    const typing = a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT') && a.closest('#content,#modal');
    if (!typing) render(); else dirty = false;
  }
}
// Masuk ke permainan (dari load slot aktif atau pilih akun); welcome=true menampilkan ringkasan offline
function startGame(welcome) {
  const away = now() - S.last;
  offlineLog = {reports:0, builds:0, raidsIn:0};
  tick();
  go('dorf1');
  if (welcome && away > 300 && !S.ended) {
    openModal('<h2><span class="x" onclick="closeModal()">✖</span>🌅 Selamat datang kembali!</h2><div class="mbd">' +
      '<p>Anda pergi selama <b>' + fmtT(Math.min(away, 7 * 86400)) + '</b>. Selama itu:</p><br><ul style="margin-left:18px;line-height:1.8">' +
      '<li>🏗️ ' + offlineLog.builds + ' pembangunan selesai</li>' +
      '<li>📜 ' + offlineLog.reports + ' laporan baru</li>' +
      '<li>🔻 ' + offlineLog.raidsIn + ' kali desa Anda diserang bot</li>' +
      (S.wonder ? '<li>🛕 Para pembangun Candi terus melaju…</li>' : '<li>🌱 Para bot terus berkembang…</li>') + '</ul><br>' +
      '<button onclick="closeModal()">Lanjutkan</button></div>');
  }
}
function init() {
  migrateOldKey();
  const active = localStorage.getItem(ACTIVE_KEY);
  if (active !== null && loadSlot(+active)) {
    startGame(true);
  } else {
    screen = 'accounts';
    render();
  }
  setInterval(frame, 1000);
  setInterval(() => { if (S) save(); }, 15000);
  window.addEventListener('beforeunload', () => { if (S) save(); });
  let rsz;
  window.addEventListener('resize', () => {
    clearTimeout(rsz);
    rsz = setTimeout(() => { if (S && VIEW.name === 'map') render(); }, 300);
  });
  // geser peta (drag-to-pan) — listener global agar tetap jalan saat kursor keluar petak
  window.addEventListener('pointermove', mapMoveHandler);
  window.addEventListener('pointerup', mapUpHandler);
  window.addEventListener('pointercancel', mapUpHandler);
}
init();
