// 英语磨耳朵 · 离线缓存（Service Worker）
// 作用：把播放过的 / 主动下载的音频缓存到本机，断网也能听；
//       应用页面本身用「网络优先」策略，保证你每次打开都能拿到最新版本。
const CACHE = 'ekids-audio-v1';
const SHELL = ['./', './index.html', './subtitles.js', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const isAudio = url.pathname.endsWith('.mp3') ||
                  url.hostname.includes('libsyn') ||
                  url.hostname.includes('libsyn.net');

  if (isAudio) {
    // 音频：按 URL 缓存完整文件；忽略 Range，离线时也能拖动进度
    e.respondWith(
      caches.open(CACHE).then(async c => {
        const hit = await c.match(e.request.url);
        if (hit) return hit;
        const full = new Request(e.request.url, {
          method: 'GET', headers: new Headers(), mode: 'no-cors', credentials: 'omit'
        });
        try {
          const r = await fetch(full);
          if (r) c.put(e.request.url, r.clone());
          return r;
        } catch (err) {
          return hit || Response.error();
        }
      })
    );
    return;
  }

  // 应用外壳：网络优先，失败再回退缓存（保证离线也能打开页面）
  e.respondWith(
    fetch(e.request).then(r => {
      const cp = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, cp));
      return r;
    }).catch(() => caches.match(e.request))
  );
});
