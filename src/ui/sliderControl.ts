export function setupSlider(
  containerId: string,
  initial: number,
  onChange: (value: number) => void
): (value: number) => void {
  const container = document.getElementById(containerId);
  if (!container) throw new Error(`Slider container not found: ${containerId}`);
  const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('.slider-opt'));

  const applyActive = (value: number) => {
    for (const btn of buttons) {
      const v = parseFloat(btn.dataset.value ?? '0');
      btn.classList.toggle('active', v === value);
      btn.setAttribute('aria-pressed', String(v === value));
    }
  };

  for (const btn of buttons) {
    btn.addEventListener('click', () => {
      const v = parseFloat(btn.dataset.value ?? '0');
      applyActive(v);
      onChange(v);
    });
  }

  applyActive(initial);
  return applyActive;
}
