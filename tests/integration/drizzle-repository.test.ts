import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '../../src/db/schema.js';
import { DrizzleToolboxRepository } from '../../src/repositories/drizzle-toolbox-repository.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL is required for PostgreSQL integration tests.');
}

const pool = new pg.Pool({
  connectionString: testDatabaseUrl,
  max: 2,
});
const database = drizzle(pool, { schema });
const repository = new DrizzleToolboxRepository(database);
const OWNER_A = '00000000-0000-4000-8000-000000000001';
const OWNER_B = '00000000-0000-4000-8000-000000000002';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const clearTestData = async (): Promise<void> => {
  await pool.query('TRUNCATE TABLE bookmarks, notes');
};

const waitForLaterTimestamp = () => new Promise(resolve => setTimeout(resolve, 20));

before(clearTestData);

after(async () => {
  try {
    await clearTestData();
  } finally {
    await pool.end();
  }
});

void test('Drizzle notes use UUIDs, isolate owners, order updates, and delete records', async () => {
  const first = await repository.createNote(OWNER_A, {
    title: 'First note',
    content: 'created first',
  });
  const second = await repository.createNote(OWNER_A, {
    title: 'Second note',
    content: 'created second',
  });
  await repository.createNote(OWNER_B, {
    title: 'Other owner note',
    content: 'private',
  });

  assert.match(first.id, UUID_PATTERN);
  assert.match(second.id, UUID_PATTERN);
  assert.notEqual(first.id, second.id);
  assert.deepEqual(
    (await repository.listNotes(OWNER_A)).map(note => note.id),
    [second.id, first.id]
  );
  assert.equal(await repository.findNote(OWNER_B, first.id), null);
  assert.equal(
    await repository.updateNote(OWNER_B, first.id, { title: 'Cross-owner update' }),
    null
  );
  assert.equal(await repository.deleteNote(OWNER_B, first.id), false);

  await waitForLaterTimestamp();
  const updated = await repository.updateNote(OWNER_A, first.id, {
    title: 'Updated first note',
  });
  assert.equal(updated?.title, 'Updated first note');
  assert.deepEqual(
    (await repository.listNotes(OWNER_A)).map(note => note.id),
    [first.id, second.id]
  );

  assert.equal(await repository.deleteNote(OWNER_A, first.id), true);
  assert.equal(await repository.findNote(OWNER_A, first.id), null);
  assert.equal(await repository.deleteNote(OWNER_A, first.id), false);
});

void test('Drizzle bookmarks isolate owners, filter tags, order updates, and delete records', async () => {
  const reference = await repository.createBookmark(OWNER_A, {
    url: 'https://example.com/reference',
    title: 'Reference',
    tags: ['reference', 'typescript'],
  });
  const other = await repository.createBookmark(OWNER_A, {
    url: 'https://example.com/other',
    title: 'Other',
    tags: ['other'],
  });
  await repository.createBookmark(OWNER_B, {
    url: 'https://example.com/private',
    title: 'Private reference',
    tags: ['reference'],
  });

  assert.match(reference.id, UUID_PATTERN);
  assert.match(other.id, UUID_PATTERN);
  assert.deepEqual(
    (await repository.listBookmarks(OWNER_A, 'reference')).map(bookmark => bookmark.id),
    [reference.id]
  );
  assert.equal(await repository.findBookmark(OWNER_B, reference.id), null);
  assert.equal(
    await repository.updateBookmark(OWNER_B, reference.id, { title: 'Cross-owner update' }),
    null
  );
  assert.equal(await repository.deleteBookmark(OWNER_B, reference.id), false);

  await waitForLaterTimestamp();
  const updated = await repository.updateBookmark(OWNER_A, reference.id, {
    title: 'Updated reference',
    tags: ['updated'],
  });
  assert.equal(updated?.title, 'Updated reference');
  assert.deepEqual(updated?.tags, ['updated']);
  assert.deepEqual(
    (await repository.listBookmarks(OWNER_A)).map(bookmark => bookmark.id),
    [reference.id, other.id]
  );
  assert.deepEqual(await repository.listBookmarks(OWNER_A, 'reference'), []);
  assert.deepEqual(
    (await repository.listBookmarks(OWNER_A, 'updated')).map(bookmark => bookmark.id),
    [reference.id]
  );

  assert.equal(await repository.deleteBookmark(OWNER_A, reference.id), true);
  assert.equal(await repository.findBookmark(OWNER_A, reference.id), null);
  assert.equal(await repository.deleteBookmark(OWNER_A, reference.id), false);
});
