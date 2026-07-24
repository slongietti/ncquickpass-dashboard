import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Dispute } from '../models/Dispute';
import { DisputeReason } from '../models/DisputeReason';

/** Payload to file a dispute for selected transactions. */
export interface CreateDispute {
  reasonId: number;
  comments: string;
  detailTransactionIds: string[];
}

@Injectable({ providedIn: 'root' })
export class TollExceptionsService {
  constructor(private readonly http: HttpClient) {}

  getDisputes(): Observable<Dispute[]> {
    return this.http.get<Dispute[]>('/api/toll-exceptions/disputes');
  }

  getReasons(): Observable<DisputeReason[]> {
    return this.http.get<DisputeReason[]>('/api/toll-exceptions/reasons');
  }

  createDispute(payload: CreateDispute): Observable<{ caseNumber: string; caseId: number }> {
    return this.http.post<{ caseNumber: string; caseId: number }>(
      '/api/toll-exceptions/disputes',
      payload,
    );
  }

  /** URL for a correspondence document (e.g. the attached vehicle image), streamed by the BFF. */
  documentUrl(documentId: string): string {
    return `/api/toll-exceptions/documents/${encodeURIComponent(documentId)}`;
  }
}
