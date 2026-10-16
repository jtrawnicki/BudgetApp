// Ekrany i obsługa interfejsu.

import {
  MESSAGES,
  SLIDER_FIELDS,
  calculateSummary,
  clampSliderValue,
  formatAmount,
  monthKeyFromDate,
  monthName,
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

showMonth(state.monthKey);
setUpTabs();
setUpSliders();
renderPlanView();
