import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DeclarationView } from '../models/DeclarationView';
import { VehicleView } from '../models/VehicleView';
import { WeeklySchedule } from '../models/WeeklySchedule';
import { ScheduleDay } from '../models/ScheduleDay';
import { FutureDeclaration } from '../models/FutureDeclaration';

/** Body accepted by PUT /api/hov/schedule. */
export interface PutSchedule {
  transponderNumber: string;
  enabled: boolean;
  timezone?: string;
  days: ScheduleDay[];
  /** NCQP password, only when first enabling scheduling (no credential on file). */
  password?: string;
}

/** An ad-hoc window to check for conflicts with scheduled declarations. */
export interface ConflictCheck {
  transponderNumber: string;
  startDateTime: string;
  endDateTime: string;
}

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

  getSchedule(transponderNumber: string): Observable<WeeklySchedule> {
    const params = new HttpParams().set('transponder', transponderNumber);
    return this.http.get<WeeklySchedule>('/api/hov/schedule', { params });
  }

  putSchedule(schedule: PutSchedule): Observable<WeeklySchedule> {
    return this.http.put<WeeklySchedule>('/api/hov/schedule', schedule);
  }

  deleteSchedule(transponderNumber: string): Observable<{ deleted: boolean }> {
    const params = new HttpParams().set('transponder', transponderNumber);
    return this.http.delete<{ deleted: boolean }>('/api/hov/schedule', { params });
  }

  /** Create a one-off ad-hoc future-dated declaration (requires the password). */
  scheduleAdhoc(
    transponderNumber: string,
    startDateTime: string,
    endDateTime: string,
    password: string,
  ): Observable<FutureDeclaration> {
    return this.http.post<FutureDeclaration>('/api/hov/schedule/adhoc', {
      transponderNumber,
      startDateTime,
      endDateTime,
      password,
    });
  }

  getFutureDeclarations(): Observable<FutureDeclaration[]> {
    return this.http.get<FutureDeclaration[]>('/api/hov/schedule/future-declarations');
  }

  cancelFutureDeclaration(id: string): Observable<{ canceled: boolean }> {
    return this.http.put<{ canceled: boolean }>('/api/hov/schedule/future-declarations/cancel', {
      id,
    });
  }

  checkConflict(check: ConflictCheck): Observable<FutureDeclaration[]> {
    return this.http.post<FutureDeclaration[]>('/api/hov/schedule/conflict-check', check);
  }

  resolveConflict(ids: string[]): Observable<{ canceled: number }> {
    return this.http.post<{ canceled: number }>('/api/hov/schedule/resolve-conflict', { ids });
  }
}
