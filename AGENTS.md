# AGENTS.md — zasady pracy nad BudgetApp

Zasady dla agentów AI (i ludzi) pracujących nad projektem.

## 0. Dokumenty i pierwszeństwo
- `SPEC.md` — CO aplikacja robi (wymagania).
- `STACK.md` — JAK ją budujemy (technologie, model danych, plan pracy).
- `AGENTS.md` — JAK pracujemy (ten plik).

Te dokumenty są źródłem prawdy. Jeśli są ze sobą sprzeczne albo czegoś
w nich brakuje — zatrzymaj się i zapytaj właściciela projektu. Nie zgaduj.

## 1. Technologie i dobre praktyki
- HTML + CSS + JavaScript (moduły ES). Bez frameworków i bez kompilacji.
- HTML: semantyczne znaczniki, każde pole ma etykietę, przyciski
  z samą ikoną mają `aria-label`.
- CSS: najpierw telefon (mobile-first); kolory i zaokrąglenia tylko
  jako zmienne CSS zgodne z `SPEC.md` (sekcja 5); bez stylów inline.
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
- Testy: `node --test`

## 3. Małe kroki
- Pracuj zgodnie z planem pracy w `STACK.md` (sekcja 4), jeden krok naraz.
- Jedna zmiana = jeden cel. Nie zmieniaj plików niezwiązanych z krokiem.
- Przed rozpoczęciem kroku napisz krótko, co zamierzasz zrobić,
  i poczekaj na zgodę.
- Po zakończeniu kroku zatrzymaj się, pokaż efekt i poczekaj
  na akceptację. Dopiero wtedy commit i wysłanie na GitHub.

## 4. Sprawdzanie pracy
Po każdej zmianie, przed zgłoszeniem jej jako gotowej:
- uruchom testy — wszystkie muszą przechodzić,
- uruchom aplikację i sprawdź zmianę w przeglądarce, także
  w szerokości telefonu,
- uczciwie napisz, co sprawdzono, a czego nie. Nie pisz „działa”,
  jeśli tego nie sprawdzono.

## 5. Jakość
- Każda zmiana w `budget.js` ma testy w `tests/budget.test.js`.
- Czytelne nazwy; komentarze wyjaśniają „dlaczego”, nie „co”.
- Bez martwego kodu i bez pozostawionych `console.log`.
- Zachowanie aplikacji ma być zgodne z `SPEC.md` — także komunikaty
  i formaty kwot.

## 6. Bezpieczeństwo i prywatność
- Dane nigdy nie opuszczają urządzenia: żadnych zapytań do zewnętrznych
  serwerów, analityki ani plików z CDN. Wszystkie pliki są w projekcie.
- Tekst wpisany przez użytkownika wstawiaj przez `textContent`,
  nigdy przez `innerHTML`.
- Importowany plik zawsze waliduj. Błędny plik nie może zmienić
  ani uszkodzić obecnych danych.
- Żadnych haseł, kluczy ani danych osobowych w repozytorium.

## 7. Zależności
- Projekt nie używa żadnych zewnętrznych bibliotek ani pakietów.
- Nową zależność można dodać tylko za zgodą właściciela projektu,
  po wyjaśnieniu, dlaczego jest potrzebna i dlaczego nie da się bez niej.

## 8. Aktualizowanie planu
- Po zakończeniu kroku oznacz go jako wykonany w `STACK.md`.
- Jeśli w trakcie pracy okaże się, że trzeba odejść od `SPEC.md`
  lub `STACK.md` — zatrzymaj się i zapytaj. Po zgodzie zaktualizuj
  dokument w tym samym commicie co kod.
- Nigdy nie zmieniaj dokumentów bez zgody właściciela.

## 9. Wyjaśnianie decyzji
- Właściciel projektu uczy się programowania. Wyjaśniaj decyzje prostym
  językiem, zwłaszcza te nieoczywiste.
- Jeśli coś jest niejasne — dopytaj, zamiast zgadywać.
- Komunikacja po polsku.

## 10. Git
- Małe commity; opis po polsku: co i dlaczego.
- Nigdy nie nadpisuj historii (`--force`, `rebase` opublikowanych zmian).
