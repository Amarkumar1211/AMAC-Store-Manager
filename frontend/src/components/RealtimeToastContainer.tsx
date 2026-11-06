import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  X,
  ArrowRight,
  Volume2,
  VolumeX,
  ExternalLink
} from 'lucide-react';
import { realtimeSync, ToastItem, audioSynth } from '../services/realtimeSync';

interface RealtimeToastContainerProps {
  onNavigate: (tab: string) => void;
}

export const RealtimeToastContainer: React.FC<RealtimeToastContainerProps> = ({ onNavigate }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isMuted, setIsMuted] = useState(audioSynth.isMuted());

  useEffect(() => {
    const unsub = realtimeSync.subscribeToasts((active) => {
      setToasts(active);
    });

    const handleSoundToggle = (e: any) => {
      setIsMuted(e.detail?.muted ?? audioSynth.isMuted());
    };
    window.addEventListener('amac-sound-toggle', handleSoundToggle);

    return () => {
      unsub();
      window.removeEventListener('amac-sound-toggle', handleSoundToggle);
    };
  }, []);

  if (toasts.length === 0) return null;

  const getToastStyles = (type: string) => {
    switch (type) {
      case 'success':
        return {
          bg: 'linear-gradient(135deg, rgba(6, 78, 59, 0.95) 0%, rgba(4, 120, 87, 0.95) 100%)',
          border: '1px solid #34d399',
          iconColor: '#34d399',
          badgeBg: '#10b981',
          shadow: '0 12px 32px -4px rgba(5, 150, 105, 0.45)'
        };
      case 'error':
        return {
          bg: 'linear-gradient(135deg, rgba(127, 29, 29, 0.95) 0%, rgba(153, 27, 27, 0.95) 100%)',
          border: '1px solid #f87171',
          iconColor: '#f87171',
          badgeBg: '#ef4444',
          shadow: '0 12px 32px -4px rgba(220, 38, 38, 0.45)'
        };
      case 'warning':
        return {
          bg: 'linear-gradient(135deg, rgba(120, 53, 15, 0.95) 0%, rgba(180, 83, 9, 0.95) 100%)',
          border: '1px solid #fbbf24',
          iconColor: '#fbbf24',
          badgeBg: '#f59e0b',
          shadow: '0 12px 32px -4px rgba(245, 158, 11, 0.45)'
        };
      default:
        return {
          bg: 'linear-gradient(135deg, rgba(15, 23, 42, 0.96) 0%, rgba(30, 41, 59, 0.96) 100%)',
          border: '1px solid #38bdf8',
          iconColor: '#38bdf8',
          badgeBg: '#0284c7',
          shadow: '0 12px 32px -4px rgba(2, 132, 199, 0.45)'
        };
    }
  };

  const getToastIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={20} color="#34d399" />;
      case 'error':
        return <XCircle size={20} color="#f87171" />;
      case 'warning':
        return <AlertTriangle size={20} color="#fbbf24" />;
      default:
        return <Bell size={20} color="#38bdf8" />;
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        maxWidth: '420px',
        width: 'calc(100vw - 48px)',
        pointerEvents: 'none'
      }}
    >
      {toasts.map((toast) => {
        const style = getToastStyles(toast.type);
        return (
          <div
            key={toast.id}
            style={{
              background: style.bg,
              border: style.border,
              boxShadow: style.shadow,
              borderRadius: '14px',
              padding: '16px 18px',
              color: '#ffffff',
              backdropFilter: 'blur(16px)',
              pointerEvents: 'auto',
              animation: 'slideInUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Top Bar: Icon, Title, Close Button */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '6px', borderRadius: '8px', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {getToastIcon(toast.type)}
                </div>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, letterSpacing: '-0.2px', lineHeight: 1.2 }}>
                    {toast.title}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600, marginTop: '2px' }}>
                    ⚡ Instant Live Alert • {new Date(toast.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => audioSynth.setMuted(!isMuted)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255,255,255,0.7)',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px'
                  }}
                  title={isMuted ? 'Unmute alert sounds' : 'Mute alert sounds'}
                >
                  {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
                <button
                  type="button"
                  onClick={() => realtimeSync.removeToast(toast.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255,255,255,0.8)',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px'
                  }}
                  title="Dismiss notification"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Body Description */}
            <p style={{ margin: '0 0 12px 0', fontSize: '0.82rem', lineHeight: 1.4, color: 'rgba(255,255,255,0.92)' }}>
              {toast.message}
            </p>

            {/* Action Bar */}
            {toast.targetTab && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate(toast.targetTab!);
                    realtimeSync.removeToast(toast.id);
                  }}
                  style={{
                    background: '#ffffff',
                    color: '#0f172a',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 14px',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                    transition: 'transform 0.15s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  <span>{toast.actionLabel || 'View Now'}</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            )}

            {/* Animated Bottom Timer Bar */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                height: '3px',
                background: 'rgba(255,255,255,0.4)',
                width: '100%',
                animation: 'shrinkWidth 6.5s linear forwards'
              }}
            />
          </div>
        );
      })}
    </div>
  );
};
