import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, Subscription } from 'rxjs';
import { CategoryFeature } from '../../features/categories/category.feature';
import { Category } from '../../features/categories/category.model';
import { ClientFeature } from '../../features/clients/client.feature';
import { Client } from '../../features/clients/client.model';
import { ShipmentFeature } from '../../features/shipments/shipment.feature';
import { Shipment } from '../../features/shipments/shipment.model';
import { StatusFeature } from '../../features/statuses/status.feature';
import { ShipmentStatus } from '../../features/statuses/status.model';
import { TransportFeature } from '../../features/transports/transport.feature';
import { Transport } from '../../features/transports/transport.model';
import { ConfirmModalService } from '../../shared/confirm-modal/confirm-modal.service';
import { UserFeature } from '../../features/users/user.feature';
import { User } from '../../features/users/user.model';
import { AuditFeature } from '../../features/audit/audit.feature';
import { AuditEvent, AuditPage } from '../../features/audit/audit.model';
import { NotificationFeature } from '../../features/notifications/notification.feature';
import { NotificationItem, NotificationPage } from '../../features/notifications/notification.model';

type MaintenanceView =
  | 'TRANSPORTER'
  | 'transports'
  | 'clients'
  | 'categories'
  | 'statuses'
  | 'shipments'
  | 'assignments'
  | 'audit'
  | 'notifications';

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-page.html',
  styleUrl: './admin-page.css'
})
export class AdminPageComponent implements OnInit, OnDestroy {
  @Input({ required: true }) currentUser: User | null = null;
  selectedView: MaintenanceView = 'TRANSPORTER';
  isLoading = false;
  private readonly minLoadingMs = 450;

  transportistas: User[] = [];
  transports: Transport[] = [];
  clients: Client[] = [];
  categories: Category[] = [];
  statuses: ShipmentStatus[] = [];
  shipments: Shipment[] = [];
  selectedStatusByShipment: Record<string, string> = {};
  isTransportStatusModalOpen = false;
  transportStatusModal = {
    transportId: '',
    transportLabel: '',
    transportStatus: 'AVAILABLE' as 'AVAILABLE' | 'IN_TRANSIT' | 'MAINTENANCE' | 'OUT_OF_SERVICE',
    location: '',
    reason: ''
  };

  newTransportista = { userName: '', userEmail: '', userPassword: '' };

  newTransport = {
    transportUserId: null as string | null,
    transportType: '',
    transportCapacity: 0,
    transportStatus: 'available',
    transportLocation: '',
    transportDriver: '',
    transportLicensePlate: '',
    transportCompany: ''
  };

  newClient = {
    companyCode: '',
    companyName: '',
    address: '',
    contactName: '',
    email: '',
    phone: ''
  };

  newCategory = { categoryName: '' };
  newStatus = { statusName: '' };

  newShipment = {
    orderNumber: '',
    categoryId: '',
    description: '',
    price: 0,
    weight: 0,
    volume: 0,
    origin: '',
    destination: '',
    status: '',
    atDate: '',
    clientId: '',
    transportId: ''
  };

  assignment = { transportId: '', userId: '' };

  auditFilters = {
    area: 'all' as 'all' | 'ms-clientes' | 'ms-servicios' | 'ms-transportistas' | 'ms-users',
    from: '',
    to: ''
  };
  auditPage: AuditPage<AuditEvent> = this.emptyAuditPage();
  selectedAuditEvent: AuditEvent | null = null;
  selectedAuditEventJson = '';
  showAuditTechnicalInfo = false;
  auditError = '';
  isAuditLoading = false;
  isAuditDetailLoading = false;

  notificationFilters = {
    readState: 'all' as 'all' | 'read' | 'unread'
  };
  notificationPage: NotificationPage<NotificationItem> = this.emptyNotificationPage();
  selectedNotification: NotificationItem | null = null;
  selectedNotificationJson = '';
  notificationError = '';
  unreadNotificationsCount = 0;
  isNotificationLoading = false;
  isNotificationDetailLoading = false;
  isMarkingAllNotifications = false;

  lastError = '';
  lastSuccess = '';

  private readonly subscriptions = new Subscription();
  private successTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly userFeature: UserFeature,
    private readonly transportFeature: TransportFeature,
    private readonly clientFeature: ClientFeature,
    private readonly categoryFeature: CategoryFeature,
    private readonly statusFeature: StatusFeature,
    private readonly shipmentFeature: ShipmentFeature,
    private readonly confirmSvc: ConfirmModalService,
    private readonly auditFeature: AuditFeature,
    private readonly notificationFeature: NotificationFeature
  ) { }

  ngOnInit(): void {
    this.subscriptions.add(this.userFeature.watchTransportistas().subscribe((rows) => (this.transportistas = rows)));
    this.subscriptions.add(this.transportFeature.watchAll().subscribe((rows) => (this.transports = rows)));
    this.subscriptions.add(this.clientFeature.watchAll().subscribe((rows) => (this.clients = rows)));
    this.subscriptions.add(this.categoryFeature.watchAll().subscribe((rows) => (this.categories = rows)));
    this.subscriptions.add(this.statusFeature.watchAll().subscribe((rows) => (this.statuses = rows)));
    this.subscriptions.add(
      this.shipmentFeature.watchAll().subscribe((rows) => {
        this.shipments = rows;
        this.syncSelectedStatusMap();
      })
    );

    void this.refreshAuditEvents();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.successTimer) clearTimeout(this.successTimer);
  }

  async loadTransportistas(): Promise<void> {
    try {
      this.transportistas = await firstValueFrom(this.userFeature.watchTransportistas());
    } catch (error) {
      console.error('Error al cargar transportistas', error);
    }
  }

  // ── Crear ──────────────────────────────────────────────────

  async createTransportista(): Promise<void> {
    await this.runMutation(async () => {
      await this.userFeature.createTransportista(
        this.newTransportista.userName,
        this.newTransportista.userEmail,
        this.newTransportista.userPassword
      );
      this.newTransportista = { userName: '', userEmail: '', userPassword: '' };
      await this.loadTransportistas();
      this.showSuccess('Transportista creado.');
    });
  }

  async createTransport(): Promise<void> {
    await this.runMutation(async () => {
      await this.transportFeature.create(this.newTransport);
      this.newTransport = {
        transportUserId: null,
        transportType: '',
        transportCapacity: 0,
        transportStatus: 'available',
        transportLocation: '',
        transportDriver: '',
        transportLicensePlate: '',
        transportCompany: ''
      };
      await this.loadTransportes();
      this.showSuccess('Transporte creado.');
    });
  }

  async loadTransportes(): Promise<void> {
    try {
      this.transports = await firstValueFrom(this.transportFeature.watchAll());
    } catch (error) {
      console.error('Error al cargar transportes', error);
    }
  }

  onTransportistaChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const value = select.value;
    this.newTransport.transportUserId = value;
    console.log('transportUserId asignado:', this.newTransport.transportUserId);
  }

  async loadClients(): Promise<void> {
    try {
      this.clients = await firstValueFrom(this.clientFeature.watchAll());
    } catch (error) {
      console.error('Error al cargar clientes', error);
    }
  }

  async createClient(): Promise<void> {
    await this.runMutation(async () => {
      await this.clientFeature.create(this.newClient);
      this.newClient = { companyCode: '', companyName: '', address: '', contactName: '', email: '', phone: '' };
      this.loadClients();
      this.showSuccess('Cliente creado.');
    });
  }

  async createCategory(): Promise<void> {
    await this.runMutation(async () => {
      await this.categoryFeature.create(this.newCategory);
      this.newCategory = { categoryName: '' };
      this.showSuccess('Categoria creada.');
    });
  }

  async createStatus(): Promise<void> {
    await this.runMutation(async () => {
      await this.statusFeature.create(this.newStatus);
      this.newStatus = { statusName: '' };
      this.showSuccess('Estado creado.');
    });
  }

  async createShipment(): Promise<void> {
    await this.runMutation(async () => {
      await this.shipmentFeature.create(this.newShipment);
      this.newShipment = {
        orderNumber: '',
        categoryId: '',
        description: '',
        price: 0,
        weight: 0,
        volume: 0,
        origin: '',
        destination: '',
        status: '',
        atDate: '',
        clientId: '',
        transportId: ''
      };
      this.showSuccess('Envio creado.');
    });
  }

  // ── Asignar / cambiar estado ───────────────────────────────

  async assignTransport(): Promise<void> {
    if (!this.assignment.transportId || !this.assignment.userId) {
      this.lastError = 'Selecciona transporte y transportista.';
      this.lastSuccess = '';
      return;
    }

    this.clearMessages();

    try {
      await this.transportFeature.assignToUser(this.assignment.transportId, this.assignment.userId);
      this.assignment = { transportId: '', userId: '' };
      this.transports = await firstValueFrom(this.transportFeature.watchAll());
      this.showSuccess('Transporte asignado.');
    } catch (error) {
      this.lastError = this.errorText(error);
    }
  }

  openTransportStatusModal(transport: Transport): void {
    if (!transport.id) return;
    this.transportStatusModal = {
      transportId: transport.id,
      transportLabel: `${transport.transportType} - ${transport.transportLicensePlate}`,
      transportStatus: (transport.transportStatus as 'AVAILABLE' | 'IN_TRANSIT' | 'MAINTENANCE' | 'OUT_OF_SERVICE') ?? 'AVAILABLE',
      location: transport.transportLocation ?? '',
      reason: ''
    };
    this.isTransportStatusModalOpen = true;
  }

  closeTransportStatusModal(): void {
    this.isTransportStatusModalOpen = false;
  }

  async confirmTransportStatusUpdate(): Promise<void> {
    const transportId = this.transportStatusModal.transportId;
    if (!transportId) {
      this.lastError = 'No se puede actualizar: transporte sin id.';
      return;
    }

    await this.runMutation(async () => {
      await this.transportFeature.updateStatus(transportId, {
        transportStatus: this.transportStatusModal.transportStatus,
        location: this.transportStatusModal.location.trim() || undefined,
        reason: this.transportStatusModal.reason.trim() || undefined
      });
      this.closeTransportStatusModal();
      this.showSuccess('Estado de transporte actualizado.');
    });
  }

  async changeShipmentStatus(shipmentId: string): Promise<void> {
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

    this.clearMessages();

    try {
      await this.shipmentFeature.changeStatus(shipmentId, statusId);
      this.showSuccess('Estado de envio actualizado.');
    } catch (error) {
      this.lastError = this.errorText(error);
    }
  }

  // ── Eliminar ───────────────────────────────────────────────

  async deleteTransportista(userId: string): Promise<void> {
    if (!(await this.confirmSvc.confirm('¿Eliminar este transportista?'))) return;
    await this.runMutation(async () => {
      await this.userFeature.remove(userId);
      await this.loadTransportistas();
      this.showSuccess('Transportista eliminado.');
    });
  }

  async deleteTransport(transportId: string): Promise<void> {
    if (!(await this.confirmSvc.confirm('¿Eliminar este transporte?'))) return;
    await this.runMutation(async () => {
      await this.transportFeature.remove(transportId);
      await this.loadTransportes();
      this.showSuccess('Transporte eliminado.');
    });
  }

  async deleteClient(clientId: string): Promise<void> {
    if (!(await this.confirmSvc.confirm('¿Eliminar este cliente?'))) return;
    await this.runMutation(async () => {
      await this.clientFeature.remove(clientId);
      this.showSuccess('Cliente eliminado.');
    });
  }

  async deleteCategory(categoryId: string): Promise<void> {
    if (!(await this.confirmSvc.confirm('¿Eliminar esta categoría?'))) return;
    await this.runMutation(async () => {
      await this.categoryFeature.remove(categoryId);
      this.showSuccess('Categoria eliminada.');
    });
  }

  async deleteStatus(statusId: string): Promise<void> {
    if (!(await this.confirmSvc.confirm('¿Eliminar este estado?'))) return;
    await this.runMutation(async () => {
      await this.statusFeature.remove(statusId);
      this.showSuccess('Estado eliminado.');
    });
  }

  async deleteShipment(shipmentId: string): Promise<void> {
    if (!(await this.confirmSvc.confirm('¿Eliminar este envío?'))) return;
    await this.runMutation(async () => {
      await this.shipmentFeature.remove(shipmentId);
      this.showSuccess('Envio eliminado.');
    });
  }

  // ── Helpers públicos ───────────────────────────────────────

  statusNameById(statusId: string): string {
    return this.statuses.find((row) => row.id === statusId)?.statusName ?? statusId;
  }

  clientNameById(clientId: string): string {
    if (!clientId) return 'Sin cliente';
    return this.clients.find((row) => String(row.id) === String(clientId))?.companyName ?? `ID ${clientId}`;
  }

  transportLabelById(transportId: string): string {
    if (!transportId) return 'Sin asignar';
    const transport = this.transports.find((row) => String(row.id) === String(transportId));
    if (!transport) return `ID ${transportId}`;
    return `${transport.transportType} - ${transport.transportLicensePlate}`;
  }

  transportistaNameByTransportId(transportId: string): string {
    if (!transportId) return 'Sin asignar';
    const transport = this.transports.find((row) => String(row.id) === String(transportId));
    return this.userNameById(transport?.transportUserId ?? null);
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

  userNameById(userId: string | null): string {
    if (!userId) return 'Sin asignar';
    return this.transportistas.find((row) => row.id === userId)?.userName ?? 'No encontrado';
  }

  setView(view: MaintenanceView): void {
    if (this.isLoading) return;
    this.clearMessages();
    this.selectedView = view;
    if (view === 'audit') {
      void this.refreshAuditEvents(0);
    }
  }

  isView(view: MaintenanceView): boolean {
    return this.selectedView === view;
  }

  async refreshAuditEvents(page: number = this.auditPage.number): Promise<void> {
    if (this.isAuditLoading) return;
    this.auditError = '';
    this.isAuditLoading = true;

    try {
      this.auditPage = await this.auditFeature.findEvents({
        source: this.auditSourceFilterValue(),
        from: this.toIsoDate(this.auditFilters.from),
        to: this.toIsoDate(this.auditFilters.to),
        page,
        size: this.auditPage.size || 20
      });

      if (
        this.selectedAuditEvent &&
        !this.auditPage.content.some((row) => String(row.id) === String(this.selectedAuditEvent?.id))
      ) {
        this.selectedAuditEvent = null;
        this.selectedAuditEventJson = '';
        this.showAuditTechnicalInfo = false;
      }
    } catch (error) {
      this.auditError = this.errorText(error);
      this.auditPage = this.emptyAuditPage();
    } finally {
      this.isAuditLoading = false;
    }
  }

  async applyAuditFilters(): Promise<void> {
    await this.refreshAuditEvents(0);
  }

  async clearAuditFilters(): Promise<void> {
    this.auditFilters = {
      area: 'all',
      from: '',
      to: ''
    };
    await this.refreshAuditEvents(0);
  }

  async goToPreviousAuditPage(): Promise<void> {
    if (this.auditPage.first) return;
    await this.refreshAuditEvents(this.auditPage.number - 1);
  }

  async goToNextAuditPage(): Promise<void> {
    if (this.auditPage.last) return;
    await this.refreshAuditEvents(this.auditPage.number + 1);
  }

  async viewAuditDetail(event: AuditEvent): Promise<void> {
    const isSameEventSelected =
      this.selectedAuditEvent && String(this.selectedAuditEvent.id) === String(event.id);

    if (isSameEventSelected) {
      this.hideAuditDetail();
      return;
    }

    this.selectedAuditEvent = event;
    this.selectedAuditEventJson = this.prettyJson(event.raw);
    this.showAuditTechnicalInfo = false;
    this.auditError = '';

    if (event.id === 'N/A') {
      return;
    }

    this.isAuditDetailLoading = true;
    try {
      const detail = await this.auditFeature.findById(event.auditId ?? event.id);
      this.selectedAuditEvent = detail;
      this.selectedAuditEventJson = this.prettyJson(detail.raw);
    } catch (error) {
      this.auditError = this.errorText(error);
    } finally {
      this.isAuditDetailLoading = false;
    }
  }

  hideAuditDetail(): void {
    this.selectedAuditEvent = null;
    this.selectedAuditEventJson = '';
    this.showAuditTechnicalInfo = false;
  }

  auditRangeLabel(): string {
    if (this.auditPage.totalElements === 0) {
      return '0 eventos';
    }

    const from = this.auditPage.number * this.auditPage.size + 1;
    const to = Math.min((this.auditPage.number + 1) * this.auditPage.size, this.auditPage.totalElements);
    return `${from}-${to} de ${this.auditPage.totalElements}`;
  }

  auditAreaLabel(event: AuditEvent): string {
    const source = (event.source ?? '').toLowerCase();
    if (source.includes('client')) return 'Clientes';
    if (source.includes('servicio') || source.includes('shipment')) return 'Servicios';
    if (source.includes('transport')) return 'Transportes';
    if (source.includes('user')) return 'Usuarios';
    return 'General';
  }

  auditActivityLabel(event: AuditEvent): string {
    const text = this.auditEventText(event);
    if (text.includes('create') || text.includes('created')) return 'Registro creado';
    if (text.includes('assign') || text.includes('assigned')) return 'Asignacion realizada';
    if (text.includes('status') && (text.includes('change') || text.includes('update'))) return 'Estado actualizado';
    if (text.includes('update') || text.includes('changed')) return 'Informacion actualizada';
    if (text.includes('delete') || text.includes('remove') || text.includes('cancel')) return 'Registro eliminado';
    return 'Actividad del sistema';
  }

  auditDescription(event: AuditEvent): string {
    const payload = event.payload;
    const companyName = this.readPayloadField(payload, ['companyName']);
    if (companyName) return `Empresa: ${companyName}`;

    const userName = this.readPayloadField(payload, ['userName']);
    if (userName) return `Usuario: ${userName}`;

    const orderNumber = this.readPayloadField(payload, ['orderNumber']);
    if (orderNumber) return `Envio ${orderNumber}`;

    const transportPlate = this.readPayloadField(payload, ['transportLicensePlate']);
    if (transportPlate) return `Transporte placa ${transportPlate}`;

    const message = this.readPayloadField(payload, ['description', 'message']);
    if (message) return message;

    if (event.correlationId && event.correlationId !== 'N/A') {
      return `Referencia ${event.correlationId}`;
    }

    return this.auditActivityLabel(event);
  }

  auditStatusLabel(event: AuditEvent): string {
    return this.isAuditErrorEvent(event) ? 'Error' : 'Completado';
  }

  auditStatusClass(event: AuditEvent): string {
    return this.isAuditErrorEvent(event) ? 'badge--danger' : 'badge--ok';
  }

  toggleAuditTechnicalInfo(): void {
    this.showAuditTechnicalInfo = !this.showAuditTechnicalInfo;
  }

  async refreshNotificationUnreadCount(): Promise<void> {
    try {
      this.unreadNotificationsCount = await this.notificationFeature.unreadCount();
    } catch (error) {
      this.notificationError = this.errorText(error);
    }
  }

  async refreshNotifications(page: number = this.notificationPage.number): Promise<void> {
    if (this.isNotificationLoading) return;
    this.notificationError = '';
    this.isNotificationLoading = true;

    try {
      this.notificationPage = await this.notificationFeature.findNotifications({
        read: this.notificationReadFilterValue(),
        page,
        size: this.notificationPage.size || 20
      });

      if (
        this.selectedNotification &&
        !this.notificationPage.content.some(
          (row) => String(row.id) === String(this.selectedNotification?.id)
        )
      ) {
        this.hideNotificationDetail();
      }

      await this.refreshNotificationUnreadCount();
    } catch (error) {
      this.notificationError = this.errorText(error);
      this.notificationPage = this.emptyNotificationPage();
    } finally {
      this.isNotificationLoading = false;
    }
  }

  async applyNotificationFilters(): Promise<void> {
    await this.refreshNotifications(0);
  }

  async clearNotificationFilters(): Promise<void> {
    this.notificationFilters = {
      readState: 'all'
    };
    await this.refreshNotifications(0);
  }

  async goToPreviousNotificationPage(): Promise<void> {
    if (this.notificationPage.first) return;
    await this.refreshNotifications(this.notificationPage.number - 1);
  }

  async goToNextNotificationPage(): Promise<void> {
    if (this.notificationPage.last) return;
    await this.refreshNotifications(this.notificationPage.number + 1);
  }

  async viewNotificationDetail(notification: NotificationItem): Promise<void> {
    const isSameNotificationSelected =
      this.selectedNotification && String(this.selectedNotification.id) === String(notification.id);

    if (isSameNotificationSelected) {
      this.hideNotificationDetail();
      return;
    }

    this.selectedNotification = notification;
    this.selectedNotificationJson = this.prettyJson(notification.raw);
    this.notificationError = '';

    if (notification.notificationId === undefined) {
      return;
    }

    this.isNotificationDetailLoading = true;
    try {
      const detail = await this.notificationFeature.findById(notification.notificationId);
      this.selectedNotification = detail;
      this.selectedNotificationJson = this.prettyJson(detail.raw);
    } catch (error) {
      this.notificationError = this.errorText(error);
    } finally {
      this.isNotificationDetailLoading = false;
    }
  }

  hideNotificationDetail(): void {
    this.selectedNotification = null;
    this.selectedNotificationJson = '';
  }

  async markNotificationAsRead(notification: NotificationItem): Promise<void> {
    if (notification.notificationId === undefined || notification.read) return;

    this.notificationError = '';
    try {
      const updated = await this.notificationFeature.markAsRead(notification.notificationId);
      this.notificationPage = {
        ...this.notificationPage,
        content: this.notificationPage.content.map((row) =>
          row.notificationId === updated.notificationId ? updated : row
        )
      };

      if (
        this.selectedNotification &&
        this.selectedNotification.notificationId === updated.notificationId
      ) {
        this.selectedNotification = updated;
        this.selectedNotificationJson = this.prettyJson(updated.raw);
      }

      await this.refreshNotificationUnreadCount();
    } catch (error) {
      this.notificationError = this.errorText(error);
    }
  }

  async markAllNotificationsAsRead(): Promise<void> {
    if (this.isMarkingAllNotifications) return;
    this.notificationError = '';
    this.isMarkingAllNotifications = true;

    try {
      const updated = await this.notificationFeature.markAllAsRead();
      if (updated > 0) {
        this.showSuccess(`${updated} notificaciones marcadas como leidas.`);
      }
      await this.refreshNotifications(this.notificationPage.number);
    } catch (error) {
      this.notificationError = this.errorText(error);
    } finally {
      this.isMarkingAllNotifications = false;
    }
  }

  notificationReadClass(read: boolean): string {
    return read ? 'badge--ok' : 'badge--warn';
  }

  notificationRangeLabel(): string {
    if (this.notificationPage.totalElements === 0) {
      return '0 notificaciones';
    }

    const from = this.notificationPage.number * this.notificationPage.size + 1;
    const to = Math.min(
      (this.notificationPage.number + 1) * this.notificationPage.size,
      this.notificationPage.totalElements
    );
    return `${from}-${to} de ${this.notificationPage.totalElements}`;
  }

  // ── Privados ───────────────────────────────────────────────

  private showSuccess(message: string): void {
    this.lastSuccess = message;
    if (this.successTimer) clearTimeout(this.successTimer);
    this.successTimer = setTimeout(() => { this.lastSuccess = ''; }, 4000);
  }

  private clearMessages(): void {
    this.lastError = '';
    this.lastSuccess = '';
    if (this.successTimer) clearTimeout(this.successTimer);
  }

  private async runMutation(task: () => Promise<void>): Promise<void> {
    if (this.isLoading) return;

    this.clearMessages();
    this.isLoading = true;
    const startedAt = Date.now();

    try {
      await task();
    } catch (error) {
      this.lastError = this.errorText(error);
    } finally {
      const elapsed = Date.now() - startedAt;
      if (elapsed < this.minLoadingMs) {
        await this.sleep(this.minLoadingMs - elapsed);
      }
      this.isLoading = false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private syncSelectedStatusMap(): void {
    const next: Record<string, string> = {};
    this.shipments.forEach((row) => {
      if (!row.id) return;
      next[row.id] = this.selectedStatusByShipment[row.id] ?? row.status;
    });
    this.selectedStatusByShipment = next;
  }

  private emptyAuditPage(): AuditPage<AuditEvent> {
    return {
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: 0,
      size: 20,
      first: true,
      last: true,
      empty: true
    };
  }

  private emptyNotificationPage(): NotificationPage<NotificationItem> {
    return {
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: 0,
      size: 20,
      first: true,
      last: true,
      empty: true
    };
  }

  private notificationReadFilterValue(): boolean | undefined {
    if (this.notificationFilters.readState === 'read') return true;
    if (this.notificationFilters.readState === 'unread') return false;
    return undefined;
  }

  private auditSourceFilterValue(): string | undefined {
    return this.auditFilters.area === 'all' ? undefined : this.auditFilters.area;
  }

  private auditEventText(event: AuditEvent): string {
    return `${event.eventType ?? ''} ${event.routingKey ?? ''}`.toLowerCase();
  }

  private isAuditErrorEvent(event: AuditEvent): boolean {
    const text = this.auditEventText(event);
    return text.includes('error') || text.includes('fail') || text.includes('reject');
  }

  private readPayloadField(payload: unknown, fields: string[]): string | null {
    if (!payload || typeof payload !== 'object') return null;
    const payloadMap = payload as Record<string, unknown>;

    for (const field of fields) {
      const value = payloadMap[field];
      if (value === undefined || value === null) continue;
      const normalized = String(value).trim();
      if (normalized) return normalized;
    }

    return null;
  }

  private toIsoDate(value: string): string | undefined {
    const normalized = value.trim();
    if (!normalized) return undefined;
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return parsed.toISOString();
  }

  private prettyJson(data: unknown): string {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data ?? '');
    }
  }

  private errorText(error: unknown): string {
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object') {
      const anyError = error as {
        message?: string;
        error?: unknown;
      };
      const nested = anyError.error as unknown;
      if (nested) {
        if (typeof nested === 'string') {
          try {
            const parsed = JSON.parse(nested) as { message?: string; error?: string };
            return this.cleanBackendMessage(parsed.message ?? parsed.error ?? nested);
          } catch {
            return this.cleanBackendMessage(nested);
          }
        }
        if (typeof nested === 'object') {
          const nestedObj = nested as { message?: string; error?: string };
          if (nestedObj.message) return this.cleanBackendMessage(nestedObj.message);
          if (nestedObj.error) return this.cleanBackendMessage(nestedObj.error);
        }
      }
      if (anyError.message) return this.cleanBackendMessage(anyError.message);
    }
    return 'Ocurrio un error.';
  }

  private cleanBackendMessage(message: unknown): string {
    if (typeof message !== 'string') return 'Ocurrio un error.';
    let text = message.trim();
    if (text.toLowerCase().startsWith('validation error:')) {
      text = text.slice('validation error:'.length).trim();
    }
    const braceMatch = text.match(/^\{(.+)\}$/);
    if (braceMatch) {
      text = braceMatch[1].trim();
    }
    const mapping = this.fieldMessageOverrides();
    if (text.includes('=')) {
      const [fieldRaw, msgRaw] = text.split('=');
      const field = fieldRaw.trim();
      const msg = msgRaw.trim();
      if (field && mapping[field]) return mapping[field];
      if (msg) return msg;
    }
    if (!text) return 'Ocurrio un error.';
    return text;
  }

  private fieldMessageOverrides(): Record<string, string> {
    return {
      transportCapacity: 'La capacidad debe ser positiva.',
      price: 'El precio debe ser positivo.',
      weight: 'El peso debe ser positivo.',
      volume: 'El volumen debe ser positivo.',
      orderNumber: 'El número de orden es obligatorio.',
      description: 'La descripción es obligatoria.',
      origin: 'El origen es obligatorio.',
      destination: 'El destino es obligatorio.',
      statusId: 'Selecciona un estado válido.',
      categoryId: 'Selecciona una categoría válida.',
      clientId: 'Selecciona un cliente válido.',
      transportId: 'Selecciona un transporte válido.'
    };
  }
}
