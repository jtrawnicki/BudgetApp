// Ekrany i obsługa interfejsu.

import {
  MESSAGES,
  SLIDER_FIELDS,
  addItem,
  addMonths,
  amountToInputText,
  calculateSummary,
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
import { loadData, saveData } from './storage.js';

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

function cloneTemplate(selector) {
  return document.querySelector(selector).content.firstElementChild.cloneNode(true);
}

// ---------- Nagłówek i zakładki ----------

function renderHeader(today) {
  document.querySelector('#month-name').textContent = monthName(state.monthKey);
  document.querySelector('#previous-month').disabled = !canGoPrevious(state.monthKey, state.data.months, today);
  document.querySelector('#next-month').disabled = !canGoNext(state.monthKey, today);
}

function goToMonth(offset) {
  // Trwającą edycję zapisujemy w miesiącu, którego dotyczy. Niepoprawną wartość
  // trzeba najpierw poprawić (SPEC §4.3), więc wtedy zostajemy na miejscu.
  if (!itemLists.every((itemList) => itemList.finishEdit())) return;
  state.monthKey = addMonths(state.monthKey, offset);
  // Komunikaty i niedokończony formularz dotyczyły poprzedniego miesiąca.
  for (const itemList of itemLists) itemList.reset();
  showSliderError(null, null);
  renderAll();
}

function setUpMonthArrows() {
  document.querySelector('#previous-month').addEventListener('click', () => goToMonth(-1));
  document.querySelector('#next-month').addEventListener('click', () => goToMonth(1));
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
    const error = document.querySelector(`#${name}-error`);
    const visible = name === slider && message !== null;
    error.hidden = !visible;
    error.textContent = visible ? message : '';
  }
}

// Podczas przesuwania tylko przeliczamy; zapis jest po puszczeniu suwaka (zdarzenie change).
function handleSliderInput(event) {
  const slider = event.target.dataset.slider;
  const plan = currentPlan();
  const { value, error } = clampSliderValue(plan, slider, Number(event.target.value));
  plan[SLIDER_FIELDS[slider]] = value;
  showSliderError(slider, error);
  // Suwaki są tylko w bieżącym i następnym miesiącu, więc to nigdy nie jest tryb podglądu.
  renderPlanView(false);
}

function handleSliderChange(event) {
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
  container.append(card);

  function showError(message) {
    error.hidden = false;
    error.textContent = message;
  }

  function render(readOnly) {
    container.hidden = currentPlan() !== null;
    error.hidden = true;
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
  const error = document.getElementById(input.getAttribute('aria-describedby'));
  error.hidden = message === null;
  error.textContent = message ?? '';
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
    li.querySelector('.item-error').hidden = true;
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
    const error = findRow(id).querySelector('.item-error');
    error.hidden = false;
    error.textContent = message;
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
    const { name, amount } = form.elements;
    const formError = part('form-error');
    formError.hidden = true;

    const result = addItem(currentPlan(), list, crypto.randomUUID(), name.value, amount.value);
    showFieldError(name, result.ok ? null : result.errors.name);
    showFieldError(amount, result.ok ? null : result.errors.amount);
    if (!result.ok) return;

    if (!applyPlan(result.value)) {
      formError.hidden = false;
      formError.textContent = MESSAGES.saveFailed;
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
    const { id } = editor;
    editor = null;
    render(false);
    return id;
  }

  // Zwraca id pozycji, gdy edycja się zakończyła, albo null, gdy wartość jest niepoprawna
  // (wtedy zostaje w polu z komunikatem).
  function saveEdit() {
    const { id } = editor;
    const inputs = editorInputs();
    const result = updateItem(currentPlan(), list, id, inputs.name.value, inputs.amount.value);
    for (const field of FIELDS) {
      showFieldError(inputs[field], result.ok ? null : result.errors[field]);
    }
    if (!result.ok) return null;

    const before = findItem(id);
    const after = result.value[list].find((item) => item.id === id);
    editor = null;
    // Bez zmian nie ma czego zapisywać.
    if (before.name === after.name && before.amount === after.amount) {
      render(false);
      return id;
    }
    if (!applyPlan(result.value)) showItemError(id, MESSAGES.saveFailed);
    return id;
  }

  function handleEditorKeydown(event) {
    if (!editor || !editor.li.contains(event.target)) return;
    if (event.key !== 'Enter' && event.key !== 'Escape') return;
    event.preventDefault();
    const id = event.key === 'Enter' ? saveEdit() : cancelEdit();
    // Fokus wraca na pozycję, żeby nie zniknął razem z polami.
    if (id) focusRow(id);
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
    const { id } = button.closest('.item').dataset;
    // Trwającą edycję kończymy tutaj (fokus został w polu, zob. handleItemMouseDown).
    // Niepoprawną wartość trzeba najpierw poprawić (SPEC §4.3).
    if (editor && saveEdit() === null) return;
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
  function finishEdit() {
    return editor === null || section.hidden || saveEdit() !== null;
  }

  function reset() {
    editor = null;
    form.reset();
    for (const input of form.querySelectorAll('.field-input')) showFieldError(input, null);
    part('form-error').hidden = true;
  }

  form.addEventListener('submit', handleSubmit);
  section.addEventListener('input', handleInput);
  itemsElement.addEventListener('mousedown', handleItemMouseDown);
  itemsElement.addEventListener('click', handleItemClick);
  itemsElement.addEventListener('keydown', handleEditorKeydown);
  itemsElement.addEventListener('focusout', handleEditorFocusOut);

  return { render, finishEdit, reset };
}

const noPlanCards = [...document.querySelectorAll('[data-no-plan]')].map(createNoPlanCard);
const itemLists = [...document.querySelectorAll('[data-list]')].map(createItemList);

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
}

setUpTabs();
setUpMonthArrows();
setUpSliders();
// Telefon może trzymać aplikację w tle wiele dni; po powrocie odświeżamy status miesięcy.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) renderAll();
});
renderAll();
