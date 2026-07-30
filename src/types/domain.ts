export interface Note {
  id: string;
  ownerSub: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteInput {
  title: string;
  content: string;
}

export interface UpdateNoteInput {
  title?: string;
  content?: string;
}

export interface Bookmark {
  id: string;
  ownerSub: string;
  url: string;
  title: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookmarkInput {
  url: string;
  title: string;
  tags: string[];
}

export interface UpdateBookmarkInput {
  url?: string;
  title?: string;
  tags?: string[];
}
