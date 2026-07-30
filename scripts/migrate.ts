import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import { config } from '../src/config.js';

const migrationsDirectory = resolve(process.cwd(), 'migrations');
const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 1 });
const client = await pool.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS toolbox_migrations (
      name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const migrationNames = (await readdir(migrationsDirectory))
    .filter(name => name.endsWith('.sql'))
    .sort();

  for (const migrationName of migrationNames) {
    const sql = await readFile(resolve(migrationsDirectory, migrationName), 'utf8');
    const checksum = createHash('sha256').update(sql, 'utf8').digest('hex');
    const existing = await client.query<{ checksum: string }>(
      'SELECT checksum FROM toolbox_migrations WHERE name = $1',
      [migrationName]
    );

    if (existing.rows[0]) {
      if (existing.rows[0].checksum !== checksum) {
        throw new Error(`Applied migration was modified: ${migrationName}`);
      }
      continue;
    }

    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO toolbox_migrations (name, checksum) VALUES ($1, $2)', [
        migrationName,
        checksum,
      ]);
      await client.query('COMMIT');
      console.log(`Applied migration: ${migrationName}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }

  console.log('Database migrations are up to date.');
} finally {
  client.release();
  await pool.end();
}
