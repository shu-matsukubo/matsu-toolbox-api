import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { getOpenApiDocument } from '../src/app.js';

const outputPath = resolve(process.cwd(), 'openapi/openapi.json');
const serialized = `${JSON.stringify(getOpenApiDocument(), null, 2)}\n`;

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, serialized, 'utf8');

console.log(`OpenAPI document generated: ${outputPath}`);
