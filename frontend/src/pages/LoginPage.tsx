import React, { useState } from 'react';
import {
  Sparkles,
  Lock,
  User as UserIcon,
  Shield,
  CheckCircle,
  AlertCircle,
  Building,
  ArrowRight
} from 'lucide-react';
import api from '../services/api';
import { User } from '../types';
import { FifoDashboardPage } from './FifoDashboardPage';

interface LoginPageProps {
  onLoginSuccess: (user: User, token: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showFifo, setShowFifo] = useState(false);

  if (showFifo) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a' }}>
        <FifoDashboardPage 
          user={null} 
          isFullscreen={!!document.fullscreenElement}
          onToggleFullscreen={(isFs) => {
            if (!isFs) setShowFifo(false);
          }} 
        />
      </div>
    );
  }

  const handleLogin = async (e?: React.FormEvent, customUser?: string, customPass?: string) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    const u = customUser || username;
    const p = customPass || password;

    try {
      const res = await api.post('/auth/login', { username: u, password: p });
      const data = res.data;
      const token = data.token;
      const userObj: User = data.user || {
        id: data.userId || data.id || 1,
        username: data.username || u,
        fullName: data.fullName || data.username || u,
        role: (data.role as any) || 'Admin',
        email: data.email || ''
      };

      localStorage.setItem('store_token', token);
      localStorage.setItem('store_user', JSON.stringify(userObj));
      onLoginSuccess(userObj, token);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Login failed. Please check credentials or ensure backend API is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at top, #1e1b4b 0%, #0f172a 100%)',
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '460px',
        background: '#1e293b',
        borderRadius: '16px',
        padding: '36px 32px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        color: '#f8fafc'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '68px',
            height: '68px',
            borderRadius: '16px',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            padding: '4px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
            border: '2px solid rgba(255, 255, 255, 0.3)'
          }}>
            <img src="/amac_logo.jpg" alt="AMAC Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '12px' }} />
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
            AMAC STORES & INVENTORY
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: '6px' }}>
            ASIAAN METALS & ALUMINIUM CASTINGS PVT LTD — UNIT-5
          </p>
        </div>

        {errorMsg && (
          <div style={{ padding: '12px 14px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', borderRadius: '8px', marginBottom: '20px', fontSize: '0.82rem' }}>
            <AlertCircle size={15} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ color: '#cbd5e1' }}>Username</label>
            <div style={{ position: 'relative' }}>
              <UserIcon size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                type="text"
                required
                className="form-control"
                style={{ paddingLeft: '38px', background: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label" style={{ color: '#cbd5e1' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                type="password"
                required
                className="form-control"
                style={{ paddingLeft: '38px', background: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '12px', fontSize: '0.95rem', fontWeight: 700 }}
          >
            {loading ? 'Authenticating...' : 'Sign In to Store Command'}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '20px' }}>
          <button
            type="button"
            onClick={() => {
              setShowFifo(true);
              document.documentElement.requestFullscreen().catch(() => {});
            }}
            style={{ 
              background: 'transparent', 
              border: '1px solid rgba(255, 255, 255, 0.2)', 
              color: '#94a3b8', 
              padding: '10px 16px', 
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => { e.currentTarget.style.color = '#f8fafc'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)'; }}
            onMouseOut={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'; }}
          >
            View Public FIFO Dashboard
          </button>
        </div>

      </div>
    </div>
  );
};
