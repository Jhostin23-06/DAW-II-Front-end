export interface AuditEvent {
  id: string;
  auditId?: string | number;
  source?: string;
  eventType?: string;
  routingKey?: string;
  correlationId?: string;
  eventAt?: string;
  payload?: unknown;
  metadata?: unknown;
  raw: Record<string, unknown>;
}

export interface AuditEventQuery {
  source?: string;
  eventType?: string;
  routingKey?: string;
  correlationId?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

export interface AuditPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}
