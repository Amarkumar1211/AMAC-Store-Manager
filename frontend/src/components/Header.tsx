import React from 'react';
import {
  Search,
  Moon,
  Sun,
  LogOut,
  Bell,
  ArrowDownToLine,
  ArrowUpFromLine,
  Shield,
  FileDown
} from 'lucide-react';
import { User } from '../types';
import { NotificationCenter } from './NotificationCenter';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  globalSearch: string;
  setGlobalSearch: (val: string) => void;
  onQuickAction: (action: string) => void;
  onNavigateTab?: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  isDarkMode,
  setIsDarkMode,
  globalSearch,
  setGlobalSearch,
  onQuickAction,
  onNavigateTab,
}) => {
  const hasAccess = (permissionKey: string) => {
    if (!user) return false;
    if (user.role === 'Admin') return true;
    if (user.permissions && user.permissions.length > 0) {
      if (user.permissions.includes('all')) return true;
      return user.permissions.includes(permissionKey);
    }
    return user.role !== 'Viewer';
  };

  return (
    <header className="header glass-panel">
      <div className="header-left">
        <div className="header-search">
          <Search className="header-search-icon" size={17} />
          <input
            type="text"
            placeholder="Global search: Material M001, GRN, Slip No, PO, Supplier..."
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="header-right">
        <div style={{ display: 'flex', gap: '8px' }}>
          {hasAccess('receipts') && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onQuickAction('new-receipt')}
              title="Record GRN Material Inward"
            >
              <ArrowDownToLine size={15} />
              <span>Inward GRN</span>
            </button>
          )}

          {hasAccess('issues') && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onQuickAction('new-issue')}
              title="Create Material Issue Slip"
            >
              <ArrowUpFromLine size={15} />
              <span>Issue Slip</span>
            </button>
          )}
        </div>

        {/* Live Store & Department Real-Time Notification Bell */}
        <NotificationCenter onNavigateTab={onNavigateTab || (() => {})} />

        <button
          className="header-btn"
          onClick={() => setIsDarkMode(!isDarkMode)}
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="user-profile-badge">
          <div className="user-avatar">
            {user?.fullName?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="user-details">
            <h4>{user?.fullName || 'User'}</h4>
            <span>{user?.role}</span>
          </div>
          <button
            onClick={onLogout}
            style={{ background: 'none', border: 'none', color: '#94a3b8', padding: '4px', marginLeft: '4px' }}
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
};
