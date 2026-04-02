const CACHE = 'cellar-v1'

const APP_SHELL = [
  '/',
  '/admin',
  '/studio',
  '/boxes',
  '/labels',
  '/buyer',
  '/local',
]

// Install — cache the app shell immediately
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(APP_SHELL))
  )
  self.skipWaiting()
})

// Activate — clear any old caches from previous versions
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Never intercept Supabase API calls or Anthropic API calls —
  // let them fail naturally so the app can show its own offline message
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('anthropic.com')
  ) {
    return
  }

  // For Next.js API routes — always go to network, no caching
  if (url.pathname.startsWith('/api/')) {
    return
  }

  // For navigation requests (HTML pages) — try network first,
  // fall back to cache so the app shell loads offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone()
          caches.open(CACHE).then(cache => cache.put(request, clone))
          return response
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match('/')))
    )
    return
  }

  // For static assets (JS, CSS, fonts, images) — cache first, then network
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/static/') ||
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font' ||
    request.destination === 'image'
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(response => {
          const clone = response.clone()
          caches.open(CACHE).then(cache => cache.put(request, clone))
          return response
        })
      })
    )
    return
  }
})
