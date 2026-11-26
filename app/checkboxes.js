// Native checkbox activation differs between TV engines. The remote focuses
// ordinary buttons; hidden inputs retain the existing filters and preferences.
function syncCheckboxControl(input) {
  const control = document.querySelector('[data-checkbox-id="' + input.id + '"]');
  if (!control) return;
  control.setAttribute('aria-checked', String(input.checked));
  control.disabled = input.disabled;
}

function initCheckboxControls() {
  menu.querySelectorAll('input[type="checkbox"]').forEach(input => {
    const label = input.closest('label');
    if (!label) return;
    const control = document.createElement('button');
    control.type = 'button';
    control.className = 'checkbox-control';
    control.dataset.checkboxId = input.id;
    control.setAttribute('role', 'checkbox');
    const mark = document.createElement('span');
    mark.className = 'checkbox-mark';
    mark.setAttribute('aria-hidden', 'true');
    control.appendChild(mark);
    Array.from(label.childNodes).forEach(node => { if (node !== input) control.appendChild(node); });
    input.hidden = true;
    input.tabIndex = -1;
    input.setAttribute('aria-hidden', 'true');
    label.replaceWith(control);
    control.after(input);
    control.addEventListener('click', () => {
      if (input.disabled) return;
      input.checked = !input.checked;
      syncCheckboxControl(input);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    input.addEventListener('change', () => syncCheckboxControl(input));
    syncCheckboxControl(input);
  });
}
