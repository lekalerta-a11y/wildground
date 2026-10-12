import { COLORS, PLAYER, WORLD } from '../core/constants';
import { mixHexColors } from '../core/math';
import type { Player } from '../core/player';
import type { Camera } from './camera';
import { SensorHitType, type RayReading } from '../brains/shared-sensors/sensorFrame';

const OUTSIDE_MIX_COLOR = mixHexColors(COLORS.BOUNDARY_OUTER, COLORS.BOUNDARY_SHADOW, 0.5);

export function clearBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = COLORS.BACKGROUND;
  ctx.fillRect(0, 0, w, h);
}

/** Draw the circular world boundary: cyan ring + soft grey shadow, per spec. */
export function drawWorldBoundary(ctx: CanvasRenderingContext2D, camera: Camera, w: number, h: number) {
  const center = camera.worldToScreen({ x: 0, y: 0 }, w, h);
  const r = WORLD.RADIUS * camera.zoom;

  // Area outside the playable world: an even 50/50 blend of the boundary's
  // blue and grey, rather than leaning toward either color.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.arc(center.x, center.y, r, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.fillStyle = OUTSIDE_MIX_COLOR;
  ctx.globalAlpha = 0.28;
  ctx.fill('evenodd');
  ctx.globalAlpha = 1;
  ctx.restore();

  // Soft shadow ring for depth.
  ctx.beginPath();
  ctx.arc(center.x, center.y + 4, r + 10, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.BOUNDARY_SHADOW;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 18;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Cyan boundary ring.
  ctx.beginPath();
  ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.BOUNDARY_OUTER;
  ctx.lineWidth = 8;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(center.x, center.y, r - 6, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

export function drawTrail(ctx: CanvasRenderingContext2D, camera: Camera, w: number, h: number, player: Player) {
  if (!player.outsideTerritory || player.trail.length < 2) return;
  ctx.beginPath();
  const first = camera.worldToScreen(player.trail[0], w, h);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < player.trail.length; i++) {
    const s = camera.worldToScreen(player.trail[i], w, h);
    ctx.lineTo(s.x, s.y);
  }
  const head = camera.worldToScreen(player.position, w, h);
  ctx.lineTo(head.x, head.y);
  ctx.strokeStyle = player.color;
  ctx.lineWidth = PLAYER.TRAIL_WIDTH * 2 * camera.zoom;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = 0.85;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  w: number,
  h: number,
  player: Player,
  isFollowed: boolean
) {
  if (!player.alive) return;
  const s = camera.worldToScreen(player.position, w, h);
  const r = PLAYER.COLLISION_RADIUS * camera.zoom;

  ctx.save();
  ctx.translate(s.x, s.y);
  if (player.headEmoji) {
    // Keep faces upright and legible, with a size that tracks the collision body.
    ctx.font = `${r * 3}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(player.headEmoji, 0, 0);
  } else {
  ctx.rotate(player.heading);

  // Soft shadow.
  ctx.beginPath();
  ctx.ellipse(0, r * 0.55, r * 0.9, r * 0.35, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fill();

  // Rounded square "block" body, per reference: simple geometric block.
  const size = r * 1.6;
  const radius = size * 0.28;
  roundedRect(ctx, -size / 2, -size / 2, size, size, radius);
  ctx.fillStyle = player.color;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.18);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.stroke();

  // Direction nub.
  ctx.beginPath();
  ctx.moveTo(size * 0.5, 0);
  ctx.lineTo(size * 0.22, -size * 0.22);
  ctx.lineTo(size * 0.22, size * 0.22);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fill();
  }

  ctx.restore();

  if (isFollowed) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, r * 1.9, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(20,20,20,0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Name label.
  ctx.font = `${Math.max(10, 11 * camera.zoom)}px 'Segoe UI', sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(20,20,20,0.75)';
  ctx.fillText(player.name, s.x, s.y - r * 2 - 4);
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawRays(ctx: CanvasRenderingContext2D, camera: Camera, w: number, h: number, player: Player, rays: RayReading[]) {
  if (!player.alive || rays.length === 0) return;

  const start = camera.worldToScreen(player.position, w, h);
  const NUM_RAYS = rays.length;
  const ANGLE_STEP = (2 * Math.PI) / NUM_RAYS;
  const MAX_VISION_DISTANCE = 1000; // Must match the constant in sensorFrame.ts

  for (let i = 0; i < NUM_RAYS; i++) {
    const rayAngle = player.heading + (i * ANGLE_STEP);
    const ray = rays[i];
    const endDist = ray.distance * MAX_VISION_DISTANCE;
    
    const endX = player.position.x + Math.cos(rayAngle) * endDist;
    const endY = player.position.y + Math.sin(rayAngle) * endDist;
    const endScreen = camera.worldToScreen({ x: endX, y: endY }, w, h);

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(endScreen.x, endScreen.y);

    // Color code the lasers based on what they hit
    if (ray.hitType === SensorHitType.EMPTY) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'; // Faint white
    } else if (ray.hitType === SensorHitType.ENEMY_BODY || ray.hitType === SensorHitType.ENEMY_TRAIL) {
      ctx.strokeStyle = 'rgba(255, 0, 50, 0.8)'; // Bright Red for danger/targets
    } else if (ray.hitType === SensorHitType.OWN_TRAIL) {
      ctx.strokeStyle = 'rgba(50, 255, 50, 0.6)'; // Green for own trail
    } else {
      ctx.strokeStyle = 'rgba(255, 200, 0, 0.4)'; // Yellow for boundaries/territory
    }
    
    ctx.lineWidth = 1.5 * camera.zoom;
    ctx.stroke();
  }
}
