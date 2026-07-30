import { ErrorResponseSchema } from '../schemas.js';

export const jsonContent = <Schema>(schema: Schema) => ({
  'application/json': { schema },
});

export const standardErrorResponses = {
  400: {
    description: 'Request validation failed.',
    content: jsonContent(ErrorResponseSchema),
  },
  401: {
    description: 'Bearer access token is missing or invalid.',
    content: jsonContent(ErrorResponseSchema),
  },
  404: {
    description: 'The owned resource was not found.',
    content: jsonContent(ErrorResponseSchema),
  },
  409: {
    description: 'The request conflicts with existing state.',
    content: jsonContent(ErrorResponseSchema),
  },
  500: {
    description: 'Unexpected server error.',
    content: jsonContent(ErrorResponseSchema),
  },
  503: {
    description: 'Authentication keys are temporarily unavailable.',
    content: jsonContent(ErrorResponseSchema),
  },
} as const;

export const bearerSecurity: Record<string, string[]>[] = [{ BearerAuth: [] }];
