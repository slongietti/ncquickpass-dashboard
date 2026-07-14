import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { AuthState } from './models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly state = signal<AuthState>({ authenticated: false });

  readonly authenticated = computed(() => this.state().authenticated);
  readonly accountId = computed(() => this.state().accountId);

  constructor(private readonly http: HttpClient) {}

  login(username: string, password: string): Observable<AuthState> {
    return this.http
      .post<AuthState>('/api/auth/login', { username, password })
      .pipe(tap((s) => this.state.set(s)));
  }

  logout(): Observable<AuthState> {
    return this.http
      .post<AuthState>('/api/auth/logout', {})
      .pipe(tap(() => this.state.set({ authenticated: false })));
  }

  /** Refresh auth state from the server (used by the route guard). */
  me(): Observable<AuthState> {
    return this.http.get<AuthState>('/api/auth/me').pipe(tap((s) => this.state.set(s)));
  }
}
