import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { createRepository } from '../../repo/repository.factory';
import { Client } from './client.model';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { API_BASE_URL } from '../../repo/data-source.config';

@Injectable({ providedIn: 'root' })
export class ClientFeature {
  private readonly repo = createRepository<Client>('clients');

  constructor(private http: HttpClient) { }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders().set('Authorization', `Bearer ${token}`);
  }

  watchAll(): Observable<Client[]> {
    return this.repo.watchAll().pipe(
      map((clients) =>
        clients.map((row: any) => ({
          ...row,
          id: row.clientId ?? row.id
        }))
      )
    );
  }

  async create(data: Omit<Client, 'id'>): Promise<string> {
    try {
          const response = await this.http.post<{ id: string }>(`${API_BASE_URL}/clients`, data, { headers: this.getHeaders() }).toPromise();
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

  async remove(id: string): Promise<void> {
    await this.repo.remove(id);
  }
}
