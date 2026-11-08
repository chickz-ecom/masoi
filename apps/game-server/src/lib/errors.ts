import { ERROR_MESSAGES, type ServerError, type ServerErrorCode } from '@masoi/shared';

export class AppError extends Error {
  constructor(
    public readonly code: ServerErrorCode,
    message?: string,
    public readonly details?: unknown,
  ) {
    super(message ?? ERROR_MESSAGES[code] ?? code);
  }
  toJSON(): ServerError {
    return { code: this.code, message: this.message, ...(this.details === undefined ? {} : { details: this.details }) };
  }
}

export function toServerError(err: unknown): ServerError {
  if (err instanceof AppError) return err.toJSON();
  return { code: 'INTERNAL', message: ERROR_MESSAGES.INTERNAL ?? 'Internal error' };
}

/** HTTP status for an error code. */
export function httpStatus(code: ServerErrorCode): number {
  switch (code) {
    case 'UNAUTHORIZED':
    case 'SESSION_REVOKED':
      return 401;
    case 'NOT_HOST':
    case 'NOT_ALLOWED':
    case 'SPECTATORS_DISABLED':
    case 'REJOIN_DISABLED':
      return 403;
    case 'ROOM_NOT_FOUND':
      return 404;
    case 'RATE_LIMITED':
      return 429;
    case 'INVALID_PAYLOAD':
      return 400;
    case 'INTERNAL':
      return 500;
    default:
      return 409;
  }
}
