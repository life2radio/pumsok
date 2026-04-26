/* 인생2막라디오 루틴앱 — 서비스워커 */
var CACHE = 'pumsok-v1';
var ASSETS = ['/pumsok/', '/index.html', '/style.css', '/data.js', '/app.js'];

self.addEventListener('install', function(e) {
  e.waitUntil(caches.open(CACHE).then(function(c) { return c.addAll(ASSETS); }));
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(caches.keys().then(function(keys) {
    return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));
  }));
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  e.respondWith(caches.match(e.request).then(function(r) {
    return r || fetch(e.request).catch(function() { return caches.match('/index.html'); });
  }));
});
