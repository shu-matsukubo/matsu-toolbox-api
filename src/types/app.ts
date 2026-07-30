export interface AuthContext {
  sub: string;
  email?: string;
  issuer: string;
  audience: string;
}

export interface AppBindings {
  Variables: {
    auth: AuthContext;
    requestId: string;
  };
}

export interface LogEntry {
  event: string;
  level: 'info' | 'warn' | 'error';
  [key: string]: unknown;
}

export type AppLogger = (entry: LogEntry) => void;
