import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_BASE_URL } from '../../repo/data-source.config';
import { createRepository } from '../../repo/repository.factory';
import { User } from './user.model';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class UserFeature {
  private readonly repo = createRepository<User>('users');
  private readonly listeners = new Set<(user: User | null) => void>();
  private readonly sessionStorageKey = 'daw-current-user';

  constructor(private http: HttpClient) { }


  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders().set('Authorization', `Bearer ${token}`);
  }

  watchAll(): Observable<User[]> {
    return this.repo.watchAll();
  }

  watchTransportistas(): Observable<any[]> {
    return this.http.get<{ userId: string; userName: string; userEmail: string; userRole: string; }[]>(
      `${API_BASE_URL}/users`,
      { params: { role: 'TRANSPORTER' } }
    ).pipe(
      map(users => users.map(u => ({
        id: u.userId,
        userName: u.userName,
        userEmail: u.userEmail,
        userRole: u.userRole,
      })))
    );
  }

  async login(userEmail: string, userPassword: string): Promise<User | null> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail, userPassword })
    });

    const data = await response.json();

    if (!response.ok) {
      // Extrae el mensaje del backend (ajusta según la estructura de tu ErrorResponse)
      const errorMessage = data.message || data.error || 'Credenciales inválidas o servicio no disponible.';
      throw new Error(errorMessage);
    }

    const token = data.token;
    const user: User = {
      id: data.userId,          // Ajusta según tu modelo (puede ser data.id)
      userName: data.userName,
      userEmail: data.userEmail,
      userRole: data.userRole,
      // otros campos si existen
    };

    localStorage.setItem('token', token);
    localStorage.setItem(this.sessionStorageKey, JSON.stringify(user));
    this.notify(user);
    return user;
  }

  async createTransportista(userName: string, userEmail: string, userPassword: string): Promise<string> {
    try {
      const response = await this.http.post<{ id: string }>(`${API_BASE_URL}/users`, {
        userName,
        userEmail,
        userPassword,
        userRole: 'TRANSPORTER'
      }).toPromise();
      return response!.id;
    } catch (error) {
      throw this.handleError(error); // Convierte el error en un mensaje legible
    }
  }

  private handleError(error: HttpErrorResponse | any): never {
    let errorMessage = 'Ocurrió un error inesperado.';
    if (error instanceof HttpErrorResponse) {
      // Intenta extraer el mensaje del backend (puede estar en error.error.message o error.error)
      const backendMessage = error.error?.message || error.error?.error || error.message;
      errorMessage = backendMessage || `Error ${error.status}: ${error.statusText}`;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    // Lanza un nuevo Error para que el componente lo capture
    throw new Error(errorMessage);
  }

  async remove(id: string): Promise<void> {
    await this.http.delete(`${API_BASE_URL}/users/${id}`, { headers: this.getHeaders() }).toPromise();
  }

  onAuthUserChanged(callback: (user: User | null) => void): () => void {
    this.listeners.add(callback);
    callback(this.readSessionUser());
    return () => this.listeners.delete(callback);
  }

  async logout(): Promise<void> {
    localStorage.removeItem(this.sessionStorageKey);
    this.notify(null);
  }

  private readSessionUser(): User | null {
    const raw = localStorage.getItem(this.sessionStorageKey);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }

  private notify(user: User | null): void {
    this.listeners.forEach((listener) => listener(user));
  }
}
