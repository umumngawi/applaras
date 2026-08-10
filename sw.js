/* ─────────────────────────────────────────────
   LARAS — Service Worker
   Strategi: cache-first untuk aset statis,
   network-first untuk request ke GAS (API).
───────────────────────────────────────────── */

const CACHE_NAME = 'laras-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;1,600&family=Inter:wght@400;600;700&display=swap'
];

// ── INSTALL: cache semua aset statis ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
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

// ── FETCH: strategi cerdas per jenis request ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Request ke GAS → network-first (data harus fresh)
  // Kalau offline, kembalikan response kosong yang aman
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

  // Request ke Google Fonts → cache-first
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

  // Request ke Google Drive (lampiran) → network only
  if (url.hostname.includes('drive.google') || url.hostname.includes('lh3.googleusercontent')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Aset statis LARAS (HTML, CSS, JS) → cache-first, fallback network
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        // Simpan ke cache kalau berhasil
        if (res && res.status === 200 && res.type !== 'opaque') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return res;
      });
    }).catch(() => {
      // Offline fallback untuk navigasi
      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});
