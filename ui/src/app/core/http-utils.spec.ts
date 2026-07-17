import { HttpErrorResponse } from '@angular/common/http';
import { serverMessage } from './http-utils';

describe('serverMessage', () => {
  it('serverMessage_stringMessageBody_returnsMessage', () => {
    const err = new HttpErrorResponse({ error: { message: 'Password incorrect' }, status: 401 });
    expect(serverMessage(err)).toBe('Password incorrect');
  });

  it('serverMessage_noMessageField_returnsNull', () => {
    const err = new HttpErrorResponse({ error: {}, status: 500 });
    expect(serverMessage(err)).toBeNull();
  });

  it('serverMessage_nonStringMessage_returnsNull', () => {
    // NestJS validation errors put an array in `message`.
    const err = new HttpErrorResponse({ error: { message: ['a', 'b'] }, status: 400 });
    expect(serverMessage(err)).toBeNull();
  });

  it('serverMessage_noErrorBody_returnsNull', () => {
    const err = new HttpErrorResponse({ status: 0 });
    expect(serverMessage(err)).toBeNull();
  });
});
