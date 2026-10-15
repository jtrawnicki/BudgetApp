# BudgetApp — plan działania (wersja 1)

> Szczegółowy plan budowy pierwszej wersji. Wymagania są w [SPEC.md](SPEC.md), technologie w [STACK.md](STACK.md), zasady pracy w [AGENTS.md](AGENTS.md). Ten plan rozpisuje kroki z STACK.md (sekcja 4) na zadania.
>
> Każde zadanie kończy się akceptacją właściciela projektu, commitem i wysłaniem zmian na GitHub. Ukończone zadanie oznaczamy jako wykonane w tym pliku i w STACK.md.

**Status zadań**

- [x] Z0. Rozstrzygnięcie otwartych pytań
- [ ] Z1. Szkielet projektu
- [ ] Z2. `budget.js`: obliczenia, walidacja i testy
- [ ] Z3. `storage.js`: zapis i odczyt
- [ ] Z4. Wygląd bazowy
- [ ] Z5. Ekran Plan
- [ ] Z6. Ekrany Przychody i Wydatki
- [ ] Z7. Miesiące i tworzenie planu
- [ ] Z8. Ekran Więcej
- [ ] Z9. PWA
- [ ] Z10. Publikacja na GitHub Pages i test na telefonie
- [ ] Z11. Poprawki i sprawdzenie kryteriów

---

## Etap 0 — Przygotowanie

### Z0. Rozstrzygnięcie otwartych pytań ✅
- **Opis:** wyjaśnienie niejasności w SPEC przed rozpoczęciem kodowania.
- **Rezultat:** decyzje zapisane w SPEC.md i STACK.md:
  - zaokrąglanie % do grosza, połówki w górę,
  - suwak zatrzymuje się na najwyższej dozwolonej wartości i pokazuje komunikat,
  - edycja pozycji zapisuje się po Enter albo po wyjściu z pola, Escape anuluje,
  - bieżący miesiąc jest zawsze dostępny,
  - nazwy miesięcy bez odmiany („Skopiuj z: Wrzesień 2026”),
  - potwierdzenia we własnym oknie `<dialog>` w stylu aplikacji,
  - ikona SVG z ręcznym eksportem do PNG,
  - kwotę można wpisać z przecinkiem albo kropką.
- **Definicja ukończenia:** każde pytanie ma odpowiedź, a dokumenty są zaktualizowane i scommitowane.
- **Weryfikacja:** przegląd zmian w dokumentach (diff).

---

## Etap 1 — Fundamenty (sobota rano)

### Z1. Szkielet projektu
- **Opis:** struktura folderów z STACK.md §2, pusty `index.html` z podpiętym `styles.css` i `js/app.js` (moduł ES) oraz plik `.gitignore`.
- **Rezultat:** pusta strona z tytułem „BudgetApp” działa pod http://localhost:8000.
- **Definicja ukończenia:** strona się otwiera, w konsoli przeglądarki nie ma błędów, a `node --test` uruchamia się bez błędu.
- **Weryfikacja:** `python -m http.server 8000`, potem przeglądarka na komputerze i w szerokości telefonu, a do tego konsola DevTools.
- **Zależności:** Z0.
- **Ryzyka:**
  - Moduły ES nie działają po otwarciu pliku dwuklikiem (`file://`), dlatego zawsze uruchamiamy serwer.
  - Od początku używamy wyłącznie ścieżek względnych (`./js/app.js`), bo na GitHub Pages aplikacja działa pod podścieżką `/BudgetApp/` (zob. Z10).

### Z2. `budget.js`: obliczenia, walidacja i testy
- **Opis:** czyste funkcje bez DOM i bez `localStorage`:
  - wzory z SPEC §3.1 (w groszach, z zaokrągleniem %),
  - walidacja reguł z SPEC §3.4, w tym wyliczanie najwyższej dozwolonej wartości suwaka,
  - zamiana tekstu z pola na grosze (`"12,50"` i `"12.50"` → `1250`),
  - formatowanie kwot (`1 234,56 zł`),
  - nazwy miesięcy,
  - status miesiąca (zamknięty, bieżący, następny, niedostępny) liczony od podanej daty,
  - zasady nawigacji strzałkami,
  - wybór źródła kopii i kopiowanie planu,
  - walidacja całej struktury danych, potrzebna później przy imporcie.
- **Rezultat:** `js/budget.js` i `tests/budget.test.js`.
- **Definicja ukończenia:** każda funkcja ma testy, także przypadki brzegowe (0%, 100%, suma % > 100, „Zostało” dokładnie 0, kwota `0,001`, pusta nazwa, zaokrąglenie połówki grosza, przełom roku grudzień → styczeń), a `node --test` przechodzi w całości.
- **Weryfikacja:** `node --test` oraz przegląd przykładów w testach przez właściciela projektu.
- **Zależności:** Z0.
- **Ryzyka:**
  - Wbudowane `Intl.NumberFormat('pl-PL')` nie grupuje liczb czterocyfrowych (pokaże `1234,56 zł` zamiast `1 234,56 zł`), dlatego formater kwot piszemy sami.
  - „Dziś” musi być przekazywane do funkcji jako parametr. Inaczej nie da się przetestować statusów miesięcy.

### Z3. `storage.js`: zapis i odczyt
- **Opis:**
  - odczyt i zapis klucza `budgetapp-data`,
  - budowanie pliku eksportu,
  - import, który oddaje dane do walidacji (funkcja z Z2) i zapisuje je dopiero wtedy, gdy są poprawne.
- **Rezultat:** `js/storage.js`.
- **Definicja ukończenia:**
  - brak danych daje pustą strukturę `{ version: 1, months: {} }`,
  - uszkodzony JSON w `localStorage` nie wywraca aplikacji,
  - błędny import nie zmienia obecnych danych.
- **Weryfikacja:** ręczny test w konsoli przeglądarki (zapis, odświeżenie, odczyt) oraz podgląd w DevTools → Application → Local Storage. Logikę sprawdzania danych trzymamy w `budget.js`, gdzie można ją przetestować w Node.
- **Zależności:** Z2.
- **Ryzyka:** tryb prywatny i Safari mogą czyścić `localStorage`. To jest powód, dla którego eksport jest ważny.

---

## Etap 2 — Interfejs (sobota)

### Z4. Wygląd bazowy
- **Opis:**
  - zmienne CSS z SPEC §5 (kolory i zaokrąglenia),
  - czcionka Inter w `fonts/` (`@font-face`),
  - karty, przyciski i pola formularzy,
  - nagłówek ze strzałkami,
  - dolny pasek 4 zakładek z „pigułką” i przełączaniem widoków,
  - szerokość maksymalnie 480 px, wyśrodkowana.
- **Rezultat:** puste zakładki Plan, Przychody, Wydatki i Więcej, między którymi można się przełączać.
- **Definicja ukończenia:**
  - kolory zgodne z tabelą w SPEC,
  - brak stylów inline i kolorów poza zmiennymi,
  - przyciski z samą ikoną mają `aria-label`,
  - brak poziomego przewijania przy 360 px.
- **Weryfikacja:** przeglądarka w szerokościach 360, 768 i 1280 px.
- **Zależności:** Z1.
- **Ryzyka:**
  - Pliki czcionki Inter trzeba jednorazowo pobrać z oficjalnego źródła (licencja OFL pozwala dołączyć je do projektu). Przed pobraniem pytamy o zgodę.
  - Ikony zakładek to własne, proste SVG, bez bibliotek ikon.

### Z5. Ekran Plan
- **Opis:**
  - karta „Zostało do zaplanowania”,
  - pasek podziału z 4 segmentów,
  - karta z suwakami (wartość % i kwota w zł),
  - suwak zatrzymuje się na najwyższej dozwolonej wartości i pokazuje komunikat,
  - każda poprawna zmiana zapisuje się automatycznie.
- **Rezultat:** działający ekran Plan dla miesiąca z planem (dane testowe wpisane ręcznie w `localStorage`).
- **Definicja ukończenia:** ruch suwaka od razu przelicza kwoty i pasek. Suwak nie przekracza dozwolonego maksimum (suma % ≤ 100, „Zostało” ≥ 0). Wygląd jest zgodny ze SPEC (22 px, biały uchwyt).
- **Weryfikacja:** ręczne scenariusze (suma % = 100, próba przekroczenia, przychód 0 zł) oraz odświeżenie strony, po którym wartości zostają.
- **Zależności:** Z2, Z3, Z4.
- **Ryzyka:** stylowanie `<input type="range">` różni się w Chrome i Safari, więc potrzebne są dwa zestawy reguł CSS.

### Z6. Ekrany Przychody i Wydatki
- **Opis:** jeden wspólny komponent listy użyty dwa razy:
  - formularz z polami Nazwa i Kwota oraz przyciskiem „Dodaj”,
  - edycja po dotknięciu pozycji (zapis po Enter lub po wyjściu z pola, Escape anuluje),
  - kosz,
  - suma „Razem”,
  - komunikaty walidacji pod polami.
- **Rezultat:** pełne F3, F5 i F7 dla miesiąca z planem.
- **Definicja ukończenia:**
  - działają dodawanie, edycja i usuwanie,
  - odrzucana jest zmiana, przez którą „Zostało” byłoby ujemne (także usunięcie przychodu),
  - odrzucane są pusta nazwa, kwota 0 i 3 miejsca po przecinku,
  - tekst użytkownika trafia na stronę wyłącznie przez `textContent`.
- **Weryfikacja:** scenariusze ręczne oraz próba wpisania `<b>test</b>` jako nazwy (musi się pokazać dosłownie, jako tekst).
- **Zależności:** Z5.
- **Ryzyka:** edycja w miejscu to najtrudniejsza część interfejsu. Trzeba dopilnować, żeby zapis po wyjściu z pola i zapis po Enter nie wykonały się dwa razy, oraz sprawdzić działanie z klawiaturą ekranową telefonu.

---

## Etap 3 — Miesiące i dane (niedziela)

### Z7. Miesiące i tworzenie planu
- **Opis:**
  - strzałki zgodne z SPEC §3.2,
  - nazwa miesiąca w nagłówku,
  - karta „Zaplanuj: [miesiąc]” z przyciskami „Skopiuj z: [miesiąc]” i „Zacznij od zera”,
  - miesiące zamknięte tylko do odczytu (przygaszenie, brak formularzy i koszy),
  - napis „Brak planu” dla zamkniętych miesięcy bez planu.
- **Rezultat:** pełne F1, F2 i F9.
- **Definicja ukończenia:** działają wszystkie scenariusze z SPEC §6 dotyczące miesięcy.
- **Weryfikacja:** podstawienie innej daty „dziś”, żeby sprawdzić przełom miesiąca i roku. Do tego testy jednostkowe z Z2.
- **Zależności:** Z5, Z6.
- **Ryzyka:** ręczne testowanie zamykania miesiąca wymaga manipulowania datą.

### Z8. Ekran Więcej
- **Opis:**
  - eksport, czyli pobranie `budgetapp-kopia-RRRR-MM-DD.json`,
  - import z walidacją,
  - „Usuń plan miesiąca” (tylko bieżący i następny),
  - informacja o przechowywaniu danych,
  - wspólne okno potwierdzenia `<dialog>` w stylu aplikacji.
- **Rezultat:** pełne F10 i F11.
- **Definicja ukończenia:** eksport, potem wyczyszczenie danych, potem import przywraca identyczny stan. Plik z błędem (zły JSON, ujemna kwota, % > 100, brak pola) daje komunikat i niczego nie zmienia. Anulowanie w oknie potwierdzenia niczego nie zmienia.
- **Weryfikacja:** ręcznie, z kilkoma przygotowanymi „zepsutymi” plikami.
- **Zależności:** Z3, Z7.
- **Ryzyka:** pobieranie plików na iPhonie działa inaczej niż na komputerze, więc trzeba to sprawdzić na prawdziwym telefonie w Z10.

---

## Etap 4 — PWA i publikacja (niedziela)

### Z9. PWA
- **Opis:**
  - `manifest.webmanifest`,
  - ikona SVG oraz PNG 192 i 512 px w `icons/` (wyeksportowane ręcznie z SVG),
  - `sw.js`, który zapisuje w pamięci wszystkie pliki aplikacji i ma numer wersji cache.
- **Rezultat:** aplikację można zainstalować, a po instalacji działa bez internetu.
- **Definicja ukończenia:** DevTools → Application nie pokazuje błędów manifestu. Po włączeniu trybu offline strona się wczytuje razem z czcionką.
- **Weryfikacja:** DevTools (Manifest, Service Workers, tryb Offline) oraz Lighthouse.
- **Zależności:** wszystkie pliki aplikacji muszą być gotowe (lista plików do cache).
- **Ryzyka:** service worker potrafi serwować starą wersję po aktualizacji, dlatego przy każdej zmianie podnosimy numer wersji cache.

### Z10. Publikacja na GitHub Pages i test na telefonie
- **Opis:** właściciel projektu włącza GitHub Pages w ustawieniach repozytorium. Potem sprawdzamy aplikację na telefonie.
- **Rezultat:** aplikacja dostępna pod `https://jtrawnicki.github.io/BudgetApp/`.
- **Definicja ukończenia:** strona otwiera się na telefonie, da się ją zainstalować i działa w trybie samolotowym.
- **Weryfikacja:** prawdziwy telefon.
- **Zależności:** Z9.
- **Ryzyka:** ścieżki bezwzględne (`/js/app.js`) działają lokalnie, ale nie pod podścieżką `/BudgetApp/`, dlatego używamy wyłącznie ścieżek względnych.

---

## Etap 5 — Odbiór

### Z11. Poprawki i sprawdzenie kryteriów
- **Opis:** przejście przez listy kryteriów w SPEC §6 i STACK §5 punkt po punkcie oraz oznaczenie wykonanych kroków w STACK.md.
- **Rezultat:** odhaczone listy kryteriów i lista ewentualnych znanych ograniczeń.
- **Definicja ukończenia:** wszystkie kryteria spełnione i sprawdzone, a nie założone.
- **Weryfikacja:** właściciel projektu przechodzi na telefonie scenariusz z SPEC §1.3.
