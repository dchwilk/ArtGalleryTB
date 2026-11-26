// Menu state and focus only; no slideshow or remote key handling here.
let menuTabIndex = 0;
let menuItemIndex = 0;
let menuRemoteActivation = null;
let menuActivationClickAllowed = false;

function activateMenuControl(control) {
  menuRemoteActivation = { element: control, time: Date.now() };
  menuActivationClickAllowed = true;
  try { control.click(); } finally { menuActivationClickAllowed = false; }
}

function isMenuOpen() {
  return menu.style.display === 'flex';
}

function isSmallLayout() {
  return window.matchMedia('(max-width: 1280px)').matches;
}

function menuItems() {
  return [...document.querySelector('.menu-section.active').querySelectorAll('input:not([hidden]):not(:disabled), button:not(:disabled), select:not(:disabled), [tabindex="0"]'), document.getElementById('applySettingsButton')];
}

function switchTab(tabName) {
  const tabs = document.querySelectorAll('.menu-tab');
  tabs.forEach((tab, index) => {
    const active = tab.dataset.tab === tabName;
    tab.classList.toggle('active', active);
    if (active) menuTabIndex = index;
  });
  document.querySelectorAll('.menu-section').forEach(section => {
    section.classList.toggle('active', section.id === tabName);
  });
  menuItemIndex = 0;
}

function focusCurrentTab() {
  document.querySelectorAll('.menu-tab')[menuTabIndex].focus();
}

function focusCurrentMenuItem() {
  const items = menuItems();
  menuItemIndex = Math.max(0, Math.min(menuItemIndex, items.length - 1));
  if (items.length) items[menuItemIndex].focus();
  else focusCurrentTab();
}

function navigateTabs(step) {
  const tabs = document.querySelectorAll('.menu-tab');
  const index = Math.max(0, Math.min(tabs.length - 1, menuTabIndex + step));
  switchTab(tabs[index].dataset.tab);
  focusCurrentTab();
}

function navigateContent(action) {
  const focused = document.activeElement;
  const footer = document.getElementById('applySettingsButton');
  const content = menuItems().filter(element => element !== footer);
  if (focused === footer && action === 'up') {
    if (content.length) content[content.length - 1].focus();
    return;
  }
  const rect = focused.getBoundingClientRect();
  const x = rect.left + (focused.classList.contains('checkbox-control') ? Math.min(20, rect.width / 2) : rect.width / 2);
  const y = rect.top + rect.height / 2;
  const horizontal = action === 'left' || action === 'right';
  let candidates = Array.from(menuItems()).filter(element => element !== focused).map(element => {
    const box = element.getBoundingClientRect();
    return { element, box, dx: box.left + box.width / 2 - x, dy: box.top + box.height / 2 - y };
  }).filter(item => {
    if (horizontal) return item.box.top < rect.bottom && item.box.bottom > rect.top
      && (action === 'left' ? item.dx < -2 : item.dx > 2);
    return action === 'up' ? item.dy < -2 : item.dy > 2;
  });
  // The fixed footer must not intercept Down before offscreen content rows.
  if (!horizontal && candidates.some(item => item.element !== footer)) {
    candidates = candidates.filter(item => item.element !== footer);
  }
  candidates.sort((a, b) => horizontal ? Math.abs(a.dx) - Math.abs(b.dx)
    : (Math.abs(a.dy) * 10 + Math.abs(a.dx)) - (Math.abs(b.dy) * 10 + Math.abs(b.dx)));
  if (candidates.length) candidates[0].element.focus();
  else if (action === 'left' || (isSmallLayout() && action === 'up')) focusCurrentTab();
}

function handleMenuNavigation(action) {
  if (action === 'menu') { closeMenu(); return; }
  const focused = document.activeElement;
  const onTab = focused && focused.classList.contains('menu-tab');
  const horizontal = isSmallLayout();
  if (focused?.type === 'range' && (action === 'left' || action === 'right')) {
    if (action === 'left') focused.stepDown();
    else focused.stepUp();
    focused.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  if (action === 'ok') {
    // Tabs are buttons too: handle them before ordinary button activation.
    if (onTab) {
      switchTab(focused.dataset.tab);
      focusCurrentMenuItem();
    } else if (focused?.type === 'checkbox' && !focused.disabled) {
      // Tizen engines do not consistently activate checkboxes through click().
      focused.checked = !focused.checked;
      focused.dispatchEvent(new Event('input', { bubbles: true }));
      focused.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (focused && menu.contains(focused) && typeof focused.click === 'function') {
      activateMenuControl(focused);
    }
  } else if (onTab) {
    if (horizontal && (action === 'left' || action === 'right')) {
      navigateTabs(action === 'left' ? -1 : 1);
    } else if (!horizontal && (action === 'up' || action === 'down')) {
      navigateTabs(action === 'up' ? -1 : 1);
    } else if ((horizontal && action === 'down') || (!horizontal && action === 'right')) {
      focusCurrentMenuItem();
    }
  } else if (['left', 'right', 'up', 'down'].indexOf(action) >= 0) {
    navigateContent(action);
  }
}

function toggleMenu() {
  if (isMenuOpen()) { closeMenu(); return; }
  infoHoldStart = null;
  menu.style.display = 'flex';
  switchTab(document.querySelectorAll('.menu-tab')[menuTabIndex].dataset.tab);
  focusCurrentTab();
}

function closeMenu(forceReload = false) {
  const changed = appliedSelectionKey !== collectionSelectionKey();
  saveSettings();
  infoHoldStart = null;
  if (menu.contains(document.activeElement)) document.activeElement.blur();
  menu.style.display = 'none';
  if (changed || forceReload) loadAllArtworks();
}

function applyFiltersAndReload() {
  closeMenu(true);
}

function initMenuNavigation() {
  // Some TV engines deliver a separate activation click after the handled Enter.
  // Allow our synchronous click once; ignore only the following zero-detail
  // activation clicks on that same control. Real pointer clicks keep working.
  menu.addEventListener('click', event => {
    const control = event.target.closest('button');
    if (event.detail === 0 && menuRemoteActivation?.element === control
      && Date.now() - menuRemoteActivation.time < 700 && !menuActivationClickAllowed) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  document.querySelectorAll('.menu-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    tab.addEventListener('focus', () => {
      if (!tab.classList.contains('active')) switchTab(tab.dataset.tab);
    });
  });
  // Keep indices in sync when a mouse or keyboard changes the focus.
  menu.addEventListener('focusin', event => {
    const index = Array.from(menuItems()).indexOf(event.target);
    if (index >= 0) menuItemIndex = index;
    if (index >= 0) event.target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
}
