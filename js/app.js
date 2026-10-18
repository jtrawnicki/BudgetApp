// Ekrany i obsługa interfejsu.

import {
  MESSAGES,
  SLIDER_FIELDS,
  addItem,
  addMonths,
  amountToInputText,
  calculateSummary,
  canDeletePlan,
  canGoNext,
  canGoPrevious,
  clampSliderValue,
  copyPlan,
  createEmptyPlan,
  findCopySource,
  formatAmount,
  getMonthStatus,
  monthKeyFromDate,
  monthName,
  removeItem,
  sumAmounts,
  updateItem,
} from './budget.js';
import { buildExportFile, loadData, readImportFile, saveData } from './storage.js';

const initialData = loadData();

const state = {
  data: initialData,
  monthKey: monthKeyFromDate(new Date()),
  // Kopia ostatnio zapisanych danych: gdy zapis się nie uda, wracamy do niej (SPEC §3.4).
  savedData: structuredClone(initialData),
};

function currentPlan() {
  return state.data.months[state.monthKey] ?? null;
}

// Zapisuje dane albo przywraca ostatnio zapisane. Zwraca, czy zapis się udał.
function saveOrRevert() {
  if (saveData(state.data)) {
    state.savedData = structuredClone(state.data);
    return true;
  }
  state.data = structuredClone(state.savedData);
  return false;
}

// Ekran mógł nie zdążyć się odświeżyć po północy (np. karta na komputerze widoczna przez
// całą noc). Wtedy niczego nie zapisujemy, tylko pokazujemy miesiąc jako zamknięty (SPEC §3.2).
// Zwraca true, gdy wybrany miesiąc jest już zamknięty.
function refreshIfClosed() {
  if (getMonthStatus(state.monthKey, new Date()) !== 'closed') return false;
  // Przesuwany suwak zmienia dane w pamięci przed zapisem; zamknięty miesiąc
  // ma zostać taki, jak zapisany, żeby ta zmiana nie trafiła później do zapisu.
  state.data = structuredClone(state.savedData);
  renderAll();
  return true;
}

function cloneTemplate(selector) {
  return document.querySelector(selector).content.firstElementChild.cloneNode(true);
}

// Pokazuje komunikat w elemencie; null ukrywa element razem z poprzednim tekstem.
function setMessage(element, message) {
  element.hidden = message === null;
  element.textContent = message ?? '';
}

// ---------- Nagłówek i zakładki ----------

function renderHeader(today) {
  const nameElement = document.querySelector('#month-name');
  const name = monthName(state.monthKey);
  // Nagłówek ma aria-live: wpisanie nawet tego samego tekstu czytnik ekranu ogłosiłby ponownie.
  if (nameElement.textContent !== name) nameElement.textContent = name;
  document.querySelector('#previous-month').disabled = !canGoPrevious(state.monthKey, state.data.months, today);
  document.querySelector('#next-month').disabled = !canGoNext(state.monthKey, today);
}

function goToMonth(arrow, otherArrow, offset) {
  // Trwającą edycję zapisujemy w miesiącu, którego dotyczy. Niepoprawną wartość
  // trzeba najpierw poprawić (SPEC §4.3), więc wtedy zostajemy na miejscu.
  if (!itemLists.every((itemList) => itemList.finishEdit())) return;
  state.monthKey = addMonths(state.monthKey, offset);
  // Komunikaty i niedokończony formularz dotyczyły poprzedniego miesiąca.
  resetMonthMessages();
  renderAll();
  // Nieaktywny przycisk traci fokus; przenosimy go na drugą strzałkę, żeby nie zgubił się na stronie.
  (arrow.disabled ? otherArrow : arrow).focus();
}

function setUpMonthArrows() {
  const previous = document.querySelector('#previous-month');
  const next = document.querySelector('#next-month');
  previous.addEventListener('click', () => goToMonth(previous, next, -1));
  next.addEventListener('click', () => goToMonth(next, previous, 1));
  // Jak w handleItemMouseDown: w trakcie edycji wciśnięcie strzałki nie zabiera fokusu z pola.
  // Inaczej edycję zapisałby handleEditorFocusOut jeszcze przed kliknięciem i goToMonth
  // nie wiedziałby, że zapis się nie udał.
  document.querySelector('.month-header').addEventListener('mousedown', (event) => {
    if (event.target.closest('.icon-button') && itemLists.some((itemList) => itemList.isEditing())) {
      event.preventDefault();
    }
  });
}

function selectTab(viewName) {
  for (const tab of document.querySelectorAll('.tab')) {
    // aria-current mówi czytnikom ekranu, która zakładka jest wybrana; CSS rysuje według niego „pigułkę”.
    if (tab.dataset.view === viewName) {
      tab.setAttribute('aria-current', 'page');
    } else {
      tab.removeAttribute('aria-current');
    }
  }
  for (const view of document.querySelectorAll('.view')) {
    view.hidden = view.id !== `view-${viewName}`;
  }
  // Nowy ekran zaczyna się od góry, a nie w miejscu przewinięcia poprzedniego.
  window.scrollTo(0, 0);
}

function setUpTabs() {
  document.querySelector('.tab-bar').addEventListener('click', (event) => {
    const tab = event.target.closest('.tab');
    if (tab) selectTab(tab.dataset.view);
  });
}

// ---------- Ekran Plan ----------

function splitParts(summary) {
  return {
    savings: summary.savings,
    investments: summary.investments,
    expenses: summary.expensesTotal,
    remaining: summary.remaining,
  };
}

function renderSplitBar(summary) {
  const parts = splitParts(summary);
  // Bez przychodu wszystkie części są zerowe; pokazujemy wtedy pusty (biały) pasek.
  if (summary.income === 0) parts.remaining = 1;

  for (const segment of document.querySelectorAll('.split-segment')) {
    const share = parts[segment.dataset.part];
    segment.hidden = share === 0;
    segment.style.setProperty('--share', share);
  }

  document.querySelector('#split-bar').setAttribute('aria-label', [
    `Oszczędności ${formatAmount(summary.savings)}`,
    `inwestycje ${formatAmount(summary.investments)}`,
    `wydatki ${formatAmount(summary.expensesTotal)}`,
    `zostało ${formatAmount(summary.remaining)}`,
  ].join(', '));
}

function renderSlider(slider, plan, amount, readOnly) {
  const percent = plan[SLIDER_FIELDS[slider]];
  const input = document.querySelector(`#${slider}-slider`);
  const text = `${percent}% · ${formatAmount(amount)}`;
  // W zamkniętym miesiącu zamiast suwaka zostaje sama wartość (SPEC §4.2).
  input.hidden = readOnly;
  input.value = percent;
  input.style.setProperty('--fill', percent / 100);
  input.setAttribute('aria-valuetext', text);
  document.querySelector(`#${slider}-value`).textContent = text;
}

function renderPlanView(readOnly) {
  const plan = currentPlan();
  document.querySelector('#closed-badge').hidden = !readOnly;
  document.querySelector('#plan-content').hidden = plan === null;
  if (!plan) return;

  const summary = calculateSummary(plan);
  document.querySelector('#remaining-amount').textContent = formatAmount(summary.remaining);
  renderSplitBar(summary);
  renderSlider('savings', plan, summary.savings, readOnly);
  renderSlider('investment', plan, summary.investments, readOnly);
}

// Na ekranie jest najwyżej jeden komunikat suwaka: ten, którego dotyczy ostatnia zmiana.
function showSliderError(slider, message) {
  for (const name of Object.keys(SLIDER_FIELDS)) {
    setMessage(document.querySelector(`#${name}-error`), name === slider ? message : null);
  }
}

// Podczas przesuwania tylko przeliczamy; zapis jest po puszczeniu suwaka (zdarzenie change).
function handleSliderInput(event) {
  if (refreshIfClosed()) return;
  const slider = event.target.dataset.slider;
  const plan = currentPlan();
  const { value, error } = clampSliderValue(plan, slider, Number(event.target.value));
  plan[SLIDER_FIELDS[slider]] = value;
  showSliderError(slider, error);
  // Zamknięty miesiąc wykluczyło refreshIfClosed, więc to nigdy nie jest tryb podglądu.
  renderPlanView(false);
}

function handleSliderChange(event) {
  if (refreshIfClosed()) return;
  if (saveOrRevert()) return;
  showSliderError(event.target.dataset.slider, MESSAGES.saveFailed);
  renderPlanView(false);
}

function setUpSliders() {
  for (const input of document.querySelectorAll('.slider')) {
    input.addEventListener('input', handleSliderInput);
    input.addEventListener('change', handleSliderChange);
  }
}

// ---------- Miesiąc bez planu ----------

// Tworzy plan wybranego miesiąca: kopię najnowszego wcześniejszego planu albo pusty (SPEC §3.3).
function createPlan(kind, showError) {
  if (refreshIfClosed()) return;
  const { months } = state.data;
  months[state.monthKey] = kind === 'copy'
    ? copyPlan(months[findCopySource(months, state.monthKey)])
    : createEmptyPlan();
  const saved = saveOrRevert();
  renderAll();
  if (!saved) {
    showError(MESSAGES.saveFailed);
    return;
  }
  // Karta z klikniętym przyciskiem zniknęła; fokus przechodzi na tytuł ekranu, żeby się nie zgubił.
  document.querySelector('.view:not([hidden]) .view-title').focus();
}

// Karta „Zaplanuj: [miesiąc]” albo napis „Brak planu” w zamkniętym miesiącu.
function createNoPlanCard(container) {
  const card = cloneTemplate('#no-plan-template');
  const part = (name) => card.querySelector(`[data-part="${name}"]`);
  const copyButton = card.querySelector('[data-create="copy"]');
  const error = part('error');
  const showError = (message) => setMessage(error, message);
  container.append(card);

  function render(readOnly) {
    container.hidden = currentPlan() !== null;
    showError(null);
    part('start').hidden = readOnly;
    part('closed').hidden = !readOnly;
    part('title').textContent = `Zaplanuj: ${monthName(state.monthKey)}`;
    // Bez wcześniejszego planu jest tylko „Zacznij od zera”.
    const source = findCopySource(state.data.months, state.monthKey);
    copyButton.hidden = source === null;
    copyButton.textContent = source ? `Skopiuj z: ${monthName(source)}` : '';
  }

  card.addEventListener('click', (event) => {
    const button = event.target.closest('[data-create]');
    if (button) createPlan(button.dataset.create, showError);
  });

  return { render };
}

// ---------- Ekrany Przychody i Wydatki ----------

const FIELDS = ['name', 'amount'];

// Komunikat trafia do elementu wskazanego przez aria-describedby pola,
// dzięki czemu czytnik ekranu przeczyta go razem z polem.
function showFieldError(input, message) {
  setMessage(document.getElementById(input.getAttribute('aria-describedby')), message);
  if (message === null) {
    input.removeAttribute('aria-invalid');
  } else {
    input.setAttribute('aria-invalid', 'true');
  }
}

// Wspólny komponent listy; section ma data-list="incomes" albo "expenses".
function createItemList(section) {
  const list = section.dataset.list;
  const part = (name) => section.querySelector(`[data-part="${name}"]`);
  const form = part('form');
  const itemsElement = part('items');
  // Wiersze niezmienionych pozycji używamy ponownie (zob. render).
  // Zamknięty miesiąc ma osobne wiersze, bez przycisków edycji i kosza.
  const rowsByItem = new WeakMap();
  const readOnlyRowsByItem = new WeakMap();
  // Edytowana pozycja: { id, li } albo null. Najwyżej jedna naraz.
  let editor = null;

  function findItem(id) {
    return currentPlan()[list].find((item) => item.id === id);
  }

  function findRow(id) {
    return [...itemsElement.children].find((li) => li.dataset.id === id);
  }

  function createRow(item) {
    const li = cloneTemplate('#item-template');
    const amount = formatAmount(item.amount);
    li.dataset.id = item.id;
    // Tekst użytkownika tylko przez textContent i atrybuty, nigdy przez innerHTML.
    li.querySelector('.item-name').textContent = item.name;
    li.querySelector('.item-amount').textContent = amount;
    li.querySelector('[data-action="edit"]').setAttribute('aria-label', `Edytuj: ${item.name}, ${amount}`);
    li.querySelector('[data-action="remove"]').setAttribute('aria-label', `Usuń: ${item.name}`);
    return li;
  }

  function createReadOnlyRow(item) {
    const li = cloneTemplate('#item-readonly-template');
    li.querySelector('.item-name').textContent = item.name;
    li.querySelector('.item-amount').textContent = formatAmount(item.amount);
    return li;
  }

  function cachedRow(cache, item, create) {
    let li = cache.get(item);
    if (!li) {
      li = create(item);
      cache.set(item, li);
    }
    return li;
  }

  function rowFor(item, readOnly) {
    if (readOnly) return cachedRow(readOnlyRowsByItem, item, createReadOnlyRow);
    if (editor?.id === item.id) return editor.li;
    const li = cachedRow(rowsByItem, item, createRow);
    setMessage(li.querySelector('.item-error'), null);
    return li;
  }

  function render(readOnly) {
    const plan = currentPlan();
    part('content').hidden = plan === null;
    // Miesiąc mógł się zamknąć w trakcie edycji (aplikacja otwarta po północy).
    if (!plan || readOnly) editor = null;
    if (!plan) return;
    form.hidden = readOnly;
    const rows = plan[list].map((item) => rowFor(item, readOnly));
    // Wiersze już stojące na swoim miejscu zostają nietknięte: przeniesienie wiersza
    // między wciśnięciem a puszczeniem palca zgubiłoby dotknięcie.
    const keep = new Set(rows);
    for (const child of [...itemsElement.children]) {
      if (!keep.has(child)) child.remove();
    }
    rows.forEach((row, index) => {
      const current = itemsElement.children[index];
      if (current !== row) itemsElement.insertBefore(row, current ?? null);
    });
    part('empty').hidden = rows.length > 0;
    part('total').textContent = formatAmount(sumAmounts(plan[list]));
  }

  // Komunikat pod pozycją na liście (np. odrzucone usunięcie, SPEC §3.4).
  function showItemError(id, message) {
    setMessage(findRow(id).querySelector('.item-error'), message);
  }

  function focusRow(id) {
    findRow(id)?.querySelector('[data-action="edit"]').focus();
  }

  // Zapisuje nowy plan i odświeża ekrany. Zwraca false, gdy zapis się nie udał
  // (wtedy saveOrRevert przywrócił poprzednie dane).
  function applyPlan(nextPlan) {
    state.data.months[state.monthKey] = nextPlan;
    const saved = saveOrRevert();
    renderAll();
    return saved;
  }

  // ----- Dodawanie -----

  function handleSubmit(event) {
    event.preventDefault();
    if (refreshIfClosed()) return;
    const { name, amount } = form.elements;
    const formError = part('form-error');
    setMessage(formError, null);

    const result = addItem(currentPlan(), list, crypto.randomUUID(), name.value, amount.value);
    showFieldError(name, result.ok ? null : result.errors.name);
    showFieldError(amount, result.ok ? null : result.errors.amount);
    if (!result.ok) return;

    if (!applyPlan(result.value)) {
      setMessage(formError, MESSAGES.saveFailed);
      return;
    }
    form.reset();
    // Kursor wraca do nazwy, żeby od razu dopisać kolejną pozycję.
    name.focus();
  }

  // ----- Edycja w miejscu -----

  function editorInputs() {
    return Object.fromEntries(FIELDS.map((field) => [field, editor.li.querySelector(`input[data-field="${field}"]`)]));
  }

  function createEditor(item) {
    const li = cloneTemplate('#item-editor-template');
    li.dataset.id = item.id;
    for (const field of FIELDS) {
      // Najwyżej jedna edycja na listę, więc stałe id na listę są unikalne na stronie.
      const inputId = `${list}-edit-${field}`;
      const [label, input, error] = li.querySelectorAll(`[data-field="${field}"]`);
      label.htmlFor = inputId;
      input.id = inputId;
      error.id = `${inputId}-error`;
      input.setAttribute('aria-describedby', error.id);
    }
    li.querySelector('input[data-field="name"]').value = item.name;
    li.querySelector('input[data-field="amount"]').value = amountToInputText(item.amount);
    return li;
  }

  function startEdit(id) {
    const li = createEditor(findItem(id));
    findRow(id).replaceWith(li);
    editor = { id, li };
    li.querySelector('input').focus();
  }

  function cancelEdit() {
    editor = null;
    render(false);
  }

  // Zwraca 'invalid', gdy wartość jest niepoprawna (edycja zostaje w polu z komunikatem),
  // 'failed', gdy nie udało się zapisać (komunikat pod pozycją), albo 'done'.
  function saveEdit() {
    // renderAll w zamkniętym miesiącu kończy edycję bez zapisu.
    if (refreshIfClosed()) return 'done';
    const { id } = editor;
    const inputs = editorInputs();
    const result = updateItem(currentPlan(), list, id, inputs.name.value, inputs.amount.value);
    for (const field of FIELDS) {
      showFieldError(inputs[field], result.ok ? null : result.errors[field]);
    }
    if (!result.ok) return 'invalid';

    const before = findItem(id);
    const after = result.value[list].find((item) => item.id === id);
    editor = null;
    // Bez zmian nie ma czego zapisywać.
    if (before.name === after.name && before.amount === after.amount) {
      render(false);
      return 'done';
    }
    if (applyPlan(result.value)) return 'done';
    showItemError(id, MESSAGES.saveFailed);
    return 'failed';
  }

  function handleEditorKeydown(event) {
    if (!editor || !editor.li.contains(event.target)) return;
    if (event.key !== 'Enter' && event.key !== 'Escape') return;
    event.preventDefault();
    const { id } = editor;
    if (event.key === 'Escape') {
      cancelEdit();
    } else if (saveEdit() === 'invalid') {
      return;
    }
    // Fokus wraca na pozycję, żeby nie zniknął razem z polami.
    focusRow(id);
  }

  // Wyjście z pola zapisuje edycję, ale przejście z „Nazwy” do „Kwoty” nie.
  // Sprawdzamy to po chwili, bo w trakcie focusout fokus nie jest jeszcze na nowym miejscu.
  // Porównanie z current chroni przed drugim zapisem, gdy Enter albo Escape już zakończyły edycję.
  function handleEditorFocusOut(event) {
    if (!editor || !editor.li.contains(event.target)) return;
    const current = editor;
    setTimeout(() => {
      if (editor === current && !current.li.contains(document.activeElement)) saveEdit();
    }, 0);
  }

  // ----- Usuwanie -----

  function handleRemove(id) {
    const result = removeItem(currentPlan(), list, id);
    if (!result.ok) {
      render(false);
      showItemError(id, result.error);
      return;
    }
    if (!applyPlan(result.value)) showItemError(id, MESSAGES.saveFailed);
  }

  function handleItemClick(event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    if (refreshIfClosed()) return;
    const { id } = button.closest('.item').dataset;
    // Trwającą edycję kończymy tutaj (fokus został w polu, zob. handleItemMouseDown).
    // Niepoprawną wartość trzeba najpierw poprawić (SPEC §4.3).
    if (editor && saveEdit() === 'invalid') return;
    if (button.dataset.action === 'edit') startEdit(id);
    if (button.dataset.action === 'remove') handleRemove(id);
  }

  // Fokus przechodzi na przycisk już przy wciśnięciu, a click przychodzi dopiero po puszczeniu.
  // Zapis z handleEditorFocusOut zdążyłby się wykonać w międzyczasie: edytor zamieniłby się
  // w niższy wiersz, pozycje poniżej przesunęłyby się w górę i kliknięcie by przepadło.
  // Dlatego w trakcie edycji wciśnięcie przycisku pozycji nie zabiera fokusu z pola.
  function handleItemMouseDown(event) {
    if (editor && event.target.closest('[data-action]')) event.preventDefault();
  }

  // Wpisywanie w pole chowa jego komunikat; przy zapisie sprawdzamy wartość od nowa.
  function handleInput(event) {
    if (event.target.matches('.field-input')) showFieldError(event.target, null);
  }

  // Kończy trwającą edycję przed zmianą miesiąca. Zwraca false, gdy wartość jest niepoprawna.
  // Na ukrytej zakładce może zostać tylko niepoprawna edycja (poprawną zapisało wyjście
  // z pola przy zmianie zakładki). Jej komunikatu nie widać, więc nie blokuje zmiany
  // miesiąca, tylko przepada jak po Escape (zob. reset).
  // Po nieudanym zapisie też zostajemy, żeby komunikat pod pozycją nie zniknął razem z miesiącem.
  function finishEdit() {
    if (editor === null || section.hidden) return true;
    const { id } = editor;
    const result = saveEdit();
    // Pola edycji zniknęły razem z fokusem; wraca on na pozycję z komunikatem.
    if (result === 'failed') focusRow(id);
    return result === 'done';
  }

  function isEditing() {
    return editor !== null;
  }

  function reset() {
    editor = null;
    form.reset();
    for (const input of form.querySelectorAll('.field-input')) showFieldError(input, null);
    setMessage(part('form-error'), null);
  }

  form.addEventListener('submit', handleSubmit);
  section.addEventListener('input', handleInput);
  itemsElement.addEventListener('mousedown', handleItemMouseDown);
  itemsElement.addEventListener('click', handleItemClick);
  itemsElement.addEventListener('keydown', handleEditorKeydown);
  itemsElement.addEventListener('focusout', handleEditorFocusOut);

  return { render, finishEdit, isEditing, reset };
}

const noPlanCards = [...document.querySelectorAll('[data-no-plan]')].map(createNoPlanCard);
const itemLists = [...document.querySelectorAll('[data-list]')].map(createItemList);

// ---------- Okno potwierdzenia ----------

// Funkcja, która przekazuje decyzję z otwartego okna, albo null, gdy okno nie czeka na decyzję.
let resolveConfirm = null;

function finishConfirm(confirmed) {
  const resolve = resolveConfirm;
  resolveConfirm = null;
  resolve?.(confirmed);
}

// Pokazuje wspólne okno potwierdzenia i czeka na decyzję. Zwraca true tylko po wybraniu
// przycisku skutku; „Anuluj”, Escape i zamknięcie okna w inny sposób dają false.
function confirmAction({ title, text, confirmLabel }) {
  // Pytanie, na które nikt nie odpowiedział, nie może „zatwierdzić się” później.
  finishConfirm(false);
  document.querySelector('#confirm-title').textContent = title;
  document.querySelector('#confirm-text').textContent = text;
  document.querySelector('#confirm-button').textContent = confirmLabel;
  document.querySelector('#confirm-dialog').showModal();
  return new Promise((resolve) => {
    resolveConfirm = resolve;
  });
}

// Decyzję bierzemy z kliknięcia przycisku (submit przychodzi od razu i wiadomo, który
// przycisk wybrano), a nie ze zdarzenia close: przeglądarka wysyła je z opóźnieniem,
// a w testach zdarzało się, że przyszło dopiero przy następnym kliknięciu na stronie
// i rozstrzygało wtedy niewłaściwe pytanie.
function setUpConfirmDialog() {
  const dialog = document.querySelector('#confirm-dialog');
  dialog.querySelector('form').addEventListener('submit', (event) => {
    // Okno zamykamy sami, zanim przekażemy decyzję: zamknięcie oddaje fokus
    // na przycisk, który je otworzył, a skutek decyzji może ten fokus jeszcze przenieść.
    event.preventDefault();
    dialog.close();
    finishConfirm(event.submitter?.value === 'confirm');
  });
  dialog.addEventListener('cancel', () => finishConfirm(false));
}

// ---------- Ekran Więcej ----------

function showBackupMessages(error, status) {
  setMessage(document.querySelector('#backup-error'), error);
  setMessage(document.querySelector('#backup-status'), status);
}

function showDeletePlanError(message) {
  setMessage(document.querySelector('#delete-plan-error'), message);
}

// Komunikaty i otwarte edycje dotyczą wybranego miesiąca; po jego zmianie albo
// podmianie danych byłyby nieaktualne.
function resetMonthMessages() {
  for (const itemList of itemLists) itemList.reset();
  showSliderError(null, null);
  showDeletePlanError(null);
}

// Odnośnik do pliku w pamięci przeglądarki: plik powstaje na urządzeniu i nigdzie nie jest wysyłany.
function handleExport() {
  showBackupMessages(null, null);
  const { fileName, content } = buildExportFile(state.data, new Date());
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Pobieranie startuje w tle; zbyt wczesne zwolnienie odnośnika potrafi je przerwać (np. w Firefoksie).
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function handleImportClick() {
  showBackupMessages(null, null);
  const input = document.querySelector('#import-file');
  // Bez wyczyszczenia ponowny wybór tego samego pliku nie wywołałby zdarzenia change.
  input.value = '';
  input.click();
}

async function readFileText(file) {
  try {
    return await file.text();
  } catch {
    return null;
  }
}

// Najpierw sprawdzamy plik, potem pytamy: błędny plik nie wymaga potwierdzenia,
// bo i tak niczego nie zmieni (SPEC §4.4).
async function handleImportFile(event) {
  const [file] = event.target.files;
  if (!file) return;
  const text = await readFileText(file);
  const result = text === null ? { ok: false, error: MESSAGES.importInvalid } : readImportFile(text);
  if (!result.ok) {
    showBackupMessages(result.error, null);
    return;
  }

  const confirmed = await confirmAction({
    title: 'Zastąpić dane?',
    text: 'Wszystkie obecne plany zostaną zastąpione danymi z pliku. Tego nie da się cofnąć.',
    confirmLabel: 'Zastąp dane',
  });
  if (!confirmed) return;
  if (!saveData(result.value)) {
    showBackupMessages(MESSAGES.importSaveFailed, null);
    return;
  }

  state.data = result.value;
  state.savedData = structuredClone(result.value);
  // Wybrany miesiąc mógł w nowych danych stracić sens (np. zamknięty miesiąc bez planu
  // starszy niż wszystkie wczytane), więc zaczynamy od bieżącego, jak po otwarciu aplikacji.
  state.monthKey = monthKeyFromDate(new Date());
  resetMonthMessages();
  renderAll();
  showBackupMessages(null, MESSAGES.importDone);
}

function renderMoreView(today) {
  const allowed = canDeletePlan(state.monthKey, state.data.months, today);
  const button = document.querySelector('#delete-plan-button');
  button.textContent = `Usuń plan: ${monthName(state.monthKey)}`;
  button.disabled = !allowed;
  document.querySelector('#delete-plan-hint').hidden = allowed;
}

async function handleDeletePlan() {
  showDeletePlanError(null);
  const key = state.monthKey;
  const confirmed = await confirmAction({
    title: `Usunąć plan: ${monthName(key)}?`,
    text: 'Przychody, procenty i wydatki z tego miesiąca zostaną usunięte. Tego nie da się cofnąć.',
    confirmLabel: 'Usuń plan',
  });
  // Gdy okno było otwarte, mogła minąć północ i miesiąc mógł się zamknąć.
  if (!confirmed || !canDeletePlan(key, state.data.months, new Date())) {
    renderAll();
    return;
  }

  delete state.data.months[key];
  const saved = saveOrRevert();
  resetMonthMessages();
  renderAll();
  if (!saved) {
    showDeletePlanError(MESSAGES.saveFailed);
    return;
  }
  // Przycisk stał się nieaktywny i stracił fokus; przenosimy go na tytuł ekranu.
  document.querySelector('#view-more-title').focus();
}

function setUpMoreView() {
  document.querySelector('#export-button').addEventListener('click', handleExport);
  document.querySelector('#import-button').addEventListener('click', handleImportClick);
  document.querySelector('#import-file').addEventListener('change', handleImportFile);
  document.querySelector('#delete-plan-button').addEventListener('click', handleDeletePlan);
}

// Status miesiąca liczymy przy każdym odświeżeniu, a nie raz przy starcie:
// aplikacja otwarta przez noc ma sama zamknąć miesiąc 1. dnia kolejnego (SPEC §3.2).
function renderAll() {
  const today = new Date();
  // Po cofnięciu zegara w urządzeniu wybrany miesiąc mógł stać się niedostępny.
  if (getMonthStatus(state.monthKey, today) === 'unavailable') state.monthKey = monthKeyFromDate(today);
  const readOnly = getMonthStatus(state.monthKey, today) === 'closed';
  // Według tego atrybutu CSS przygasza treść kart zamkniętego miesiąca.
  document.querySelector('main').dataset.monthStatus = readOnly ? 'closed' : 'open';

  renderHeader(today);
  renderPlanView(readOnly);
  for (const card of noPlanCards) card.render(readOnly);
  for (const itemList of itemLists) itemList.render(readOnly);
  renderMoreView(today);
}

// Bez service workera aplikacja działa normalnie, tylko nie offline — stąd sprawdzenie.
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Karta widoczna przez całą noc nie dostaje visibilitychange, więc początek miesiąca
// sprawdza też minutnik. setTimeout nie przyjmuje opóźnień dłuższych niż ok. 24 dni,
// dlatego czekamy najwyżej dobę naraz. Uśpiony komputer może minutnik opóźnić;
// wtedy przed zapisem i tak chroni refreshIfClosed.
function scheduleMonthStart() {
  const now = new Date();
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  setTimeout(() => {
    if (new Date() >= nextMonthStart) renderAll();
    scheduleMonthStart();
  }, Math.min(nextMonthStart - now, DAY_MS));
}

setUpTabs();
setUpMonthArrows();
setUpSliders();
setUpConfirmDialog();
setUpMoreView();
// Telefon może trzymać aplikację w tle wiele dni; po powrocie odświeżamy status miesięcy.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) renderAll();
});
scheduleMonthStart();
renderAll();
registerServiceWorker();
