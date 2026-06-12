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
function frame() {
  if (!S) return;
  tick();
  renderBar();
  $('fclock').textContent = '🕐 ' + new Date().toLocaleTimeString('id-ID');
  const expired = updateCDs();
  if (dirty || expired) {
    const a = document.activeElement;
    const typing = a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT') && a.closest('#content,#modal');
    if (!typing) render(); else dirty = false;
  }
}
function init() {
  if (load()) {
    const away = now() - S.last;
    // proses waktu offline
    offlineLog = {reports:0, builds:0, raidsIn:0};
    tick();
    render();
    if (away > 300) {
      openModal('<h2><span class="x" onclick="closeModal()">✖</span>🌅 Selamat datang kembali!</h2><div class="mbd">' +
        '<p>Anda pergi selama <b>' + fmtT(Math.min(away, 7 * 86400)) + '</b>. Selama itu:</p><br><ul style="margin-left:18px;line-height:1.8">' +
        '<li>🏗️ ' + offlineLog.builds + ' pembangunan selesai</li>' +
        '<li>📜 ' + offlineLog.reports + ' laporan baru</li>' +
        '<li>🔻 ' + offlineLog.raidsIn + ' kali desa Anda diserang bot</li>' +
        '<li>🌱 Para bot terus berkembang…</li></ul><br>' +
        '<button onclick="closeModal()">Lanjutkan</button></div>');
    }
  } else {
    renderSetup();
  }
  setInterval(frame, 1000);
  setInterval(() => save(), 15000);
  window.addEventListener('beforeunload', () => save());
  let rsz;
  window.addEventListener('resize', () => {
    clearTimeout(rsz);
    rsz = setTimeout(() => { if (S && VIEW.name === 'map') render(); }, 300);
  });
}
init();
