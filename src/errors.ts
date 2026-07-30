export interface ErrorDetail {
  path: string;
  message: string;
}

export type PublicErrorStatus = 400 | 401 | 404 | 409 | 500 | 503;

export class PublicError extends Error {
  constructor(
    readonly statusCode: PublicErrorStatus,
    readonly code: string,
    message: string,
    readonly details: ErrorDetail[] = []
  ) {
    super(message);
    this.name = 'PublicError';
  }
}

export type JwtFailureKind = 'invalid' | 'unavailable';

export class JwtVerificationError extends Error {
  constructor(
    readonly kind: JwtFailureKind,
    options?: ErrorOptions
  ) {
    super(kind === 'unavailable' ? 'JWKS is unavailable.' : 'Access token is invalid.', options);
    this.name = 'JwtVerificationError';
  }
}
