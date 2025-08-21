// NEU: TV Keymap
const TV_KEYS = {
  RED: 403,
  GREEN: 404,
  YELLOW: 405,
  BLUE: 406,
  OK: 13,
  UP: 38,
  DOWN: 40,
  LEFT: 37,
  RIGHT: 39,
  CHANNEL_UP: 427,
  CHANNEL_DOWN: 428,
  PLAY: 10252,
  RETURN: 10009
};

// Navigation-Variablen
let menuTabIndex = 0;
let menuItemIndex = 0;

if (window.__spatialNavigation__) {
  window.__spatialNavigation__.keyMode = 'NONE';
}

// Menu Navigation für TV-Fernbedienung
function initMenuNavigation() {
  const tabs = document.querySelectorAll('.menu-tab');
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
  
  // Entferne den separaten keydown handler für Tabs
  document.addEventListener('keydown', handleAllNavigation);
}

function switchTab(tabName) {
  // Alle Tabs deaktivieren
  document.querySelectorAll('.menu-tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.menu-section').forEach(section => section.classList.remove('active'));
  
  // Gewählten Tab aktivieren
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(tabName).classList.add('active');
  
  // Tab-Index aktualisieren
  const tabs = document.querySelectorAll('.menu-tab');
  menuTabIndex = Array.from(tabs).findIndex(tab => tab.dataset.tab === tabName);
  menuItemIndex = 0;
}

function focusCurrentTab() {
  const tabs = document.querySelectorAll('.menu-tab');
  if (tabs[menuTabIndex]) {
    tabs[menuTabIndex].focus();
    tabs[menuTabIndex].classList.add('active');
  }
}

function focusCurrentMenuItem() {
  const activeSection = document.querySelector('.menu-section.active');
  if (!activeSection) return;
  
  const focusableElements = activeSection.querySelectorAll('input, button, select');
  if (focusableElements[menuItemIndex]) {
    focusableElements[menuItemIndex].focus();
  }
}

function navigateInMenu(direction) {
  const activeSection = document.querySelector('.menu-section.active');
  if (!activeSection) return;
  
  const focusableElements = activeSection.querySelectorAll('input, button, select');
  
  if (direction === 'up') {
    menuItemIndex = Math.max(0, menuItemIndex - 1);
  } else if (direction === 'down') {
    menuItemIndex = Math.min(focusableElements.length - 1, menuItemIndex + 1);
  }
  
  focusCurrentMenuItem();
}

function navigateTabs(direction) {
  const tabs = document.querySelectorAll('.menu-tab');
  
  if (direction === 'left') {
    menuTabIndex = Math.max(0, menuTabIndex - 1);
  } else if (direction === 'right') {
    menuTabIndex = Math.min(tabs.length - 1, menuTabIndex + 1);
  } else if (direction === 'up') {
    // Für vertikale Navigation (Burger-Menü)
    menuTabIndex = Math.max(0, menuTabIndex - 1);
  } else if (direction === 'down') {
    // Für vertikale Navigation (Burger-Menü)  
    menuTabIndex = Math.min(tabs.length - 1, menuTabIndex + 1);
  }
  
  // Tab fokussieren (aber nicht automatisch wechseln im Burger-Menü)
  const newTab = tabs[menuTabIndex];
  if (newTab) {
    newTab.focus();
    // Nur bei horizontalem Layout automatisch wechseln
    if (isSmallLayout() && (direction === 'left' || direction === 'right')) {
      switchTab(newTab.dataset.tab);
    }
  }
}

function toggleInfo() {
  infoVisible = !infoVisible;
  infoBox.style.display = infoVisible ? 'block' : 'none';
}

function toggleMenu() {
  menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
  if (menu.style.display === 'flex') {
    // Reset navigation indices
    menuTabIndex = 0;
    menuItemIndex = 0;
    focusCurrentTab();
  }
}

function closeMenu() {
  menu.style.display = 'none';
}

function applyFiltersAndReload() {
  loadAllArtworks();
  closeMenu();
}

function nextArtwork() {
  currentIndex++;
  if (currentIndex >= randomizedOrder.length) {
    createRandomizedOrder();
  }
  showArtwork();
}

function previousArtwork() {
  currentIndex = (currentIndex - 1 + randomizedOrder.length) % randomizedOrder.length;
  showArtwork();
}

// Prüfe ob wir im kleinen Layout sind
function isSmallLayout() {
  return window.innerWidth <= 1280;
}

// EINE zentrale Navigation-Funktion
function handleAllNavigation(e) {
  const code = e.keyCode || e.which;
  const key = e.key;
  
  if (menu.style.display === 'flex') {
    // MENU-NAVIGATION
    e.preventDefault();
    
    const currentFocus = document.activeElement;
    const isOnTab = currentFocus && currentFocus.classList.contains('menu-tab');
    const smallLayout = isSmallLayout();
    
    if (smallLayout) {
      // KLEINES LAYOUT: Horizontale Tab-Navigation
      switch (code) {
        case TV_KEYS.LEFT:
        case 37: // Arrow Left
          if (isOnTab) {
            navigateTabs('left');
          } else {
            // Zurück zu den Tabs
            focusCurrentTab();
          }
          break;
          
        case TV_KEYS.RIGHT:
        case 39: // Arrow Right
          if (isOnTab) {
            navigateTabs('right');
          } else {
            // Bleib im Menü-Bereich
            focusCurrentMenuItem();
          }
          break;
          
        case TV_KEYS.UP:
        case 38: // Arrow Up
          if (isOnTab) {
            // Nichts tun
          } else {
            navigateInMenu('up');
          }
          break;
          
        case TV_KEYS.DOWN:
        case 40: // Arrow Down
          if (isOnTab) {
            // Ins Menü wechseln
            menuItemIndex = 0;
            focusCurrentMenuItem();
          } else {
            navigateInMenu('down');
          }
          break;
      }
    } else {
      // NORMALES LAYOUT: Vertikale Burger-Menu Navigation
      switch (code) {
        case TV_KEYS.UP:
        case 38: // Arrow Up
          if (isOnTab) {
            navigateTabs('up'); // Vertikale Tab-Navigation
          } else {
            navigateInMenu('up');
          }
          break;
          
        case TV_KEYS.DOWN:
        case 40: // Arrow Down
          if (isOnTab) {
            navigateTabs('down'); // Vertikale Tab-Navigation
          } else {
            navigateInMenu('down');
          }
          break;
          
        case TV_KEYS.RIGHT:
        case 39: // Arrow Right
          if (isOnTab) {
            // Ins Untermenü wechseln
            switchTab(currentFocus.dataset.tab);
            menuItemIndex = 0;
            focusCurrentMenuItem();
          } else {
            // Bleib im Menü-Bereich
            focusCurrentMenuItem();
          }
          break;
          
        case TV_KEYS.LEFT:
        case 37: // Arrow Left
          if (!isOnTab) {
            // Zurück zur Hauptnavigation
            focusCurrentTab();
          }
          break;
      }
    }
    
    // Gemeinsame Aktionen für beide Layouts
    switch (code) {
      case TV_KEYS.OK:
      case 13: // Enter
        const focused = document.activeElement;
        if (focused) {
          if (focused.type === 'checkbox') {
            focused.checked = !focused.checked;
            focused.dispatchEvent(new Event('change'));
          } else if (focused.tagName === 'BUTTON') {
            focused.click();
          } else if (focused.classList.contains('menu-tab')) {
            // Tab aktivieren und ins Menü wechseln
            switchTab(focused.dataset.tab);
            menuItemIndex = 0;
            focusCurrentMenuItem();
          }
        }
        break;
        
      case TV_KEYS.RETURN:
      case 27: // Escape
      case 77: // M
        closeMenu();
        break;
    }
    return;
  }

  // HAUPT-NAVIGATION (wenn Menü geschlossen ist)
  switch (code) {
    case TV_KEYS.RIGHT:
    case 39: // Arrow Right
      nextArtwork();
      break;
      
    case TV_KEYS.LEFT:
    case 37: // Arrow Left
      previousArtwork();
      break;
      
    case TV_KEYS.UP:
    case 38: // Arrow Up
      if (infoHoldStart === 0) infoHoldStart = Date.now();
      break;
      
    case TV_KEYS.DOWN:
    case 40: // Arrow Down
      infoBox.style.display = 'none';
      infoVisible = false;
      infoHoldStart = 0;
      break;
      
    case TV_KEYS.GREEN:
    case TV_KEYS.PLAY:
    case 71: // g
    case 32: // Space
      colorIndex = (colorIndex + 1) % matColors.length;
      setPassepartout(colorIndex);
      break;
      
    case TV_KEYS.YELLOW:
    case TV_KEYS.CHANNEL_UP:
    case 89: // y
    case 68: // d
      timer += 15;
      startSlideshow();
      break;
      
    case TV_KEYS.BLUE:
    case TV_KEYS.CHANNEL_DOWN:
    case 66: // b
    case 65: // a
      timer = Math.max(5, timer - 15);
      startSlideshow();
      break;
      
    case TV_KEYS.RED:
    case TV_KEYS.RETURN:
    case 77: // m
    case 82: // r
      toggleMenu();
      break;
      
    case TV_KEYS.OK:
    case 13: // Enter
      styleIndex = (styleIndex + 1) % styles.length;
      updatePassepartoutStyle();
      break;
      
    default:
      if (key === 'n') {
        createRandomizedOrder();
        showArtwork();
      }
  }
}

document.addEventListener('keyup', (e) => {
  const code = e.keyCode || e.which;
  if ((code === TV_KEYS.UP || e.key === 'ArrowUp') && infoHoldStart > 0) {
    const held = Date.now() - infoHoldStart;
    infoHoldStart = 0;
    if (held > 3000) {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    } else {
      toggleInfo();
    }
  }
});