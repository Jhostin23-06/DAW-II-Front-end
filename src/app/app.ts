import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AdminPageComponent } from './pages/admin/admin-page';
import { TransportistaPageComponent } from './pages/transportista/transportista-page';
import { ConfirmModalComponent } from './shared/confirm-modal/confirm-modal.component';
import { UserFeature } from './features/users/user.feature';
import { User } from './features/users/user.model';
import { NotificationFeature } from './features/notifications/notification.feature';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminPageComponent, TransportistaPageComponent, ConfirmModalComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  @ViewChild(TransportistaPageComponent) private transportistaPageComponent?: TransportistaPageComponent;

  currentUser: User | null = null;
  currentView: 'login' | 'admin-maintenance' | 'TRANSPORTER' = 'login';
  unreadNotificationsCount = 0;

  loginForm = {
    userEmail: '',
    userPassword: ''
  };

  lastError = '';
  isLoading = false;
  showPassword = false;
  private authListenerCleanup: (() => void) | null = null;
  private errorTimer: ReturnType<typeof setTimeout> | null = null;
  private unreadCountStreamSubscription: Subscription | null = null;

  constructor(
    private readonly userFeature: UserFeature,
    private readonly notificationFeature: NotificationFeature
  ) {}

  ngOnInit(): void {
    this.authListenerCleanup = this.userFeature.onAuthUserChanged((user) => {
      this.currentUser = user;
      this.redirectByRole();
      this.syncUnreadNotificationsCounter();
    });
  }

  ngOnDestroy(): void {
    this.authListenerCleanup?.();
    if (this.errorTimer) clearTimeout(this.errorTimer);
    this.unreadCountStreamSubscription?.unsubscribe();
  }

  clearError(): void {
    this.lastError = '';
    if (this.errorTimer) clearTimeout(this.errorTimer);
  }

  private showError(message: string): void {
    this.lastError = message;
    if (this.errorTimer) clearTimeout(this.errorTimer);
    this.errorTimer = setTimeout(() => { this.lastError = ''; }, 5000);
  }

  async login(): Promise<void> {
    this.lastError = '';
    this.isLoading = true;

    try {
      const user = await this.userFeature.login(this.loginForm.userEmail, this.loginForm.userPassword);

      if (!user) {
        this.showError('No se encontro perfil de usuario en el backend.');
        this.currentView = 'login';
        return;
      }

      this.currentUser = user;
      this.redirectByRole();
    } catch (error) {
      this.showError(error instanceof Error ? error.message : 'No se pudo iniciar sesion.');
      this.currentView = 'login';
    } finally {
      this.isLoading = false;
    }
  }

  async logout(): Promise<void> {
    await this.userFeature.logout();
    this.loginForm = { userEmail: '', userPassword: '' };
    this.lastError = '';
    this.currentView = 'login';
  }

  openNotificationsFromHeader(): void {
    if (!this.currentUser || this.currentUser.userRole !== 'TRANSPORTER') {
      return;
    }

    this.currentView = 'TRANSPORTER';
    setTimeout(() => {
      this.transportistaPageComponent?.openNotificationsModal();
    }, 0);
  }

  private redirectByRole(): void {
    if (!this.currentUser) {
      this.currentView = 'login';
      return;
    }

    this.currentView = this.currentUser.userRole === 'ADMIN' ? 'admin-maintenance' : 'TRANSPORTER';
  }

  private syncUnreadNotificationsCounter(): void {
    this.unreadCountStreamSubscription?.unsubscribe();
    this.unreadCountStreamSubscription = null;

    if (!this.currentUser) {
      this.unreadNotificationsCount = 0;
      return;
    }

    if (this.currentUser.userRole !== 'TRANSPORTER') {
      this.unreadNotificationsCount = 0;
      return;
    }

    void this.refreshUnreadNotificationsCount();

    const transportUserId = this.currentUser.id;
    if (transportUserId) {
      this.unreadCountStreamSubscription = this.notificationFeature
        .streamNotifications({ transportUserId })
        .subscribe(() => {
          void this.refreshUnreadNotificationsCount();
        });
    }
  }

  private async refreshUnreadNotificationsCount(): Promise<void> {
    if (!this.currentUser) {
      this.unreadNotificationsCount = 0;
      return;
    }

    if (this.currentUser.userRole !== 'TRANSPORTER') {
      this.unreadNotificationsCount = 0;
      return;
    }

    try {
      this.unreadNotificationsCount = await this.notificationFeature.unreadCountForUser(
        this.currentUser.id
      );
    } catch {
      // Keep UI stable if the notifications service is temporarily unavailable.
      this.unreadNotificationsCount = 0;
    }
  }
}
