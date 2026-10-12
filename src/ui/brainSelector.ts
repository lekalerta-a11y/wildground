import { BRAIN_REGISTRY } from '../brains/registry';

/**
 * Renders `count` "Bot N: [brain dropdown]" rows into `containerId`,
 * reflecting/mutating `brainIds` (by index). Safe to call repeatedly (e.g.
 * whenever the associated bot-count slider changes) -- it fully replaces
 * the container's contents each time.
 */
export function renderBrainSelectors(
  containerId: string,
  count: number,
  brainIds: string[],
  onChange: (index: number, brainId: string) => void
) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const rows: string[] = [];
  for (let i = 0; i < count; i++) {
    const current = brainIds[i] ?? BRAIN_REGISTRY[i % BRAIN_REGISTRY.length].id;
    const options = BRAIN_REGISTRY.map(
      (b) => `<option value="${b.id}" ${b.id === current ? 'selected' : ''}>${b.label}</option>`
    ).join('');
    rows.push(
      `<div class="brain-row">
        <span class="brain-row-label">Bot ${i + 1}</span>
        <select class="brain-select" data-index="${i}">${options}</select>
      </div>`
    );
  }
  container.innerHTML = rows.join('');

  container.querySelectorAll<HTMLSelectElement>('.brain-select').forEach((sel) => {
    sel.addEventListener('change', () => {
      const idx = parseInt(sel.dataset.index ?? '0', 10);
      onChange(idx, sel.value);
    });
  });
}
