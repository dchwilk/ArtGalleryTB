// Versioned, best-effort persistence. Unavailable storage never blocks the TV UI.
const SETTINGS_KEY = 'artgallerytb.settings.v1';

function settingsCheckboxes() {
  return menu.querySelectorAll('input[type="checkbox"][id]');
}

function saveSettings() {
  const checkboxes = {};
  settingsCheckboxes().forEach(input => { checkboxes[input.id] = input.checked; });
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      version: 1, timer, matColor: matColors[colorIndex], frameStyle: styles[styleIndex], checkboxes,
      brightness: Number(document.getElementById('brightnessSlider').value)
    }));
  } catch (error) { console.log('Einstellungen konnten nicht gespeichert werden:', error); }
}

function restoreSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (!saved || saved.version !== 1) return;
    if (Number.isInteger(saved.timer) && saved.timer >= 5 && saved.timer <= 86400) timer = saved.timer;
    const color = matColors.indexOf(saved.matColor);
    const style = styles.indexOf(saved.frameStyle);
    if (color >= 0) colorIndex = color;
    if (style >= 0) styleIndex = style;
    if (Number.isInteger(saved.brightness) && saved.brightness >= 20 && saved.brightness <= 100) {
      document.getElementById('brightnessSlider').value = saved.brightness;
    }
    if (saved.checkboxes && typeof saved.checkboxes === 'object') {
      settingsCheckboxes().forEach(input => {
        if (typeof saved.checkboxes[input.id] === 'boolean') input.checked = saved.checkboxes[input.id];
      });
    }
  } catch (error) { console.log('Gespeicherte Einstellungen werden ignoriert:', error); }
}

function initSettings() {
  restoreSettings();
  settingsCheckboxes().forEach(syncCheckboxControl);
  document.getElementById('timeLabel').textContent = timer;
  applyBrightness();
  menu.addEventListener('change', () => { applyBrightness(); saveSettings(); });
  document.getElementById('brightnessSlider').addEventListener('input', () => { applyBrightness(); saveSettings(); });
}

function applyBrightness() {
  const enabled = document.getElementById('brightnessEnabled').checked;
  const slider = document.getElementById('brightnessSlider');
  slider.disabled = !enabled;
  const value = enabled ? Number(slider.value) : 100;
  document.getElementById('brightnessLabel').textContent = value + ' %';
  frame.style.filter = value === 100 ? 'none' : 'brightness(' + value / 100 + ')';
}
