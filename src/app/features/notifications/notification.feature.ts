import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../repo/data-source.config';
import { NotificationItem, NotificationPage, NotificationQuery } from './notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationFeature {
  constructor(private readonly http: HttpClient) {}

  async findNotifications(query: NotificationQuery): Promise<NotificationPage<NotificationItem>> {
    const params = this.buildParams(query);
    const page = await firstValueFrom(
      this.http.get<NotificationPage<Record<string, unknown>>>(`${API_BASE_URL}/notifications`, { params })
    );

    return {
      content: (page.content ?? []).map((row) => this.mapNotification(row)),
      totalElements: page.totalElements ?? 0,
      totalPages: page.totalPages ?? 0,
      number: page.number ?? 0,
      size: page.size ?? (query.size ?? 20),
      first: page.first ?? true,
      last: page.last ?? true,
      empty: page.empty ?? (page.content?.length ?? 0) === 0
    };
  }

  async findById(notificationId: number | string): Promise<NotificationItem> {
    return this.findByIdForUser(notificationId);
  }

  async findByIdForUser(notificationId: number | string, transportUserId?: string): Promise<NotificationItem> {
    let params = new HttpParams();
    if (transportUserId) {
      params = params.set('transportUserId', transportUserId);
    }
    const row = await firstValueFrom(
      this.http.get<Record<string, unknown>>(`${API_BASE_URL}/notifications/${notificationId}`, { params })
    );
    return this.mapNotification(row);
  }

  async markAsRead(notificationId: number | string): Promise<NotificationItem> {
    return this.markAsReadForUser(notificationId);
  }

  async markAsReadForUser(
    notificationId: number | string,
    transportUserId?: string
  ): Promise<NotificationItem> {
    let params = new HttpParams();
    if (transportUserId) {
      params = params.set('transportUserId', transportUserId);
    }
    const row = await firstValueFrom(
      this.http.patch<Record<string, unknown>>(
        `${API_BASE_URL}/notifications/${notificationId}/read`,
        {},
        { params }
      )
    );
    return this.mapNotification(row);
  }

  async markAllAsRead(): Promise<number> {
    return this.markAllAsReadForUser();
  }

  async markAllAsReadForUser(transportUserId?: string): Promise<number> {
    let params = new HttpParams();
    if (transportUserId) {
      params = params.set('transportUserId', transportUserId);
    }
    const response = await firstValueFrom(
      this.http.patch<{ updated?: number }>(`${API_BASE_URL}/notifications/read-all`, {}, { params })
    );
    return Number(response.updated ?? 0);
  }

  async unreadCount(): Promise<number> {
    return this.unreadCountForUser();
  }

  async unreadCountForUser(transportUserId?: string): Promise<number> {
    let params = new HttpParams();
    if (transportUserId) {
      params = params.set('transportUserId', transportUserId);
    }
    const response = await firstValueFrom(
      this.http.get<{ unreadCount?: number }>(`${API_BASE_URL}/notifications/unread-count`, { params })
    );
    return Number(response.unreadCount ?? 0);
  }

  streamNotifications(options: { source?: string; transportUserId: string }): Observable<NotificationItem> {
    return new Observable<NotificationItem>((subscriber) => {
      const params = new URLSearchParams();
      params.set('transportUserId', options.transportUserId);
      if (options.source) {
        params.set('source', options.source);
      }

      const url = `${API_BASE_URL}/notifications/stream?${params.toString()}`;
      const eventSource = new EventSource(url);

      const handleEventMessage = (event: MessageEvent) => {
        try {
          const parsed = JSON.parse(event.data) as Record<string, unknown>;
          subscriber.next(this.mapNotification(parsed));
        } catch {
          // Ignore non-JSON keep-alive messages.
        }
      };

      eventSource.onmessage = handleEventMessage;
      // Support custom event names from backend emitters.
      eventSource.addEventListener('notification', handleEventMessage as EventListener);
      eventSource.addEventListener('notifications', handleEventMessage as EventListener);

      eventSource.onerror = () => {
        // EventSource usually retries automatically; keep stream alive unless explicitly closed.
      };

      return () => {
        eventSource.close();
      };
    });
  }

  private buildParams(query: NotificationQuery): HttpParams {
    let params = new HttpParams();
    const entries: Array<[string, unknown]> = [
      ['source', query.source],
      ['read', query.read],
      ['transportUserId', query.transportUserId],
      ['page', query.page ?? 0],
      ['size', query.size ?? 20]
    ];

    entries.forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      const normalized = String(value).trim();
      if (!normalized) return;
      params = params.set(key, normalized);
    });

    return params;
  }

  private mapNotification(row: Record<string, unknown>): NotificationItem {
    const notificationId = this.readNumber(row['notificationId'] ?? row['id']);
    const id = notificationId !== undefined ? String(notificationId) : 'N/A';

    const raw: Record<string, unknown> = { ...row };
    raw['payload'] = this.parseJsonIfPossible(row['payload']);

    return {
      id,
      notificationId,
      eventSource: this.readString(row['eventSource'] ?? row['source']),
      eventType: this.readString(row['eventType']),
      title: this.readString(row['title']),
      message: this.readString(row['message']),
      payload: raw['payload'],
      correlationId: this.readString(row['correlationId']),
      read: Boolean(row['read']),
      occurredAt: this.readString(row['occurredAt']),
      receivedAt: this.readString(row['receivedAt']),
      readAt: this.readString(row['readAt']),
      raw
    };
  }

  private parseJsonIfPossible(value: unknown): unknown {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed) return value;
    if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return value;
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return value;
    }
  }

  private readString(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;
    const normalized = String(value).trim();
    return normalized || undefined;
  }

  private readNumber(value: unknown): number | undefined {
    if (value === undefined || value === null) return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return undefined;
    return parsed;
  }
}
