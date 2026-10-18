// Service worker: zapisuje pliki aplikacji w pamięci telefonu, żeby działała bez internetu.

// Podnoś numer przy każdej zmianie plików aplikacji (AGENTS §6). Nowa nazwa
// to nowy cache, a stary zostaje usunięty w „activate”. Bez tego telefon
// dalej pokazywałby starą wersję.
const CACHE_NAME = 'budgetapp-v3';

// Ścieżki względne: na GitHub Pages aplikacja działa pod /BudgetApp/.
const APP_FILES = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './js/app.js',
  './js/budget.js',
  './js/storage.js',
  './fonts/InterVariable.woff2',
  './icons/icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// cache: 'reload' pomija pamięć podręczną przeglądarki. Bez tego nowa wersja cache
// mogłaby dostać stare pliki, które przeglądarka trzyma jeszcze sama u siebie.
// skipWaiting dopiero po zapisaniu wszystkich plików: nowa wersja nie czeka, aż
// aplikacja zostanie całkowicie zamknięta, ale też nie przejmie jej niekompletna.
self.addEventListener('install', (event) => {
  const requests = APP_FILES.map((file) => new Request(file, { cache: 'reload' }));
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(requests))
      .then(() => self.skipWaiting()),
  );
});

// clients.claim: otwarta aplikacja od razu korzysta z nowej wersji, więc nowe
// pliki pokażą się po najbliższym odświeżeniu albo ponownym otwarciu.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)),
      ))
      .then(() => self.clients.claim()),
  );
});

// Najpierw pamięć, potem sieć: aplikacja otwiera się od razu, także bez internetu.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request)),
  );
});
