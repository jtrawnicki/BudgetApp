// Obliczenia i walidacja budżetu. Bez DOM i bez localStorage, żeby dało się to testować w Node.
// Wszystkie kwoty są liczbami całkowitymi w groszach.

export const DATA_VERSION = 1;
// 10 000 000 zł w groszach.
export const MAX_AMOUNT = 1_000_000_000;
export const MAX_NAME_LENGTH = 50;

export const MESSAGES = Object.freeze({
  nameEmpty: 'Wpisz nazwę.',
  nameTooLong: `Nazwa może mieć najwyżej ${MAX_NAME_LENGTH} znaków.`,
  amountInvalid: 'Wpisz kwotę, np. 12,50.',
  amountNotPositive: 'Kwota musi być większa od 0.',
  amountTooPrecise: 'Kwota może mieć najwyżej 2 miejsca po przecinku.',
  amountTooLarge: 'Kwota nie może przekraczać 10 000 000 zł.',
  percentInvalid: 'Procent musi być liczbą całkowitą od 0 do 100.',
  percentSumTooHigh: 'Suma procentów nie może przekraczać 100%.',
  remainingNegative: 'Ta zmiana sprawiłaby, że „Zostało” byłoby ujemne.',
  importInvalid: 'To nie jest poprawna kopia danych BudgetApp.',
  saveFailed: 'Nie udało się zapisać zmiany. Przeglądarka nie pozwala zapisywać danych na tym urządzeniu.',
  importSaveFailed: 'Nie udało się zapisać danych z pliku. Obecne dane nie zostały zmienione.',
  importDone: 'Dane zostały wczytane.',
});

// Spacja nierozdzielająca: kwota nie rozbije się na dwie linie.
const NBSP = ' ';

const MONTH_NAMES = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
];

const AMOUNT_PATTERN = /^(\d+)(?:[.,](\d+))?$/;
const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export const SLIDER_FIELDS = Object.freeze({
  savings: 'savingsPercent',
  investment: 'investmentPercent',
});

// ---------- Obliczenia ----------

// Liczy procent kwoty z zaokrągleniem połówki grosza w górę.
// Tylko na liczbach całkowitych, żeby uniknąć błędów liczb z przecinkiem.
export function roundPercentOf(amount, percent) {
  return Math.floor((amount * percent + 50) / 100);
}

export function sumAmounts(items) {
  return items.reduce((total, item) => total + item.amount, 0);
}

export function calculateSummary(plan) {
  const income = sumAmounts(plan.incomes);
  const savings = roundPercentOf(income, plan.savingsPercent);
  // Inwestycje liczymy jako różnicę, żeby oszczędności i inwestycje razem
  // nigdy nie przekroczyły przychodu (SPEC §3.5).
  const savingsAndInvestments = roundPercentOf(income, plan.savingsPercent + plan.investmentPercent);
  const investments = savingsAndInvestments - savings;
  const toSpend = income - savingsAndInvestments;
  const expensesTotal = sumAmounts(plan.expenses);
  return {
    income,
    savings,
    investments,
    toSpend,
    expensesTotal,
    remaining: toSpend - expensesTotal,
  };
}

// ---------- Kwoty i nazwy ----------

function success(value) {
  return { ok: true, value };
}

function failure(error) {
  return { ok: false, error };
}

// Sprawdza kwotę w groszach. Zwraca komunikat błędu albo null.
function validateAmountValue(amount) {
  if (!Number.isInteger(amount)) return MESSAGES.amountInvalid;
  if (amount <= 0) return MESSAGES.amountNotPositive;
  if (amount > MAX_AMOUNT) return MESSAGES.amountTooLarge;
  return null;
}

// Zamienia tekst z pola (np. "1 234,50") na grosze.
export function parseAmount(text) {
  // \s obejmuje też spację nierozdzielającą, np. z wklejonej kwoty.
  const compact = String(text).replace(/\s/g, '');
  const match = AMOUNT_PATTERN.exec(compact);
  if (!match) return failure(MESSAGES.amountInvalid);

  const [, whole, fraction = ''] = match;
  if (fraction.length > 2) return failure(MESSAGES.amountTooPrecise);

  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  const error = validateAmountValue(amount);
  return error ? failure(error) : success(amount);
}

export function normalizeName(text) {
  const name = String(text).trim();
  if (name === '') return failure(MESSAGES.nameEmpty);
  // Liczymy znaki Unicode, a nie jednostki UTF-16, żeby emoji liczyło się jako jeden znak.
  if ([...name].length > MAX_NAME_LENGTH) return failure(MESSAGES.nameTooLong);
  return success(name);
}

// Formatuje grosze (≥ 0) jako np. "1 234,56 zł". Własny formater, bo
// Intl.NumberFormat('pl-PL') nie grupuje liczb czterocyfrowych.
export function formatAmount(amount) {
  const zloty = Math.floor(amount / 100);
  const grosze = String(amount % 100).padStart(2, '0');
  const groupedZloty = String(zloty).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${groupedZloty},${grosze}${NBSP}zł`;
}

// Kwota do pola edycji, np. "1234,50": bez spacji i bez „zł”, żeby łatwo ją poprawić.
export function amountToInputText(amount) {
  const grosze = String(amount % 100).padStart(2, '0');
  return `${Math.floor(amount / 100)},${grosze}`;
}

// ---------- Procenty ----------

function isPercent(value) {
  return Number.isInteger(value) && value >= 0 && value <= 100;
}

export function validatePercents(savingsPercent, investmentPercent) {
  if (!isPercent(savingsPercent) || !isPercent(investmentPercent)) return MESSAGES.percentInvalid;
  if (savingsPercent + investmentPercent > 100) return MESSAGES.percentSumTooHigh;
  return null;
}

// Najwyższa wartość suwaka, na którą pozwala sama reguła „suma % najwyżej 100”.
function percentSumLimit(plan, slider) {
  const otherPercent = plan.savingsPercent + plan.investmentPercent - plan[SLIDER_FIELDS[slider]];
  return 100 - otherPercent;
}

// Najwyższa wartość suwaka ('savings' albo 'investment'), przy której suma %
// nie przekracza 100, a „Zostało” nie jest ujemne.
export function maxSliderValue(plan, slider) {
  const field = SLIDER_FIELDS[slider];
  for (let percent = percentSumLimit(plan, slider); percent > 0; percent--) {
    if (calculateSummary({ ...plan, [field]: percent }).remaining >= 0) return percent;
  }
  return 0;
}

// Wartość, na której suwak ma się zatrzymać, i komunikat, gdy trzeba go było zatrzymać.
// Komunikat mówi o tej regule, która wyznaczyła granicę.
export function clampSliderValue(plan, slider, requested) {
  const max = maxSliderValue(plan, slider);
  if (requested <= max) return { value: requested, error: null };

  const error = max === percentSumLimit(plan, slider) ? MESSAGES.percentSumTooHigh : MESSAGES.remainingNegative;
  return { value: max, error };
}

// ---------- Pozycje list (przychody i wydatki) ----------
// Funkcje nie zmieniają przekazanego planu: zwracają nowy plan albo błędy.
// Błędy pól są osobne, żeby każdy komunikat pojawił się pod swoim polem.

function fieldErrors(name, amount) {
  return { ok: false, errors: { name, amount } };
}

function parseItemFields(nameText, amountText) {
  const name = normalizeName(nameText);
  const amount = parseAmount(amountText);
  if (name.ok && amount.ok) return success({ name: name.value, amount: amount.value });
  return fieldErrors(name.ok ? null : name.error, amount.ok ? null : amount.error);
}

// Ujemne „Zostało” wynika z kwoty, dlatego komunikat jest pod polem kwoty.
function acceptIfRemainingValid(nextPlan) {
  if (calculateSummary(nextPlan).remaining < 0) return fieldErrors(null, MESSAGES.remainingNegative);
  return success(nextPlan);
}

// list to 'incomes' albo 'expenses'.
export function addItem(plan, list, id, nameText, amountText) {
  const fields = parseItemFields(nameText, amountText);
  if (!fields.ok) return fields;
  return acceptIfRemainingValid({ ...plan, [list]: [...plan[list], { id, ...fields.value }] });
}

export function updateItem(plan, list, id, nameText, amountText) {
  const fields = parseItemFields(nameText, amountText);
  if (!fields.ok) return fields;
  const items = plan[list].map((item) => (item.id === id ? { id, ...fields.value } : item));
  return acceptIfRemainingValid({ ...plan, [list]: items });
}

// Usunięcie przychodu może sprawić, że „Zostało” byłoby ujemne (SPEC §3.4, reguła 2).
export function removeItem(plan, list, id) {
  const nextPlan = { ...plan, [list]: plan[list].filter((item) => item.id !== id) };
  if (calculateSummary(nextPlan).remaining < 0) return failure(MESSAGES.remainingNegative);
  return success(nextPlan);
}

// ---------- Walidacja ----------

// Sprawdza plan miesiąca (SPEC §3.4). Zwraca pierwszy komunikat błędu albo null.
export function validatePlan(plan) {
  const percentError = validatePercents(plan.savingsPercent, plan.investmentPercent);
  if (percentError) return percentError;

  for (const item of [...plan.incomes, ...plan.expenses]) {
    const name = normalizeName(item.name);
    if (!name.ok) return name.error;
    const amountError = validateAmountValue(item.amount);
    if (amountError) return amountError;
  }

  if (calculateSummary(plan).remaining < 0) return MESSAGES.remainingNegative;
  return null;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Pozycje z pliku muszą mieć unikalne id i nazwę już bez spacji na brzegach.
function hasValidItems(items) {
  if (!Array.isArray(items)) return false;
  const ids = new Set();
  return items.every((item) => {
    const valid = isPlainObject(item)
      && typeof item.id === 'string' && item.id !== '' && !ids.has(item.id)
      && typeof item.name === 'string' && item.name === item.name.trim();
    if (valid) ids.add(item.id);
    return valid;
  });
}

function isValidStoredPlan(plan) {
  return isPlainObject(plan)
    && hasValidItems(plan.incomes)
    && hasValidItems(plan.expenses)
    && validatePlan(plan) === null;
}

// Sprawdza całe dane (np. z pliku importu). Zwraca komunikat błędu albo null.
export function validateData(data) {
  const valid = isPlainObject(data)
    && data.version === DATA_VERSION
    && isPlainObject(data.months)
    && Object.entries(data.months).every(([key, plan]) => MONTH_KEY_PATTERN.test(key) && isValidStoredPlan(plan));
  return valid ? null : MESSAGES.importInvalid;
}

// Zamienia tekst (zapis z localStorage albo plik kopii) na sprawdzone dane.
// Tekst, który nie jest nawet poprawnym JSON-em, też jest po prostu niepoprawną kopią.
export function parseData(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return failure(MESSAGES.importInvalid);
  }
  const error = validateData(data);
  return error ? failure(error) : success(data);
}

// ---------- Miesiące ----------
// Klucz miesiąca ma postać "RRRR-MM", więc klucze można porównywać jak tekst.

function toMonthKey(year, monthIndex) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

function parseMonthKey(key) {
  const [year, month] = key.split('-').map(Number);
  return { year, monthIndex: month - 1 };
}

// Czas lokalny urządzenia, nie UTC: toISOString() tuż po północy dałby zły miesiąc.
export function monthKeyFromDate(date) {
  return toMonthKey(date.getFullYear(), date.getMonth());
}

// Data w nazwie pliku też w czasie lokalnym: kopia zrobiona 1 stycznia o 0:30
// nie może mieć w nazwie 31 grudnia.
export function exportFileName(date) {
  const day = String(date.getDate()).padStart(2, '0');
  return `budgetapp-kopia-${monthKeyFromDate(date)}-${day}.json`;
}

export function addMonths(key, count) {
  const { year, monthIndex } = parseMonthKey(key);
  const total = year * 12 + monthIndex + count;
  return toMonthKey(Math.floor(total / 12), total % 12);
}

export function monthName(key) {
  const { year, monthIndex } = parseMonthKey(key);
  return `${MONTH_NAMES[monthIndex]} ${year}`;
}

export function getMonthStatus(key, today) {
  const current = monthKeyFromDate(today);
  if (key < current) return 'closed';
  if (key === current) return 'current';
  if (key === addMonths(current, 1)) return 'next';
  return 'unavailable';
}

// W lewo można iść do najstarszego miesiąca z planem, ale nigdy nie dalej niż bieżący,
// gdy wcześniejszych planów nie ma.
export function canGoPrevious(key, months, today) {
  const oldest = [monthKeyFromDate(today), ...Object.keys(months)].sort()[0];
  return key > oldest;
}

export function canGoNext(key, today) {
  return key < addMonths(monthKeyFromDate(today), 1);
}

// ---------- Tworzenie planu ----------

// Najnowszy miesiąc z planem wcześniejszy niż docelowy albo null.
export function findCopySource(months, targetKey) {
  return Object.keys(months).filter((key) => key < targetKey).sort().at(-1) ?? null;
}

// Głęboka kopia: późniejsze zmiany w kopii nie wpływają na oryginał.
export function copyPlan(plan) {
  return structuredClone(plan);
}

export function createEmptyPlan() {
  return { savingsPercent: 0, investmentPercent: 0, incomes: [], expenses: [] };
}

// Usunąć można tylko istniejący plan bieżącego albo następnego miesiąca (SPEC §4.4):
// zamknięte miesiące są tylko do odczytu.
export function canDeletePlan(key, months, today) {
  const status = getMonthStatus(key, today);
  return (status === 'current' || status === 'next') && Object.hasOwn(months, key);
}
