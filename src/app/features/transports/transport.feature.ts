import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { createRepository } from '../../repo/repository.factory';
import { Transport } from './transport.model';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { API_BASE_URL } from '../../repo/data-source.config';

@Injectable({ providedIn: 'root' })
export class TransportFeature {
  constructor(private http: HttpClient) { }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders().set('Authorization', `Bearer ${token}`);
  }

  private readonly repo = createRepository<Transport>('transports');

  watchAll(): Observable<Transport[]> {
    return this.http.get<any[]>(`${API_BASE_URL}/transports`).pipe(
      map((transports) => transports.map((t) => this.mapTransport(t)))
    );
  }

  watchAssignedToUser(userId: string): Observable<Transport[]> {
    return this.http.get<any[]>(`${API_BASE_URL}/transports`, {
      params: { userId }
    }).pipe(
      map((transports) => transports.map((t) => this.mapTransport(t)))
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
      transportUserId: t.transportUserId
    };
  }

  async create(data: Omit<Transport, 'id'>): Promise<string> {
    try {
      const response = await this.http.post<{ id: string }>(`${API_BASE_URL}/transports`, data, { headers: this.getHeaders() }).toPromise();
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
    await this.http.patch(`${API_BASE_URL}/transports/${transportId}/assign`, { userId }).toPromise();
  }

  async remove(id: string): Promise<void> {
    await this.repo.remove(id);
  }
}
