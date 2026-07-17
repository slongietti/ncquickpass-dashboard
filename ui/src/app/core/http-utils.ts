import { HttpErrorResponse } from '@angular/common/http';

/** The message from a NestJS error response body (`{ message }`), if present. */
export function serverMessage(err: HttpErrorResponse): string | null {
  return typeof err?.error?.message === 'string' ? err.error.message : null;
}
