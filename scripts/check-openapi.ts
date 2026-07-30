import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getOpenApiDocument } from '../src/app.js';

const outputPath = resolve(process.cwd(), 'openapi/openapi.json');
const expected = JSON.stringify(getOpenApiDocument());

let actual: string;
try {
  actual = await readFile(outputPath, 'utf8');
} catch {
  throw new Error('OpenAPI artifact is missing. Run npm run openapi:generate.');
}

if (JSON.stringify(JSON.parse(actual) as unknown) !== expected) {
  throw new Error('OpenAPI artifact is stale. Run npm run openapi:generate.');
}

console.log('OpenAPI artifact matches the registered routes.');
