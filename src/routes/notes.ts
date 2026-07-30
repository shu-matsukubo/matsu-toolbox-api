import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';
import { PublicError } from '../errors.js';
import { CreateNoteSchema, NoteSchema, UpdateNoteSchema } from '../schemas.js';
import type { AppBindings } from '../types/app.js';
import type { ToolboxRepository } from '../repositories/toolbox-repository.js';
import { bearerSecurity, jsonContent, standardErrorResponses } from './shared.js';

const noteIdParams = z.object({
  noteId: z.string().uuid(),
});

const createNoteRoute = createRoute({
  method: 'post',
  path: '/api/notes',
  tags: ['Notes'],
  security: bearerSecurity,
  request: {
    body: {
      required: true,
      content: jsonContent(CreateNoteSchema),
    },
  },
  responses: {
    201: {
      description: 'Created note.',
      content: jsonContent(NoteSchema),
    },
    400: standardErrorResponses[400],
    401: standardErrorResponses[401],
    500: standardErrorResponses[500],
    503: standardErrorResponses[503],
  },
});

const listNotesRoute = createRoute({
  method: 'get',
  path: '/api/notes',
  tags: ['Notes'],
  security: bearerSecurity,
  responses: {
    200: {
      description: 'Owned notes ordered by updatedAt descending.',
      content: jsonContent(z.array(NoteSchema)),
    },
    401: standardErrorResponses[401],
    500: standardErrorResponses[500],
    503: standardErrorResponses[503],
  },
});

const getNoteRoute = createRoute({
  method: 'get',
  path: '/api/notes/{noteId}',
  tags: ['Notes'],
  security: bearerSecurity,
  request: { params: noteIdParams },
  responses: {
    200: {
      description: 'Owned note.',
      content: jsonContent(NoteSchema),
    },
    400: standardErrorResponses[400],
    401: standardErrorResponses[401],
    404: standardErrorResponses[404],
    500: standardErrorResponses[500],
    503: standardErrorResponses[503],
  },
});

const updateNoteRoute = createRoute({
  method: 'patch',
  path: '/api/notes/{noteId}',
  tags: ['Notes'],
  security: bearerSecurity,
  request: {
    params: noteIdParams,
    body: {
      required: true,
      content: jsonContent(UpdateNoteSchema),
    },
  },
  responses: {
    200: {
      description: 'Updated owned note.',
      content: jsonContent(NoteSchema),
    },
    400: standardErrorResponses[400],
    401: standardErrorResponses[401],
    404: standardErrorResponses[404],
    500: standardErrorResponses[500],
    503: standardErrorResponses[503],
  },
});

const deleteNoteRoute = createRoute({
  method: 'delete',
  path: '/api/notes/{noteId}',
  tags: ['Notes'],
  security: bearerSecurity,
  request: { params: noteIdParams },
  responses: {
    204: {
      description: 'Deleted owned note.',
    },
    400: standardErrorResponses[400],
    401: standardErrorResponses[401],
    404: standardErrorResponses[404],
    500: standardErrorResponses[500],
    503: standardErrorResponses[503],
  },
});

const requireNote = <Value>(value: Value | null): Value => {
  if (value === null) {
    throw new PublicError(404, 'NOT_FOUND', 'The requested note was not found.');
  }
  return value;
};

export const registerNoteRoutes = (
  app: OpenAPIHono<AppBindings>,
  repository: ToolboxRepository
): void => {
  app.openapi(createNoteRoute, async context => {
    const auth = context.get('auth');
    const note = await repository.createNote(auth.sub, context.req.valid('json'));
    return context.json(note, 201);
  });

  app.openapi(listNotesRoute, async context => {
    const auth = context.get('auth');
    return context.json(await repository.listNotes(auth.sub), 200);
  });

  app.openapi(getNoteRoute, async context => {
    const auth = context.get('auth');
    const { noteId } = context.req.valid('param');
    return context.json(requireNote(await repository.findNote(auth.sub, noteId)), 200);
  });

  app.openapi(updateNoteRoute, async context => {
    const auth = context.get('auth');
    const { noteId } = context.req.valid('param');
    const note = await repository.updateNote(auth.sub, noteId, context.req.valid('json'));
    return context.json(requireNote(note), 200);
  });

  app.openapi(deleteNoteRoute, async context => {
    const auth = context.get('auth');
    const { noteId } = context.req.valid('param');
    const deleted = await repository.deleteNote(auth.sub, noteId);
    if (!deleted) {
      throw new PublicError(404, 'NOT_FOUND', 'The requested note was not found.');
    }
    return context.body(null, 204);
  });
};
