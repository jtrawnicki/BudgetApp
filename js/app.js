// Ekrany i obsługa interfejsu.

import { monthKeyFromDate, monthName } from './budget.js';

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

showMonth(monthKeyFromDate(new Date()));
setUpTabs();
