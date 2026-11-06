import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { MaterialsPage } from './pages/MaterialsPage';
import { StockLedgerPage } from './pages/StockLedgerPage';
import { ReceiptsPage } from './pages/ReceiptsPage';
import { IssuesPage } from './pages/IssuesPage';
import { StockAdjustmentPage } from './pages/StockAdjustmentPage';
import { PurchaseRequestsPage } from './pages/PurchaseRequestsPage';
import { PurchaseOrdersPage } from './pages/PurchaseOrdersPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { ManufacturingPage } from './pages/ManufacturingPage';
import { MonthlyProjectionPlanPage } from './pages/MonthlyProjectionPlanPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { DepartmentPortalPage } from './pages/DepartmentPortalPage';
import { FifoDashboardPage } from './pages/FifoDashboardPage';
import { RealtimeToastContainer } from './components/RealtimeToastContainer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { realtimeSync } from './services/realtimeSync';
import { User } from './types';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [quickAction, setQuickAction] = useState<string | null>(null);
  const [isFifoFullscreen, setIsFifoFullscreen] = useState<boolean>(false);

  // Initialize Real-Time Synchronization Bus
  useEffect(() => {
    if (token) {
      realtimeSync.start();
    } else {
      realtimeSync.stop();
    }
    return () => {
      realtimeSync.stop();
    };
  }, [token]);

  // Check saved session safely
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem('store_token');
      const savedUser = localStorage.getItem('store_user');
      if (savedToken && savedUser && savedUser !== 'undefined' && savedUser !== 'null') {
        const parsed = JSON.parse(savedUser);
        if (parsed && typeof parsed === 'object' && parsed.username) {
          setToken(savedToken);
          setUser(parsed);
          if (parsed.role === 'DepartmentUser') {
            setActiveTab('department-portal');
          }
        } else {
          localStorage.removeItem('store_token');
          localStorage.removeItem('store_user');
        }
      }
    } catch (err) {
      console.warn('Invalid session in localStorage, clearing:', err);
      localStorage.removeItem('store_token');
      localStorage.removeItem('store_user');
    }
  }, []);

  // Apply Dark Mode to the DOM
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Permissions & Route Guard Check
  useEffect(() => {
    if (!user) return;
    if (user.role === 'DepartmentUser') {
      if (activeTab !== 'department-portal') {
        setActiveTab('department-portal');
      }
      return;
    }
    if (user.role === 'Admin') return;
    if (user.permissions && user.permissions.length > 0) {
      if (user.permissions.includes('all')) return;
      const effectivePerms = user.permissions;
      if (!effectivePerms.includes(activeTab)) {
        const tabPriority = [
          'dashboard', 'fifo', 'department-portal', 'materials', 'stock', 'receipts', 'issues',
          'purchase-requests', 'purchase-orders', 'suppliers',
          'projection-plan', 'manufacturing', 'reports', 'settings'
        ];
        const firstAllowed = tabPriority.find(t => effectivePerms.includes(t)) || 'dashboard';
        if (firstAllowed !== activeTab) {
          setActiveTab(firstAllowed);
        }
      }
    }
  }, [user, activeTab]);

  const handleLoginSuccess = (loggedInUser: User, jwtToken: string) => {
    setUser(loggedInUser);
    setToken(jwtToken);
    if (loggedInUser.role === 'DepartmentUser') {
      setActiveTab('department-portal');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('store_token');
    localStorage.removeItem('store_user');
    setUser(null);
    setToken(null);
  };

  const handleQuickAction = (action: string) => {
    if (action === 'new-receipt') {
      setActiveTab('receipts');
      setQuickAction('new-receipt');
    } else if (action === 'new-issue') {
      setActiveTab('issues');
      setQuickAction('new-issue');
    }
  };

  if (!token || !user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className={`app-container ${isFifoFullscreen ? 'fifo-fullscreen-active' : ''}`}>
      {!isFifoFullscreen && (
        <Sidebar
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setQuickAction(null);
            if (tab !== 'fifo') setIsFifoFullscreen(false);
          }}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
          user={user}
          onLogout={handleLogout}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
        />
      )}

      <div className={`main-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${isFifoFullscreen ? 'fullscreen-kiosk' : ''}`}>
        {!isFifoFullscreen && (
          <Header
            user={user}
            onLogout={handleLogout}
            isDarkMode={isDarkMode}
            setIsDarkMode={setIsDarkMode}
            globalSearch={globalSearch}
            setGlobalSearch={setGlobalSearch}
            onQuickAction={handleQuickAction}
            onNavigateTab={setActiveTab}
          />
        )}

        <RealtimeToastContainer onNavigate={setActiveTab} />

        <main className={`content-area ${isFifoFullscreen ? 'fullscreen-kiosk' : ''}`}>
          <ErrorBoundary key={activeTab} onReset={() => setActiveTab('dashboard')}>
          {activeTab === 'dashboard' && (
            <DashboardPage onNavigate={setActiveTab} onQuickAction={handleQuickAction} />
          )}

          {activeTab === 'fifo' && (
            <FifoDashboardPage
              user={user}
              onNavigateToRequisitions={() => setActiveTab('issues')}
              onNavigateToIssues={() => setActiveTab('issues')}
              isFullscreen={isFifoFullscreen}
              onToggleFullscreen={(val) => setIsFifoFullscreen(val)}
            />
          )}

          {activeTab === 'department-portal' && (
            <DepartmentPortalPage user={user} />
          )}

          {activeTab === 'materials' && (
            <MaterialsPage user={user} />
          )}

          {activeTab === 'stock' && (
            <StockLedgerPage />
          )}

          {activeTab === 'receipts' && (
            <ReceiptsPage
              user={user}
              initialCreateOpen={quickAction === 'new-receipt'}
              onResetQuickAction={() => setQuickAction(null)}
            />
          )}

          {activeTab === 'issues' && (
            <IssuesPage
              user={user}
              initialCreateOpen={quickAction === 'new-issue'}
              onResetQuickAction={() => setQuickAction(null)}
            />
          )}

          {activeTab === 'adjustment' && (
            <StockAdjustmentPage user={user} />
          )}

          {activeTab === 'purchase-requests' && (
            <PurchaseRequestsPage user={user} />
          )}

          {activeTab === 'purchase-orders' && (
            <PurchaseOrdersPage user={user} />
          )}

          {activeTab === 'suppliers' && (
            <SuppliersPage user={user} />
          )}

          {activeTab === 'manufacturing' && (
            <ManufacturingPage user={user} />
          )}

          {activeTab === 'projection-plan' && (
            <MonthlyProjectionPlanPage user={user} />
          )}

          {activeTab === 'reports' && (
            <ReportsPage />
          )}

          {activeTab === 'master-import' && (
            <SettingsPage user={user} initialTab="master-import" onNavigateTab={setActiveTab} />
          )}

          {activeTab === 'settings' && (
            <SettingsPage user={user} onNavigateTab={setActiveTab} />
          )}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};

export default App;
