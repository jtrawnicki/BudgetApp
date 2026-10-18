# BudgetApp — stack technologiczny

> Dokument opisuje **jak** budujemy aplikację: technologie, strukturę projektu, model danych i plan pracy. Wymagania (co aplikacja robi i jak wygląda) są w [SPEC.md](SPEC.md).
>
> Zawiera wyłącznie zatwierdzone ustalenia. Zmiany wprowadzamy dopiero po wspólnym uzgodnieniu.

---

## 1. Technologie

| Element | Wybór | Dlaczego |
|---|---|---|
| Interfejs | HTML + CSS | Podstawa każdej strony; właściciel projektu je zna |
| Logika | JavaScript (moduły ES), bez frameworka i bez kompilacji | Nauka podstaw, zero konfiguracji |
| Dane | `localStorage` + eksport/import pliku JSON | Bez backendu; dane zostają na urządzeniu |
| Okna potwierdzeń | wbudowany element HTML `<dialog>` | Wygląd zgodny z aplikacją, bez bibliotek |
| Instalacja i offline | PWA (manifest + service worker) | Ikona na ekranie głównym telefonu, działanie bez internetu |
| Testy | wbudowany w Node.js `node --test` | Testy obliczeń i walidacji bez instalowania bibliotek |
| Uruchamianie lokalne | `python -m http.server` | Prosty serwer bez instalowania niczego |
| Repozytorium | Git + GitHub | Historia zmian, kopia kodu, podstawa publikacji |
| Publikacja | GitHub Pages | Darmowy hosting plików statycznych |
| Edytor | VS Code | Wygodne czytanie i przeglądanie zmian |

Zainstalowane narzędzia (stan na 2026-10-13): Node.js 26, Python 3.13, Git.

---

## 2. Struktura plików

```
BudgetApp/
├── index.html
├── styles.css
├── manifest.webmanifest
├── sw.js                 # service worker (offline)
├── js/
│   ├── app.js            # ekrany i obsługa interfejsu
│   ├── budget.js         # obliczenia i walidacja (bez interfejsu)
│   └── storage.js        # zapis, odczyt, eksport, import
├── tests/
│   └── budget.test.js    # testy obliczeń i walidacji
├── fonts/                # czcionka Inter (dołączona do projektu, żeby działała offline) oraz plik licencji OFL.txt
├── icons/                # ikony aplikacji (SVG oraz PNG 180 px dla iPhone'a, 192 i 512 px, wyeksportowane z SVG
│                         #   jednorazowym pomocniczym skryptem w przeglądarce, który nie trafia do repozytorium)
├── .gitignore            # pliki systemowe i edytora, których nie wrzucamy do repozytorium
├── AGENTS.md            # zasady pracy (dla agentów AI i ludzi)
├── CLAUDE.md            # wczytuje AGENTS.md w Claude Code
├── SPEC.md
└── STACK.md
```

Zasada: `budget.js` nie wie nic o interfejsie ani o zapisie danych, dzięki czemu można go testować w izolacji.

---

## 3. Model danych

Dane są zapisane w `localStorage` pod kluczem `budgetapp-data`. Ten sam format ma plik eksportu, nazwany według wzoru `budgetapp-kopia-RRRR-MM-DD.json`.

```json
{
  "version": 1,
  "months": {
    "2026-10": {
      "savingsPercent": 20,
      "investmentPercent": 10,
      "incomes":  [{ "id": "a1b2", "name": "Pensja",  "amount": 900000 }],
      "expenses": [{ "id": "c3d4", "name": "Czynsz", "amount": 200000 }]
    }
  }
}
```

- `amount` to kwota w **groszach**, jako liczba całkowita (900000 = 9 000,00 zł). Dzięki temu nie powstają błędy zaokrągleń liczb zmiennoprzecinkowych.
- Zasady zaokrąglania oszczędności i inwestycji opisuje SPEC §3.5.
- Miesiąc bez planu nie ma swojego wpisu w `months`.
- Pole `version` pozwoli w przyszłości bezpiecznie zmieniać format danych.

---

## 4. Plan pracy na weekend

Każdy krok to mała, zamknięta całość: AI generuje kod, właściciel projektu go przegląda i testuje, a po jego akceptacji robimy commit i wysyłamy zmiany na GitHub (zob. AGENTS.md).

Plan pracy i postęp prowadzimy na GitHubie: etapy to [kamienie milowe](https://github.com/jtrawnicki/BudgetApp/milestones), a zadania to [issues](https://github.com/jtrawnicki/BudgetApp/issues). Każde issue ma opis, rezultat, definicję ukończenia, weryfikację, zależności i ryzyka.

---

## 5. Techniczne kryteria ukończenia
- [x] Wszystkie testy `node --test` przechodzą.
- [x] Aplikacja jest opublikowana na GitHub Pages.
- [x] Service worker pozwala uruchomić aplikację bez internetu.
