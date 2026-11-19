const statusEl = document.querySelector('#status');

async function cekServer() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    statusEl.textContent = data.status === 'ok' ? 'terhubung' : 'bermasalah';
  } catch {
    statusEl.textContent = 'tidak terhubung (jalankan server dulu)';
  }
}

cekServer();
