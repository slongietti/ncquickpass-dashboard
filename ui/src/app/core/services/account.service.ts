import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AccountSummary } from '../models';

@Injectable({ providedIn: 'root' })
export class AccountService {
  constructor(private readonly http: HttpClient) {}

  getSummary(): Observable<AccountSummary> {
    return this.http.get<AccountSummary>('/api/account');
  }
}
