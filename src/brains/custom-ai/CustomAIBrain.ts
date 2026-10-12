import type { Player } from '../../core/player';
import type { Match } from '../../core/simulation';
import type { BotBrain, BotBrainDebugInfo } from '../types';
import { buildSensorFrame, type SensorFrame } from '../shared-sensors/sensorFrame';
import { NeuralNet } from './NeuralNet';

export class CustomAIBrain implements BotBrain {
  readonly brainId = 'custom-ai';

  private player: Player;
  private sensorFrame: SensorFrame | null = null;
  
  private visionTimer = 0;
  private readonly VISION_INTERVAL = 0.1; // 100ms polling rate
  
  private net: NeuralNet;

  constructor(player: Player) {
    this.player = player;
    
    this.net = NeuralNet.load('orion-best-brain-v2') ?? new NeuralNet();
  }

  update(dt: number, match: Match): void {
    if (!this.player.alive) return;

    this.visionTimer -= dt;
    if (this.visionTimer <= 0) {
      this.sensorFrame = buildSensorFrame(this.player, match, dt);
      this.visionTimer = this.VISION_INTERVAL;

      // Flatten the 36 rays into 72 numerical inputs
      const inputs: number[] = [];
      for (const ray of this.sensorFrame.rays) {
        inputs.push(ray.distance);       // 0.0 to 1.0
        inputs.push(ray.hitType / 6.0);  // Normalize hitType (0 to 6) down to 0.0 - 1.0
      }

      // Forward pass
      const [outX, outY] = this.net.forward(inputs);
      
      // Convert the 2D output vector back into a heading angle
      this.player.desiredHeading = Math.atan2(outY, outX);
    }
  }

  getDebugInfo(): BotBrainDebugInfo {
    return {
      state: 'EVALUATING',
      currentIntent: 'Neural steering',
      threatLevel: 'none',
      rays: this.sensorFrame?.rays,
    };
  }
}
