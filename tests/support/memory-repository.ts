import { randomUUID } from 'node:crypto';
import type { ToolboxRepository } from '../../src/repositories/toolbox-repository.js';
import type {
  Bookmark,
  CreateBookmarkInput,
  CreateNoteInput,
  Note,
  UpdateBookmarkInput,
  UpdateNoteInput,
} from '../../src/types/domain.js';

export class MemoryToolboxRepository implements ToolboxRepository {
  private readonly notes = new Map<string, Note>();
  private readonly bookmarks = new Map<string, Bookmark>();
  private timestampSequence = 0;

  private timestamp(): string {
    this.timestampSequence += 1;
    return new Date(Date.UTC(2026, 0, 1, 0, 0, 0, this.timestampSequence)).toISOString();
  }

  async createNote(ownerSub: string, input: CreateNoteInput): Promise<Note> {
    const now = this.timestamp();
    const note: Note = {
      id: randomUUID(),
      ownerSub,
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    this.notes.set(note.id, note);
    return structuredClone(note);
  }

  async listNotes(ownerSub: string): Promise<Note[]> {
    return [...this.notes.values()]
      .filter(note => note.ownerSub === ownerSub)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(note => structuredClone(note));
  }

  async findNote(ownerSub: string, noteId: string): Promise<Note | null> {
    const note = this.notes.get(noteId);
    return note?.ownerSub === ownerSub ? structuredClone(note) : null;
  }

  async updateNote(ownerSub: string, noteId: string, input: UpdateNoteInput): Promise<Note | null> {
    const note = this.notes.get(noteId);
    if (note?.ownerSub !== ownerSub) {
      return null;
    }
    const updated = { ...note, ...input, updatedAt: this.timestamp() };
    this.notes.set(noteId, updated);
    return structuredClone(updated);
  }

  async deleteNote(ownerSub: string, noteId: string): Promise<boolean> {
    const note = this.notes.get(noteId);
    return note?.ownerSub === ownerSub ? this.notes.delete(noteId) : false;
  }

  async createBookmark(ownerSub: string, input: CreateBookmarkInput): Promise<Bookmark> {
    const now = this.timestamp();
    const bookmark: Bookmark = {
      id: randomUUID(),
      ownerSub,
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    this.bookmarks.set(bookmark.id, bookmark);
    return structuredClone(bookmark);
  }

  async listBookmarks(ownerSub: string, tag?: string): Promise<Bookmark[]> {
    return [...this.bookmarks.values()]
      .filter(
        bookmark =>
          bookmark.ownerSub === ownerSub && (tag === undefined || bookmark.tags.includes(tag))
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(bookmark => structuredClone(bookmark));
  }

  async findBookmark(ownerSub: string, bookmarkId: string): Promise<Bookmark | null> {
    const bookmark = this.bookmarks.get(bookmarkId);
    return bookmark?.ownerSub === ownerSub ? structuredClone(bookmark) : null;
  }

  async updateBookmark(
    ownerSub: string,
    bookmarkId: string,
    input: UpdateBookmarkInput
  ): Promise<Bookmark | null> {
    const bookmark = this.bookmarks.get(bookmarkId);
    if (bookmark?.ownerSub !== ownerSub) {
      return null;
    }
    const updated = { ...bookmark, ...input, updatedAt: this.timestamp() };
    this.bookmarks.set(bookmarkId, updated);
    return structuredClone(updated);
  }

  async deleteBookmark(ownerSub: string, bookmarkId: string): Promise<boolean> {
    const bookmark = this.bookmarks.get(bookmarkId);
    return bookmark?.ownerSub === ownerSub ? this.bookmarks.delete(bookmarkId) : false;
  }
}
