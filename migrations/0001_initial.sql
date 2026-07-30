CREATE TABLE IF NOT EXISTS notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_sub text NOT NULL,
    title text NOT NULL,
    content text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT notes_title_length CHECK (char_length(title) BETWEEN 1 AND 120),
    CONSTRAINT notes_content_length CHECK (char_length(content) <= 20000)
);

CREATE INDEX IF NOT EXISTS notes_owner_sub_updated_at_idx
    ON notes(owner_sub, updated_at DESC);

CREATE TABLE IF NOT EXISTS bookmarks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_sub text NOT NULL,
    url text NOT NULL,
    title text NOT NULL,
    tags jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT bookmarks_title_length CHECK (char_length(title) BETWEEN 1 AND 200),
    CONSTRAINT bookmarks_url_scheme CHECK (url ~ '^https?://'),
    CONSTRAINT bookmarks_tags_array CHECK (jsonb_typeof(tags) = 'array')
);

CREATE INDEX IF NOT EXISTS bookmarks_owner_sub_updated_at_idx
    ON bookmarks(owner_sub, updated_at DESC);

CREATE INDEX IF NOT EXISTS bookmarks_tags_idx
    ON bookmarks USING gin(tags);
