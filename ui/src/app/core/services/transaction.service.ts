import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { TransactionView } from '../models';

@Injectable({ providedIn: 'root' })
export class TransactionService {
  constructor(private readonly http: HttpClient) {}

  /** All account transactions in the last `days` (server paginates). */
  getTransactions(days: number): Observable<TransactionView[]> {
    const params = new HttpParams().set('days', days);
    return this.http.get<TransactionView[]>('/api/transactions', { params });
  }
}
