import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../repo/data-source.config';
import { AuditEvent, AuditEventQuery, AuditPage } from './audit.model';

@Injectable({ providedIn: 'root' })
export class AuditFeature {
  constructor(private readonly http: HttpClient) {}

  async findEvents(query: AuditEventQuery): Promise<AuditPage<AuditEvent>> {
    const params = this.buildParams(query);
    const page = await firstValueFrom(
      this.http.get<AuditPage<Record<string, unknown>>>(`${API_BASE_URL}/audit/events`, { params })
    );

    return {
      content: (page.content ?? []).map((row) => this.mapEvent(row)),
      totalElements: page.totalElements ?? 0,
      totalPages: page.totalPages ?? 0,
      number: page.number ?? 0,
      size: page.size ?? (query.size ?? 20),
      first: page.first ?? true,
      last: page.last ?? true,
      empty: page.empty ?? (page.content?.length ?? 0) === 0
    };
  }

  async findById(auditId: string | number): Promise<AuditEvent> {
    const row = await firstValueFrom(
      this.http.get<Record<string, unknown>>(`${API_BASE_URL}/audit/events/${auditId}`)
    );
    return this.mapEvent(row);
  }

  private buildParams(query: AuditEventQuery): HttpParams {
    let params = new HttpParams();
    const entries: Array<[string, unknown]> = [
      ['source', query.source],
      ['eventType', query.eventType],
      ['routingKey', query.routingKey],
      ['correlationId', query.correlationId],
      ['from', query.from],
      ['to', query.to],
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

  private mapEvent(row: Record<string, unknown>): AuditEvent {
    const normalizedRaw: Record<string, unknown> = { ...row };
    normalizedRaw['payload'] = this.parseJsonIfPossible(
      row['payload'] ?? row['data'] ?? row['body']
    );
    normalizedRaw['metadata'] = this.parseJsonIfPossible(
      row['metadata'] ?? row['meta'] ?? row['headers']
    );

    const auditId = this.readFirst(row, ['auditId', 'id', 'eventId']);
    const source = this.readFirst(row, ['eventSource', 'source', 'service', 'origin']);
    const eventType = this.readFirst(row, ['eventType', 'type']);
    const routingKey = this.readFirst(row, ['routingKey', 'routeKey', 'topic']);
    const correlationId = this.readFirst(row, ['correlationId', 'traceId', 'trackingId']);
    const eventAt = this.readFirst(row, ['eventAt', 'occurredAt', 'createdAt', 'timestamp']);

    const idValue = auditId !== undefined && auditId !== null ? String(auditId) : 'N/A';

    return {
      id: idValue,
      auditId: auditId as string | number | undefined,
      source: source ? String(source) : undefined,
      eventType: eventType ? String(eventType) : undefined,
      routingKey: routingKey ? String(routingKey) : undefined,
      correlationId: correlationId ? String(correlationId) : undefined,
      eventAt: eventAt ? String(eventAt) : undefined,
      payload: normalizedRaw['payload'],
      metadata: normalizedRaw['metadata'],
      raw: normalizedRaw
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

  private readFirst(row: Record<string, unknown>, keys: string[]): unknown {
    for (const key of keys) {
      const value = row[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return value;
      }
    }
    return undefined;
  }
}
