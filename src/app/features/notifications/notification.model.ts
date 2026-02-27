export interface NotificationItem {
  id: string;
  notificationId?: number;
  eventSource?: string;
  eventType?: string;
  title?: string;
  message?: string;
  payload?: unknown;
  correlationId?: string;
  read: boolean;
  occurredAt?: string;
  receivedAt?: string;
  readAt?: string;
  raw: Record<string, unknown>;
}

export interface NotificationQuery {
  source?: string;
  read?: boolean;
  transportUserId?: string;
  page?: number;
  size?: number;
}

export interface NotificationPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}
