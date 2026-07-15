import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DeclarationView } from '../models/DeclarationView';
import { VehicleView } from '../models/VehicleView';

@Injectable({ providedIn: 'root' })
export class HovService {
  constructor(private readonly http: HttpClient) {}

  getVehicles(): Observable<VehicleView[]> {
    return this.http.get<VehicleView[]>('/api/hov/vehicles');
  }

  getStatus(): Observable<DeclarationView[]> {
    return this.http.get<DeclarationView[]>('/api/hov/status');
  }

  /** Activate HOV. Pass an ISO end date/time for a custom range; omit for rest-of-today. */
  activate(
    transponderNumber: string,
    endDateTime?: string,
  ): Observable<{ declarationId: number }> {
    return this.http.post<{ declarationId: number }>('/api/hov/activate', {
      transponderNumber,
      ...(endDateTime ? { endDateTime } : {}),
    });
  }

  cancel(declarationId: string): Observable<{ result: string }> {
    return this.http.put<{ result: string }>('/api/hov/cancel', { declarationId });
  }
}
