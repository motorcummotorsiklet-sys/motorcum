const CACHE_NAME = 'motorcum-v1.0.129'
const APP_SHELL = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // API ve Supabase istekleri asla önbelleğe alınmaz
  if (url.pathname.startsWith('/api/')) return
  if (url.hostname.includes('supabase.co')) return
  if (event.request.method !== 'GET') return

  // Sayfa yönlendirmelerinde (HTML) her zaman Network First uygula
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const kopya = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, kopya))
          return response
        })
        .catch(() => caches.match('/'))
    )
    return
  }

  // Diğer statik varlıklar için Network first, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const kopya = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, kopya))
        return response
      })
      .catch(() => caches.match(event.request))
  )
})

// Web Push (Apple & Google Push Servisinden gelen kilit ekranı uyarısı)
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { title: 'Motorcum Servis', body: event.data ? event.data.text() : 'Yeni bildirim' }
  }

  const title = data.title || 'Motorcum Servis'
  const options = {
    body: data.body || 'İş emrinde güncelleme var.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [300, 150, 300],
    tag: data.tag || 'motorcum-' + Date.now(),
    renotify: true,
    data: {
      url: data.url || '/dashboard'
    }
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Bildirime tıklandığında PWA uygulamasını öne getir / aç
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/dashboard')
      }
    })
  )
})
