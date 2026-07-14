import { AuthService } from './auth.service';

describe('AuthService.parseUserInfo', () => {
  it('parseUserInfo_withValidJson_returnsParsedObject', () => {
    const raw = JSON.stringify({ WebUserId: '504066', AccountID: '86513205' });
    const info = AuthService.parseUserInfo(raw);
    expect(info.WebUserId).toBe('504066');
    expect(info.AccountID).toBe('86513205');
  });

  it('parseUserInfo_withMalformedJson_returnsEmptyObject', () => {
    expect(AuthService.parseUserInfo('{not valid json')).toEqual({});
  });

  it('parseUserInfo_withUndefined_returnsEmptyObject', () => {
    expect(AuthService.parseUserInfo(undefined)).toEqual({});
  });
});
