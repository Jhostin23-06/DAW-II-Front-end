import { Injectable } from '@angular/core';
import { map, mapTo, merge, Observable, of, Subject, switchMap } from 'rxjs';
import { createRepository } from '../../repo/repository.factory';
import { Transport } from './transport.model';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { API_BASE_URL } from '../../repo/data-source.config';

@Injectable({ providedIn: 'root' })
export class TransportFeature {
  constructor(private http: HttpClient) { }
  private readonly refresh$ = new Subject<void>();

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders().set('Authorization', `Bearer ${token}`);
  }

  private readonly repo = createRepository<Transport>('transports');

  watchAll(): Observable<Transport[]> {
    return merge(of(0), this.refresh$.pipe(mapTo(0))).pipe(
      switchMap(() =>
        this.http.get<any[]>(`${API_BASE_URL}/transports`).pipe(
          map((transports) => transports.map((t) => this.mapTransport(t)))
        )
      )
    );
  }

  watchAssignedToUser(userId: string): Observable<Transport[]> {
    return merge(of(0), this.refresh$.pipe(mapTo(0))).pipe(
      switchMap(() =>
        this.http.get<any[]>(`${API_BASE_URL}/transports`, {
          params: { userId }
        }).pipe(
          map((transports) => transports.map((t) => this.mapTransport(t)))
        )
      )
    );
  }

  private mapTransport(t: any): Transport {
    return {
      id: t.transportId ?? t.id,
      transportType: t.transportType,
      transportLicensePlate: t.transportLicensePlate,
      transportDriver: t.transportDriver,
      transportCapacity: t.transportCapacity,
      transportLocation: t.transportLocation,
      transportStatus: t.transportStatus,
      transportCompany: t.transportCompany,
      transportUserId: t.transportUserId,
      active: t.active,
      available: t.available
    };
  }

  async create(data: Omit<Transport, 'id'>): Promise<string> {
    try {
      const response = await this.http.post<{ id: string }>(`${API_BASE_URL}/transports`, data, { headers: this.getHeaders() }).toPromise();
      this.notifyRefresh();
      return response!.id;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private handleError(error: any): never {
    let errorMessage = 'Ocurrió un error inesperado.';
    if (error instanceof HttpErrorResponse) {
      // Intenta extraer el mensaje del backend (puede estar en error.error.message o error.error)
      const backendMessage = error.error?.message || error.error?.error || error.message;
      errorMessage = backendMessage || `Error ${error.status}: ${error.statusText}`;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    throw new Error(errorMessage);
  }

  async assignToUser(transportId: string, userId: string): Promise<void> {
    try {
      await this.http.patch(`${API_BASE_URL}/transports/${transportId}/assign`, { userId }).toPromise();
      this.notifyRefresh();
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateStatus(
    transportId: string,
    data: { transportStatus: 'AVAILABLE' | 'IN_TRANSIT' | 'MAINTENANCE' | 'OUT_OF_SERVICE'; location?: string; reason?: string }
  ): Promise<void> {
    try {
      await this.http.put(`${API_BASE_URL}/transports/${transportId}/status`, data).toPromise();
      this.notifyRefresh();
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async remove(id: string): Promise<void> {
    await this.repo.remove(id);
    this.notifyRefresh();
  }

  private notifyRefresh(): void {
    this.refresh$.next();
  }

  refresh(): void {
    this.notifyRefresh();
  }
}
