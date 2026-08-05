const CACHE_NAME = 'motorcum-v1'
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

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Supabase'e giden istekler HİÇ önbelleğe alınmaz — iş emri, müşteri, bakiye
  // gibi canlı veriler her zaman ağdan taze gelsin, bayat veri gösterilmesin.
  if (url.hostname.includes('supabase.co')) return
  if (event.request.method !== 'GET') return

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
