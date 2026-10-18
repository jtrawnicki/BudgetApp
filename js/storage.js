// Zapis i odczyt danych w localStorage oraz eksport i import pliku.
// Sprawdzanie poprawności danych jest w budget.js; ten moduł tylko z niego korzysta.

import { DATA_VERSION, parseData, exportFileName } from './budget.js';

const STORAGE_KEY = 'budgetapp-data';
// Tu trafia uszkodzony zapis, zanim aplikacja go nadpisze, żeby dało się go jeszcze ręcznie odzyskać.
const CORRUPTED_KEY = 'budgetapp-data-corrupted';

function createEmptyData() {
  return { version: DATA_VERSION, months: {} };
}

// localStorage może rzucić błąd (np. tryb prywatny, zablokowane dane strony),
// dlatego każde odwołanie jest w try/catch: aplikacja ma działać dalej.
function readRaw(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function loadData() {
  const raw = readRaw(STORAGE_KEY);
  if (raw === null) return createEmptyData();

  const result = parseData(raw);
  if (result.ok) return result.value;

  writeRaw(CORRUPTED_KEY, raw);
  return createEmptyData();
}

// Zwraca false, gdy przeglądarka nie pozwoliła zapisać (np. brak miejsca).
export function saveData(data) {
  return writeRaw(STORAGE_KEY, JSON.stringify(data));
}

// Treść z wcięciami, żeby plik kopii dało się przeczytać w zwykłym edytorze.
export function buildExportFile(data, today) {
  return {
    fileName: exportFileName(today),
    content: JSON.stringify(data, null, 2),
  };
}

// Import ma dwa kroki: najpierw sprawdzamy plik (readImportFile), a dopiero
// po potwierdzeniu użytkownika zapisujemy go przez saveData. Dzięki temu błędny
// plik daje komunikat od razu i niczego nie zmienia.
export function readImportFile(text) {
  return parseData(text);
}
