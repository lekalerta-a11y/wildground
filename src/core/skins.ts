import { COLORS } from './constants';

export interface PlayerSkin {
  id: string;
  name: string;
  emoji: string | null;
  color: string;
}

// Skin colors also color territory, trails, particles and the minimap.
export const PLAYER_SKINS: readonly PlayerSkin[] = [
  { id: 'classic', name: 'Classic', emoji: null, color: COLORS.HUMAN },
  { id: 'whale', name: 'Whale', emoji: '🐳', color: '#2563eb' },
  { id: 'fox', name: 'Fox', emoji: '🦊', color: '#ea580c' },
  { id: 'frog', name: 'Frog', emoji: '🐸', color: '#16a34a' },
  { id: 'lion', name: 'Lion', emoji: '🦁', color: '#d97706' },
  { id: 'octopus', name: 'Octopus', emoji: '🐙', color: '#9333ea' },
  { id: 'pig', name: 'Pig', emoji: '🐷', color: '#db2777' },
  { id: 'panda', name: 'Panda', emoji: '🐼', color: '#475569' },
  { id: 'bear', name: 'Bear', emoji: '🐻', color: '#92400e' },
  { id: 'turtle', name: 'Turtle', emoji: '🐢', color: '#0d9488' },
];

const STORAGE_KEY = 'orion-player-skin';

export function loadPlayerSkin(): PlayerSkin {
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    return PLAYER_SKINS.find((skin) => skin.id === id) ?? PLAYER_SKINS[0];
  } catch {
    return PLAYER_SKINS[0];
  }
}

export function savePlayerSkin(skin: PlayerSkin): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, skin.id);
    return true;
  } catch {
    return false;
  }
}
