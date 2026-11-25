// Menu state and focus only; no slideshow or remote key handling here.
let menuTabIndex = 0;
let menuItemIndex = 0;

function isMenuOpen() {
  return menu.style.display === 'flex';
}

function isSmallLayout() {
  return window.matchMedia('(max-width: 1280px)').matches;
}

function menuItems() {
  return document.querySelector('.menu-section.active').querySelectorAll('input:not(:disabled), button:not(:disabled), select:not(:disabled)');
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

function handleMenuNavigation(action) {
  if (action === 'menu') { closeMenu(); return; }
  const focused = document.activeElement;
  const onTab = focused && focused.classList.contains('menu-tab');
  const horizontal = isSmallLayout();
  if (action === 'ok') {
    // Tabs are buttons too: handle them before ordinary button activation.
    if (onTab) {
      switchTab(focused.dataset.tab);
      focusCurrentMenuItem();
    } else if (focused && menu.contains(focused) && typeof focused.click === 'function') {
      focused.click(); // Native checkbox activation emits input/change exactly once.
    }
  } else if (onTab) {
    if (horizontal && (action === 'left' || action === 'right')) {
      navigateTabs(action === 'left' ? -1 : 1);
    } else if (!horizontal && (action === 'up' || action === 'down')) {
      navigateTabs(action === 'up' ? -1 : 1);
    } else if ((horizontal && action === 'down') || (!horizontal && action === 'right')) {
      focusCurrentMenuItem();
    }
  } else if (action === 'left' || (horizontal && action === 'up' && menuItemIndex === 0)) {
    focusCurrentTab();
  } else if (action === 'up' || action === 'down') {
    menuItemIndex += action === 'up' ? -1 : 1;
    focusCurrentMenuItem();
  }
}

function toggleMenu() {
  if (isMenuOpen()) { closeMenu(); return; }
  infoHoldStart = null;
  menu.style.display = 'flex';
  switchTab(document.querySelectorAll('.menu-tab')[menuTabIndex].dataset.tab);
  focusCurrentTab();
}

function closeMenu() {
  saveSettings();
  infoHoldStart = null;
  if (menu.contains(document.activeElement)) document.activeElement.blur();
  menu.style.display = 'none';
}

function applyFiltersAndReload() {
  saveSettings();
  loadAllArtworks();
  closeMenu();
}

function initMenuNavigation() {
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
  });
}
