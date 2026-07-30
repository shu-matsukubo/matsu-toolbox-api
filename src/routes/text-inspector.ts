import { createHash } from 'node:crypto';
import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';
import { InspectTextSchema, TextInspectionSchema } from '../schemas.js';
import type { AppBindings } from '../types/app.js';
import { bearerSecurity, jsonContent, standardErrorResponses } from './shared.js';

const inspectTextRoute = createRoute({
  method: 'post',
  path: '/api/tools/text/inspect',
  tags: ['Tools'],
  security: bearerSecurity,
  request: {
    body: {
      required: true,
      content: jsonContent(InspectTextSchema),
    },
  },
  responses: {
    200: {
      description: 'Unicode-aware text metrics.',
      content: jsonContent(TextInspectionSchema),
    },
    400: standardErrorResponses[400],
    401: standardErrorResponses[401],
    500: standardErrorResponses[500],
    503: standardErrorResponses[503],
  },
});

const wordSegmenter = new Intl.Segmenter('und', { granularity: 'word' });

const countWords = (text: string): number => {
  let count = 0;
  for (const segment of wordSegmenter.segment(text)) {
    if (segment.isWordLike) {
      count += 1;
    }
  }
  return count;
};

export const inspectText = (text: string) => ({
  codePointCount: [...text].length,
  utf8ByteCount: Buffer.byteLength(text, 'utf8'),
  wordCount: countWords(text),
  lineCount: text.length === 0 ? 0 : text.split(/\r\n|\r|\n/).length,
  sha256: createHash('sha256').update(text, 'utf8').digest('hex'),
});

export const registerTextInspectorRoutes = (app: OpenAPIHono<AppBindings>): void => {
  app.openapi(inspectTextRoute, context => {
    const { text } = context.req.valid('json');
    return context.json(inspectText(text), 200);
  });
};
