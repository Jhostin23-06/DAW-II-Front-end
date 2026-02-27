import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ShipmentFeature } from '../../features/shipments/shipment.feature';
import { Shipment } from '../../features/shipments/shipment.model';
import { StatusFeature } from '../../features/statuses/status.feature';
import { ShipmentStatus } from '../../features/statuses/status.model';
import { TransportFeature } from '../../features/transports/transport.feature';
import { Transport } from '../../features/transports/transport.model';
import { User } from '../../features/users/user.model';
import { UserFeature } from '../../features/users/user.feature';
import { NotificationFeature } from '../../features/notifications/notification.feature';
import { NotificationItem } from '../../features/notifications/notification.model';

@Component({
  selector: 'app-transportista-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './transportista-page.html',
  styleUrl: './transportista-page.css'
})
export class TransportistaPageComponent implements OnChanges, OnDestroy, OnInit {
  @Input({ required: true }) currentUser: User | null = null;
  @Output() unreadCountChange = new EventEmitter<number>();

  transports: Transport[] = [];
  private allAssignedShipments: Shipment[] = [];
  assignedShipments: Shipment[] = [];
  notifications: NotificationItem[] = [];
  notificationFilter: 'unread' | 'all' = 'unread';
  unreadNotificationsCount = 0;
  isNotificationsModalOpen = false;
  statuses: ShipmentStatus[] = [];
  selectedStatusByShipment: Record<string, string> = {};
  isTransportStatusModalOpen = false;
  transportStatusModal = {
    transportId: '',
    transportLabel: '',
    transportStatus: 'AVAILABLE' as 'AVAILABLE' | 'IN_TRANSIT',
    location: '',
    reason: ''
  };

  lastError = '';
  lastSuccess = '';
  notificationError = '';
  isLoading = false;
  isNotificationsLoading = false;
  private isNotificationRefreshPending = false;

  private readonly fixedSubscriptions = new Subscription();
  private dynamicSubscriptions = new Subscription();
  private successTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private userFeature: UserFeature,
    private readonly transportFeature: TransportFeature,
    private readonly shipmentFeature: ShipmentFeature,
    private readonly statusFeature: StatusFeature,
    private readonly notificationFeature: NotificationFeature
  ) {
    this.fixedSubscriptions.add(this.statusFeature.watchAll().subscribe((rows) => (this.statuses = rows)));
  }

  ngOnInit(): void {
    this.userFeature.onAuthUserChanged((user) => {
      this.currentUser = user;
      this.connectAssignedTransportStream();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['currentUser']) {
      this.connectAssignedTransportStream();
    }
  }

  ngOnDestroy(): void {
    this.dynamicSubscriptions.unsubscribe();
    this.fixedSubscriptions.unsubscribe();
    if (this.successTimer) clearTimeout(this.successTimer);
  }

  async changeStatus(shipmentId: string): Promise<void> {
    if (!shipmentId) {
      this.lastError = 'No se puede actualizar: envio sin id.';
      this.lastSuccess = '';
      return;
    }

    const statusId = this.selectedStatusByShipment[shipmentId];

    if (!statusId) {
      this.lastError = 'Selecciona un estado.';
      this.lastSuccess = '';
      return;
    }

    this.lastError = '';
    this.lastSuccess = '';
    this.isLoading = true;

    try {
      await this.shipmentFeature.changeStatus(shipmentId, statusId);
      this.showSuccess('Estado actualizado.');
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'No se pudo actualizar el estado.';
    } finally {
      this.isLoading = false;
    }
  }

  async refreshNotifications(): Promise<void> {
    const transportUserId = this.currentUser?.id ?? null;
    if (!transportUserId) {
      this.notifications = [];
      this.unreadNotificationsCount = 0;
      this.unreadCountChange.emit(this.unreadNotificationsCount);
      return;
    }

    if (this.isNotificationsLoading) {
      this.isNotificationRefreshPending = true;
      return;
    }
    this.notificationError = '';
    this.isNotificationsLoading = true;
    this.isNotificationRefreshPending = false;

    try {
      const unreadPage = await this.notificationFeature.findNotifications({
        read: false,
        transportUserId,
        page: 0,
        size: 1
      });
      this.unreadNotificationsCount = unreadPage.totalElements;

      const page = await this.notificationFeature.findNotifications({
        read: this.notificationFilter === 'unread' ? false : undefined,
        transportUserId,
        page: 0,
        size: 20
      });
      this.notifications = page.content;
      this.unreadCountChange.emit(this.unreadNotificationsCount);
    } catch (error) {
      this.notificationError = error instanceof Error ? error.message : 'No se pudieron cargar notificaciones.';
      this.notifications = [];
      this.unreadNotificationsCount = 0;
      this.unreadCountChange.emit(this.unreadNotificationsCount);
    } finally {
      this.isNotificationsLoading = false;
      if (this.isNotificationRefreshPending) {
        this.isNotificationRefreshPending = false;
        void this.refreshNotifications();
      }
    }
  }

  async onNotificationFilterChange(): Promise<void> {
    await this.refreshNotifications();
  }

  async markNotificationAsRead(notification: NotificationItem): Promise<void> {
    if (notification.notificationId === undefined || notification.read) return;
    const transportUserId = this.currentUser?.id ?? null;
    if (!transportUserId) return;

    this.notificationError = '';
    try {
      await this.notificationFeature.markAsReadForUser(notification.notificationId, transportUserId);
      await this.refreshNotifications();
      this.showSuccess('Notificacion marcada como leida.');
    } catch (error) {
      this.notificationError = error instanceof Error ? error.message : 'No se pudo marcar la notificacion.';
    }
  }

  statusNameById(statusId: string): string {
    return this.statuses.find((row) => row.id === statusId)?.statusName ?? statusId;
  }

  transportStatusClass(status: string | null | undefined): string {
    const value = (status ?? '').toLowerCase();
    if (value.includes('available')) return 'badge--ok';
    if (value.includes('in_transit') || value.includes('transit')) return 'badge--info';
    if (value.includes('maintenance')) return 'badge--warn';
    if (value.includes('out_of_service')) return 'badge--danger';
    return 'badge--muted';
  }

  shipmentStatusClass(status: string): string {
    const value = (status ?? '').toLowerCase();
    if (value.includes('entregado') || value.includes('delivered')) return 'badge--ok';
    if (value.includes('transito') || value.includes('transit')) return 'badge--info';
    if (value.includes('pendiente') || value.includes('por asignar')) return 'badge--warn';
    if (value.includes('cancel') || value.includes('devuelto') || value.includes('rechaz')) return 'badge--danger';
    return 'badge--muted';
  }

  notificationReadClass(read: boolean): string {
    return read ? 'badge--ok' : 'badge--warn';
  }

  openNotificationsModal(): void {
    this.isNotificationsModalOpen = true;
    void this.refreshNotifications();
  }

  closeNotificationsModal(): void {
    this.isNotificationsModalOpen = false;
  }

  private showSuccess(message: string): void {
    this.lastSuccess = message;
    if (this.successTimer) clearTimeout(this.successTimer);
    this.successTimer = setTimeout(() => {
      this.lastSuccess = '';
    }, 4000);
  }

  private connectAssignedTransportStream(): void {
    this.dynamicSubscriptions.unsubscribe();
    this.dynamicSubscriptions = new Subscription();

    const userId = this.currentUser?.id;

    if (!userId) {
      this.transports = [];
      this.assignedShipments = [];
      this.notifications = [];
      this.unreadNotificationsCount = 0;
      this.isNotificationsModalOpen = false;
      return;
    }

    this.dynamicSubscriptions.add(
      this.transportFeature.watchAssignedToUser(userId).subscribe((rows) => {
        const currentUserId = String(userId);
        this.transports = rows.filter(
          (row) => String(row.transportUserId ?? '') === currentUserId && row.active === true
        );
        this.rebuildAssignedShipments();
      })
    );

    this.dynamicSubscriptions.add(
      this.shipmentFeature.watchByUser(userId).subscribe((rows) => {
        this.allAssignedShipments = rows;
        this.rebuildAssignedShipments();
      })
    );

    void this.refreshNotifications();
    this.dynamicSubscriptions.add(
      this.notificationFeature.streamNotifications({ transportUserId: userId }).subscribe({
        next: () => {
          this.transportFeature.refresh();
          this.shipmentFeature.refresh();
          void this.refreshNotifications();
        }
      })
    );
  }

  private syncSelectedStatusMap(): void {
    const next: Record<string, string> = {};
    this.assignedShipments.forEach((row) => {
      if (row.id) {
        next[row.id] = this.selectedStatusByShipment[row.id] ?? row.status;
      }
    });
    this.selectedStatusByShipment = next;
  }

  private rebuildAssignedShipments(): void {
    const activeTransportIds = new Set(
      this.transports.map((row) => String(row.id ?? '')).filter((row) => !!row)
    );
    this.assignedShipments = this.allAssignedShipments.filter((row) =>
      activeTransportIds.has(String(row.transportId ?? ''))
    );
    this.syncSelectedStatusMap();
  }

  openTransportStatusModal(transport: Transport): void {
    if (!transport.id) return;
    this.transportStatusModal = {
      transportId: transport.id,
      transportLabel: `${transport.transportType} - ${transport.transportLicensePlate}`,
      transportStatus: transport.transportStatus === 'IN_TRANSIT' ? 'IN_TRANSIT' : 'AVAILABLE',
      location: transport.transportLocation ?? '',
      reason: ''
    };
    this.isTransportStatusModalOpen = true;
  }

  closeTransportStatusModal(): void {
    this.isTransportStatusModalOpen = false;
  }

  async confirmOwnTransportStatusUpdate(): Promise<void> {
    const transportId = this.transportStatusModal.transportId;
    if (!transportId) {
      this.lastError = 'No se puede actualizar: transporte sin id.';
      this.lastSuccess = '';
      return;
    }

    this.lastError = '';
    this.lastSuccess = '';
    this.isLoading = true;

    try {
      await this.transportFeature.updateStatus(transportId, {
        transportStatus: this.transportStatusModal.transportStatus,
        location: this.transportStatusModal.location.trim() || undefined,
        reason: this.transportStatusModal.reason.trim() || undefined
      });
      this.closeTransportStatusModal();
      this.showSuccess('Estado de transporte actualizado.');
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'No se pudo actualizar el estado del transporte.';
    } finally {
      this.isLoading = false;
    }
  }
}
