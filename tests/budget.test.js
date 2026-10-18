import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  DATA_VERSION,
  MAX_AMOUNT,
  MESSAGES,
  roundPercentOf,
  calculateSummary,
  parseAmount,
  normalizeName,
  formatAmount,
  validatePercents,
  maxSliderValue,
  clampSliderValue,
  sumAmounts,
  amountToInputText,
  addItem,
  updateItem,
  removeItem,
  validatePlan,
  validateData,
  parseData,
  monthKeyFromDate,
  exportFileName,
  addMonths,
  monthName,
  getMonthStatus,
  canGoPrevious,
  canGoNext,
  findCopySource,
  copyPlan,
  createEmptyPlan,
  canDeletePlan,
} from '../js/budget.js';

const NBSP = ' ';

// Plan z jednym przychodem i opcjonalnie jednym wydatkiem.
function makePlan({ income = 0, expense = 0, savings = 0, investment = 0 } = {}) {
  return {
    savingsPercent: savings,
    investmentPercent: investment,
    incomes: income > 0 ? [{ id: 'i1', name: 'Pensja', amount: income }] : [],
    expenses: expense > 0 ? [{ id: 'e1', name: 'Czynsz', amount: expense }] : [],
  };
}

// Daty w czasie lokalnym (miesiące w Date liczone od 0).
const OCTOBER_31_LATE = new Date(2026, 9, 31, 23, 59);
const NOVEMBER_1_EARLY = new Date(2026, 10, 1, 0, 0);
const DECEMBER_15 = new Date(2026, 11, 15);

describe('roundPercentOf', () => {
  it('zaokrągla połówkę grosza w górę (12,5 gr → 13 gr)', () => {
    assert.equal(roundPercentOf(25, 50), 13);
  });

  it('zaokrągla mniej niż połówkę w dół', () => {
    assert.equal(roundPercentOf(1, 49), 0);
  });

  it('0% i 100%', () => {
    assert.equal(roundPercentOf(123456, 0), 0);
    assert.equal(roundPercentOf(123456, 100), 123456);
  });
});

describe('calculateSummary', () => {
  it('liczy wszystkie kwoty według SPEC §3.1', () => {
    const plan = makePlan({ income: 900000, expense: 200000, savings: 20, investment: 10 });
    assert.deepEqual(calculateSummary(plan), {
      income: 900000,
      savings: 180000,
      investments: 90000,
      toSpend: 630000,
      expensesTotal: 200000,
      remaining: 430000,
    });
  });

  it('3 333,33 zł przy 50% + 50% daje „Zostało” 0,00 zł', () => {
    const summary = calculateSummary(makePlan({ income: 333333, savings: 50, investment: 50 }));
    assert.equal(summary.savings, 166667);
    assert.equal(summary.investments, 166666);
    assert.equal(summary.remaining, 0);
  });

  it('sumuje wiele przychodów i wydatków', () => {
    const plan = {
      savingsPercent: 0,
      investmentPercent: 0,
      incomes: [{ id: 'a', name: 'A', amount: 100 }, { id: 'b', name: 'B', amount: 250 }],
      expenses: [{ id: 'c', name: 'C', amount: 50 }, { id: 'd', name: 'D', amount: 70 }],
    };
    const summary = calculateSummary(plan);
    assert.equal(summary.income, 350);
    assert.equal(summary.expensesTotal, 120);
    assert.equal(summary.remaining, 230);
  });

  it('pusty plan daje same zera', () => {
    const summary = calculateSummary(createEmptyPlan());
    assert.equal(summary.income, 0);
    assert.equal(summary.remaining, 0);
  });
});

describe('parseAmount', () => {
  it('przyjmuje przecinek i kropkę: "12,50" i "12.50" → 1250', () => {
    assert.deepEqual(parseAmount('12,50'), { ok: true, value: 1250 });
    assert.deepEqual(parseAmount('12.50'), { ok: true, value: 1250 });
  });

  it('pomija spacje: "1 234,50" → 123450', () => {
    assert.deepEqual(parseAmount('1 234,50'), { ok: true, value: 123450 });
    assert.deepEqual(parseAmount(` 1${NBSP}234,50 `), { ok: true, value: 123450 });
  });

  it('przyjmuje kwotę bez groszy i z jedną cyfrą po przecinku', () => {
    assert.deepEqual(parseAmount('15'), { ok: true, value: 1500 });
    assert.deepEqual(parseAmount('0,5'), { ok: true, value: 50 });
  });

  it('odrzuca 0,001 (więcej niż 2 miejsca po przecinku)', () => {
    assert.deepEqual(parseAmount('0,001'), { ok: false, error: MESSAGES.amountTooPrecise });
  });

  it('odrzuca zero', () => {
    assert.deepEqual(parseAmount('0'), { ok: false, error: MESSAGES.amountNotPositive });
    assert.deepEqual(parseAmount('0,00'), { ok: false, error: MESSAGES.amountNotPositive });
  });

  it('przyjmuje dokładnie 10 000 000 zł, odrzuca 10 000 000,01 zł', () => {
    assert.deepEqual(parseAmount('10 000 000'), { ok: true, value: MAX_AMOUNT });
    assert.deepEqual(parseAmount('10 000 000,01'), { ok: false, error: MESSAGES.amountTooLarge });
  });

  it('odrzuca zły format', () => {
    for (const text of ['', '   ', 'abc', '12,', ',5', '1.234,50', '-5', '12zł']) {
      assert.deepEqual(parseAmount(text), { ok: false, error: MESSAGES.amountInvalid }, text);
    }
  });
});

describe('normalizeName', () => {
  it('usuwa spacje z brzegów', () => {
    assert.deepEqual(normalizeName('  Pensja  '), { ok: true, value: 'Pensja' });
  });

  it('odrzuca pustą nazwę i same spacje', () => {
    assert.deepEqual(normalizeName(''), { ok: false, error: MESSAGES.nameEmpty });
    assert.deepEqual(normalizeName('   '), { ok: false, error: MESSAGES.nameEmpty });
  });

  it('przyjmuje 50 znaków, odrzuca 51', () => {
    assert.equal(normalizeName('a'.repeat(50)).ok, true);
    assert.deepEqual(normalizeName('a'.repeat(51)), { ok: false, error: MESSAGES.nameTooLong });
  });

  it('spacje na brzegach nie liczą się do limitu', () => {
    assert.equal(normalizeName(`  ${'a'.repeat(50)}  `).ok, true);
  });

  it('emoji liczy się jako jeden znak', () => {
    assert.equal(normalizeName('😀'.repeat(50)).ok, true);
  });

  it('nie zmienia znaczników HTML (wyświetlimy je jako tekst)', () => {
    assert.deepEqual(normalizeName('<b>test</b>'), { ok: true, value: '<b>test</b>' });
  });
});

describe('formatAmount', () => {
  it('formatuje z groszami i grupuje tysiące', () => {
    assert.equal(formatAmount(0), `0,00${NBSP}zł`);
    assert.equal(formatAmount(5), `0,05${NBSP}zł`);
    assert.equal(formatAmount(99999), `999,99${NBSP}zł`);
    assert.equal(formatAmount(123456), `1${NBSP}234,56${NBSP}zł`);
    assert.equal(formatAmount(MAX_AMOUNT), `10${NBSP}000${NBSP}000,00${NBSP}zł`);
    assert.equal(formatAmount(100000000000), `1${NBSP}000${NBSP}000${NBSP}000,00${NBSP}zł`);
  });
});

describe('validatePercents', () => {
  it('przyjmuje 0% i 100%', () => {
    assert.equal(validatePercents(0, 0), null);
    assert.equal(validatePercents(100, 0), null);
    assert.equal(validatePercents(0, 100), null);
    assert.equal(validatePercents(60, 40), null);
  });

  it('odrzuca sumę powyżej 100%', () => {
    assert.equal(validatePercents(60, 41), MESSAGES.percentSumTooHigh);
  });

  it('odrzuca wartości spoza 0–100 i niecałkowite', () => {
    assert.equal(validatePercents(-1, 0), MESSAGES.percentInvalid);
    assert.equal(validatePercents(101, 0), MESSAGES.percentInvalid);
    assert.equal(validatePercents(10.5, 0), MESSAGES.percentInvalid);
    assert.equal(validatePercents('10', 0), MESSAGES.percentInvalid);
  });
});

describe('maxSliderValue', () => {
  it('bez wydatków ogranicza tylko suma 100%', () => {
    const plan = makePlan({ income: 100000, savings: 30, investment: 20 });
    assert.equal(maxSliderValue(plan, 'savings'), 80);
    assert.equal(maxSliderValue(plan, 'investment'), 70);
  });

  it('zatrzymuje suwak, zanim „Zostało” byłoby ujemne', () => {
    // 1000 zł przychodu, 700 zł wydatków: razem najwyżej 30%.
    const plan = makePlan({ income: 100000, expense: 70000, savings: 10, investment: 0 });
    assert.equal(maxSliderValue(plan, 'investment'), 20);
    assert.equal(maxSliderValue(plan, 'savings'), 30);
  });

  it('uwzględnia zaokrąglenie do grosza', () => {
    // 1,00 zł przychodu, 0,66 zł wydatków: przy 34% zostaje 0,00 zł, przy 35% byłoby −0,01 zł.
    const plan = makePlan({ income: 100, expense: 66 });
    assert.equal(maxSliderValue(plan, 'savings'), 34);
  });

  it('zwraca 0, gdy wydatki zajmują cały przychód', () => {
    const plan = makePlan({ income: 100000, expense: 100000 });
    assert.equal(maxSliderValue(plan, 'savings'), 0);
  });
});

describe('clampSliderValue', () => {
  it('przepuszcza dozwoloną wartość bez komunikatu', () => {
    const plan = makePlan({ income: 100000, savings: 30, investment: 20 });
    assert.deepEqual(clampSliderValue(plan, 'savings', 80), { value: 80, error: null });
  });

  it('przy sumie powyżej 100% zatrzymuje na granicy z komunikatem o sumie', () => {
    const plan = makePlan({ income: 100000, savings: 30, investment: 20 });
    assert.deepEqual(clampSliderValue(plan, 'savings', 90), { value: 80, error: MESSAGES.percentSumTooHigh });
  });

  it('gdy granicę wyznacza „Zostało”, pokazuje komunikat o „Zostało”', () => {
    // 1000 zł przychodu, 700 zł wydatków: razem najwyżej 30%.
    const plan = makePlan({ income: 100000, expense: 70000, savings: 10 });
    assert.deepEqual(clampSliderValue(plan, 'investment', 50), { value: 20, error: MESSAGES.remainingNegative });
  });

  it('przy przychodzie 0 zł ogranicza tylko suma 100%', () => {
    const plan = makePlan({ investment: 40 });
    assert.deepEqual(clampSliderValue(plan, 'savings', 100), { value: 60, error: MESSAGES.percentSumTooHigh });
  });

  it('gdy drugi suwak ma 100%, ten stoi na 0 z komunikatem o sumie', () => {
    const plan = makePlan({ income: 100000, investment: 100 });
    assert.deepEqual(clampSliderValue(plan, 'savings', 5), { value: 0, error: MESSAGES.percentSumTooHigh });
  });
});

describe('sumAmounts i amountToInputText', () => {
  it('sumuje kwoty listy, pusta lista daje 0', () => {
    assert.equal(sumAmounts([{ amount: 100 }, { amount: 250 }]), 350);
    assert.equal(sumAmounts([]), 0);
  });

  it('kwota do pola edycji: przecinek, bez spacji i bez „zł”', () => {
    assert.equal(amountToInputText(123450), '1234,50');
    assert.equal(amountToInputText(5), '0,05');
    assert.equal(amountToInputText(MAX_AMOUNT), '10000000,00');
  });

  it('tekst z pola edycji wraca do tej samej kwoty', () => {
    for (const amount of [1, 99, 100, 123456, MAX_AMOUNT]) {
      assert.deepEqual(parseAmount(amountToInputText(amount)), { ok: true, value: amount });
    }
  });
});

describe('addItem', () => {
  it('dodaje pozycję na koniec listy, z nazwą bez spacji na brzegach', () => {
    const plan = makePlan({ income: 100000 });
    const result = addItem(plan, 'incomes', 'i2', '  Premia ', '1 234,50');
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.incomes.at(-1), { id: 'i2', name: 'Premia', amount: 123450 });
    assert.equal(result.value.incomes.length, 2);
  });

  it('nie zmienia przekazanego planu', () => {
    const plan = makePlan({ income: 100000 });
    addItem(plan, 'expenses', 'e9', 'Prąd', '100');
    assert.equal(plan.expenses.length, 0);
  });

  it('odrzuca pustą nazwę, zbyt długą nazwę i złą kwotę, z komunikatem pod właściwym polem', () => {
    const plan = makePlan({ income: MAX_AMOUNT });
    const cases = [
      ['  ', '10', { name: MESSAGES.nameEmpty, amount: null }],
      ['a'.repeat(51), '10', { name: MESSAGES.nameTooLong, amount: null }],
      ['Prąd', '0', { name: null, amount: MESSAGES.amountNotPositive }],
      ['Prąd', '10 000 000,01', { name: null, amount: MESSAGES.amountTooLarge }],
      ['Prąd', '1,234', { name: null, amount: MESSAGES.amountTooPrecise }],
      ['', '', { name: MESSAGES.nameEmpty, amount: MESSAGES.amountInvalid }],
    ];
    for (const [name, amount, errors] of cases) {
      assert.deepEqual(addItem(plan, 'expenses', 'e9', name, amount), { ok: false, errors }, `${name} / ${amount}`);
    }
  });

  it('odrzuca wydatek, przez który „Zostało” byłoby ujemne, a przyjmuje dokładnie 0', () => {
    const plan = makePlan({ income: 100000, savings: 50 });
    assert.deepEqual(addItem(plan, 'expenses', 'e9', 'Czynsz', '500,01'), {
      ok: false,
      errors: { name: null, amount: MESSAGES.remainingNegative },
    });
    assert.equal(addItem(plan, 'expenses', 'e9', 'Czynsz', '500').ok, true);
  });
});

describe('updateItem', () => {
  it('zmienia nazwę i kwotę wskazanej pozycji', () => {
    const plan = makePlan({ income: 100000, expense: 1000 });
    const result = updateItem(plan, 'expenses', 'e1', ' Najem ', '20,5');
    assert.deepEqual(result.value.expenses, [{ id: 'e1', name: 'Najem', amount: 2050 }]);
    assert.equal(plan.expenses[0].name, 'Czynsz');
  });

  it('odrzuca zmniejszenie przychodu, przez które „Zostało” byłoby ujemne', () => {
    const plan = makePlan({ income: 100000, expense: 60000 });
    assert.deepEqual(updateItem(plan, 'incomes', 'i1', 'Pensja', '599,99'), {
      ok: false,
      errors: { name: null, amount: MESSAGES.remainingNegative },
    });
  });

  it('odrzuca niepoprawne pola', () => {
    const plan = makePlan({ income: 100000 });
    assert.deepEqual(updateItem(plan, 'incomes', 'i1', '', '0'), {
      ok: false,
      errors: { name: MESSAGES.nameEmpty, amount: MESSAGES.amountNotPositive },
    });
  });
});

describe('removeItem', () => {
  it('usuwa wskazaną pozycję', () => {
    const plan = makePlan({ income: 100000, expense: 1000 });
    const result = removeItem(plan, 'expenses', 'e1');
    assert.deepEqual(result.value.expenses, []);
    assert.equal(plan.expenses.length, 1);
  });

  it('odrzuca usunięcie przychodu, przez które „Zostało” byłoby ujemne', () => {
    const plan = makePlan({ income: 100000, expense: 1000 });
    assert.deepEqual(removeItem(plan, 'incomes', 'i1'), { ok: false, error: MESSAGES.remainingNegative });
  });
});

describe('validatePlan', () => {
  it('przyjmuje poprawny plan i pusty plan', () => {
    assert.equal(validatePlan(makePlan({ income: 900000, expense: 200000, savings: 20, investment: 10 })), null);
    assert.equal(validatePlan(createEmptyPlan()), null);
  });

  it('przyjmuje „Zostało” równe dokładnie 0', () => {
    assert.equal(validatePlan(makePlan({ income: 100000, expense: 50000, savings: 50 })), null);
  });

  it('odrzuca „Zostało” poniżej 0', () => {
    assert.equal(validatePlan(makePlan({ income: 100000, expense: 50001, savings: 50 })), MESSAGES.remainingNegative);
  });

  it('odrzuca usunięcie przychodu, przez które „Zostało” byłoby ujemne', () => {
    const plan = makePlan({ expense: 100 });
    assert.equal(validatePlan(plan), MESSAGES.remainingNegative);
  });

  it('odrzuca sumę % powyżej 100', () => {
    assert.equal(validatePlan(makePlan({ income: 100000, savings: 60, investment: 41 })), MESSAGES.percentSumTooHigh);
  });

  it('odrzuca pozycję z pustą nazwą albo złą kwotą', () => {
    const emptyName = makePlan({ income: 100000 });
    emptyName.incomes[0].name = '  ';
    assert.equal(validatePlan(emptyName), MESSAGES.nameEmpty);

    const tooLarge = makePlan({ income: MAX_AMOUNT + 1 });
    assert.equal(validatePlan(tooLarge), MESSAGES.amountTooLarge);

    const fraction = makePlan({ income: 100000 });
    fraction.incomes[0].amount = 10.5;
    assert.equal(validatePlan(fraction), MESSAGES.amountInvalid);
  });
});

describe('validateData', () => {
  function makeData(months) {
    return { version: DATA_VERSION, months };
  }

  it('przyjmuje poprawne dane i dane bez planów', () => {
    assert.equal(validateData(makeData({ '2026-10': makePlan({ income: 900000, expense: 1000, savings: 20 }) })), null);
    assert.equal(validateData(makeData({})), null);
  });

  it('przyjmuje plany na odległe miesiące (zachowujemy je)', () => {
    assert.equal(validateData(makeData({ '2030-01': createEmptyPlan() })), null);
  });

  it('odrzuca to, co nie jest kopią BudgetApp', () => {
    for (const data of [null, [], 'tekst', 42, {}, { version: DATA_VERSION }, { version: 2, months: {} }, { version: DATA_VERSION, months: [] }]) {
      assert.equal(validateData(data), MESSAGES.importInvalid, JSON.stringify(data));
    }
  });

  it('odrzuca zły klucz miesiąca', () => {
    for (const key of ['2026-13', '2026-00', '2026-1', '26-10', 'październik']) {
      assert.equal(validateData(makeData({ [key]: createEmptyPlan() })), MESSAGES.importInvalid, key);
    }
  });

  it('odrzuca miesiąc łamiący reguły z SPEC §3.4', () => {
    const negative = makePlan({ income: 100000, expense: 50001, savings: 50 });
    const percents = makePlan({ income: 100000, savings: 70, investment: 31 });
    const fraction = makePlan({ income: 100000 });
    fraction.incomes[0].amount = 0.5;
    const untrimmed = makePlan({ income: 100000 });
    untrimmed.incomes[0].name = ' Pensja';
    for (const plan of [negative, percents, fraction, untrimmed]) {
      assert.equal(validateData(makeData({ '2026-10': plan })), MESSAGES.importInvalid);
    }
  });

  it('odrzuca złą budowę planu i pozycji', () => {
    const missingList = { savingsPercent: 0, investmentPercent: 0, incomes: [] };
    const duplicateIds = makePlan({ income: 100000 });
    duplicateIds.incomes.push({ id: 'i1', name: 'Premia', amount: 100 });
    const missingId = makePlan({ income: 100000 });
    delete missingId.incomes[0].id;
    for (const plan of [null, [], missingList, duplicateIds, missingId]) {
      assert.equal(validateData(makeData({ '2026-10': plan })), MESSAGES.importInvalid);
    }
  });

  it('odrzuca przypadki z definicji ukończenia Z8', () => {
    const negativeAmount = makePlan({ income: 100000 });
    negativeAmount.incomes[0].amount = -100;
    const percentOver100 = makePlan({ income: 100000, savings: 101 });
    const emptyName = makePlan({ income: 100000 });
    emptyName.incomes[0].name = '';
    const missingPercent = makePlan({ income: 100000 });
    delete missingPercent.savingsPercent;
    const missingAmount = makePlan({ income: 100000 });
    delete missingAmount.incomes[0].amount;
    const missingName = makePlan({ income: 100000 });
    delete missingName.incomes[0].name;
    const textAmount = makePlan({ income: 100000 });
    textAmount.incomes[0].amount = '1000';
    for (const plan of [negativeAmount, percentOver100, emptyName, missingPercent, missingAmount, missingName, textAmount]) {
      assert.equal(validateData(makeData({ '2026-10': plan })), MESSAGES.importInvalid, JSON.stringify(plan));
    }
  });

  it('odrzuca dane, gdy błędny jest choćby jeden z wielu miesięcy', () => {
    const valid = makePlan({ income: 100000 });
    const invalid = makePlan({ income: 100000, expense: 100001 });
    assert.equal(validateData(makeData({ '2026-09': valid, '2026-10': invalid })), MESSAGES.importInvalid);
  });
});

describe('parseData', () => {
  it('zwraca dane z poprawnego tekstu, także z planem na odległy miesiąc', () => {
    const data = { version: DATA_VERSION, months: { '2026-10': makePlan({ income: 100000 }), '2030-01': createEmptyPlan() } };
    assert.deepEqual(parseData(JSON.stringify(data, null, 2)), { ok: true, value: data });
  });

  it('odrzuca tekst, który nie jest JSON-em, i pusty plik', () => {
    for (const text of ['', '{', 'nie json', '{"version": 1, "months": {}']) {
      assert.deepEqual(parseData(text), { ok: false, error: MESSAGES.importInvalid }, text);
    }
  });

  it('odrzuca poprawny JSON, który nie jest kopią BudgetApp', () => {
    assert.deepEqual(parseData('{"version": 2, "months": {}}'), { ok: false, error: MESSAGES.importInvalid });
    assert.deepEqual(parseData('null'), { ok: false, error: MESSAGES.importInvalid });
  });
});

describe('monthKeyFromDate i addMonths', () => {
  it('używa czasu lokalnego tuż przed i tuż po północy', () => {
    assert.equal(monthKeyFromDate(OCTOBER_31_LATE), '2026-10');
    assert.equal(monthKeyFromDate(NOVEMBER_1_EARLY), '2026-11');
  });

  it('przechodzi przez przełom roku w obie strony', () => {
    assert.equal(addMonths('2026-12', 1), '2027-01');
    assert.equal(addMonths('2027-01', -1), '2026-12');
    assert.equal(addMonths('2026-10', 0), '2026-10');
    assert.equal(addMonths('2026-10', 15), '2028-01');
  });
});

describe('exportFileName', () => {
  it('ma wzór budgetapp-kopia-RRRR-MM-DD.json z zerami wiodącymi', () => {
    assert.equal(exportFileName(new Date(2026, 9, 5, 12, 0)), 'budgetapp-kopia-2026-10-05.json');
  });

  it('tuż po północy 1 stycznia bierze datę lokalną, a nie UTC', () => {
    assert.equal(exportFileName(new Date(2027, 0, 1, 0, 30)), 'budgetapp-kopia-2027-01-01.json');
  });

  it('tuż przed północą 31 grudnia zostaje przy starym roku', () => {
    assert.equal(exportFileName(new Date(2026, 11, 31, 23, 59)), 'budgetapp-kopia-2026-12-31.json');
  });
});

describe('monthName', () => {
  it('podaje nazwę w mianowniku z rokiem', () => {
    assert.equal(monthName('2026-10'), 'Październik 2026');
    assert.equal(monthName('2027-01'), 'Styczeń 2027');
    assert.equal(monthName('2026-12'), 'Grudzień 2026');
  });
});

describe('getMonthStatus', () => {
  it('rozpoznaje zamknięty, bieżący, następny i niedostępny', () => {
    assert.equal(getMonthStatus('2026-09', OCTOBER_31_LATE), 'closed');
    assert.equal(getMonthStatus('2026-10', OCTOBER_31_LATE), 'current');
    assert.equal(getMonthStatus('2026-11', OCTOBER_31_LATE), 'next');
    assert.equal(getMonthStatus('2026-12', OCTOBER_31_LATE), 'unavailable');
  });

  it('zamyka miesiąc 1. dnia kolejnego miesiąca', () => {
    assert.equal(getMonthStatus('2026-10', NOVEMBER_1_EARLY), 'closed');
    assert.equal(getMonthStatus('2026-11', NOVEMBER_1_EARLY), 'current');
  });

  it('działa na przełomie roku grudzień → styczeń', () => {
    assert.equal(getMonthStatus('2026-12', DECEMBER_15), 'current');
    assert.equal(getMonthStatus('2027-01', DECEMBER_15), 'next');
    assert.equal(getMonthStatus('2027-02', DECEMBER_15), 'unavailable');
    assert.equal(getMonthStatus('2025-12', DECEMBER_15), 'closed');
  });
});

describe('canGoPrevious', () => {
  it('bez planów strzałka w lewo jest nieaktywna na bieżącym miesiącu', () => {
    assert.equal(canGoPrevious('2026-10', {}, OCTOBER_31_LATE), false);
    assert.equal(canGoPrevious('2026-11', {}, OCTOBER_31_LATE), true);
  });

  it('z planem tylko na następny miesiąc nie da się zejść poniżej bieżącego', () => {
    const months = { '2026-11': createEmptyPlan() };
    assert.equal(canGoPrevious('2026-11', months, OCTOBER_31_LATE), true);
    assert.equal(canGoPrevious('2026-10', months, OCTOBER_31_LATE), false);
  });

  it('pozwala cofać się do najstarszego miesiąca z planem, także przez miesiące bez planu', () => {
    const months = { '2026-06': createEmptyPlan(), '2026-09': createEmptyPlan() };
    assert.equal(canGoPrevious('2026-10', months, OCTOBER_31_LATE), true);
    assert.equal(canGoPrevious('2026-07', months, OCTOBER_31_LATE), true);
    assert.equal(canGoPrevious('2026-06', months, OCTOBER_31_LATE), false);
  });

  it('cofa się przez przełom roku', () => {
    const months = { '2026-11': createEmptyPlan() };
    assert.equal(canGoPrevious('2027-01', months, new Date(2027, 0, 10)), true);
  });
});

describe('canGoNext', () => {
  it('strzałka w prawo jest nieaktywna na następnym miesiącu', () => {
    assert.equal(canGoNext('2026-09', OCTOBER_31_LATE), true);
    assert.equal(canGoNext('2026-10', OCTOBER_31_LATE), true);
    assert.equal(canGoNext('2026-11', OCTOBER_31_LATE), false);
  });

  it('w grudniu można przejść na styczeń, ale nie dalej', () => {
    assert.equal(canGoNext('2026-12', DECEMBER_15), true);
    assert.equal(canGoNext('2027-01', DECEMBER_15), false);
  });
});

describe('findCopySource', () => {
  it('wybiera najnowszy wcześniejszy miesiąc z planem, pomijając miesiące bez planu', () => {
    const months = { '2026-06': createEmptyPlan(), '2026-08': createEmptyPlan(), '2026-11': createEmptyPlan() };
    assert.equal(findCopySource(months, '2026-10'), '2026-08');
  });

  it('dla następnego miesiąca źródłem może być bieżący', () => {
    const months = { '2026-10': createEmptyPlan() };
    assert.equal(findCopySource(months, '2026-11'), '2026-10');
  });

  it('działa przez przełom roku', () => {
    const months = { '2026-12': createEmptyPlan() };
    assert.equal(findCopySource(months, '2027-01'), '2026-12');
  });

  it('zwraca null, gdy nie ma wcześniejszego planu', () => {
    assert.equal(findCopySource({}, '2026-10'), null);
    assert.equal(findCopySource({ '2026-11': createEmptyPlan() }, '2026-10'), null);
  });
});

describe('copyPlan i createEmptyPlan', () => {
  it('kopiuje wszystko: przychody, % i wydatki', () => {
    const plan = makePlan({ income: 900000, expense: 200000, savings: 20, investment: 10 });
    assert.deepEqual(copyPlan(plan), plan);
  });

  it('późniejsze zmiany w kopii nie wpływają na oryginał', () => {
    const plan = makePlan({ income: 900000, expense: 200000, savings: 20 });
    const copy = copyPlan(plan);
    copy.savingsPercent = 50;
    copy.incomes[0].amount = 1;
    copy.expenses.push({ id: 'e2', name: 'Prąd', amount: 100 });
    assert.equal(plan.savingsPercent, 20);
    assert.equal(plan.incomes[0].amount, 900000);
    assert.equal(plan.expenses.length, 1);
  });

  it('pusty plan ma puste listy i 0%', () => {
    assert.deepEqual(createEmptyPlan(), { savingsPercent: 0, investmentPercent: 0, incomes: [], expenses: [] });
  });

  it('każdy pusty plan to osobny obiekt', () => {
    const first = createEmptyPlan();
    first.incomes.push({ id: 'x', name: 'X', amount: 1 });
    assert.equal(createEmptyPlan().incomes.length, 0);
  });
});

describe('canDeletePlan', () => {
  const months = { '2026-09': createEmptyPlan(), '2026-10': createEmptyPlan(), '2026-11': createEmptyPlan() };

  it('pozwala usunąć plan bieżącego i następnego miesiąca', () => {
    assert.equal(canDeletePlan('2026-10', months, OCTOBER_31_LATE), true);
    assert.equal(canDeletePlan('2026-11', months, OCTOBER_31_LATE), true);
  });

  it('nie pozwala usunąć planu zamkniętego miesiąca', () => {
    assert.equal(canDeletePlan('2026-09', months, OCTOBER_31_LATE), false);
    // Po północy 1 listopada październik jest już zamknięty.
    assert.equal(canDeletePlan('2026-10', months, NOVEMBER_1_EARLY), false);
  });

  it('nie pozwala usunąć planu, którego nie ma', () => {
    assert.equal(canDeletePlan('2026-10', {}, OCTOBER_31_LATE), false);
    assert.equal(canDeletePlan('2026-11', { '2026-10': createEmptyPlan() }, OCTOBER_31_LATE), false);
  });

  it('działa na przełomie roku', () => {
    assert.equal(canDeletePlan('2027-01', { '2027-01': createEmptyPlan() }, DECEMBER_15), true);
  });
});