export interface SimConfig {
  bankroll: number;
  rounds: number;
  p: number;
  b: number;
  kellyMultiplier: number;
  paths: number;
}

export interface SimResult {
  medianTrajectory: number[];
  p10Trajectory: number[];
  p90Trajectory: number[];
  medianFinal: number;
  meanFinal: number;
  bankruptcyRate: number;
  beatStartRate: number;
}

export function kellyFraction(p: number, b: number): number {
  const q = 1 - p;
  return (b * p - q) / b;
}

export function growthRate(f: number, p: number, b: number): number {
  if (f <= 0) return 0;
  if (f >= 1) return -Infinity;
  const q = 1 - p;
  return p * Math.log(1 + f * b) + q * Math.log(1 - f);
}

export function runSimulation(config: SimConfig): SimResult {
  const { bankroll, rounds, p, b, kellyMultiplier, paths } = config;

  let kelly = kellyFraction(p, b);
  // If negative, use absolute value (pedagogical: simulate "ignoring Kelly")
  if (kelly < 0) kelly = -kelly;
  const betFrac = kelly * kellyMultiplier;

  const rolls = new Float64Array(paths).fill(bankroll);
  const dead = new Uint8Array(paths);

  const med = new Float64Array(rounds + 1);
  const lo = new Float64Array(rounds + 1);
  const hi = new Float64Array(rounds + 1);
  med[0] = lo[0] = hi[0] = bankroll;

  const tmp = new Float64Array(paths);

  for (let r = 1; r <= rounds; r++) {
    for (let i = 0; i < paths; i++) {
      if (dead[i]) continue;
      let bet = rolls[i] * betFrac;
      if (bet > rolls[i]) bet = rolls[i];
      if (bet < 0.01) continue;
      if (Math.random() < p) {
        rolls[i] += bet * b;
      } else {
        rolls[i] -= bet;
      }
      if (rolls[i] <= 0.01) {
        rolls[i] = 0;
        dead[i] = 1;
      }
    }
    tmp.set(rolls);
    tmp.sort();
    lo[r] = tmp[Math.floor(paths * 0.1)];
    med[r] = tmp[Math.floor(paths * 0.5)];
    hi[r] = tmp[Math.floor(paths * 0.9)];
  }

  let sum = 0;
  let bankruptCount = 0;
  let beatCount = 0;
  for (let i = 0; i < paths; i++) {
    sum += rolls[i];
    if (dead[i]) bankruptCount++;
    if (rolls[i] > bankroll) beatCount++;
  }

  return {
    medianTrajectory: Array.from(med),
    p10Trajectory: Array.from(lo),
    p90Trajectory: Array.from(hi),
    medianFinal: med[rounds],
    meanFinal: sum / paths,
    bankruptcyRate: bankruptCount / paths,
    beatStartRate: beatCount / paths,
  };
}
