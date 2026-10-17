// Ekrany i obsługa interfejsu.

import {
  MESSAGES,
  SLIDER_FIELDS,
  addItem,
  amountToInputText,
  calculateSummary,
  clampSliderValue,
  formatAmount,
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

// ---------- Nagłówek i zakładki ----------

function showMonth(key) {
  document.querySelector('#month-name').textContent = monthName(key);
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

function renderSlider(slider, plan, amount) {
  const percent = plan[SLIDER_FIELDS[slider]];
  const input = document.querySelector(`#${slider}-slider`);
  const text = `${percent}% · ${formatAmount(amount)}`;
  input.value = percent;
  input.style.setProperty('--fill', percent / 100);
  input.setAttribute('aria-valuetext', text);
  document.querySelector(`#${slider}-value`).textContent = text;
}

function renderPlanView() {
  const plan = currentPlan();
  document.querySelector('#plan-empty').hidden = plan !== null;
  document.querySelector('#plan-content').hidden = plan === null;
  if (!plan) return;

  const summary = calculateSummary(plan);
  document.querySelector('#remaining-amount').textContent = formatAmount(summary.remaining);
  renderSplitBar(summary);
  renderSlider('savings', plan, summary.savings);
  renderSlider('investment', plan, summary.investments);
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
  renderPlanView();
}

function handleSliderChange(event) {
  if (saveOrRevert()) return;
  showSliderError(event.target.dataset.slider, MESSAGES.saveFailed);
  renderPlanView();
}

function setUpSliders() {
  for (const input of document.querySelectorAll('.slider')) {
    input.addEventListener('input', handleSliderInput);
    input.addEventListener('change', handleSliderChange);
  }
}

// ---------- Ekrany Przychody i Wydatki ----------

const FIELDS = ['name', 'amount'];

function cloneTemplate(selector) {
  return document.querySelector(selector).content.firstElementChild.cloneNode(true);
}

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
  const rowsByItem = new WeakMap();
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

  function rowFor(item) {
    if (editor?.id === item.id) return editor.li;
    let li = rowsByItem.get(item);
    if (li) {
      li.querySelector('.item-error').hidden = true;
    } else {
      li = createRow(item);
      rowsByItem.set(item, li);
    }
    return li;
  }

  function render() {
    const plan = currentPlan();
    part('no-plan').hidden = plan !== null;
    part('content').hidden = plan === null;
    if (!plan) {
      editor = null;
      return;
    }
    const rows = plan[list].map(rowFor);
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
    render();
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
      render();
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
      render();
      showItemError(id, result.error);
      return;
    }
    if (!applyPlan(result.value)) showItemError(id, MESSAGES.saveFailed);
  }

  function handleItemClick(event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const { id } = button.closest('.item').dataset;
    // Na telefonie kliknięcie przychodzi tuż po focusout, zanim zapis z handleEditorFocusOut
    // zdąży się wykonać, więc trwającą edycję kończymy tutaj. Niepoprawną wartość trzeba
    // najpierw poprawić (SPEC §4.3).
    if (editor && saveEdit() === null) return;
    if (button.dataset.action === 'edit') startEdit(id);
    if (button.dataset.action === 'remove') handleRemove(id);
  }

  // Wpisywanie w pole chowa jego komunikat; przy zapisie sprawdzamy wartość od nowa.
  function handleInput(event) {
    if (event.target.matches('.field-input')) showFieldError(event.target, null);
  }

  form.addEventListener('submit', handleSubmit);
  section.addEventListener('input', handleInput);
  itemsElement.addEventListener('click', handleItemClick);
  itemsElement.addEventListener('keydown', handleEditorKeydown);
  itemsElement.addEventListener('focusout', handleEditorFocusOut);

  return { render };
}

const itemLists = [...document.querySelectorAll('[data-list]')].map(createItemList);

function renderAll() {
  renderPlanView();
  for (const itemList of itemLists) itemList.render();
}

showMonth(state.monthKey);
setUpTabs();
setUpSliders();
renderAll();
