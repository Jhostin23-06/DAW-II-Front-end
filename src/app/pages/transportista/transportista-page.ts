import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
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

@Component({
  selector: 'app-transportista-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './transportista-page.html',
  styleUrl: './transportista-page.css'
})
export class TransportistaPageComponent implements OnChanges, OnDestroy, OnInit {
  @Input({ required: true }) currentUser: User | null = null;

  transports: Transport[] = [];
  assignedShipments: Shipment[] = [];
  statuses: ShipmentStatus[] = [];
  selectedStatusByShipment: Record<string, string> = {};

  lastError = '';
  lastSuccess = '';
  isLoading = false;

  private readonly fixedSubscriptions = new Subscription();
  private dynamicSubscriptions = new Subscription();
  private successTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private userFeature: UserFeature,
    private readonly transportFeature: TransportFeature,
    private readonly shipmentFeature: ShipmentFeature,
    private readonly statusFeature: StatusFeature
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

  statusNameById(statusId: string): string {
    return this.statuses.find((row) => row.id === statusId)?.statusName ?? statusId;
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
      return;
    }

    this.dynamicSubscriptions.add(
      this.transportFeature.watchAssignedToUser(userId).subscribe((rows) => {
        const currentUserId = String(userId);
        this.transports = rows.filter((row) => String(row.transportUserId ?? '') === currentUserId);
      })
    );

    this.dynamicSubscriptions.add(
      this.shipmentFeature.watchByUser(userId).subscribe((rows) => {
        this.assignedShipments = rows;
        this.syncSelectedStatusMap();
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
}
