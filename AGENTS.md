# AGENTS.md — zasady pracy nad BudgetApp

Zasady dla agentów AI (i ludzi) pracujących nad projektem.

## 0. Dokumenty i pierwszeństwo
- `SPEC.md` — CO aplikacja robi (wymagania).
- `STACK.md` — JAK ją budujemy (technologie, struktura plików, model danych).
- `AGENTS.md` — JAK pracujemy (ten plik).
- GitHub Issues i kamienie milowe — CO JEST DO ZROBIENIA: jedno zadanie
  to jedno issue (opis, rezultat, definicja ukończenia, weryfikacja,
  zależności, ryzyka), a etapy pracy to kamienie milowe.

Te dokumenty są źródłem prawdy. Jeśli są ze sobą sprzeczne albo czegoś
w nich brakuje — zatrzymaj się i zapytaj właściciela projektu. Nie zgaduj.

## 1. Technologie i dobre praktyki
- HTML + CSS + JavaScript (moduły ES). Bez frameworków i bez kompilacji.
- HTML: semantyczne znaczniki, każde pole ma etykietę, przyciski
  z samą ikoną mają `aria-label`.
- CSS: najpierw telefon (mobile-first); kolory i zaokrąglenia tylko
  jako zmienne CSS zgodne z `SPEC.md` (sekcja 5); bez atrybutów
  `style="…"` w HTML. Wartości zmieniane w trakcie działania (np. szerokość
  segmentów paska, wypełnienie suwaka) JS ustawia jako zmienne CSS:
  `element.style.setProperty('--nazwa', wartość)`.
- JavaScript: `const`/`let`, bez zmiennych globalnych, małe funkcje
  o jednej odpowiedzialności.
- `js/budget.js` — wyłącznie obliczenia i walidacja: bez DOM
  i bez `localStorage`.
- Dane zapisuje i odczytuje wyłącznie `js/storage.js`.
- Kwoty zawsze jako liczby całkowite w groszach. Nigdy nie licz
  pieniędzy na liczbach z przecinkiem.
- Nazwy w kodzie po angielsku, teksty w interfejsie po polsku,
  komentarze po polsku.

## 2. Uruchamianie
- Aplikacja: `python -m http.server 8000`, potem http://localhost:8000
- Zawsze przez serwer: moduły ES nie działają po otwarciu pliku
  dwuklikiem (`file://`).
- Testy: `node --test`

## 3. Małe kroki
- Pracuj zgodnie z issues na GitHubie, etap po etapie (kamienie milowe),
  jedno issue naraz. Przed startem sprawdź, czy zależności issue są zamknięte.
- Jedna zmiana = jeden cel. Nie zmieniaj plików niezwiązanych z krokiem.
- Przed rozpoczęciem kroku napisz krótko, co zamierzasz zrobić,
  i poczekaj na zgodę.
- Po zakończeniu kroku zatrzymaj się, pokaż efekt i poczekaj
  na akceptację. Dopiero wtedy commit i wysłanie na GitHub.

## 4. Sprawdzanie pracy
Po każdej zmianie, przed zgłoszeniem jej jako gotowej:
- uruchom testy — wszystkie muszą przechodzić,
- jeśli zmiana dotyczy interfejsu, uruchom aplikację i sprawdź ją w przeglądarce w szerokościach
  360, 768 i 1280 px; przy 360 px nie może być poziomego przewijania,
- sprawdź konsolę przeglądarki — bez błędów,
- przejdź punkty „Definicja ukończenia” i „Weryfikacja” z issue,
- uczciwie napisz, co sprawdzono, a czego nie. Nie pisz „działa”,
  jeśli tego nie sprawdzono.

## 5. Jakość
- Każda zmiana w `budget.js` ma testy w `tests/budget.test.js`.
- Czytelne nazwy; komentarze wyjaśniają „dlaczego”, nie „co”.
- Bez martwego kodu i bez pozostawionych `console.log`.
- Zachowanie aplikacji ma być zgodne z `SPEC.md` — także komunikaty
  i formaty kwot.

## 6. Ustalenia techniczne (pułapki, o których trzeba pamiętać)
- Wyłącznie ścieżki względne (`./js/app.js`, nie `/js/app.js`):
  na GitHub Pages aplikacja działa pod podścieżką `/BudgetApp/`.
- Funkcje zależne od daty dostają „dziś” jako parametr — inaczej
  nie da się przetestować statusów miesięcy ani przełomu roku.
- Daty liczymy w czasie lokalnym urządzenia, nie w UTC. `toISOString()`
  zwraca czas UTC, więc tuż po północy pokazałby zły dzień albo miesiąc.
  Dotyczy to też daty w nazwie pliku eksportu.
- Formater kwot piszemy sami: `Intl.NumberFormat('pl-PL')` nie grupuje
  liczb czterocyfrowych (`1234,56 zł` zamiast `1 234,56 zł`).
- Walidacja danych (także całego pliku importu) jest w `budget.js`,
  żeby dało się ją testować w Node. `storage.js` tylko z niej korzysta
  i zapisuje dane dopiero, gdy są poprawne.
- Od zadania Z9, gdy istnieje już `sw.js`, przy każdej zmianie plików
  aplikacji podnieś numer wersji cache
  w `sw.js` — inaczej telefon może dalej pokazywać starą wersję.

## 7. Bezpieczeństwo i prywatność
- Dane nigdy nie opuszczają urządzenia: żadnych zapytań do zewnętrznych
  serwerów, analityki ani plików z CDN. Wszystkie pliki są w projekcie.
- Tekst wpisany przez użytkownika wstawiaj przez `textContent`,
  nigdy przez `innerHTML`. Test: nazwa `<b>test</b>` musi się pokazać
  dosłownie, jako tekst.
- Importowany plik zawsze waliduj. Błędny plik nie może zmienić
  ani uszkodzić obecnych danych.
- Żadnych haseł, kluczy ani danych osobowych w repozytorium.

## 8. Zależności
- Projekt nie używa żadnych zewnętrznych bibliotek ani pakietów.
- Nową zależność można dodać tylko za zgodą właściciela projektu,
  po wyjaśnieniu, dlaczego jest potrzebna i dlaczego nie da się bez niej.
- Wyjątek uzgodniony: czcionka Inter (licencja OFL) w `fonts/`.
  Pliki pobieramy jednorazowo z oficjalnego źródła, po zgodzie właściciela.
- Ikony to własne, proste SVG — bez bibliotek ikon.

## 9. Aktualizowanie planu
- Commit kończący zadanie ma w opisie `Closes #N` (numer issue),
  dzięki czemu issue zamknie się po wysłaniu na GitHub. Commit robimy
  dopiero po akceptacji właściciela (zob. sekcja 3). N to numer issue,
  a nie numer zadania Z (np. Z1 to #2).
- Nowe zadania i znalezione problemy zgłaszaj jako issues — po zgodzie
  właściciela.
- Jeśli w trakcie pracy okaże się, że trzeba odejść od `SPEC.md`
  lub `STACK.md` — zatrzymaj się i zapytaj. Po zgodzie zaktualizuj
  dokument w tym samym commicie co kod.
- Nigdy nie zmieniaj dokumentów bez zgody właściciela.

## 10. Wyjaśnianie decyzji
- Właściciel projektu uczy się programowania. Wyjaśniaj decyzje prostym
  językiem, zwłaszcza te nieoczywiste.
- Jeśli coś jest niejasne — dopytaj, zamiast zgadywać.
- Komunikacja po polsku.

## 11. Git
- Małe commity; opis po polsku: co i dlaczego.
- Nigdy nie nadpisuj historii (`--force`, `rebase` opublikowanych zmian).
