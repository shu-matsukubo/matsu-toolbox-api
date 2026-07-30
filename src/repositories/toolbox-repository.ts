import type {
  Bookmark,
  CreateBookmarkInput,
  CreateNoteInput,
  Note,
  UpdateBookmarkInput,
  UpdateNoteInput,
} from '../types/domain.js';

export interface ToolboxRepository {
  createNote(ownerSub: string, input: CreateNoteInput): Promise<Note>;
  listNotes(ownerSub: string): Promise<Note[]>;
  findNote(ownerSub: string, noteId: string): Promise<Note | null>;
  updateNote(ownerSub: string, noteId: string, input: UpdateNoteInput): Promise<Note | null>;
  deleteNote(ownerSub: string, noteId: string): Promise<boolean>;
  createBookmark(ownerSub: string, input: CreateBookmarkInput): Promise<Bookmark>;
  listBookmarks(ownerSub: string, tag?: string): Promise<Bookmark[]>;
  findBookmark(ownerSub: string, bookmarkId: string): Promise<Bookmark | null>;
  updateBookmark(
    ownerSub: string,
    bookmarkId: string,
    input: UpdateBookmarkInput
  ): Promise<Bookmark | null>;
  deleteBookmark(ownerSub: string, bookmarkId: string): Promise<boolean>;
}
