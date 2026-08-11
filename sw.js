/* ─────────────────────────────────────────────
   LARAS — Service Worker v2
   Strategi: network-first untuk JS/HTML agar
   selalu dapat versi terbaru, cache-first
   hanya untuk font.
───────────────────────────────────────────── */

const CACHE_NAME = 'laras-v2';

// ── INSTALL ──
self.addEventListener('install', event => {
  // Langsung aktif tanpa tunggu tab lama ditutup
  self.skipWaiting();
});

// ── ACTIVATE: hapus cache lama ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // GAS API → network only, fallback offline response
  if (url.hostname === 'script.google.com') {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ success: false, offline: true }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Google Fonts → cache-first (jarang berubah)
  if (url.hostname.includes('fonts.g')) {
    event.respondWith(
      caches.match(event.request).then(cached =>
        cached || fetch(event.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        })
      )
    );
    return;
  }

  // Google Drive / gambar → network only
  if (url.hostname.includes('drive.google') || url.hostname.includes('lh3.googleusercontent')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // app.js, style.css, index.html → NETWORK-FIRST
  // Selalu ambil versi terbaru dari server,
  // cache hanya sebagai fallback kalau offline
  event.respondWith(
    fetch(event.request).then(res => {
      if (res && res.status === 200 && res.type !== 'opaque') {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
      }
      return res;
    }).catch(() =>
      // Offline: pakai cache
      caches.match(event.request).then(cached =>
        cached || (event.request.mode === 'navigate'
          ? caches.match('./index.html')
          : null)
      )
    )
  );
});
