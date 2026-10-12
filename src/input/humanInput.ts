export type DirectionMode = 'keyboard' | 'pointer' | 'none';

/**
 * Captures WASD / arrow key / mouse / touch input and exposes a single
 * desired-heading value for the human player. Keyboard takes priority over
 * pointer direction whenever a movement key is actively held.
 */
export class HumanInputController {
  private keys = new Set<string>();
  private pointerActive = false;
  private pointerX = 0;
  private pointerY = 0;
  private target: HTMLElement;

  constructor(target: HTMLElement) {
    this.target = target;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('mousemove', this.onPointerMove);
    target.addEventListener('mousedown', this.onPointerMove);
    target.addEventListener('touchstart', this.onTouchMove, { passive: true });
    target.addEventListener('touchmove', this.onTouchMove, { passive: true });
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('mousemove', this.onPointerMove);
    this.target.removeEventListener('mousedown', this.onPointerMove);
    this.target.removeEventListener('touchstart', this.onTouchMove);
    this.target.removeEventListener('touchmove', this.onTouchMove);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.key.toLowerCase());
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };

  private onPointerMove = (e: MouseEvent) => {
    const rect = this.target.getBoundingClientRect();
    this.pointerX = e.clientX - rect.left;
    this.pointerY = e.clientY - rect.top;
    this.pointerActive = true;
  };

  private onTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 0) return;
    const rect = this.target.getBoundingClientRect();
    this.pointerX = e.touches[0].clientX - rect.left;
    this.pointerY = e.touches[0].clientY - rect.top;
    this.pointerActive = true;
  };

  private keyboardVector(): { x: number; y: number } | null {
    let x = 0;
    let y = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) y -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) y += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    if (x === 0 && y === 0) return null;
    return { x, y };
  }

  isKeyDown(key: string): boolean {
    return this.keys.has(key.toLowerCase());
  }

  /**
   * Compute the desired heading (radians) given where the player currently
   * renders on screen (usually near canvas center, since the camera follows
   * them). Falls back to `fallback` heading if no input is currently active.
   */
  getDesiredHeading(playerScreenX: number, playerScreenY: number, fallback: number): {
    heading: number;
    mode: DirectionMode;
  } {
    const kb = this.keyboardVector();
    if (kb) {
      return { heading: Math.atan2(kb.y, kb.x), mode: 'keyboard' };
    }
    if (this.pointerActive) {
      const dx = this.pointerX - playerScreenX;
      const dy = this.pointerY - playerScreenY;
      if (Math.hypot(dx, dy) > 4) {
        return { heading: Math.atan2(dy, dx), mode: 'pointer' };
      }
    }
    return { heading: fallback, mode: 'none' };
  }
}
