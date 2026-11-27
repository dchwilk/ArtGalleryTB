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
  return Array.from(document.querySelector('.menu-section.active').querySelectorAll('input:not([hidden]):not(:disabled), button:not(:disabled), select:not(:disabled), [tabindex="0"]'));
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
  const items = Array.from(document.querySelectorAll(isSmallLayout() ? '.menu-tab' : '.menu-sidebar button'));
  const current = items.indexOf(document.activeElement);
  const index = Math.max(0, Math.min(items.length - 1, (current < 0 ? menuTabIndex : current) + step));
  const target = items[index];
  if (target.dataset.tab) switchTab(target.dataset.tab);
  target.focus();
}

function navigateContent(action) {
  const focused = document.activeElement;
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
  candidates.sort((a, b) => horizontal ? Math.abs(a.dx) - Math.abs(b.dx)
    : (Math.abs(a.dy) * 10 + Math.abs(a.dx)) - (Math.abs(b.dy) * 10 + Math.abs(b.dx)));
  if (candidates.length) candidates[0].element.focus();
  else if (action === 'left') focusCurrentTab();
  else if (action === 'down' || (isSmallLayout() && action === 'up')) document.getElementById('applySettingsButton').focus();
}

function handleMenuNavigation(action) {
  if (action === 'menu') { closeMenu(); return; }
  const focused = document.activeElement;
  const onTab = focused && focused.classList.contains('menu-tab');
  const onSidebar = focused && focused.closest('.menu-sidebar');
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
  } else if (onSidebar) {
    if (horizontal && !onTab) {
      if (action === 'up') focusCurrentTab();
      else if (action === 'down') focusCurrentMenuItem();
      else if (action === 'left' || action === 'right') {
        const actions = Array.from(document.querySelectorAll('.sidebar-action'));
        const index = Math.max(0, Math.min(actions.length - 1, actions.indexOf(focused) + (action === 'left' ? -1 : 1)));
        actions[index].focus();
      }
    } else if (horizontal && (action === 'left' || action === 'right')) {
      navigateTabs(action === 'left' ? -1 : 1);
    } else if (!horizontal && (action === 'up' || action === 'down')) {
      navigateTabs(action === 'up' ? -1 : 1);
    } else if (horizontal && action === 'down') {
      document.getElementById('applySettingsButton').focus();
    } else if (!horizontal && action === 'right') {
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
    if (index >= 0 || event.target.closest('.menu-sidebar')) event.target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
}
