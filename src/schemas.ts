import { z } from '@hono/zod-openapi';

export const TEXT_INSPECT_MAX_LENGTH = 100_000;

export const ErrorDetailSchema = z
  .object({
    path: z.string(),
    message: z.string(),
  })
  .openapi('ErrorDetail');

export const ErrorResponseSchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.array(ErrorDetailSchema),
    }),
  })
  .openapi('ErrorResponse');

export const HealthResponseSchema = z
  .object({
    status: z.literal('ok'),
  })
  .openapi('HealthResponse');

export const MeResponseSchema = z
  .object({
    sub: z.string().min(1),
    email: z.string().email().optional(),
    issuer: z.string().url(),
    audience: z.string().min(1),
  })
  .openapi('MeResponse');

const TimestampSchema = z.string().datetime({ offset: true });

export const NoteSchema = z
  .object({
    id: z.string().uuid(),
    ownerSub: z.string().min(1),
    title: z.string().min(1).max(120),
    content: z.string().max(20_000),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .openapi('Note');

export const CreateNoteSchema = z
  .object({
    title: z.string().min(1).max(120),
    content: z.string().max(20_000).default(''),
  })
  .openapi('CreateNote');

export const UpdateNoteSchema = z
  .object({
    title: z.string().min(1).max(120).optional(),
    content: z.string().max(20_000).optional(),
  })
  .refine(value => value.title !== undefined || value.content !== undefined, {
    message: 'At least one field must be provided.',
  })
  .openapi('UpdateNote');

export const ResourceIdParamsSchema = z.object({
  resourceId: z.string().uuid(),
});

const HttpUrlSchema = z
  .string()
  .url()
  .refine(value => {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  }, 'URL must use http or https.');

const TagsSchema = z.array(z.string().trim().min(1).max(50)).max(20);

export const BookmarkSchema = z
  .object({
    id: z.string().uuid(),
    ownerSub: z.string().min(1),
    url: HttpUrlSchema,
    title: z.string().min(1).max(200),
    tags: TagsSchema,
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .openapi('Bookmark');

export const CreateBookmarkSchema = z
  .object({
    url: HttpUrlSchema,
    title: z.string().min(1).max(200),
    tags: TagsSchema.default([]),
  })
  .openapi('CreateBookmark');

export const UpdateBookmarkSchema = z
  .object({
    url: HttpUrlSchema.optional(),
    title: z.string().min(1).max(200).optional(),
    tags: TagsSchema.optional(),
  })
  .refine(
    value => value.url !== undefined || value.title !== undefined || value.tags !== undefined,
    {
      message: 'At least one field must be provided.',
    }
  )
  .openapi('UpdateBookmark');

export const BookmarkListQuerySchema = z.object({
  tag: z.string().trim().min(1).max(50).optional(),
});

export const InspectTextSchema = z
  .object({
    text: z.string().max(TEXT_INSPECT_MAX_LENGTH),
  })
  .openapi('InspectText');

export const TextInspectionSchema = z
  .object({
    codePointCount: z.number().int().nonnegative(),
    utf8ByteCount: z.number().int().nonnegative(),
    wordCount: z.number().int().nonnegative(),
    lineCount: z.number().int().nonnegative(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .openapi('TextInspection');
