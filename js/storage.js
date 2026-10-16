// Zapis i odczyt danych w localStorage oraz eksport i import pliku.
// Sprawdzanie poprawności danych jest w budget.js; ten moduł tylko z niego korzysta.

import { DATA_VERSION, MESSAGES, validateData, exportFileName } from './budget.js';

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

// Zwraca sprawdzone dane albo null, gdy tekst nie jest poprawną kopią BudgetApp.
function parseData(text) {
  try {
    const data = JSON.parse(text);
    return validateData(data) === null ? data : null;
  } catch {
    return null;
  }
}

export function loadData() {
  const raw = readRaw(STORAGE_KEY);
  if (raw === null) return createEmptyData();

  const data = parseData(raw);
  if (data) return data;

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

// Zapisuje dane z pliku dopiero, gdy są poprawne: błędny plik niczego nie zmienia.
export function importData(text) {
  const data = parseData(text);
  if (!data) return { ok: false, error: MESSAGES.importInvalid };
  if (!saveData(data)) return { ok: false, saveFailed: true };
  return { ok: true, value: data };
}
