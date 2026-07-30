import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';
import { PublicError } from '../errors.js';
import type { ToolboxRepository } from '../repositories/toolbox-repository.js';
import {
  BookmarkListQuerySchema,
  BookmarkSchema,
  CreateBookmarkSchema,
  UpdateBookmarkSchema,
} from '../schemas.js';
import type { AppBindings } from '../types/app.js';
import { bearerSecurity, jsonContent, standardErrorResponses } from './shared.js';

const bookmarkIdParams = z.object({
  bookmarkId: z.string().uuid(),
});

const createBookmarkRoute = createRoute({
  method: 'post',
  path: '/api/bookmarks',
  tags: ['Bookmarks'],
  security: bearerSecurity,
  request: {
    body: {
      required: true,
      content: jsonContent(CreateBookmarkSchema),
    },
  },
  responses: {
    201: {
      description: 'Created bookmark.',
      content: jsonContent(BookmarkSchema),
    },
    400: standardErrorResponses[400],
    401: standardErrorResponses[401],
    500: standardErrorResponses[500],
    503: standardErrorResponses[503],
  },
});

const listBookmarksRoute = createRoute({
  method: 'get',
  path: '/api/bookmarks',
  tags: ['Bookmarks'],
  security: bearerSecurity,
  request: {
    query: BookmarkListQuerySchema,
  },
  responses: {
    200: {
      description: 'Owned bookmarks, optionally filtered by an exact tag.',
      content: jsonContent(z.array(BookmarkSchema)),
    },
    400: standardErrorResponses[400],
    401: standardErrorResponses[401],
    500: standardErrorResponses[500],
    503: standardErrorResponses[503],
  },
});

const getBookmarkRoute = createRoute({
  method: 'get',
  path: '/api/bookmarks/{bookmarkId}',
  tags: ['Bookmarks'],
  security: bearerSecurity,
  request: { params: bookmarkIdParams },
  responses: {
    200: {
      description: 'Owned bookmark.',
      content: jsonContent(BookmarkSchema),
    },
    400: standardErrorResponses[400],
    401: standardErrorResponses[401],
    404: standardErrorResponses[404],
    500: standardErrorResponses[500],
    503: standardErrorResponses[503],
  },
});

const updateBookmarkRoute = createRoute({
  method: 'patch',
  path: '/api/bookmarks/{bookmarkId}',
  tags: ['Bookmarks'],
  security: bearerSecurity,
  request: {
    params: bookmarkIdParams,
    body: {
      required: true,
      content: jsonContent(UpdateBookmarkSchema),
    },
  },
  responses: {
    200: {
      description: 'Updated owned bookmark.',
      content: jsonContent(BookmarkSchema),
    },
    400: standardErrorResponses[400],
    401: standardErrorResponses[401],
    404: standardErrorResponses[404],
    500: standardErrorResponses[500],
    503: standardErrorResponses[503],
  },
});

const deleteBookmarkRoute = createRoute({
  method: 'delete',
  path: '/api/bookmarks/{bookmarkId}',
  tags: ['Bookmarks'],
  security: bearerSecurity,
  request: { params: bookmarkIdParams },
  responses: {
    204: {
      description: 'Deleted owned bookmark.',
    },
    400: standardErrorResponses[400],
    401: standardErrorResponses[401],
    404: standardErrorResponses[404],
    500: standardErrorResponses[500],
    503: standardErrorResponses[503],
  },
});

const normalizeTags = (tags: string[]): string[] => [...new Set(tags)];

const requireBookmark = <Value>(value: Value | null): Value => {
  if (value === null) {
    throw new PublicError(404, 'NOT_FOUND', 'The requested bookmark was not found.');
  }
  return value;
};

export const registerBookmarkRoutes = (
  app: OpenAPIHono<AppBindings>,
  repository: ToolboxRepository
): void => {
  app.openapi(createBookmarkRoute, async context => {
    const auth = context.get('auth');
    const input = context.req.valid('json');
    const bookmark = await repository.createBookmark(auth.sub, {
      ...input,
      tags: normalizeTags(input.tags),
    });
    return context.json(bookmark, 201);
  });

  app.openapi(listBookmarksRoute, async context => {
    const auth = context.get('auth');
    const { tag } = context.req.valid('query');
    return context.json(await repository.listBookmarks(auth.sub, tag), 200);
  });

  app.openapi(getBookmarkRoute, async context => {
    const auth = context.get('auth');
    const { bookmarkId } = context.req.valid('param');
    return context.json(requireBookmark(await repository.findBookmark(auth.sub, bookmarkId)), 200);
  });

  app.openapi(updateBookmarkRoute, async context => {
    const auth = context.get('auth');
    const { bookmarkId } = context.req.valid('param');
    const input = context.req.valid('json');
    const bookmark = await repository.updateBookmark(auth.sub, bookmarkId, {
      ...input,
      ...(input.tags === undefined ? {} : { tags: normalizeTags(input.tags) }),
    });
    return context.json(requireBookmark(bookmark), 200);
  });

  app.openapi(deleteBookmarkRoute, async context => {
    const auth = context.get('auth');
    const { bookmarkId } = context.req.valid('param');
    const deleted = await repository.deleteBookmark(auth.sub, bookmarkId);
    if (!deleted) {
      throw new PublicError(404, 'NOT_FOUND', 'The requested bookmark was not found.');
    }
    return context.body(null, 204);
  });
};
