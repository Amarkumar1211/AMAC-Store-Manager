import api from './api';

export interface RequisitionLiveEvent {
  eventId: number;
  eventType: 'REQUISITION_RAISED' | 'REQUISITION_ALLOWED' | 'REQUISITION_DENIED' | 'REQUISITION_UPDATED';
  timestamp: string;
  requisitionId: number;
  requisitionNumber: string;
  departmentId?: number;
  departmentName?: string;
  requestedBy?: string;
  totalEstimatedCost: number;
  status: string;
  itemsCount: number;
  resultingIssueSlipNumber?: string;
  denialRemarks?: string;
  message: string;
}

export interface AppNotification {
  id: string;
  eventId: number;
  eventType: 'REQUISITION_RAISED' | 'REQUISITION_ALLOWED' | 'REQUISITION_DENIED' | 'REQUISITION_UPDATED';
  title: string;
  description: string;
  timestamp: Date;
  read: boolean;
  targetTab: 'issues' | 'department-portal';
  requisitionNumber: string;
  requisitionId: number;
  departmentName?: string;
  resultingIssueSlipNumber?: string;
  denialRemarks?: string;
}

export interface ToastItem {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  targetTab?: 'issues' | 'department-portal';
  requisitionNumber?: string;
  requisitionId?: number;
  actionLabel?: string;
}

// ============================================================================
// WEB AUDIO SYNTHESIZER (Crisp, High-Quality Industrial Alert Chimes)
// ============================================================================
class AudioSynthesizer {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  public isMuted(): boolean {
    return localStorage.getItem('amac_sound_enabled') === 'false';
  }

  public setMuted(muted: boolean): void {
    localStorage.setItem('amac_sound_enabled', muted ? 'false' : 'true');
    window.dispatchEvent(new CustomEvent('amac-sound-toggle', { detail: { muted } }));
  }

  // Chime 1: Requisition Raised (Pleasant 3-note ascending arpeggio)
  public playRequisitionRaised(): void {
    if (this.isMuted()) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [440, 554.37, 659.25]; // A4, C#5, E5
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);

        gain.gain.setValueAtTime(0, now + idx * 0.1);
        gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.1 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.4);
      });
    } catch {}
  }

  // Chime 2: Requisition Allowed / Dispatched (Majestic Major Triad Chord)
  public playRequisitionAllowed(): void {
    if (this.isMuted()) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);

        gain.gain.setValueAtTime(0, now + idx * 0.06);
        gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.06 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.5);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.55);
      });
    } catch {}
  }

  // Chime 3: Requisition Denied (Soft distinctive 2-tone warning descent)
  public playRequisitionDenied(): void {
    if (this.isMuted()) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const tones = [587.33, 440]; // D5 -> A4
      tones.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.15);

        gain.gain.setValueAtTime(0, now + idx * 0.15);
        gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.15 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.15);
        osc.stop(now + idx * 0.15 + 0.45);
      });
    } catch {}
  }
}

export const audioSynth = new AudioSynthesizer();

// ============================================================================
// REAL-TIME SYNCHRONIZATION ENGINE
// ============================================================================
type EventSubscriber = (event: RequisitionLiveEvent) => void;
type ToastSubscriber = (toasts: ToastItem[]) => void;
type NotificationSubscriber = (notifications: AppNotification[]) => void;

class RealtimeSyncManager {
  private lastEventId: number = -1;
  private isPolling: boolean = false;
  private pollIntervalMs: number = 1800; // 1.8s instant responsiveness
  private timerId: any = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private isInitialized: boolean = false;

  private eventSubscribers: Set<EventSubscriber> = new Set();
  private toastSubscribers: Set<ToastSubscriber> = new Set();
  private notifSubscribers: Set<NotificationSubscriber> = new Set();

  private activeToasts: ToastItem[] = [];
  private notifications: AppNotification[] = [];

  constructor() {
    this.loadSavedNotifications();

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('amac_store_live_sync');
        this.broadcastChannel.onmessage = (e) => {
          if (e.data && e.data.type === 'REQUISITION_EVENT') {
            this.handleIncomingEvent(e.data.event, false);
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel not supported in this environment', err);
      }
    }
  }

  private loadSavedNotifications() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('amac_store_notifications');
      if (raw) {
        const parsed = JSON.parse(raw);
        this.notifications = (parsed || []).map((n: any) => ({
          ...n,
          timestamp: new Date(n.timestamp)
        }));
      }
    } catch {
      this.notifications = [];
    }
  }

  private persistNotifications() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('amac_store_notifications', JSON.stringify(this.notifications.slice(0, 50)));
    } catch {}
  }

  public start() {
    if (this.isPolling) return;
    this.isPolling = true;
    this.pollLoop();
  }

  public stop() {
    this.isPolling = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  private async pollLoop() {
    if (!this.isPolling) return;

    try {
      if (typeof window === 'undefined') return;
      const token = localStorage.getItem('store_token');
      if (token) {
        // If not initialized, first establish the latest event id
        const sinceParam = this.lastEventId < 0 ? 0 : this.lastEventId;
        const res = await api.get('/store-requisitions/live-feed', {
          params: { since: sinceParam }
        });

        const data = res.data;
        if (data) {
          const events: RequisitionLiveEvent[] = data.events || [];
          const serverLatestId: number = Number(data.latestEventId) || 0;

          if (!this.isInitialized) {
            // Baseline sync: don't bombard user with past historical notifications
            this.lastEventId = serverLatestId;
            this.isInitialized = true;
          } else {
            // Process new events
            const sortedEvents = [...events].sort((a, b) => a.eventId - b.eventId);
            for (const ev of sortedEvents) {
              if (ev.eventId > this.lastEventId) {
                this.handleIncomingEvent(ev, true);
                this.lastEventId = ev.eventId;
              }
            }
            if (serverLatestId > this.lastEventId) {
              this.lastEventId = serverLatestId;
            }
          }
        }
      }
    } catch (err) {
      // Network glitch or token expired, silently retry after standard delay
    } finally {
      if (this.isPolling) {
        this.timerId = setTimeout(() => this.pollLoop(), this.pollIntervalMs);
      }
    }
  }

  private handleIncomingEvent(event: RequisitionLiveEvent, broadcast: boolean) {
    // 1. Broadcast to other tabs if requested
    if (broadcast && this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: 'REQUISITION_EVENT', event });
      } catch {}
    }

    // 2. Play distinct audio chime
    switch (event.eventType) {
      case 'REQUISITION_RAISED':
        audioSynth.playRequisitionRaised();
        break;
      case 'REQUISITION_ALLOWED':
        audioSynth.playRequisitionAllowed();
        break;
      case 'REQUISITION_DENIED':
        audioSynth.playRequisitionDenied();
        break;
      default:
        audioSynth.playRequisitionRaised();
        break;
    }

    // 3. Build Rich Notification
    let title = '';
    let description = '';
    let toastType: 'info' | 'success' | 'warning' | 'error' = 'info';
    let targetTab: 'issues' | 'department-portal' = 'issues';

    if (event.eventType === 'REQUISITION_RAISED') {
      title = `📢 New Requisition: ${event.requisitionNumber}`;
      description = `${event.departmentName || 'Shop Floor'} raised indent for ${event.itemsCount} materials (₹${event.totalEstimatedCost.toLocaleString()}). By: ${event.requestedBy || 'Supervisor'}.`;
      toastType = 'info';
      targetTab = 'issues';
    } else if (event.eventType === 'REQUISITION_ALLOWED') {
      title = `✅ Requisition Allowed: ${event.requisitionNumber}`;
      description = `Store approved indent! Issue Slip ${event.resultingIssueSlipNumber || ''} generated & dispatched for ${event.departmentName}.`;
      toastType = 'success';
      targetTab = 'department-portal';
    } else if (event.eventType === 'REQUISITION_DENIED') {
      title = `❌ Requisition Denied: ${event.requisitionNumber}`;
      description = `Store rejected indent for ${event.departmentName}. Reason: "${event.denialRemarks || 'Stock unavailable / Admin review'}".`;
      toastType = 'error';
      targetTab = 'department-portal';
    } else {
      title = `📝 Requisition Updated: ${event.requisitionNumber}`;
      description = event.message || `Requisition ${event.requisitionNumber} updated.`;
      toastType = 'warning';
      targetTab = 'issues';
    }

    const newNotif: AppNotification = {
      id: `notif_${event.eventId}_${Date.now()}`,
      eventId: event.eventId,
      eventType: event.eventType,
      title,
      description,
      timestamp: new Date(),
      read: false,
      targetTab,
      requisitionNumber: event.requisitionNumber,
      requisitionId: event.requisitionId,
      departmentName: event.departmentName,
      resultingIssueSlipNumber: event.resultingIssueSlipNumber,
      denialRemarks: event.denialRemarks
    };

    // Prepend to notifications list
    this.notifications = [newNotif, ...this.notifications.filter((n) => n.eventId !== event.eventId)].slice(0, 60);
    this.persistNotifications();
    this.notifyNotifSubscribers();

    // 4. Trigger visual Glassmorphic Toast
    this.addToast({
      id: `toast_${event.eventId}_${Date.now()}`,
      type: toastType,
      title,
      message: description,
      timestamp: new Date(),
      targetTab,
      requisitionNumber: event.requisitionNumber,
      requisitionId: event.requisitionId,
      actionLabel: targetTab === 'issues' ? 'Review Indent' : 'View Slip / Details'
    });

    // 5. Notify event subscribers and window custom event
    this.eventSubscribers.forEach((sub) => sub(event));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('amac-requisition-sync', { detail: event }));
    }
  }

  public addToast(toast: ToastItem) {
    this.activeToasts = [toast, ...this.activeToasts.slice(0, 4)];
    this.notifyToastSubscribers();

    // Auto dismiss after 6.5 seconds
    setTimeout(() => {
      this.removeToast(toast.id);
    }, 6500);
  }

  public removeToast(toastId: string) {
    this.activeToasts = this.activeToasts.filter((t) => t.id !== toastId);
    this.notifyToastSubscribers();
  }

  public getNotifications(): AppNotification[] {
    return this.notifications;
  }

  public getUnreadCount(): number {
    return this.notifications.filter((n) => !n.read).length;
  }

  public markAsRead(id: string) {
    this.notifications = this.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    this.persistNotifications();
    this.notifyNotifSubscribers();
  }

  public markAllAsRead() {
    this.notifications = this.notifications.map((n) => ({ ...n, read: true }));
    this.persistNotifications();
    this.notifyNotifSubscribers();
  }

  public clearAll() {
    this.notifications = [];
    this.persistNotifications();
    this.notifyNotifSubscribers();
  }

  // Subscribers
  public subscribeEvents(cb: EventSubscriber): () => void {
    this.eventSubscribers.add(cb);
    return () => this.eventSubscribers.delete(cb);
  }

  public subscribeToasts(cb: ToastSubscriber): () => void {
    this.toastSubscribers.add(cb);
    cb(this.activeToasts);
    return () => this.toastSubscribers.delete(cb);
  }

  private notifyToastSubscribers() {
    this.toastSubscribers.forEach((cb) => cb([...this.activeToasts]));
  }

  public subscribeNotifications(cb: NotificationSubscriber): () => void {
    this.notifSubscribers.add(cb);
    cb(this.notifications);
    return () => this.notifSubscribers.delete(cb);
  }

  private notifyNotifSubscribers() {
    this.notifSubscribers.forEach((cb) => cb([...this.notifications]));
  }
}

export const realtimeSync = new RealtimeSyncManager();
