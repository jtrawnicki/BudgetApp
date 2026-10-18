# BudgetApp — specyfikacja

> Dokument zawiera wyłącznie ostateczne, zatwierdzone ustalenia dotyczące **wymagań** aplikacji: co robi, jak działa i jak wygląda. Informacje o technologiach i sposobie budowy są w [STACK.md](STACK.md).
>
> To źródło prawdy podczas budowy aplikacji. Zmiany wprowadzamy dopiero po wspólnym uzgodnieniu.
>
> **Zasada pracy:** najpierw plan, potem działanie. Gdy coś jest niejasne, dopytujemy, zamiast zgadywać.

---

## 1. Definicja produktu

### 1.1 Użytkownik
Jedna osoba planuje swój domowy budżet miesięczny. Korzysta z aplikacji głównie na telefonie, czasem w przeglądarce na komputerze. Aplikacja nie ma kont, logowania ani współdzielenia.

### 1.2 Problem
Po otrzymaniu przychodów trudno odpowiedzieć na pytanie: *„Ile mogę przeznaczyć na wydatki, jeśli najpierw odłożę ustalony procent na oszczędności i inwestycje?”* BudgetApp odwraca zwykłą kolejność: **najpierw odkładam, resztę planuję wydać**.

### 1.3 Podstawowy scenariusz
1. Otwieram aplikację i widzę bieżący miesiąc.
2. Tworzę plan: kopiuję poprzedni albo zaczynam od zera.
3. Wpisuję lub poprawiam przychody.
4. Suwakami ustawiam % na oszczędności i % na inwestycje.
5. Wpisuję planowane wydatki.
6. Widzę, ile zostało do zaplanowania.
7. Mogę przygotować plan na następny miesiąc i przeglądać poprzednie miesiące.

### 1.4 Przechowywane dane
Wszystkie dane są zapisane lokalnie, na urządzeniu użytkownika (w przeglądarce). Dla każdego miesiąca aplikacja przechowuje:
- listę przychodów (nazwa, kwota),
- % oszczędności i % inwestycji,
- listę planowanych wydatków (nazwa, kwota).

Aplikacja nie przechowuje danych osobowych, numerów kont, haseł ani danych logowania.

### 1.5 Poza zakresem wersji 1
- śledzenie rzeczywistych wydatków,
- kategorie wydatków,
- synchronizacja między urządzeniami,
- wiele walut, kont lub użytkowników,
- wykresy historyczne, raporty i prognozy,
- cele oszczędnościowe,
- powiadomienia,
- ciemny motyw,
- przenoszenie niewydanych pieniędzy na kolejny miesiąc.

### 1.6 Czego aplikacja nie robi
- nie łączy się z bankiem,
- nie wymaga logowania, płatności ani backendu,
- nie korzysta z usług wymagających kluczy API,
- nie wysyła danych poza urządzenie,
- nie udziela porad inwestycyjnych.

---

## 2. Funkcje wersji 1

| # | Funkcja |
|---|---|
| F1 | Przełączanie miesięcy strzałkami: miesiące poprzednie, bieżący i następny |
| F2 | Tworzenie planu: „Skopiuj z: [miesiąc]” albo „Zacznij od zera” |
| F3 | Przychody: dodawanie, edycja w miejscu, usuwanie, suma |
| F4 | Podział: suwaki % oszczędności i % inwestycji z podglądem kwot |
| F5 | Planowane wydatki: dodawanie, edycja w miejscu, usuwanie, suma |
| F6 | Podsumowanie: kwota „Zostało do zaplanowania” i pasek podziału przychodu |
| F7 | Walidacja blokująca niepoprawne zmiany, z komunikatem pod polem |
| F8 | Automatyczny zapis każdej poprawnej zmiany |
| F9 | Zamknięte miesiące tylko do odczytu |
| F10 | Usuwanie planu bieżącego lub następnego miesiąca (z potwierdzeniem) |
| F11 | Eksport wszystkich danych do pliku i import z pliku (import zastępuje dane, z potwierdzeniem) |
| F12 | Instalacja na ekranie głównym telefonu i działanie bez internetu |
| F13 | Układ pod telefon, na komputerze wyśrodkowany |

---

## 3. Reguły i obliczenia

### 3.1 Wzory
| Pojęcie | Wzór |
|---|---|
| Przychód | suma przychodów miesiąca |
| Oszczędności | Przychód × % oszczędności |
| Inwestycje | Przychód × (% oszczędności + % inwestycji) − Oszczędności |
| Do wydania | Przychód − Oszczędności − Inwestycje |
| Planowane wydatki | suma planowanych wydatków |
| **Zostało** | Do wydania − Planowane wydatki |

### 3.2 Status miesiąca
Status wynika z daty ustawionej w urządzeniu.

| Status | Kiedy | Co można zrobić |
|---|---|---|
| Zamknięty | miesiąc wcześniejszy niż bieżący | tylko podgląd; bez planu widać „Brak planu” |
| Bieżący | obecny miesiąc kalendarzowy | pełna edycja |
| Następny | miesiąc po bieżącym | pełna edycja |
| Niedostępny | dalsze miesiące | nie da się do nich przejść |

- Miesiąc zamyka się automatycznie 1. dnia kolejnego miesiąca.
- Niewydane pieniądze przepadają i nie przechodzą dalej.
- Strzałką w lewo można się cofać do najstarszego miesiąca, który ma plan. Jeśli żaden wcześniejszy miesiąc nie ma planu, strzałka jest nieaktywna na bieżącym miesiącu.
- Bieżący miesiąc jest zawsze dostępny, także gdy nie ma żadnego planu albo jedyny plan ma następny miesiąc.
- Strzałka w prawo jest nieaktywna na następnym miesiącu.

### 3.3 Tworzenie planu
- „Skopiuj z: [miesiąc]” kopiuje **wszystko**: przychody, % i wydatki. Źródłem jest najnowszy wcześniejszy miesiąc, który ma plan.
- Jeśli żaden wcześniejszy plan nie istnieje, dostępna jest tylko opcja „Zacznij od zera”. Plan od zera startuje z pustymi listami i 0%.
- Kopiowanie następuje raz. Późniejsze zmiany w jednym miesiącu nie wpływają na inne.
- Nazwy miesięcy w tekstach przycisków i kart nie są odmieniane, np. „Skopiuj z: Wrzesień 2026”, „Zaplanuj: Listopad 2026”.

### 3.4 Walidacja
Każda zmiana, która złamałaby regułę, jest **odrzucana**. Pod polem pojawia się komunikat, a poprzednia wartość zostaje bez zmian. Reguły:
1. % oszczędności i % inwestycji to liczby całkowite 0–100, a ich suma nie przekracza 100.
2. Kwota „Zostało” nigdy nie jest ujemna. Dotyczy to dodawania i zwiększania wydatków, a także zmniejszania i usuwania przychodów oraz zmiany %.
3. Każda kwota jest większa od 0, nie większa niż 10 000 000 zł i ma najwyżej 2 miejsca po przecinku.
4. Każdy przychód i wydatek ma niepustą nazwę o długości najwyżej 50 znaków. Spacje na początku i końcu nazwy są usuwane.

Wyjątek: suwak % nie wraca do poprzedniej wartości, tylko zatrzymuje się na najwyższej dozwolonej wartości (zgodnej z regułami 1 i 2), a pod nim pojawia się komunikat.

Gdy usunięcie pozycji zostaje odrzucone, komunikat pojawia się pod tą pozycją na liście.

Gdy przeglądarka nie pozwala zapisać danych (np. zablokowany zapis danych strony), zmiana też jest **odrzucana**: wraca poprzednia wartość (także na suwaku), a pod elementem, którego dotyczyła zmiana, pojawia się komunikat „Nie udało się zapisać zmiany. Przeglądarka nie pozwala zapisywać danych na tym urządzeniu.”. Dotyczy to każdej zmiany danych: dodania, edycji i usunięcia pozycji, zmiany %, utworzenia i usunięcia planu. Dzięki temu ekran zawsze pokazuje to, co jest zapisane.

### 3.5 Format i dokładność
- Waluta to wyłącznie PLN, a interfejs jest po polsku.
- Kwoty wyświetlają się z groszami, np. `1 234,56 zł`.
- Kwotę można wpisać z przecinkiem albo z kropką, np. `12,50` lub `12.50`. Spacje są pomijane, np. `1 234,50`.
- Obliczenia są dokładne co do grosza, bez błędów zaokrągleń. Oszczędności oraz łączną kwotę oszczędności i inwestycji zaokrąglamy do pełnego grosza, połówki w górę (np. 12,5 gr → 13 gr). Inwestycje to różnica tych dwóch kwot. Dzięki temu oszczędności i inwestycje razem nigdy nie przekraczają przychodu (np. 3 333,33 zł przy 50% + 50%: oszczędności 1 666,67 zł, inwestycje 1 666,66 zł, zostało 0,00 zł).

---

## 4. Ekrany

### 4.1 Elementy wspólne
- **Nagłówek:** strzałka w lewo, nazwa miesiąca (np. „Październik 2026”), strzałka w prawo. Wybrany miesiąc obowiązuje na wszystkich zakładkach.
- **Dolny pasek zakładek:** Plan, Przychody, Wydatki, Więcej.
- **Miesiąc bez planu:** na zakładkach Plan, Przychody i Wydatki widać kartę „Zaplanuj: [miesiąc]” z przyciskami tworzenia planu. Dla zamkniętego miesiąca widać napis „Brak planu”. Zakładka Więcej działa zawsze tak samo.

### 4.2 Plan
- Karta główna: „Zostało do zaplanowania”, duża kwota i pasek podziału (oszczędności, inwestycje, wydatki, zostało).
- Karta z suwakami: Oszczędności i Inwestycje, każdy z wartością % i kwotą w zł.
- Miesiąc zamknięty: oznaczenie „Zamknięty”, przygaszone kolory (zob. §5), zamiast suwaków same wartości.

### 4.3 Przychody i Wydatki
Oba ekrany są zbudowane tak samo:
- formularz na górze: pola „Nazwa” i „Kwota” oraz przycisk „Dodaj”,
- lista pozycji: dotknięcie pozycji zamienia ją w pola do edycji, a ikona kosza usuwa pozycję od razu,
- edycja: zmiana zapisuje się po naciśnięciu Enter albo po wyjściu z pola (np. dotknięciu innego miejsca ekranu); Escape anuluje edycję; niepoprawna wartość zostaje w polu z komunikatem do czasu poprawienia,
- suma „Razem”,
- miesiąc zamknięty: sama lista, bez formularza, edycji i koszy.

### 4.4 Więcej
- **Eksportuj dane:** pobiera plik z kopią wszystkich danych.
- **Importuj dane:** wczytuje plik, po potwierdzeniu, że obecne dane zostaną zastąpione. Niepoprawny plik daje komunikat błędu i niczego nie zmienia. Plik jest niepoprawny, jeśli nie jest kopią z BudgetApp albo którykolwiek miesiąc łamie reguły z §3.4. Plany na miesiące późniejsze niż następny są zachowywane i stają się widoczne, gdy nadejdzie ich czas. Gdy plik jest poprawny, ale przeglądarka nie pozwala zapisać danych, pojawia się komunikat „Nie udało się zapisać danych z pliku. Obecne dane nie zostały zmienione.”. Po udanym imporcie pojawia się komunikat „Dane zostały wczytane.”.
- **Usuń plan miesiąca:** z potwierdzeniem, tylko dla bieżącego i następnego miesiąca. Dotyczy miesiąca wybranego w nagłówku; przycisk ma postać „Usuń plan: [miesiąc]”, np. „Usuń plan: Październik 2026”. Gdy wybrany miesiąc jest zamknięty albo nie ma planu, przycisk jest nieaktywny, a pod nim widać napis „Można usunąć tylko istniejący plan bieżącego lub następnego miesiąca.”.
- Informacja: „Dane zapisane tylko na tym urządzeniu”.
- Potwierdzenia wyświetlają się w oknie w stylu aplikacji, z przyciskiem opisującym skutek (np. „Zastąp dane”, „Usuń plan”) oraz przyciskiem „Anuluj”.

---

## 5. Wygląd

- Styl inspirowany Material You (Google): miękkie, mocno zaokrąglone karty w odcieniach zieleni.
- Wyłącznie jasny motyw.
- Czcionka Inter, dostępna także bez internetu.
- Kolory:

| Rola | Kolor |
|---|---|
| Tło | `#F5FAF6` |
| Karty | `#FFFFFF` |
| Karta główna | `#D3EBDC` |
| Akcent | `#1B6B4A` |
| Tekst | `#17211B` |
| Pasek zakładek | `#E9F2EC` |
| Błąd | `#B3261E` |
| Tekst drugorzędny | `#5B6B61` |
| Obramowanie pól | `#7C8B81` |
| Tor suwaka (niewypełniony) | `#C8DDD0` |
| Pasek podziału: oszczędności | `#1B6B4A` |
| Pasek podziału: inwestycje | `#52A57D` |
| Pasek podziału: wydatki | `#9CCFB2` |
| Pasek podziału: zostało | `#FFFFFF` |

- Element nieaktywny (np. strzałka): kolor tekstu z przezroczystością 38%.
- Miesiąc zamknięty: treść kart z przezroczystością 60%, plakietka „Zamknięty” w kolorze tekstu drugorzędnego.

- Zaokrąglenia: karty 24 px, pola 12 px, przyciski i suwaki w pełni zaokrąglone.
- Suwaki: tor grubości 22 px z zielonym wypełnieniem. Okrągły biały uchwyt z zieloną obwódką jest nieco większy niż tor (28 px), a wypełnienie kończy się pod uchwytem.
- Pasek podziału: 4 zaokrąglone segmenty z odstępami.
- Aktywna zakładka: ikona w zielonej „pigułce”.
- Układ projektowany najpierw pod telefon. Na komputerze aplikacja ma maksymalnie 480 px szerokości i jest wyśrodkowana.

---

## 6. Kryteria ukończenia wersji 1
- [ ] Tworzę plan bieżącego miesiąca od zera i widzę poprawną kwotę „Zostało”.
- [ ] Zmiana suwaków od razu przelicza kwoty i pasek podziału.
- [ ] Nie da się zapisać zmiany, przez którą „Zostało” byłoby ujemne albo suma % przekroczyłaby 100%.
- [ ] Tworzę plan następnego miesiąca przez kopiowanie i mogę edytować każde pole.
- [ ] Poprzedni miesiąc jest tylko do odczytu, a pominięty miesiąc pokazuje „Brak planu”.
- [ ] Dane przetrwają zamknięcie i ponowne otwarcie aplikacji.
- [ ] Eksport tworzy plik, a import go wczytuje i zastępuje dane.
- [ ] Aplikację można zainstalować na telefonie i działa bez internetu.
- [ ] Aplikacja jest dostępna w internecie i otwiera się na telefonie.

---

## 7. Pomysły na kolejne wersje
Śledzenie rzeczywistych wydatków, kategorie wydatków, ciemny motyw, wykresy historii, cele oszczędnościowe.
