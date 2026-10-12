export class NeuralNet {
  public weights1: number[][]; // 72 x 16
  public biases1: number[];    // 16
  public weights2: number[][]; // 16 x 2
  public biases2: number[];    // 2

  public fitness: number = 0;
  public ticksAlive: number = 0;

  constructor(copyInfo?: NeuralNet) {
    if (copyInfo) {
      this.weights1 = copyInfo.weights1.map(row => [...row]);
      this.biases1 = [...copyInfo.biases1];
      this.weights2 = copyInfo.weights2.map(row => [...row]);
      this.biases2 = [...copyInfo.biases2];
    } else {
      // Initialize with random weights between -1 and 1
      this.weights1 = Array.from({ length: 72 }, () => Array.from({ length: 16 }, () => (Math.random() * 2) - 1));
      this.biases1 = Array.from({ length: 16 }, () => (Math.random() * 2) - 1);
      this.weights2 = Array.from({ length: 16 }, () => Array.from({ length: 2 }, () => (Math.random() * 2) - 1));
      this.biases2 = Array.from({ length: 2 }, () => (Math.random() * 2) - 1);
    }
  }

  public forward(inputs: number[]): number[] {
    // Hidden Layer (ReLU Activation)
    const hidden = new Array(16).fill(0);
    for (let j = 0; j < 16; j++) {
      let sum = this.biases1[j];
      for (let i = 0; i < 72; i++) {
        sum += inputs[i] * this.weights1[i][j];
      }
      hidden[j] = Math.max(0, sum); // ReLU
    }

    // Output Layer (Tanh Activation for continuous angle vectors -1 to 1)
    const outputs = new Array(2).fill(0);
    for (let j = 0; j < 2; j++) {
      let sum = this.biases2[j];
      for (let i = 0; i < 16; i++) {
        sum += hidden[i] * this.weights2[i][j];
      }
      outputs[j] = Math.tanh(sum); 
    }

    return outputs;
  }

  public mutate(rate: number, strength: number) {
    const mutateValue = (val: number) => Math.random() < rate ? val + (Math.random() * 2 - 1) * strength : val;

    for (let i = 0; i < 72; i++) {
      for (let j = 0; j < 16; j++) this.weights1[i][j] = mutateValue(this.weights1[i][j]);
    }
    for (let i = 0; i < 16; i++) this.biases1[i] = mutateValue(this.biases1[i]);
    
    for (let i = 0; i < 16; i++) {
      for (let j = 0; j < 2; j++) this.weights2[i][j] = mutateValue(this.weights2[i][j]);
    }
    for (let i = 0; i < 2; i++) this.biases2[i] = mutateValue(this.biases2[i]);
  }

  public clone(): NeuralNet {
    return new NeuralNet(this);
  }

  public save(key: string) {
    localStorage.setItem(key, JSON.stringify({
      w1: this.weights1, b1: this.biases1, w2: this.weights2, b2: this.biases2
    }));
  }

  public static load(key: string): NeuralNet | null {
    try {
      const data = localStorage.getItem(key);
      if (!data) return null;
      const parsed = JSON.parse(data);
      const net = new NeuralNet();
      net.weights1 = parsed.w1; net.biases1 = parsed.b1;
      net.weights2 = parsed.w2; net.biases2 = parsed.b2;
      return net;
    } catch {
      return null;
    }
  }
}
