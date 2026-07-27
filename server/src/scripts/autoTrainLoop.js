/**
 * Standalone perpetual collect→train loop (no HTTP server).
 *
 *   npm run train:loop -w server
 *   AUTO_TRAIN_INTERVAL_MS=1800000 node src/scripts/autoTrainLoop.js
 */

import {
  AUTO_TRAIN_INTERVAL_MS,
  AUTO_TRAIN_DAYS,
  AUTO_TRAIN_MIN_MAG,
  AUTO_TRAIN_EPOCHS,
} from '../config.js';
import { runCollectAndTrain } from '../services/autoTrainer.js';

const interval = Math.max(
  15 * 60_000,
  Number(process.env.AUTO_TRAIN_INTERVAL_MS) || AUTO_TRAIN_INTERVAL_MS,
);

console.log('QuakePulse auto-train loop (standalone)');
console.log('---------------------------------------');
console.log(
  `Interval ${Math.round(interval / 60000)}m · ${AUTO_TRAIN_DAYS}d catalogs · minM ${AUTO_TRAIN_MIN_MAG} · epochs ${AUTO_TRAIN_EPOCHS}`,
);
console.log('Ctrl+C to stop\n');

let stopped = false;

async function cycle() {
  if (stopped) return;
  const result = await runCollectAndTrain({
    days: AUTO_TRAIN_DAYS,
    minMagnitude: AUTO_TRAIN_MIN_MAG,
    epochs: AUTO_TRAIN_EPOCHS,
  });
  console.log(JSON.stringify(result, null, 2));
  if (!stopped) {
    console.log(`\n[auto-train] next cycle in ${Math.round(interval / 60000)} minutes…\n`);
    setTimeout(cycle, interval);
  }
}

process.on('SIGINT', () => {
  stopped = true;
  console.log('\n[auto-train] stopping…');
  process.exit(0);
});

await cycle();
