import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, from, merge, of, mapTo, switchMap } from 'rxjs';
import { createRepository } from '../../repo/repository.factory';
import { API_BASE_URL } from '../../repo/data-source.config';
import { Shipment } from './shipment.model';

@Injectable({ providedIn: 'root' })
export class ShipmentFeature {
  constructor(private readonly http: HttpClient) {}

  private readonly repo = createRepository<Shipment>('shipments');
  private readonly refresh$ = new Subject<void>();

  watchAll(): Observable<Shipment[]> {
    return merge(of(0), this.refresh$.pipe(mapTo(0))).pipe(
      switchMap(() => from(this.fetchShipments()))
    );
  }

  watchByUser(userId: string, transportId?: string): Observable<Shipment[]> {
    return merge(of(0), this.refresh$.pipe(mapTo(0))).pipe(
      switchMap(() => from(this.fetchShipments({ userId, transportId })))
    );
  }

  watchByTransport(transportId: string): Observable<Shipment[]> {
    return this.repo.watchByField('shipmentTransportId', transportId);
  }

  async create(data: Omit<Shipment, 'id'>): Promise<string> {
    const payload = {
      orderNumber: data.orderNumber,
      categoryId: this.toNumericId(data.categoryId, 'categoryId'),
      description: data.description,
      price: data.price,
      weight: data.weight,
      volume: data.volume,
      origin: data.origin,
      destination: data.destination,
      statusId: this.toNumericId(data.status, 'statusId'),
      atDate: data.atDate,
      clientId: this.toNumericId(data.clientId, 'clientId'),
      transportId: this.toOptionalTransportId(data.transportId)
    };
    const created = await this.http.post<any>(`${API_BASE_URL}/shipments`, payload).toPromise();
    this.notifyRefresh();
    return String(created?.id ?? created?.shipmentId ?? '');
  }

  async assignTransport(shipmentId: string, transportId: string): Promise<void> {
    await this.repo.update(shipmentId, { transportId: transportId });
    this.notifyRefresh();
  }

  async changeStatus(shipmentId: string, statusId: string): Promise<void> {
    if (!shipmentId) {
      throw new Error('No se puede actualizar el estado: el envio no tiene id.');
    }
    const parsedStatusId = Number(statusId);
    if (!Number.isFinite(parsedStatusId)) {
      throw new Error('No se puede actualizar el estado: statusId invalido.');
    }
    await this.http.patch(`${API_BASE_URL}/shipments/${shipmentId}/status`, { statusId: parsedStatusId }).toPromise();
    this.notifyRefresh();
  }

  async remove(id: string): Promise<void> {
    await this.repo.remove(id);
    this.notifyRefresh();
  }

  private async fetchShipments(filters?: { userId?: string; transportId?: string }): Promise<Shipment[]> {
    const params: Record<string, string> = {};
    if (filters?.userId) params['userId'] = filters.userId;
    if (filters?.transportId) params['transportId'] = filters.transportId;
    const shipments = await this.http.get<any[]>(`${API_BASE_URL}/shipments`, { params }).toPromise();
    return (shipments ?? []).map((row) => ({
      id: row.shipmentId ?? row.id,
      orderNumber: row.orderNumber ?? row.shipmentOrderNumber ?? '',
      categoryId: row.categoryId ?? row.shipmentCategoryId ?? '',
      description: row.description ?? row.shipmentDescription ?? '',
      price: row.price ?? row.shipmentPrice ?? 0,
      weight: row.weight ?? row.shipmentWeight ?? 0,
      volume: row.volume ?? row.shipmentVolume ?? 0,
      origin: row.origin ?? row.shipmentOrigin ?? '',
      destination: row.destination ?? row.shipmentDestination ?? '',
      status: row.status ?? row.statusId ?? row.shipmentStatusId ?? '',
      atDate: row.atDate ?? row.shipmentAtDate ?? '',
      clientId: row.clientId ?? row.shipmentClientId ?? '',
      transportId: row.transportId ?? row.shipmentTransportId ?? ''
    }));
  }

  private notifyRefresh(): void {
    this.refresh$.next();
  }

  private toNumericId(value: string, fieldName: string): number {
    const normalized = String(value ?? '').trim();
    if (!/^\d+$/.test(normalized)) {
      throw new Error(`${fieldName} debe ser un id numerico valido.`);
    }
    return Number(normalized);
  }

  private toOptionalTransportId(value: string): string | null {
    const normalized = String(value ?? '').trim();
    if (!normalized) return null;
    if (normalized === 'undefined' || normalized === 'null') return null;
    return normalized;
  }
}
