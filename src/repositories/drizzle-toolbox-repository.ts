import { and, desc, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { bookmarks, notes } from '../db/schema.js';
import type {
  Bookmark,
  CreateBookmarkInput,
  CreateNoteInput,
  Note,
  UpdateBookmarkInput,
  UpdateNoteInput,
} from '../types/domain.js';
import type { ToolboxRepository } from './toolbox-repository.js';

type Database = NodePgDatabase<{
  bookmarks: typeof bookmarks;
  notes: typeof notes;
}>;

const toNote = (row: typeof notes.$inferSelect): Note => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const toBookmark = (row: typeof bookmarks.$inferSelect): Bookmark => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export class DrizzleToolboxRepository implements ToolboxRepository {
  constructor(private readonly database: Database) {}

  async createNote(ownerSub: string, input: CreateNoteInput): Promise<Note> {
    const rows = await this.database
      .insert(notes)
      .values({ ownerSub, ...input })
      .returning();
    return toNote(rows[0]);
  }

  async listNotes(ownerSub: string): Promise<Note[]> {
    const rows = await this.database
      .select()
      .from(notes)
      .where(eq(notes.ownerSub, ownerSub))
      .orderBy(desc(notes.updatedAt));
    return rows.map(toNote);
  }

  async findNote(ownerSub: string, noteId: string): Promise<Note | null> {
    const rows = await this.database
      .select()
      .from(notes)
      .where(and(eq(notes.ownerSub, ownerSub), eq(notes.id, noteId)))
      .limit(1);
    return rows[0] ? toNote(rows[0]) : null;
  }

  async updateNote(ownerSub: string, noteId: string, input: UpdateNoteInput): Promise<Note | null> {
    const rows = await this.database
      .update(notes)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(notes.ownerSub, ownerSub), eq(notes.id, noteId)))
      .returning();
    return rows[0] ? toNote(rows[0]) : null;
  }

  async deleteNote(ownerSub: string, noteId: string): Promise<boolean> {
    const rows = await this.database
      .delete(notes)
      .where(and(eq(notes.ownerSub, ownerSub), eq(notes.id, noteId)))
      .returning({ id: notes.id });
    return rows.length === 1;
  }

  async createBookmark(ownerSub: string, input: CreateBookmarkInput): Promise<Bookmark> {
    const rows = await this.database
      .insert(bookmarks)
      .values({ ownerSub, ...input })
      .returning();
    return toBookmark(rows[0]);
  }

  async listBookmarks(ownerSub: string, tag?: string): Promise<Bookmark[]> {
    const tagCondition =
      tag === undefined
        ? undefined
        : sql<boolean>`${bookmarks.tags} @> ${JSON.stringify([tag])}::jsonb`;
    const rows = await this.database
      .select()
      .from(bookmarks)
      .where(and(eq(bookmarks.ownerSub, ownerSub), tagCondition))
      .orderBy(desc(bookmarks.updatedAt));
    return rows.map(toBookmark);
  }

  async findBookmark(ownerSub: string, bookmarkId: string): Promise<Bookmark | null> {
    const rows = await this.database
      .select()
      .from(bookmarks)
      .where(and(eq(bookmarks.ownerSub, ownerSub), eq(bookmarks.id, bookmarkId)))
      .limit(1);
    return rows[0] ? toBookmark(rows[0]) : null;
  }

  async updateBookmark(
    ownerSub: string,
    bookmarkId: string,
    input: UpdateBookmarkInput
  ): Promise<Bookmark | null> {
    const rows = await this.database
      .update(bookmarks)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(bookmarks.ownerSub, ownerSub), eq(bookmarks.id, bookmarkId)))
      .returning();
    return rows[0] ? toBookmark(rows[0]) : null;
  }

  async deleteBookmark(ownerSub: string, bookmarkId: string): Promise<boolean> {
    const rows = await this.database
      .delete(bookmarks)
      .where(and(eq(bookmarks.ownerSub, ownerSub), eq(bookmarks.id, bookmarkId)))
      .returning({ id: bookmarks.id });
    return rows.length === 1;
  }
}
