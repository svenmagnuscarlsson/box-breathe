/**
 * Service Worker (sw.js)
 * 
 * Gör appen offline-kapabel genom att cacha filer.
 */

const CACHE_NAME = 'box-breathe-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './css/styles.css',
    './js/app.js',
    './js/model.js',
    './js/view.js',
    './js/audio-manager.js',
    // Vi försöker cacha externa resurser också, men det är riskabelt med CORS ibland.
    // För en MVP litar vi på browserns HTTP cache för CDN-resurser om möjligt.
];

// Installera SW och cacha filer
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('SW: Cachning startad');
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
});

// Aktivera och städa gamla cachar
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

// Fånga nätverksanrop
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Returnera cachad fil om den finns, annars hämta från nätet
                return response || fetch(event.request);
            })
    );
});
