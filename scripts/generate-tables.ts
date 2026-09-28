// Regenerates src/strategy/data/strategy-v1.json from the EV model.
// Run with: npm run generate
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generateStrategyData } from '../src/strategy/generate';

const out = fileURLToPath(new URL('../src/strategy/data/strategy-v1.json', import.meta.url));
const started = Date.now();
const data = generateStrategyData();
writeFileSync(out, JSON.stringify(data) + '\n');
console.log(`Wrote ${out}: ${Object.keys(data.base).length} base tables, ${data.splitGrids.length} unique split grids, ${Date.now() - started} ms`);
