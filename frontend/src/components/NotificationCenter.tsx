import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Inbox,
  Volume2,
  VolumeX,
  Check,
  Trash2,
  Clock,
  ArrowRight,
  ExternalLink,
  Building,
  Printer
} from 'lucide-react';
import { realtimeSync, AppNotification, audioSynth } from '../services/realtimeSync';

interface NotificationCenterProps {
  onNavigateTab: (tab: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ onNavigateTab }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isMuted, setIsMuted] = useState(audioSynth.isMuted());
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = realtimeSync.subscribeNotifications((items) => {
      setNotifications(items);
    });

    const handleSoundToggle = (e: any) => {
      setIsMuted(e.detail?.muted ?? audioSynth.isMuted());
    };
    window.addEventListener('amac-sound-toggle', handleSoundToggle);

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      unsub();
      window.removeEventListener('amac-sound-toggle', handleSoundToggle);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleToggleSound = () => {
    audioSynth.setMuted(!isMuted);
    setIsMuted(!isMuted);
  };

  const handleItemClick = (notif: AppNotification) => {
    realtimeSync.markAsRead(notif.id);
    onNavigateTab(notif.targetTab);
    setIsOpen(false);
  };

  const formatTimeAgo = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diffSec < 10) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'REQUISITION_ALLOWED':
        return (
          <span style={{ background: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={11} /> Allowed & Issued
          </span>
        );
      case 'REQUISITION_DENIED':
        return (
          <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <XCircle size={11} /> Denied
          </span>
        );
      case 'REQUISITION_RAISED':
        return (
          <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Building size={11} /> Indent Raised
          </span>
        );
      default:
        return (
          <span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800 }}>
            Update
          </span>
        );
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* Trigger Bell Button */}
      <button
        className="header-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Live Store & Department Notifications"
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isOpen ? 'var(--bg-secondary)' : undefined
        }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              minWidth: '18px',
              height: '18px',
              borderRadius: '9px',
              background: '#ef4444',
              color: '#ffffff',
              fontSize: '0.68rem',
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              boxShadow: '0 0 8px rgba(239, 68, 68, 0.7)',
              animation: 'pulse 2s infinite'
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: '380px',
            maxWidth: 'calc(100vw - 24px)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            boxShadow: '0 16px 40px -10px rgba(0, 0, 0, 0.25)',
            zIndex: 99999,
            overflow: 'hidden',
            animation: 'fadeIn 0.15s ease'
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '14px 18px',
              background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={16} color="#34d399" />
              <span style={{ fontWeight: 800, fontSize: '0.92rem' }}>Store Live Feed</span>
              {unreadCount > 0 && (
                <span
                  style={{
                    background: '#10b981',
                    color: '#ffffff',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '0.7rem',
                    fontWeight: 900
                  }}
                >
                  {unreadCount} New
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleToggleSound}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title={isMuted ? 'Alert sounds muted. Click to enable.' : 'Alert sounds active. Click to mute.'}
              >
                {isMuted ? <VolumeX size={13} color="#fca5a5" /> : <Volume2 size={13} color="#34d399" />}
                <span style={{ fontSize: '0.68rem', fontWeight: 700 }}>{isMuted ? 'Muted' : 'Sound ON'}</span>
              </button>

              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={() => realtimeSync.markAllAsRead()}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ffffff',
                    opacity: 0.85,
                    cursor: 'pointer',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textDecoration: 'underline'
                  }}
                  title="Mark all as read"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* List Area */}
          <div
            style={{
              maxHeight: '380px',
              overflowY: 'auto',
              padding: '6px 0'
            }}
          >
            {notifications.length === 0 ? (
              <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Inbox size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>No Notifications Yet</div>
                <div style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                  Live requisition raises, approvals & denials will appear here instantly.
                </div>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleItemClick(notif)}
                  style={{
                    padding: '12px 18px',
                    borderBottom: '1px solid var(--border-color)',
                    background: notif.read ? 'transparent' : 'rgba(5, 150, 105, 0.05)',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = notif.read ? 'transparent' : 'rgba(5, 150, 105, 0.05)')}
                >
                  {!notif.read && (
                    <div
                      style={{
                        position: 'absolute',
                        left: '6px',
                        top: '16px',
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: '#059669'
                      }}
                    />
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    {getEventBadge(notif.eventType)}
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {formatTimeAgo(notif.timestamp)}
                    </span>
                  </div>

                  <div style={{ fontWeight: notif.read ? 700 : 800, fontSize: '0.82rem', color: 'var(--text-primary)', marginBottom: '2px' }}>
                    {notif.title}
                  </div>

                  <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.3, marginBottom: '6px' }}>
                    {notif.description}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary-color)' }}>
                      #{notif.requisitionNumber}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      Open view <ArrowRight size={11} />
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div
              style={{
                padding: '8px 16px',
                background: 'var(--bg-secondary)',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {notifications.length} total activity logs
              </span>
              <button
                type="button"
                onClick={() => realtimeSync.clearAll()}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Trash2 size={12} /> Clear Feed
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
