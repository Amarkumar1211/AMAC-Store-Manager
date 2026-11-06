import React, { useState } from 'react';
import {
  LayoutDashboard,
  Boxes,
  ClipboardList,
  ArrowDownToLine,
  ArrowUpFromLine,
  FileCheck,
  ShoppingCart,
  Users2,
  TrendingUp,
  FileSpreadsheet,
  Sliders,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sun,
  Moon,
  Warehouse,
  Truck,
  Factory,
  BarChart3,
  Building
} from 'lucide-react';
import { CoreCylinderIcon } from './CoreCylinderIcon';
import { FifoChuteIcon } from './FifoChuteIcon';
import { User } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  user: User | null;
  onLogout: () => void;
  isDarkMode?: boolean;
  setIsDarkMode?: (val: boolean) => void;
}

interface NavItemConfig {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string; color?: string; style?: React.CSSProperties }>;
  tooltip: string;
  permission: string;
  badge?: string;
  isFifo?: boolean;
}

interface NavGroupConfig {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string; color?: string }>;
  items: NavItemConfig[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  collapsed,
  setCollapsed,
  user,
  onLogout,
  isDarkMode = false,
  setIsDarkMode,
}) => {
  const hasAccess = (permissionKey: string) => {
    if (!user) return false;
    if (user.role === 'DepartmentUser') {
      return permissionKey === 'department-portal' || permissionKey === 'issues';
    }
    if (user.role === 'Admin') return true;
    if (user.permissions && user.permissions.length > 0) {
      if (user.permissions.includes('all')) return true;
      return user.permissions.includes(permissionKey);
    }
    // Fallback based on default roles
    if (permissionKey === 'settings' || permissionKey === 'user_management') return user.role === 'StoreManager';
    if (['materials', 'stock', 'receipts', 'issues', 'dashboard', 'department-portal', 'fifo'].includes(permissionKey)) return true;
    if (['purchase-requests', 'purchase-orders', 'suppliers'].includes(permissionKey)) return user.role === 'StoreManager' || user.role === 'PurchaseUser';
    if (['projection-plan', 'manufacturing', 'adjustment', 'reports'].includes(permissionKey)) return user.role === 'StoreManager';
    return false;
  };

  const [sidebarTheme, setSidebarTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('sidebar_theme') as 'dark' | 'light') || 'dark';
    }
    return 'dark';
  });

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    operations: true,
    procurement: true,
    production: true,
    reports: true,
    system: true
  });

  const toggleSidebarTheme = () => {
    const nextTheme = sidebarTheme === 'dark' ? 'light' : 'dark';
    setSidebarTheme(nextTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebar_theme', nextTheme);
    }
  };

  const navGroups: NavGroupConfig[] = [
    {
      id: 'operations',
      label: 'Operations',
      icon: Warehouse,
      items: [
        { id: 'department-portal', label: 'Department Portals', icon: Building, tooltip: 'Department Requisitions & Portals', permission: 'department-portal' },
        { id: 'fifo', label: 'FIFO Board', icon: FifoChuteIcon, tooltip: 'FIFO System Dashboard (13 Chutes Live)', permission: 'fifo', badge: 'Live', isFifo: true },
        { id: 'materials', label: 'Material Master', icon: Boxes, tooltip: 'Material Master (M001-M179)', permission: 'materials' },
        { id: 'stock', label: 'Stock & Ledger', icon: ClipboardList, tooltip: 'Stock & Live Ledger', permission: 'stock' },
        { id: 'receipts', label: 'Material Inward (GRN)', icon: ArrowDownToLine, tooltip: 'Material Inward (GRN)', permission: 'receipts' },
        { id: 'issues', label: 'Material Issue', icon: ArrowUpFromLine, tooltip: 'Material Issue Slip', permission: 'issues' },
        { id: 'adjustment', label: 'Stock Adjustment', icon: Sliders, tooltip: 'Stock Adjustment & Reconciliation', permission: 'adjustment' },
      ]
    },
    {
      id: 'procurement',
      label: 'Procurement',
      icon: Truck,
      items: [
        { id: 'purchase-requests', label: 'Purchase Requests', icon: FileCheck, tooltip: 'Purchase Requests (PR)', permission: 'purchase-requests' },
        { id: 'purchase-orders', label: 'Purchase Orders', icon: ShoppingCart, tooltip: 'Purchase Orders (PO)', permission: 'purchase-orders' },
        { id: 'suppliers', label: 'Suppliers & Prices', icon: Users2, tooltip: 'Suppliers & Pricing Master', permission: 'suppliers' },
      ]
    },
    {
      id: 'production',
      label: 'Production',
      icon: Factory,
      items: [
        { id: 'projection-plan', label: 'Projection Plan', icon: TrendingUp, tooltip: 'Monthly Projection Plan', permission: 'projection-plan', badge: 'Plan' },
        { id: 'manufacturing', label: 'Cores & Cylinders', icon: CoreCylinderIcon, tooltip: 'Cores & Cylinders Master', permission: 'manufacturing' },
      ]
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: BarChart3,
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, tooltip: 'Store Intelligence Overview', permission: 'dashboard' },
        { id: 'reports', label: 'Reports & Exports', icon: FileSpreadsheet, tooltip: 'Reports & Master Excel Dossier', permission: 'reports' },
      ]
    },
    {
      id: 'system',
      label: 'System',
      icon: Settings,
      items: [
        { id: 'settings', label: 'Administration', icon: Settings, tooltip: 'System Administration & Plant Masters', permission: 'settings' },
      ]
    }
  ];

  const getActiveGroup = (tab: string) => {
    for (const group of navGroups) {
      if (group.items.some(item => item.id === tab)) {
        return group.id;
      }
    }
    return 'reports';
  };

  const activeGroup = getActiveGroup(activeTab);

  const isGroupOpen = (groupId: string) => {
    if (groupId === activeGroup) return true;
    return openGroups[groupId] ?? true;
  };

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => ({
      ...prev,
      [groupId]: !(prev[groupId] ?? true)
    }));
  };

  const handleNavClick = (tabId: string) => {
    setActiveTab(tabId);
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${sidebarTheme === 'light' ? 'sidebar-light' : 'sidebar-dark'}`}>
      {/* Brand Header */}
      <div
        className="sidebar-brand"
        onClick={() => handleNavClick('dashboard')}
        style={{ cursor: 'pointer' }}
        title="Go to Dashboard"
      >
        <div className="sidebar-brand-logo">
          <img src="/amac_logo.png" alt="AMAC Logo" />
        </div>
        {!collapsed && (
          <div className="sidebar-brand-info">
            <h1 className="sidebar-brand-title">AMAC STORES</h1>
            <span className="sidebar-brand-subtitle">UNIT-5 ENTERPRISE</span>
          </div>
        )}
      </div>

      {/* Navigation List */}
      {user?.role === 'DepartmentUser' ? (
        <nav className="sidebar-nav">
          <div className="nav-category-group open category-active">
            {!collapsed && (
              <div className="nav-category-header" style={{ cursor: 'default', background: 'rgba(5, 150, 105, 0.15)' }}>
                <div className="nav-category-title-wrap">
                  <Building size={16} className="category-icon" style={{ color: '#059669' }} />
                  <span className="category-title" style={{ color: '#059669', fontWeight: 900, fontSize: '0.82rem' }}>
                    {user.departmentName || 'DEPARTMENT'} PORTAL
                  </span>
                </div>
              </div>
            )}

            <div className="nav-category-children" style={{ display: 'flex', opacity: 1, maxHeight: 'none' }}>
              <button
                className={`nav-link ${activeTab === 'department-portal' ? 'active' : ''}`}
                onClick={() => handleNavClick('department-portal')}
                title="Department Requisitions & Issues"
                style={{ fontWeight: 700 }}
              >
                <Building size={18} />
                {!collapsed && <span>Department Dashboard</span>}
                <span className="nav-tooltip">Department Dashboard</span>
              </button>
            </div>
          </div>
        </nav>
      ) : (
        <nav className="sidebar-nav">
          {navGroups.map((group, groupIdx) => {
            const accessibleItems = group.items.filter(item => hasAccess(item.permission));
            if (accessibleItems.length === 0) return null;

            // When Collapsed: render each item directly as a clickable icon button with tooltip
            if (collapsed) {
              return (
                <div key={group.id} className="collapsed-group-container">
                  {groupIdx > 0 && <div className="collapsed-divider" />}
                  {accessibleItems.map(item => {
                    const isActive = activeTab === item.id;
                    const isFifoActive = isActive && item.isFifo;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`nav-link collapsed-nav-btn ${isActive ? 'active' : ''} ${isFifoActive ? 'fifo-active' : ''}`}
                        onClick={() => handleNavClick(item.id)}
                        aria-label={item.label}
                        style={
                          item.isFifo && isActive
                            ? {
                                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                                borderLeft: '3px solid #38bdf8',
                                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.45)'
                              }
                            : undefined
                        }
                      >
                        <item.icon
                          size={18}
                          color={item.isFifo && isActive ? '#ffffff' : undefined}
                        />
                        {item.badge && (
                          <span
                            className="collapsed-dot-indicator"
                            style={{ background: item.isFifo ? '#38bdf8' : '#10b981' }}
                          />
                        )}
                        <span className="nav-tooltip">{item.tooltip}</span>
                      </button>
                    );
                  })}
                </div>
              );
            }

            // When Expanded: render full accordion with Category Header + Sub-items
            const isOpen = isGroupOpen(group.id);
            const isGroupActive = activeGroup === group.id;

            return (
              <div
                key={group.id}
                className={`nav-category-group ${isOpen ? 'open' : ''} ${isGroupActive ? 'category-active' : ''}`}
              >
                <button
                  type="button"
                  className="nav-category-header"
                  onClick={() => toggleGroup(group.id)}
                  title={`Toggle ${group.label}`}
                >
                  <div className="nav-category-title-wrap">
                    <group.icon size={16} className="category-icon" />
                    <span className="category-title">{group.label}</span>
                  </div>
                  <div className="nav-category-meta">
                    <ChevronDown size={13} className="category-chevron" />
                  </div>
                </button>

                <div className="nav-category-children">
                  {accessibleItems.map(item => {
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`nav-link ${isActive ? 'active' : ''}`}
                        onClick={() => handleNavClick(item.id)}
                        title={item.label}
                        style={
                          item.isFifo && isActive
                            ? {
                                background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.25) 0%, rgba(30, 58, 138, 0.4) 100%)',
                                borderLeft: '3px solid #38BDF8'
                              }
                            : undefined
                        }
                      >
                        <item.icon size={17} color={item.isFifo && isActive ? '#38BDF8' : undefined} />
                        <span style={item.isFifo ? { fontWeight: 800 } : undefined}>{item.label}</span>
                        {item.badge && (
                          <span
                            className={`badge ${item.isFifo ? 'badge-primary' : 'nav-badge'}`}
                            style={item.isFifo ? { marginLeft: 'auto', fontSize: '0.65rem', padding: '1px 6px' } : undefined}
                          >
                            {item.badge}
                          </span>
                        )}
                        <span className="nav-tooltip">{item.tooltip}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      )}

      {/* Footer Controls & User Profile */}
      <div className="sidebar-footer">
        {/* Sidebar Independent Dark / Light Mode Switch */}
        <button
          type="button"
          className="sidebar-theme-btn"
          onClick={toggleSidebarTheme}
          title={sidebarTheme === 'dark' ? 'Switch Sidebar to Light Mode' : 'Switch Sidebar to Dark Mode'}
        >
          {sidebarTheme === 'dark' ? (
            <>
              <Sun size={16} color="#fbbf24" />
              {!collapsed && <span>Sidebar Light</span>}
            </>
          ) : (
            <>
              <Moon size={16} color="#059669" />
              {!collapsed && <span>Sidebar Dark</span>}
            </>
          )}
        </button>

        {/* User Info / Logout */}
        {user && (
          <div className="sidebar-user-info" title={`${user.fullName || 'User'} (${user.role || 'Admin'})`}>
            <div className="sidebar-user-avatar">
              {user.fullName?.charAt(0).toUpperCase() || 'A'}
            </div>
            {!collapsed && (
              <div className="sidebar-user-meta">
                <span className="sidebar-user-name">{user.fullName || 'Admin'}</span>
                <span className="sidebar-user-role">{user.role || 'Admin'}</span>
              </div>
            )}
            <button
              type="button"
              onClick={onLogout}
              className="sidebar-logout-btn"
              title="Sign Out"
            >
              <LogOut size={15} />
            </button>
          </div>
        )}

        {/* Collapse / Expand Toggle Button */}
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight size={18} />
          ) : (
            <>
              <ChevronLeft size={18} />
              <span>Collapse Sidebar</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
