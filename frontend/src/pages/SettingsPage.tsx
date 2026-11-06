import React, { useEffect, useState } from 'react';
import {
  Settings,
  Users,
  Database,
  Shield,
  ShieldCheck,
  Plus,
  CheckCircle,
  CheckCircle2,
  Check,
  AlertCircle,
  HardDrive,
  Download,
  Activity,
  UserCheck,
  Trash2,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
  Building2,
  Briefcase,
  Phone,
  Tag,
  Eye,
  KeyRound,
  Lock,
  ChevronDown,
  Truck,
  Warehouse,
  Factory,
  FileText,
  Sliders,
  Boxes,
  ClipboardList,
  ArrowDownToLine,
  ArrowUpFromLine,
  ShoppingCart,
  TrendingUp,
  BarChart3,
  FileCheck,
  Users2,
  X,
  PenTool,
  Upload,
  Image as ImageIcon
} from 'lucide-react';
import { CoreCylinderIcon } from '../components/CoreCylinderIcon';
import api from '../services/api';
import { User, AuditLog } from '../types';
import { Modal } from '../components/ModalAndPrintables';
import { MasterDataImportStudio } from '../components/MasterDataImportStudio';

export const PERMISSION_SECTIONS = [
  {
    category: 'Operations',
    color: '#0284c7',
    icon: Warehouse,
    items: [
      { key: 'materials', label: 'Material Master', desc: 'Browse catalog, create & edit SKU specifications', icon: Boxes },
      { key: 'stock', label: 'Stock & Live Ledger', desc: 'Real-time stock quantities, valuation & movements', icon: ClipboardList },
      { key: 'receipts', label: 'Material Inward (GRN)', desc: 'Generate GRNs, quality checks, print receipts', icon: ArrowDownToLine },
      { key: 'issues', label: 'Material Issue Slips', desc: 'Issue materials to departments & shift lines', icon: ArrowUpFromLine },
      { key: 'adjustment', label: 'Stock Adjustment', desc: 'Physical audit variance adjustments', icon: Sliders }
    ]
  },
  {
    category: 'Procurement',
    color: '#059669',
    icon: Truck,
    items: [
      { key: 'purchase-requests', label: 'Purchase Requests (PR)', desc: 'Create, track, and process material requisitions', icon: FileCheck },
      { key: 'purchase-orders', label: 'Purchase Orders (PO)', desc: 'Generate purchase orders & vendor shipments', icon: ShoppingCart },
      { key: 'suppliers', label: 'Suppliers & Pricing', desc: 'Vendor directory, contracts & quotation comparisons', icon: Users2 }
    ]
  },
  {
    category: 'Production',
    color: '#7c3aed',
    icon: Factory,
    items: [
      { key: 'projection-plan', label: 'Monthly Projection Plan', desc: 'Monthly requirement planning & safety buffer ledger', icon: TrendingUp },
      { key: 'manufacturing', label: 'Cores & Cylinders Master', desc: 'Shell cores, cold box cores & cylinder tracking', icon: CoreCylinderIcon }
    ]
  },
  {
    category: 'Reports & Analytics',
    color: '#d97706',
    icon: BarChart3,
    items: [
      { key: 'dashboard', label: 'Executive Dashboard', desc: 'Visual 3D KPI stickers, charts, & store metrics', icon: BarChart3 },
      { key: 'reports', label: 'Reports & Universal Exports', desc: 'Full library of 13 official Excel, CSV & PDF reports', icon: FileSpreadsheet }
    ]
  },
  {
    category: 'Administration & System',
    color: '#dc2626',
    icon: Settings,
    items: [
      { key: 'settings', label: 'Plant System Configuration', desc: 'Company profile, document formats & safety stock buffer days', icon: Settings },
      { key: 'user_management', label: 'User & Access Delegation', desc: 'Create users, reset passwords & delegate permissions to other staff', icon: UserCheck }
    ]
  },
  {
    category: 'Special Operational Privileges',
    color: '#4f46e5',
    icon: Shield,
    items: [
      { key: 'can_export', label: 'Export Data (Excel/CSV/PDF)', desc: 'Permission to download reports and financial ledgers', icon: Download },
      { key: 'can_approve', label: 'Approve Requisitions', desc: 'Authorize PRs and special material allocations', icon: CheckCircle },
      { key: 'can_delete', label: 'Delete Records', desc: 'Permanently remove materials, transactions, or draft PRs', icon: Trash2 }
    ]
  }
];

export const SettingsPage: React.FC<{
  user: User | null;
  initialTab?: 'users' | 'signatures' | 'backup' | 'audit' | 'config' | 'reset' | 'masters' | 'master-import';
  onNavigateTab?: (tab: string) => void;
}> = ({ user, initialTab = 'users', onNavigateTab }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'signatures' | 'backup' | 'audit' | 'config' | 'reset' | 'masters' | 'master-import'>(initialTab);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Digital Signatures Master State
  const [adminSignature, setAdminSignature] = useState<string>(
    localStorage.getItem('sig_store_incharge') || localStorage.getItem('sig_admin') || ''
  );
  const [adminSignatoryName, setAdminSignatoryName] = useState<string>(
    localStorage.getItem('sig_store_incharge_name') || 'System Administrator'
  );
  const [plantManagerSignature, setPlantManagerSignature] = useState<string>(
    localStorage.getItem('sig_plant_manager') || localStorage.getItem('sig_hod') || ''
  );
  const [plantManagerTitle, setPlantManagerTitle] = useState<string>(
    localStorage.getItem('sig_plant_manager_name') || 'Plant Head / HOD'
  );
  const [selectedUserForSig, setSelectedUserForSig] = useState<User | null>(null);
  const [isUserSigModalOpen, setIsUserSigModalOpen] = useState(false);
  const [userSigPreview, setUserSigPreview] = useState<string>('');
  const [isSupSigModalOpen, setIsSupSigModalOpen] = useState(false);
  const [selectedSupForSig, setSelectedSupForSig] = useState<any>(null);
  const [supSigPreview, setSupSigPreview] = useState<string>('');
  const [supDeptFilter, setSupDeptFilter] = useState<string>('All');
  const [supSearch, setSupSearch] = useState<string>('');
  const [sigSuccessMsg, setSigSuccessMsg] = useState<string | null>(null);
  const [sigErrorMsg, setSigErrorMsg] = useState<string | null>(null);

  // Master Data State (Departments, Supervisors, Categories)
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);
  const [supervisorsList, setSupervisorsList] = useState<any[]>([]);
  const [categoriesList, setCategoriesList] = useState<any[]>([]);
  const [mastersLoading, setMastersLoading] = useState(false);
  const [masterSuccessMsg, setMasterSuccessMsg] = useState<string | null>(null);

  // New Department Form State
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');

  // New Supervisor Form State
  const [newSupName, setNewSupName] = useState('');
  const [newSupDept, setNewSupDept] = useState('HPDC Casting');
  const [newSupPhone, setNewSupPhone] = useState('');
  const [newSupShift, setNewSupShift] = useState('Shift A');

  // New Category Form State
  const [newCatName, setNewCatName] = useState('');

  // User Management Extensions (Show Password, Reset Password, Delete User)
  const [userSuccessMsg, setUserSuccessMsg] = useState<string | null>(null);

  // Admin Reset Password Modal
  const [isResetUserPassOpen, setIsResetUserPassOpen] = useState(false);
  const [targetUserForPass, setTargetUserForPass] = useState<User | null>(null);
  const [newAdminSetPassword, setNewAdminSetPassword] = useState('');
  const [resetUserPassLoading, setResetUserPassLoading] = useState(false);

  // Granular Access Control Modal State
  const [isAccessControlOpen, setIsAccessControlOpen] = useState(false);
  const [targetUserForAccess, setTargetUserForAccess] = useState<User | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [accessSaving, setAccessSaving] = useState(false);
  const [permissionCategoryFilter, setPermissionCategoryFilter] = useState<string>('all');

  // Add User State
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('StoreUser');
  const [errorMsg, setErrorMsg] = useState('');

  // Backup State
  const [backupPath, setBackupPath] = useState('');
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupResult, setBackupResult] = useState<any>(null);

  // Master Reset State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [selectedResetType, setSelectedResetType] = useState<'TRANSACTIONS_ONLY' | 'FACTORY_RESET'>('TRANSACTIONS_ONLY');
  const [confirmationPhrase, setConfirmationPhrase] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetResult, setResetResult] = useState<any>(null);
  const [resetError, setResetError] = useState('');

  // Plant System Configuration State (Editable)
  const [plantConfig, setPlantConfig] = useState({
    CompanyName: 'ASIAAN METALS & ALUMINIUM CASTINGS PVT LTD',
    UnitName: 'UNIT-5',
    ContactEmail: 'kdcpurchase@amacpvt.com',
    ContactPhone: '9606082298',
    CompanyAddress: 'No.306, Sompura Industrial Area Nidavanta, Dabspet, Bangalore - 562 132',
    IssueSlipFormatNo: 'KDC-STR-FF-09 Rev 01',
    PrFormatNo: 'GDC-PUR-FF-07 Rev 02',
    GrnFormatNo: 'AMAC-STR-GRN-01 Rev 01',
    TargetDaysStock: '22',
    FifoTickerTheme: 'default',
    FifoTickerText: '*** UNIT-5 FIFO MANAGEMENT SYSTEM *** ENSURE STRICT FIFO COMPLIANCE *** MAINTAIN OPTIMAL STOCK LEVELS *** REPORT ANY DISCREPANCIES IMMEDIATELY *** SAFETY FIRST: ALWAYS WEAR PPE ***',
    FifoTickerBgColor: '#0F172A',
    FifoTickerTextColor: '#38BDF8'
  });
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configMessage, setConfigMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/auth/users');
      setUsersList(res.data);
    } catch (err) {
      console.error('Error fetching users', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/system/audit-logs');
      setAuditLogs(res.data);
    } catch (err) {
      console.error('Error fetching audit logs', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchConfig = async () => {
    setConfigLoading(true);
    try {
      const res = await api.get('/system/config');
      if (Array.isArray(res.data) && res.data.length > 0) {
        const loaded: any = {};
        res.data.forEach((item: any) => {
          if (item.key) loaded[item.key] = item.value;
        });
        setPlantConfig((prev) => ({ ...prev, ...loaded }));
      }
    } catch (err) {
      console.error('Error fetching plant configuration', err);
    } finally {
      setConfigLoading(false);
    }
  };

  const fetchMasters = async () => {
    setMastersLoading(true);
    try {
      const [deptRes, supRes, catRes] = await Promise.allSettled([
        api.get('/departments'),
        api.get('/supervisors'),
        api.get('/categories')
      ]);

      if (deptRes.status === 'fulfilled') setDepartmentsList(deptRes.value.data);
      if (supRes.status === 'fulfilled') setSupervisorsList(supRes.value.data);
      if (catRes.status === 'fulfilled') setCategoriesList(catRes.value.data);
    } catch (err) {
      console.error('Error fetching masters data', err);
    } finally {
      setMastersLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    else if (activeTab === 'audit') fetchAuditLogs();
    else if (activeTab === 'config') fetchConfig();
    else if (activeTab === 'masters') fetchMasters();
  }, [activeTab]);

  // Master Handlers
  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    try {
      await api.post('/departments', { name: newDeptName.trim(), code: newDeptCode.trim() || undefined });
      setNewDeptName('');
      setNewDeptCode('');
      setMasterSuccessMsg('Department added successfully!');
      setTimeout(() => setMasterSuccessMsg(null), 3000);
      fetchMasters();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to add department');
    }
  };

  const handleDeleteDepartment = async (id: number) => {
    if (!window.confirm('Are you sure you want to deactivate this department?')) return;
    try {
      await api.delete(`/departments/${id}`);
      fetchMasters();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete department');
    }
  };

  const handleAddSupervisor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupName.trim()) return;
    try {
      const updated = [
        ...supervisorsList,
        {
          id: supervisorsList.length > 0 ? Math.max(...supervisorsList.map((s: any) => s.id || 0)) + 1 : 1,
          name: newSupName.trim(),
          department: newSupDept,
          phone: newSupPhone.trim() || undefined,
          shift: newSupShift
        }
      ];
      await api.post('/supervisors', updated);
      setSupervisorsList(updated);
      setNewSupName('');
      setNewSupPhone('');
      setMasterSuccessMsg('Plant Supervisor added successfully!');
      setTimeout(() => setMasterSuccessMsg(null), 3000);
    } catch (err: any) {
      alert('Failed to save supervisor.');
    }
  };

  const handleDeleteSupervisor = async (id: number) => {
    if (!window.confirm('Are you sure you want to remove this supervisor?')) return;
    try {
      const updated = supervisorsList.filter((s: any) => s.id !== id);
      await api.post('/supervisors', updated);
      setSupervisorsList(updated);
    } catch (err: any) {
      alert('Failed to delete supervisor.');
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await api.post('/categories', { name: newCatName.trim().toUpperCase() });
      setNewCatName('');
      setMasterSuccessMsg('Material category added successfully!');
      setTimeout(() => setMasterSuccessMsg(null), 3000);
      fetchMasters();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to add category');
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!window.confirm('Are you sure you want to deactivate this category?')) return;
    try {
      await api.delete(`/categories/${id}`);
      fetchMasters();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete category');
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigSaving(true);
    setConfigMessage(null);
    try {
      const res = await api.put('/system/config', plantConfig);
      setConfigMessage({ type: 'success', text: res.data.message || 'Configuration saved successfully!' });
      setTimeout(() => setConfigMessage(null), 4000);
    } catch (err: any) {
      setConfigMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save configuration.' });
    } finally {
      setConfigSaving(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      await api.post('/auth/register', {
        username,
        fullName,
        email,
        password,
        role
      });
      setIsAddUserOpen(false);
      setUsername('');
      setFullName('');
      setEmail('');
      setPassword('');
      setUserSuccessMsg(`User ${fullName} created successfully!`);
      setTimeout(() => setUserSuccessMsg(null), 4000);
      fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to create user.');
    }
  };

  const handleDeleteUser = async (targetUser: User) => {
    if (targetUser.username.toLowerCase() === 'admin' || targetUser.id === user?.id) {
      alert('You cannot delete your own logged-in System Administrator account.');
      return;
    }

    const confirmAction = window.confirm(
      `⚠️ Remove User Account Confirmation:\n\nAre you sure you want to permanently remove user "${targetUser.fullName}" (@${targetUser.username})?\n\nThis is typically done when an employee has left the company.`
    );

    if (!confirmAction) return;

    try {
      const res = await api.delete(`/auth/users/${targetUser.id}`);
      setUserSuccessMsg(res.data?.message || `User account for ${targetUser.fullName} removed.`);
      setTimeout(() => setUserSuccessMsg(null), 4000);
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete user.');
    }
  };

  const openResetUserPassModal = (targetUser: User) => {
    setTargetUserForPass(targetUser);
    setNewAdminSetPassword('');
    setIsResetUserPassOpen(true);
  };

  const handleExecuteResetUserPass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserForPass || !newAdminSetPassword.trim()) return;

    setResetUserPassLoading(true);
    try {
      await api.post(`/auth/users/${targetUserForPass.id}/reset-password`, {
        newPassword: newAdminSetPassword.trim()
      });
      setIsResetUserPassOpen(false);
      setUserSuccessMsg(`Password for @${targetUserForPass.username} reset successfully!`);
      setTimeout(() => setUserSuccessMsg(null), 4000);
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to reset user password.');
    } finally {
      setResetUserPassLoading(false);
    }
  };

  const openUserSigModal = async (u: User) => {
    setSelectedUserForSig(u);
    setUserSigPreview('');
    setIsUserSigModalOpen(true);
    try {
      const res = await api.get(`/auth/users/${u.id}/signature`);
      if (res.data && res.data.signatureDataUrl) {
        setUserSigPreview(res.data.signatureDataUrl);
      }
    } catch (err) {
      console.error('Failed to fetch user signature', err);
    }
  };

  const openAccessControlModal = (targetUser: User) => {
    setTargetUserForAccess(targetUser);
    const currentPerms = targetUser.permissions && targetUser.permissions.length > 0
      ? [...targetUser.permissions]
      : targetUser.role === 'Admin'
      ? [
          'all', 'materials', 'stock', 'receipts', 'issues', 'adjustment',
          'purchase-requests', 'purchase-orders', 'suppliers', 'projection-plan',
          'manufacturing', 'dashboard', 'reports', 'settings', 'user_management',
          'can_export', 'can_approve', 'can_delete'
        ]
      : targetUser.role === 'StoreManager'
      ? [
          'materials', 'stock', 'receipts', 'issues', 'adjustment',
          'purchase-requests', 'purchase-orders', 'suppliers', 'projection-plan',
          'manufacturing', 'dashboard', 'reports', 'user_management', 'can_export', 'can_approve'
        ]
      : targetUser.role === 'PurchaseUser'
      ? ['purchase-requests', 'purchase-orders', 'suppliers', 'materials', 'stock', 'dashboard', 'reports', 'can_export']
      : ['materials', 'stock', 'receipts', 'issues', 'dashboard', 'can_export'];

    setSelectedPermissions(currentPerms);
    setIsAccessControlOpen(true);
  };

  const handleTogglePermission = (key: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key && k !== 'all') : [...prev, key]
    );
  };

  const applyPreset = (presetType: string) => {
    if (presetType === 'admin') {
      setSelectedPermissions([
        'all', 'materials', 'stock', 'receipts', 'issues', 'adjustment',
        'purchase-requests', 'purchase-orders', 'suppliers', 'projection-plan',
        'manufacturing', 'dashboard', 'reports', 'settings', 'user_management',
        'can_export', 'can_approve', 'can_delete'
      ]);
    } else if (presetType === 'manager') {
      setSelectedPermissions([
        'materials', 'stock', 'receipts', 'issues', 'adjustment',
        'purchase-requests', 'purchase-orders', 'suppliers', 'projection-plan',
        'manufacturing', 'dashboard', 'reports', 'user_management', 'can_export', 'can_approve'
      ]);
    } else if (presetType === 'store') {
      setSelectedPermissions([
        'materials', 'stock', 'receipts', 'issues', 'dashboard', 'can_export'
      ]);
    } else if (presetType === 'purchase') {
      setSelectedPermissions([
        'purchase-requests', 'purchase-orders', 'suppliers', 'materials',
        'stock', 'dashboard', 'reports', 'can_export'
      ]);
    } else if (presetType === 'viewer') {
      setSelectedPermissions([
        'dashboard', 'reports', 'stock', 'projection-plan', 'can_export'
      ]);
    } else if (presetType === 'clear') {
      setSelectedPermissions([]);
    }
  };

  const handleSavePermissions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserForAccess) return;
    setAccessSaving(true);
    try {
      await api.post(`/auth/users/${targetUserForAccess.id}/permissions`, {
        permissions: selectedPermissions
      });
      setUserSuccessMsg(`Custom access permissions updated for ${targetUserForAccess.fullName}!`);
      setTimeout(() => setUserSuccessMsg(null), 4000);
      setIsAccessControlOpen(false);
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update user permissions.');
    } finally {
      setAccessSaving(false);
    }
  };

  const handleCreateBackup = async () => {
    setBackupLoading(true);
    setBackupResult(null);
    try {
      const res = await api.post('/backup/create', { destinationFolder: backupPath || undefined });
      setBackupResult(res.data);
    } catch (err: any) {
      setBackupResult({ success: false, message: err.response?.data?.message || 'Backup failed.' });
    } finally {
      setBackupLoading(false);
    }
  };

  const openResetModal = (type: 'TRANSACTIONS_ONLY' | 'FACTORY_RESET') => {
    setSelectedResetType(type);
    setConfirmationPhrase('');
    setAdminPassword('');
    setResetError('');
    setResetResult(null);
    setIsResetModalOpen(true);
  };

  const handleExecuteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetLoading(true);
    try {
      const res = await api.post('/system/master-reset', {
        resetType: selectedResetType,
        confirmationPhrase,
        adminPassword: adminPassword || undefined
      });
      setResetResult(res.data);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.result?.message || (typeof err.response?.data === 'string' ? err.response.data : 'Master Reset failed. Please check administrator password or confirmation phrase.');
      setResetError(msg);
    } finally {
      setResetLoading(false);
    }
  };

  const isAdmin = user?.role === 'Admin';

  return (
    <div className="page-wrapper">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>System Administration & Security</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          User access roles, automated SQL Server database backup, system parameters, data reset & security audit trail
        </p>
      </div>

      {/* Space-Saving Hover Dropdown Selection Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '20px',
          padding: '8px 14px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          width: 'fit-content'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              fontSize: '0.76rem',
              fontWeight: 800,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            Settings Area:
          </span>

          {/* Hover Dropdown Pill */}
          <div className="pbi-hover-dropdown">
            <div className="pbi-hover-pill has-value" style={{ padding: '6px 14px', fontSize: '0.85rem', gap: '8px' }}>
              {activeTab === 'users' && <Users size={16} />}
              {activeTab === 'signatures' && <PenTool size={16} color="#059669" />}
              {activeTab === 'master-import' && <FileSpreadsheet size={16} color="#059669" />}
              {activeTab === 'masters' && <Building2 size={16} />}
              {activeTab === 'config' && <Settings size={16} />}
              {activeTab === 'backup' && <Database size={16} />}
              {activeTab === 'audit' && <Activity size={16} />}
              {activeTab === 'reset' && <Trash2 size={16} color="#ef4444" />}

              <span style={{ fontWeight: 700 }}>
                {activeTab === 'users' && 'User Management & Access Roles'}
                {activeTab === 'signatures' && '✍️ Digital Signatures Master (Admin, Store & HOD)'}
                {activeTab === 'master-import' && 'Universal Master Excel Data Feeder'}
                {activeTab === 'masters' && 'Plant Masters (Depts, Supervisors & Categories)'}
                {activeTab === 'config' && 'Plant System Configuration'}
                {activeTab === 'backup' && 'Database Backup & Recovery'}
                {activeTab === 'audit' && 'Security Audit Logs'}
                {activeTab === 'reset' && 'Master Data Reset (Danger Zone)'}
              </span>
              <ChevronDown size={14} color="var(--text-muted)" />
            </div>

            {/* Hover Flyout Menu */}
            <div className="pbi-hover-flyout" style={{ minWidth: '320px', padding: '6px' }}>
              <div style={{ padding: '4px 8px', fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Access & Security
              </div>
              <div
                className={`pbi-hover-item ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => setActiveTab('users')}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={15} /> User Management & Passwords
                </span>
                {activeTab === 'users' && <Check size={13} color="#059669" />}
              </div>
              <div
                className={`pbi-hover-item ${activeTab === 'signatures' ? 'active' : ''}`}
                onClick={() => setActiveTab('signatures')}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', fontWeight: 700 }}>
                  <PenTool size={15} color="#059669" /> Digital Signatures Master (Admin, Store & HOD)
                </span>
                {activeTab === 'signatures' && <Check size={13} color="#059669" />}
              </div>
              <div
                className={`pbi-hover-item ${activeTab === 'audit' ? 'active' : ''}`}
                onClick={() => setActiveTab('audit')}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={15} /> Security Audit Logs
                </span>
                {activeTab === 'audit' && <Check size={13} color="#059669" />}
              </div>

              <div style={{ margin: '4px 0', borderTop: '1px solid var(--border-color)' }} />
              <div style={{ padding: '4px 8px', fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Plant & Master Setup
              </div>
              <div
                className={`pbi-hover-item ${activeTab === 'master-import' ? 'active' : ''}`}
                onClick={() => setActiveTab('master-import')}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', fontWeight: 700 }}>
                  <FileSpreadsheet size={15} color="#059669" /> Universal Master Excel Feeder
                </span>
                {activeTab === 'master-import' && <Check size={13} color="#059669" />}
              </div>
              <div
                className={`pbi-hover-item ${activeTab === 'masters' ? 'active' : ''}`}
                onClick={() => setActiveTab('masters')}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building2 size={15} /> Plant Masters (Depts & Supervisors)
                </span>
                {activeTab === 'masters' && <Check size={13} color="#059669" />}
              </div>
              <div
                className={`pbi-hover-item ${activeTab === 'config' ? 'active' : ''}`}
                onClick={() => setActiveTab('config')}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Settings size={15} /> Plant System Configuration
                </span>
                {activeTab === 'config' && <Check size={13} color="#059669" />}
              </div>

              <div style={{ margin: '4px 0', borderTop: '1px solid var(--border-color)' }} />
              <div style={{ padding: '4px 8px', fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Database & Maintenance
              </div>
              <div
                className={`pbi-hover-item ${activeTab === 'backup' ? 'active' : ''}`}
                onClick={() => setActiveTab('backup')}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Database size={15} /> Database Backup & Recovery
                </span>
                {activeTab === 'backup' && <Check size={13} color="#059669" />}
              </div>
              {isAdmin && (
                <div
                  className={`pbi-hover-item ${activeTab === 'reset' ? 'active' : ''}`}
                  onClick={() => setActiveTab('reset')}
                  style={{ color: '#ef4444' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Trash2 size={15} color="#ef4444" /> Master Data Reset
                  </span>
                  {activeTab === 'reset' && <Check size={13} color="#ef4444" />}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* User Management */}
      {activeTab === 'users' && (
        <>
          {userSuccessMsg && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                background: '#dcfce7',
                color: '#166534',
                border: '1px solid #86efac',
                fontSize: '0.9rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px'
              }}
            >
              <CheckCircle size={18} /> {userSuccessMsg}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>System Users & Password Management</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                System Administrators can view passwords, reset employee credentials, and remove accounts when staff leave the company.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {isAdmin && (
                <button className="btn btn-primary btn-sm" onClick={() => setIsAddUserOpen(true)}>
                  <Plus size={15} /> Add New User
                </button>
              )}
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Full Name</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Assigned Role</th>
                  <th>Module Access & Permissions</th>
                  <th>Password</th>
                  <th>Last Login</th>
                  <th>Status</th>
                  {(isAdmin || user?.permissions?.includes('user_management') || user?.permissions?.includes('all')) && (
                    <th style={{ textAlign: 'center' }}>Admin Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {usersList.map((u) => {
                  const isLoggedInRootAdmin = (user?.username?.toLowerCase() === 'admin' || user?.id === 1 || !!user?.isPrimaryAdmin);
                  const isRootAdmin = u.username.toLowerCase() === 'admin' || u.id === 1 || !!u.isPrimaryAdmin;
                  const canManage = isAdmin || user?.permissions?.includes('user_management') || user?.permissions?.includes('all');

                  return (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 700 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {isRootAdmin && <ShieldCheck size={14} color="#059669" />}
                          <span>{u.fullName}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{u.username}</td>
                      <td>{u.email || '-'}</td>
                      <td>
                        <span className={`badge ${
                          u.role === 'Admin' ? 'badge-outofstock' :
                          u.role === 'StoreManager' ? 'badge-submitted' :
                          u.role === 'PurchaseUser' ? 'badge-normal' : 'badge-excess'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td>
                        {isRootAdmin ? (
                          <span style={{ fontSize: '0.74rem', color: '#059669', fontWeight: 800, background: 'rgba(5, 150, 105, 0.12)', padding: '3px 8px', borderRadius: '5px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <ShieldCheck size={13} /> Full Unrestricted Access
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.72rem', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => openAccessControlModal(u)}
                            title="View and configure custom permissions"
                          >
                            <Shield size={12} color="#4f46e5" />
                            <span style={{ fontWeight: 700, color: '#4f46e5' }}>
                              {(u.permissions?.length || 0)} Modules Active
                            </span>
                          </button>
                        )}
                      </td>
                      <td>
                        {canManage && u.visiblePassword ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#059669', fontSize: '0.85rem', fontWeight: 700, fontFamily: 'monospace', background: '#d1fae5', padding: '2px 6px', borderRadius: '4px' }}>
                            <KeyRound size={13} /> {u.visiblePassword}
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            <Lock size={13} /> Stored securely
                          </span>
                        )}
                      </td>
                      <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}</td>
                      <td>
                        <span className="badge badge-normal">Active</span>
                      </td>
                      {canManage && (
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            {isRootAdmin && !isLoggedInRootAdmin ? (
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  color: '#059669',
                                  fontWeight: 800,
                                  background: 'rgba(5, 150, 105, 0.12)',
                                  border: '1px solid rgba(5, 150, 105, 0.25)',
                                  padding: '4px 8px',
                                  borderRadius: '5px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                                title="Primary System Administrator account is permanently protected"
                              >
                                <ShieldCheck size={13} /> Protected Root Admin
                              </span>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  style={{ padding: '3px 8px', fontSize: '0.74rem', background: '#4f46e5', borderColor: '#4f46e5', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  onClick={() => openAccessControlModal(u)}
                                  title="Configure custom module access & action privileges"
                                >
                                  <Shield size={12} /> Access
                                </button>

                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '3px 8px', fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  onClick={() => openResetUserPassModal(u)}
                                  title="Reset user password"
                                >
                                  <KeyRound size={12} /> Reset Pass
                                </button>

                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '3px 8px', fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  onClick={() => openUserSigModal(u)}
                                  title="View Digital Signature"
                                >
                                  <PenTool size={12} /> View Sig
                                </button>

                                {isRootAdmin ? (
                                  <span
                                    style={{
                                      fontSize: '0.68rem',
                                      color: '#059669',
                                      fontWeight: 800,
                                      background: 'rgba(5, 150, 105, 0.12)',
                                      padding: '3px 6px',
                                      borderRadius: '4px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px'
                                    }}
                                    title="Primary System Administrator is permanently protected"
                                  >
                                    <ShieldCheck size={12} /> Protected Root
                                  </span>
                                ) : (
                                  u.id !== user?.id && (
                                    <button
                                      type="button"
                                      className="btn btn-danger btn-sm"
                                      style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                                      onClick={() => handleDeleteUser(u)}
                                      title="Permanently delete user (e.g. employee left company)"
                                    >
                                      <Trash2 size={12} /> Delete
                                    </button>
                                  )
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* =========================================================================
          DIGITAL SIGNATURES MASTER & AUTHORIZATION MATRIX (ADMIN, STORE & HOD)
         ========================================================================= */}
      {activeTab === 'signatures' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {sigSuccessMsg && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                background: '#dcfce7',
                color: '#166534',
                border: '1px solid #86efac',
                fontSize: '0.9rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <CheckCircle size={18} /> {sigSuccessMsg}
            </div>
          )}

          {sigErrorMsg && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                background: '#fee2e2',
                color: '#991b1b',
                border: '1px solid #fca5a5',
                fontSize: '0.9rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertTriangle size={18} /> {sigErrorMsg}
            </div>
          )}

          {/* Top Banner */}
          <div
            style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              color: '#ffffff',
              padding: '24px',
              borderRadius: '16px',
              boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.4)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ background: '#059669', color: '#ffffff', padding: '3px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase' }}>
                  Form KDC-STR-FF-09 Rev 01 Compatible
                </span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>• PNG Transparent Auto-Stamp Engine</span>
              </div>
              <h2 style={{ fontSize: '1.45rem', fontWeight: 900, margin: 0, color: '#ffffff' }}>
                ✍️ Official Digital Signatures & Authorization Matrix
              </h2>
              <p style={{ margin: '6px 0 0 0', fontSize: '0.86rem', color: '#94a3b8', maxWidth: '780px', lineHeight: 1.4 }}>
                Upload PNG signatures for <strong>System Administrators</strong>, <strong>Store In-Charges</strong>, <strong>HOD / Plant Heads</strong>, and <strong>Department Supervisors</strong>. Once uploaded, all official Material Issue Slips are automatically digitally stamped on printing.
              </p>
            </div>
          </div>

          {/* 3 Main Signatory Authority Stations */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
            {/* Station 1: Store In-Charge (ISSUED BY) */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', color: '#0284c7', letterSpacing: '0.5px' }}>
                    Signatory Station 1
                  </div>
                  <span className={`badge ${adminSignature ? 'badge-success' : 'badge-warning'}`}>
                    {adminSignature ? '● Signature Active' : '⚪ Missing Signature'}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 4px 0' }}>
                  Store In-Charge / Store Manager
                </h3>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
                  Auto-stamped under <strong>ISSUED BY (Store In-Charge)</strong> on all material issue slips.
                </p>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.78rem' }}>Signatory Name / Designation</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={adminSignatoryName}
                    onChange={(e) => setAdminSignatoryName(e.target.value)}
                    placeholder="e.g. System Administrator / Store Head"
                  />
                </div>

                {/* Signature Preview Canvas */}
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '12px',
                  minHeight: '80px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '14px'
                }}>
                  {adminSignature ? (
                    <div style={{ textAlign: 'center', width: '100%' }}>
                      <img
                        src={adminSignature}
                        alt="Store In-Charge Signature"
                        style={{ maxHeight: '48px', maxWidth: '160px', objectFit: 'contain', margin: '0 auto 4px', display: 'block' }}
                      />
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0f172a', borderTop: '1px solid #0f172a', paddingTop: '2px', width: '80%', margin: '0 auto' }}>
                        {adminSignatoryName}
                      </div>
                      <div style={{ fontSize: '0.62rem', color: '#64748b' }}>ISSUED BY (Store In-Charge)</div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.76rem' }}>
                      <PenTool size={22} style={{ margin: '0 auto 4px', opacity: 0.35 }} />
                      <div>No Store In-Charge Signature Uploaded</div>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', margin: 0, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Upload size={13} />
                  <span>{adminSignature ? 'Replace PNG' : 'Upload PNG'}</span>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const r = new FileReader();
                      r.onload = () => {
                        if (r.result) {
                          const str = r.result.toString();
                          setAdminSignature(str);
                          localStorage.setItem('sig_store_incharge', str);
                          localStorage.setItem('sig_admin', str);
                          localStorage.setItem('sig_store_incharge_name', adminSignatoryName);
                          api.put('/system/config', { StoreInChargeSignature: str, StoreInChargeName: adminSignatoryName }).catch(() => {});
                          setSigSuccessMsg('Store In-Charge signature saved successfully!');
                          setTimeout(() => setSigSuccessMsg(null), 3000);
                        }
                      };
                      r.readAsDataURL(file);
                    }}
                  />
                </label>

                {adminSignature && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    style={{ padding: '4px 10px' }}
                    onClick={() => {
                      setAdminSignature('');
                      localStorage.removeItem('sig_store_incharge');
                      localStorage.removeItem('sig_admin');
                      api.put('/system/config', { StoreInChargeSignature: '' }).catch(() => {});
                      setSigSuccessMsg('Store In-Charge signature removed.');
                      setTimeout(() => setSigSuccessMsg(null), 3000);
                    }}
                  >
                    <Trash2 size={13} /> Remove
                  </button>
                )}
              </div>
            </div>

            {/* Station 2: HOD / Plant Manager (AUTHORIZED BY) */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', color: '#7c3aed', letterSpacing: '0.5px' }}>
                    Signatory Station 2
                  </div>
                  <span className={`badge ${plantManagerSignature ? 'badge-success' : 'badge-warning'}`}>
                    {plantManagerSignature ? '● Signature Active' : '⚪ Missing Signature'}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 4px 0' }}>
                  HOD / Plant Manager / Authorizing Authority
                </h3>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
                  Auto-stamped under <strong>AUTHORIZED BY (HOD / Plant Manager)</strong> on all material issue slips.
                </p>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.78rem' }}>Signatory Name / Title</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={plantManagerTitle}
                    onChange={(e) => setPlantManagerTitle(e.target.value)}
                    placeholder="e.g. Plant Head / HOD Operations"
                  />
                </div>

                {/* Signature Preview Canvas */}
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '12px',
                  minHeight: '80px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '14px'
                }}>
                  {plantManagerSignature ? (
                    <div style={{ textAlign: 'center', width: '100%' }}>
                      <img
                        src={plantManagerSignature}
                        alt="Plant Manager Signature"
                        style={{ maxHeight: '48px', maxWidth: '160px', objectFit: 'contain', margin: '0 auto 4px', display: 'block' }}
                      />
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0f172a', borderTop: '1px solid #0f172a', paddingTop: '2px', width: '80%', margin: '0 auto' }}>
                        {plantManagerTitle}
                      </div>
                      <div style={{ fontSize: '0.62rem', color: '#64748b' }}>AUTHORIZED BY (HOD / Plant Manager)</div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.76rem' }}>
                      <PenTool size={22} style={{ margin: '0 auto 4px', opacity: 0.35 }} />
                      <div>No HOD / Plant Head Signature Uploaded</div>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', margin: 0, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Upload size={13} />
                  <span>{plantManagerSignature ? 'Replace PNG' : 'Upload PNG'}</span>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const r = new FileReader();
                      r.onload = () => {
                        if (r.result) {
                          const str = r.result.toString();
                          setPlantManagerSignature(str);
                          localStorage.setItem('sig_plant_manager', str);
                          localStorage.setItem('sig_hod', str);
                          localStorage.setItem('sig_plant_manager_name', plantManagerTitle);
                          api.put('/system/config', { PlantManagerSignature: str, PlantManagerName: plantManagerTitle }).catch(() => {});
                          setSigSuccessMsg('HOD / Plant Manager signature saved successfully!');
                          setTimeout(() => setSigSuccessMsg(null), 3000);
                        }
                      };
                      r.readAsDataURL(file);
                    }}
                  />
                </label>

                {plantManagerSignature && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    style={{ padding: '4px 10px' }}
                    onClick={() => {
                      setPlantManagerSignature('');
                      localStorage.removeItem('sig_plant_manager');
                      localStorage.removeItem('sig_hod');
                      api.put('/system/config', { PlantManagerSignature: '' }).catch(() => {});
                      setSigSuccessMsg('Plant Manager signature removed.');
                      setTimeout(() => setSigSuccessMsg(null), 3000);
                    }}
                  >
                    <Trash2 size={13} /> Remove
                  </button>
                )}
              </div>
            </div>

            {/* Station 3: System Users Signature Quick Manager */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', color: '#059669', letterSpacing: '0.5px' }}>
                    Signatory Station 3
                  </div>
                  <span className="badge badge-normal">System Accounts</span>
                </div>

                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 4px 0' }}>
                  System Users & Staff Signatures
                </h3>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
                  Assign personalized digital signatures to system users (e.g. <code>store.manager</code>, <code>purchase.user</code>).
                </p>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.78rem' }}>Select User Account</label>
                  <select
                    className="form-control form-control-sm"
                    value={selectedUserForSig?.id || ''}
                    onChange={(e) => {
                      const uid = Number(e.target.value);
                      const uObj = usersList.find((x) => x.id === uid) || null;
                      setSelectedUserForSig(uObj);
                    }}
                  >
                    <option value="">-- Choose User Account --</option>
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>
                        👤 {u.fullName} ({u.username}) — {u.role}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selected User Preview */}
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '12px',
                  minHeight: '80px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '14px'
                }}>
                  {selectedUserForSig ? (
                    (() => {
                      const uSig = selectedUserForSig.signatureDataUrl || localStorage.getItem(`sig_user_${selectedUserForSig.username.toLowerCase()}`);
                      return uSig ? (
                        <div style={{ textAlign: 'center', width: '100%' }}>
                          <img
                            src={uSig}
                            alt="User Signature"
                            style={{ maxHeight: '48px', maxWidth: '160px', objectFit: 'contain', margin: '0 auto 4px', display: 'block' }}
                          />
                          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0f172a', borderTop: '1px solid #0f172a', paddingTop: '2px', width: '80%', margin: '0 auto' }}>
                            {selectedUserForSig.fullName}
                          </div>
                          <div style={{ fontSize: '0.62rem', color: '#64748b' }}>{selectedUserForSig.role}</div>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.76rem' }}>
                          <PenTool size={22} style={{ margin: '0 auto 4px', opacity: 0.35 }} />
                          <div>No Signature uploaded for {selectedUserForSig.fullName}</div>
                        </div>
                      );
                    })()
                  ) : (
                    <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.76rem' }}>
                      <div>Select a user account above to manage signature</div>
                    </div>
                  )}
                </div>
              </div>

              {selectedUserForSig && (
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', margin: 0, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Upload size={13} />
                    <span>Upload PNG</span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !selectedUserForSig) return;
                        const r = new FileReader();
                        r.onload = async () => {
                          if (r.result) {
                            const str = r.result.toString();
                            localStorage.setItem(`sig_user_${selectedUserForSig.username.toLowerCase()}`, str);
                            try {
                              await api.post(`/auth/users/${selectedUserForSig.id}/signature`, { signatureDataUrl: str });
                              fetchUsers();
                              setSigSuccessMsg(`Digital signature saved for ${selectedUserForSig.fullName}!`);
                              setTimeout(() => setSigSuccessMsg(null), 3000);
                            } catch {
                              setSigErrorMsg('Failed to save signature to server.');
                            }
                          }
                        };
                        r.readAsDataURL(file);
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    style={{ padding: '4px 10px' }}
                    onClick={async () => {
                      if (!selectedUserForSig) return;
                      localStorage.removeItem(`sig_user_${selectedUserForSig.username.toLowerCase()}`);
                      try {
                        await api.post(`/auth/users/${selectedUserForSig.id}/signature`, { signatureDataUrl: null });
                        fetchUsers();
                        setSigSuccessMsg(`Signature cleared for ${selectedUserForSig.fullName}.`);
                        setTimeout(() => setSigSuccessMsg(null), 3000);
                      } catch {}
                    }}
                  >
                    <Trash2 size={13} /> Clear
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Department Supervisors & Shift In-Charges Master Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 2px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building2 size={18} color="#059669" />
                  Plant Department Supervisors Signature Master ({supervisorsList.length})
                </h3>
                <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  All department indents created by these supervisors will automatically carry their digital signature on Material Issue Slips.
                </p>
              </div>

              {/* Department Filter & Search */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  className="form-control form-control-sm"
                  style={{ width: '160px', fontWeight: 700 }}
                  value={supDeptFilter}
                  onChange={(e) => setSupDeptFilter(e.target.value)}
                >
                  <option value="All">All Departments</option>
                  {Array.from(new Set(supervisorsList.map((s) => s.department))).filter(Boolean).map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>

                <input
                  type="text"
                  className="form-control form-control-sm"
                  style={{ width: '180px' }}
                  placeholder="Search supervisor..."
                  value={supSearch}
                  onChange={(e) => setSupSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Supervisor Name</th>
                    <th>Department</th>
                    <th>Shift / In-Charge</th>
                    <th style={{ textAlign: 'center' }}>Digital Signature (PNG)</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {supervisorsList
                    .filter((s) => {
                      if (supDeptFilter !== 'All' && s.department !== supDeptFilter) return false;
                      if (supSearch && !s.name.toLowerCase().includes(supSearch.toLowerCase()) && !s.department.toLowerCase().includes(supSearch.toLowerCase())) return false;
                      return true;
                    })
                    .map((sup: any) => {
                      const sigUrl = sup.signatureDataUrl || localStorage.getItem(`sig_sup_${sup.name.toLowerCase().replace(/\s+/g, '_')}`);
                      return (
                        <tr key={sup.id}>
                          <td>
                            <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{sup.name}</div>
                            {sup.phone && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>📞 {sup.phone}</div>}
                          </td>
                          <td>
                            <span className="badge badge-normal" style={{ fontWeight: 700, fontSize: '0.74rem' }}>
                              {sup.department}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{sup.shift || 'General'}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {sigUrl ? (
                              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px', display: 'inline-block' }}>
                                <img
                                  src={sigUrl}
                                  alt={sup.name}
                                  style={{ maxHeight: '36px', maxWidth: '110px', objectFit: 'contain', display: 'block' }}
                                />
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>No Signature</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {sigUrl ? (
                              <span style={{ background: '#d1fae5', color: '#065f46', padding: '3px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <CheckCircle2 size={11} /> Configured
                              </span>
                            ) : (
                              <span style={{ background: '#fee2e2', color: '#991b1b', padding: '3px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 800 }}>
                                Missing
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <label
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '3px 8px', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', margin: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                title="Upload PNG Signature"
                              >
                                <Upload size={12} color="#059669" />
                                <span>{sigUrl ? 'Replace' : 'Upload PNG'}</span>
                                <input
                                  type="file"
                                  accept="image/png, image/jpeg, image/webp"
                                  style={{ display: 'none' }}
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const r = new FileReader();
                                    r.onload = async () => {
                                      if (r.result) {
                                        const str = r.result.toString();
                                        const key = `sig_sup_${sup.name.toLowerCase().replace(/\s+/g, '_')}`;
                                        localStorage.setItem(key, str);
                                        try {
                                          await api.post('/supervisors/signature', {
                                            supervisorName: sup.name,
                                            department: sup.department,
                                            signatureDataUrl: str
                                          });
                                          fetchMasters();
                                          setSigSuccessMsg(`Digital signature saved for supervisor ${sup.name}!`);
                                          setTimeout(() => setSigSuccessMsg(null), 3000);
                                        } catch {
                                          setSigErrorMsg('Failed to save signature to server.');
                                        }
                                      }
                                    };
                                    r.readAsDataURL(file);
                                  }}
                                />
                              </label>

                              {sigUrl && (
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                                  onClick={async () => {
                                    const key = `sig_sup_${sup.name.toLowerCase().replace(/\s+/g, '_')}`;
                                    localStorage.removeItem(key);
                                    try {
                                      await api.post('/supervisors/signature', {
                                        supervisorName: sup.name,
                                        department: sup.department,
                                        signatureDataUrl: null
                                      });
                                      fetchMasters();
                                      setSigSuccessMsg(`Signature cleared for supervisor ${sup.name}.`);
                                      setTimeout(() => setSigSuccessMsg(null), 3000);
                                    } catch {}
                                  }}
                                  title="Remove signature"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Plant Masters (Departments & Supervisors) */}
      {activeTab === 'masters' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {masterSuccessMsg && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                background: '#dcfce7',
                color: '#166534',
                border: '1px solid #86efac',
                fontSize: '0.9rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <CheckCircle size={18} /> {masterSuccessMsg}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px' }}>
            {/* 1. Departments Master */}
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', fontWeight: 800 }}>
                  <Building2 size={18} color="var(--accent-primary)" /> Plant Operational Departments ({departmentsList.length})
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Shop Floors & Cost Centers</span>
              </div>

              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                Departments configured here appear across <strong>Material Issue Slips</strong>, <strong>Projection Planning</strong>, and <strong>Costing Reports</strong>.
              </p>

              {/* Add Department Inline Form */}
              <form onSubmit={handleAddDepartment} style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  required
                  className="form-control"
                  style={{ flex: '1 1 180px', fontSize: '0.85rem' }}
                  placeholder="e.g. Die Casting 2 / Assembly Shop"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                />
                <input
                  type="text"
                  className="form-control"
                  style={{ width: '90px', fontSize: '0.85rem' }}
                  placeholder="Code (DC2)"
                  value={newDeptCode}
                  onChange={(e) => setNewDeptCode(e.target.value)}
                />
                <button type="submit" className="btn btn-primary btn-sm" style={{ whiteSpace: 'nowrap' }}>
                  <Plus size={14} /> Add Dept
                </button>
              </form>

              {/* Departments Table */}
              <div className="table-container" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Department Name</th>
                      <th>Code</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departmentsList.map((d: any) => (
                      <tr key={d.id}>
                        <td style={{ fontWeight: 700 }}>{d.name}</td>
                        <td><span className="badge badge-normal" style={{ fontSize: '0.72rem' }}>{d.code || d.name.substring(0, 4).toUpperCase()}</span></td>
                        <td><span className="badge badge-normal">Active</span></td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                            onClick={() => handleDeleteDepartment(d.id)}
                            title="Deactivate department"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. Plant Supervisors & Shift In-Charges */}
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', fontWeight: 800 }}>
                  <Briefcase size={18} color="#2563eb" /> Plant Supervisors & Shift Leads ({supervisorsList.length})
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Authorized Requisitioners</span>
              </div>

              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                Supervisors listed here automatically auto-suggest when issuing store materials during daily plant operations.
              </p>

              {/* Add Supervisor Inline Form */}
              <form onSubmit={handleAddSupervisor} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    required
                    className="form-control"
                    style={{ flex: '1 1 150px', fontSize: '0.85rem' }}
                    placeholder="Supervisor Full Name (e.g. Rajesh Kumar)"
                    value={newSupName}
                    onChange={(e) => setNewSupName(e.target.value)}
                  />
                  <select
                    className="form-control"
                    style={{ flex: '1 1 140px', fontSize: '0.85rem' }}
                    value={newSupDept}
                    onChange={(e) => setNewSupDept(e.target.value)}
                  >
                    {departmentsList.map((d: any) => (
                      <option key={d.id || d.name} value={d.name}>{d.name}</option>
                    ))}
                    {departmentsList.length === 0 && (
                      <>
                        <option value="HPDC Casting">HPDC Casting</option>
                        <option value="Core Shop">Core Shop</option>
                        <option value="Sand Moulding">Sand Moulding</option>
                        <option value="Maintenance">Maintenance</option>
                        <option value="Machining & CNC">Machining & CNC</option>
                      </>
                    )}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    className="form-control"
                    style={{ flex: '1 1 120px', fontSize: '0.85rem' }}
                    placeholder="Mobile (Optional)"
                    value={newSupPhone}
                    onChange={(e) => setNewSupPhone(e.target.value)}
                  />
                  <select
                    className="form-control"
                    style={{ flex: '1 1 120px', fontSize: '0.85rem' }}
                    value={newSupShift}
                    onChange={(e) => setNewSupShift(e.target.value)}
                  >
                    <option value="Shift A">Shift A (06:00 - 14:30)</option>
                    <option value="Shift B">Shift B (14:30 - 23:00)</option>
                  </select>
                  <button type="submit" className="btn btn-primary btn-sm" style={{ whiteSpace: 'nowrap' }}>
                    <Plus size={14} /> Add Supervisor
                  </button>
                </div>
              </form>

              {/* Supervisors Table */}
              <div className="table-container" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Supervisor Name</th>
                      <th>Department</th>
                      <th>Shift</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supervisorsList.map((s: any) => (
                      <tr key={s.id || s.name}>
                        <td style={{ fontWeight: 700 }}>{s.name}</td>
                        <td><span className="badge badge-submitted" style={{ fontSize: '0.72rem' }}>{s.department}</span></td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.shift || 'General'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                            onClick={() => handleDeleteSupervisor(s.id)}
                            title="Remove supervisor"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 3. Material Categories Master */}
          <div className="card" style={{ maxWidth: '780px' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', fontWeight: 800 }}>
                <Tag size={18} color="#8b5cf6" /> Material Categories Master ({categoriesList.length})
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Stock Classification</span>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Categories organize SKUs across inventory valuations, reorder alerts, and ClosedXML month-end reports.
            </p>

            <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: '8px', marginBottom: '16px', maxWidth: '420px' }}>
              <input
                type="text"
                required
                className="form-control"
                style={{ flex: 1, fontSize: '0.85rem' }}
                placeholder="New Category Name (e.g. PACKING, CHEMICAL)"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
              />
              <button type="submit" className="btn btn-primary btn-sm" style={{ whiteSpace: 'nowrap' }}>
                <Plus size={14} /> Add Category
              </button>
            </form>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {categoriesList.map((c: any) => (
                <div
                  key={c.id || c.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.82rem',
                    fontWeight: 700
                  }}
                >
                  <span>{c.name}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(c.id)}
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                    title="Remove category"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Database Backup */}
      {activeTab === 'backup' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <HardDrive size={20} /> Create SQL Server Native Database Backup (.BAK)
              </div>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Creates a point-in-time full database snapshot of all materials, transactional stock ledgers, receipts, issues, purchase orders, attendance, and audit logs.
            </p>

            <div className="form-group">
              <label className="form-label">Custom Backup Directory Path (Optional)</label>
              <input
                type="text"
                className="form-control"
                placeholder="Leave blank for default: C:\Program Files\Microsoft SQL Server\...\Backup\"
                value={backupPath}
                onChange={(e) => setBackupPath(e.target.value)}
              />
            </div>

            <button
              className="btn btn-primary"
              onClick={handleCreateBackup}
              disabled={backupLoading}
              style={{ width: '100%', marginTop: '12px' }}
            >
              <Database size={16} /> {backupLoading ? 'Generating Database Backup...' : 'Generate Full Database Backup (.BAK)'}
            </button>

            {backupResult && (
              <div style={{
                marginTop: '16px',
                padding: '12px 16px',
                borderRadius: '8px',
                background: backupResult.success ? '#dcfce7' : '#fee2e2',
                color: backupResult.success ? '#166534' : '#991b1b',
                fontSize: '0.85rem'
              }}>
                <strong>{backupResult.message}</strong>
                {backupResult.backupFilePath && (
                  <div style={{ marginTop: '4px', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                    Path: {backupResult.backupFilePath}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Shield size={20} /> Backup & Disaster Recovery Policy
              </div>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p>
                <strong>Daily Operational Backups:</strong> Store data changes daily with multiple GRN and Outward Issue slips. Recommend taking end-of-day backups.
              </p>
              <p>
                <strong>LAN Network Redundancy:</strong> Copy generated <code>.bak</code> files to a separate network shared drive or offline USB hard drive on a weekly basis.
              </p>
              <p>
                <strong>Zero Data Loss Ledger:</strong> Because the system relies on an immutable <code>StockLedger</code> table, restoring any backup restores exact historical state without corrupted balances.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Security Audit Logs */}
      {activeTab === 'audit' && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Entity Type</th>
                <th>Record ID</th>
                <th>Audit Info</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.timestamp).toLocaleString()}</td>
                  <td style={{ fontWeight: 700 }}>{log.username}</td>
                  <td>
                    <span className={`badge ${
                      log.action === 'CREATE' ? 'badge-normal' :
                      log.action === 'UPDATE' ? 'badge-submitted' :
                      log.action === 'DELETE' ? 'badge-rejected' : 'badge-low'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{log.entityName}</td>
                  <td>{log.recordId || '-'}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{log.newValues || '-'}</td>
                  <td style={{ fontSize: '0.78rem', fontFamily: 'monospace' }}>{log.ipAddress || '127.0.0.1'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Plant Configuration (Editable) */}
      {activeTab === 'config' && (
        <div className="card" style={{ maxWidth: '820px' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div className="card-title" style={{ fontSize: '1.2rem', fontWeight: 800 }}>
              <Settings size={22} color="var(--accent-primary)" /> Enterprise Plant & Document Standards
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Updates legal headers, document formats & company voucher parameters
            </span>
          </div>

          {configMessage && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: configMessage.type === 'success' ? '#dcfce7' : '#fee2e2',
                color: configMessage.type === 'success' ? '#166534' : '#991b1b',
                border: `1px solid ${configMessage.type === 'success' ? '#86efac' : '#fca5a5'}`,
                fontSize: '0.9rem',
                fontWeight: 600
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {configMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                {configMessage.text}
              </div>
              <button
                type="button"
                onClick={() => setConfigMessage(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 800, color: 'inherit' }}
              >
                ✕
              </button>
            </div>
          )}

          {configLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Loading plant system configuration...
            </div>
          ) : (
            <form onSubmit={handleSaveConfig}>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Plant Legal Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. ASIAAN METALS & ALUMINIUM CASTINGS PVT LTD"
                    value={plantConfig.CompanyName}
                    onChange={(e) => setPlantConfig({ ...plantConfig, CompanyName: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Plant / Manufacturing Unit Name *
                  </label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. UNIT-5"
                    value={plantConfig.UnitName}
                    onChange={(e) => setPlantConfig({ ...plantConfig, UnitName: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Contact Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    className="form-control"
                    placeholder="e.g. kdcpurchase@amacpvt.com"
                    value={plantConfig.ContactEmail}
                    onChange={(e) => setPlantConfig({ ...plantConfig, ContactEmail: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Contact Phone / Landline
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 9606082298"
                    value={plantConfig.ContactPhone}
                    onChange={(e) => setPlantConfig({ ...plantConfig, ContactPhone: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>
                  Plant / Factory Address *
                </label>
                <textarea
                  className="form-control"
                  rows={2}
                  required
                  placeholder="Complete industrial address..."
                  value={plantConfig.CompanyAddress}
                  onChange={(e) => setPlantConfig({ ...plantConfig, CompanyAddress: e.target.value })}
                />
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', margin: '20px 0 16px 0', paddingTop: '16px' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '14px', color: 'var(--text-primary)' }}>
                  ISO / Quality Audit Document Standards
                </h4>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>
                      Material Issue Slip Standard Format
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. KDC-STR-FF-09 Rev 01"
                      value={plantConfig.IssueSlipFormatNo}
                      onChange={(e) => setPlantConfig({ ...plantConfig, IssueSlipFormatNo: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>
                      Purchase Requisition (PR) Format
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. GDC-PUR-FF-07 Rev 02"
                      value={plantConfig.PrFormatNo}
                      onChange={(e) => setPlantConfig({ ...plantConfig, PrFormatNo: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>
                      Goods Receipt Note (GRN) Format
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. AMAC-STR-GRN-01 Rev 01"
                      value={plantConfig.GrnFormatNo}
                      onChange={(e) => setPlantConfig({ ...plantConfig, GrnFormatNo: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <label className="form-label" style={{ fontWeight: 700, margin: 0 }}>
                        Target Safety Buffer (Days)
                      </label>
                      <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700 }}>
                        Active: {plantConfig.TargetDaysStock || 22} Days Buffer
                      </span>
                    </div>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      className="form-control"
                      placeholder="e.g. 1, 2, 7, 15, 22, 30"
                      value={plantConfig.TargetDaysStock}
                      onChange={(e) => setPlantConfig({ ...plantConfig, TargetDaysStock: e.target.value })}
                    />
                    <small style={{ fontSize: '0.73rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                      System-wide safety stock buffer used for Month-End Master Reconciliation, Material Requirement Planning & Deficit Calculations.
                    </small>

                    {/* Quick Preset Buttons */}
                    <div style={{ display: 'flex', gap: '5px', marginTop: '6px', flexWrap: 'wrap' }}>
                      {[
                        { label: '1 Day', val: '1' },
                        { label: '2 Days', val: '2' },
                        { label: '7 Days (1 Wk)', val: '7' },
                        { label: '15 Days', val: '15' },
                        { label: '22 Days (Std)', val: '22' },
                        { label: '30 Days (1 Mo)', val: '30' }
                      ].map((preset) => (
                        <button
                          key={preset.val}
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{
                            fontSize: '0.7rem',
                            padding: '2px 7px',
                            fontWeight: plantConfig.TargetDaysStock === preset.val ? 800 : 500,
                            background: plantConfig.TargetDaysStock === preset.val ? 'rgba(5, 150, 105, 0.15)' : 'var(--bg-secondary)',
                            color: plantConfig.TargetDaysStock === preset.val ? '#059669' : 'var(--text-secondary)',
                            borderColor: plantConfig.TargetDaysStock === preset.val ? '#059669' : 'var(--border-color)'
                          }}
                          onClick={() => setPlantConfig({ ...plantConfig, TargetDaysStock: preset.val })}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', margin: '20px 0 16px 0', paddingTop: '16px' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '14px', color: 'var(--text-primary)' }}>
                  FIFO Dashboard Display Settings
                </h4>
                
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Ticker Theme Profile
                  </label>
                  <select
                    className="form-control"
                    value={plantConfig.FifoTickerTheme}
                    onChange={(e) => {
                      const theme = e.target.value;
                      const updates: any = { FifoTickerTheme: theme };
                      if (theme === 'default') {
                        updates.FifoTickerBgColor = '#0F172A';
                        updates.FifoTickerTextColor = '#38BDF8';
                      } else if (theme === 'critical') {
                        updates.FifoTickerBgColor = '#7f1d1d';
                        updates.FifoTickerTextColor = '#fecaca';
                      } else if (theme === 'warning') {
                        updates.FifoTickerBgColor = '#78350f';
                        updates.FifoTickerTextColor = '#fde68a';
                      } else if (theme === 'success') {
                        updates.FifoTickerBgColor = '#14532d';
                        updates.FifoTickerTextColor = '#bbf7d0';
                      }
                      setPlantConfig({ ...plantConfig, ...updates });
                    }}
                  >
                    <option value="default">Default (Dark Blue / Sky Text)</option>
                    <option value="critical">Critical Alert (Red Theme)</option>
                    <option value="warning">Warning / Notice (Amber Theme)</option>
                    <option value="success">Success / Optimal (Green Theme)</option>
                    <option value="custom">Custom Styling</option>
                  </select>
                </div>

                {plantConfig.FifoTickerTheme === 'custom' && (
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label">Custom Background Color</label>
                      <input
                        type="color"
                        className="form-control"
                        style={{ height: '40px', padding: '2px 4px' }}
                        value={plantConfig.FifoTickerBgColor}
                        onChange={(e) => setPlantConfig({ ...plantConfig, FifoTickerBgColor: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Custom Text Color</label>
                      <input
                        type="color"
                        className="form-control"
                        style={{ height: '40px', padding: '2px 4px' }}
                        value={plantConfig.FifoTickerTextColor}
                        onChange={(e) => setPlantConfig({ ...plantConfig, FifoTickerTextColor: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Ticker Scroll Text / HTML Content
                  </label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Enter raw text or HTML (e.g. <b>Alert:</b>...)"
                    value={plantConfig.FifoTickerText}
                    onChange={(e) => setPlantConfig({ ...plantConfig, FifoTickerText: e.target.value })}
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                    This content scrolls continuously at the bottom of the live FIFO dashboard. You may use simple HTML tags like &lt;b&gt;, &lt;span style="color: red"&gt;, etc.
                  </small>
                </div>
              </div>


              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setPlantConfig({
                      CompanyName: 'ASIAAN METALS & ALUMINIUM CASTINGS PVT LTD',
                      UnitName: 'UNIT-5',
                      ContactEmail: 'kdcpurchase@amacpvt.com',
                      ContactPhone: '9606082298',
                      CompanyAddress: 'No.306, Sompura Industrial Area Nidavanta, Dabspet, Bangalore - 562 132',
                      IssueSlipFormatNo: 'KDC-STR-FF-09 Rev 01',
                      PrFormatNo: 'GDC-PUR-FF-07 Rev 02',
                      GrnFormatNo: 'AMAC-STR-GRN-01 Rev 01',
                      TargetDaysStock: '22',
                      FifoTickerTheme: 'default',
                      FifoTickerText: '*** UNIT-5 FIFO MANAGEMENT SYSTEM *** ENSURE STRICT FIFO COMPLIANCE *** MAINTAIN OPTIMAL STOCK LEVELS *** REPORT ANY DISCREPANCIES IMMEDIATELY *** SAFETY FIRST: ALWAYS WEAR PPE ***',
                      FifoTickerBgColor: '#0F172A',
                      FifoTickerTextColor: '#38BDF8'
                    });
                  }}
                >
                  <RefreshCw size={14} /> Reset Defaults
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={configSaving}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '160px', justifyContent: 'center' }}
                >
                  {configSaving ? <RefreshCw size={15} className="animate-spin" /> : <CheckCircle size={16} />}
                  {configSaving ? 'Saving Changes...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Master Data Reset (Danger Zone) */}
      {activeTab === 'reset' && isAdmin && (
        <div style={{ maxWidth: '900px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #fef2f2, #fff1f2)',
            border: '2px solid #fecaca',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#991b1b', marginBottom: '12px' }}>
              <AlertTriangle size={28} />
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: '#991b1b' }}>
                Danger Zone — Master Database Reset & Deletion
              </h2>
            </div>
            <p style={{ fontSize: '0.88rem', color: '#7f1d1d', lineHeight: '1.6' }}>
              Use this tool when you need to clear demo or testing data and restart fresh. For safety, <strong>an automated SQL Server .BAK snapshot is generated before any deletion</strong>.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px' }}>
            {/* Reset Transactions Only */}
            <div className="card" style={{ borderTop: '4px solid #f59e0b' }}>
              <div className="card-header">
                <div className="card-title" style={{ color: '#d97706', fontSize: '1.05rem' }}>
                  <Trash2 size={18} /> 1. Reset Transactions & Stock (Keep Masters)
                </div>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '16px', minHeight: '65px' }}>
                Deletes all GRN Receipts, Issue Slips, Adjustments, Stock Ledgers, Purchase Orders, and Daily Attendance records. Sets all stock balances to <strong>0.00</strong>. Keeps Material Catalog, Suppliers, Categories, and User accounts.
              </p>
              <button
                className="btn btn-warning"
                style={{ width: '100%' }}
                onClick={() => openResetModal('TRANSACTIONS_ONLY')}
              >
                <Trash2 size={16} /> Reset All Transactions
              </button>
            </div>

            {/* Complete Factory Reset */}
            <div className="card" style={{ borderTop: '4px solid #ef4444' }}>
              <div className="card-header">
                <div className="card-title" style={{ color: '#dc2626', fontSize: '1.05rem' }}>
                  <AlertTriangle size={18} /> 2. Complete Factory Reset (Wipe Everything)
                </div>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '16px', minHeight: '65px' }}>
                Completely purges <strong>all tables</strong> across the database. Re-initializes default system configuration, standard departments, foundry categories, and default administrator accounts.
              </p>
              <button
                className="btn btn-danger"
                style={{ width: '100%' }}
                onClick={() => openResetModal('FACTORY_RESET')}
              >
                <AlertTriangle size={16} /> Complete Factory Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Universal Master Excel Data Feeder Studio */}
      {activeTab === 'master-import' && (
        <MasterDataImportStudio onNavigateTab={onNavigateTab} />
      )}

      {/* Add User Modal */}
      <Modal isOpen={isAddUserOpen} onClose={() => setIsAddUserOpen(false)} title="Create New System User">
        <form onSubmit={handleAddUser}>
          {errorMsg && (
            <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
              <AlertCircle size={15} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
              {errorMsg}
            </div>
          )}

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Username *</label>
              <input type="text" required className="form-control" placeholder="e.g. bhabani" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input type="text" required className="form-control" placeholder="e.g. Bhabani Sahu" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-control" placeholder="user@amacpvt.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Password *</label>
              <input type="password" required className="form-control" placeholder="Min 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Assigned Security Role *</label>
            <select className="form-control" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="Admin">Administrator (Full Access)</option>
              <option value="StoreManager">Store Manager (Full Store Operations & PR/PO)</option>
              <option value="StoreUser">Store User (Daily Inward / Issue Slips)</option>
              <option value="PurchaseUser">Purchase User (PR / PO / Supplier Quotations)</option>
              <option value="Viewer">Viewer (Read-only Dashboard & Reports)</option>
            </select>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setIsAddUserOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary"><CheckCircle size={16} /> Create User</button>
          </div>
        </form>
      </Modal>

      {/* Master Reset Confirmation Modal */}
      <Modal
        isOpen={isResetModalOpen}
        onClose={() => { if (!resetLoading) setIsResetModalOpen(false); }}
        title={selectedResetType === 'FACTORY_RESET' ? '⚠️ Confirm Complete Factory Master Reset' : '🧹 Confirm Transactions & Stock Reset'}
      >
        <form onSubmit={handleExecuteReset}>
          {resetError && (
            <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
              <AlertCircle size={15} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
              {resetError}
            </div>
          )}

          {resetResult ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: '#dcfce7',
                color: '#166534',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <CheckCircle size={32} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#166534', marginBottom: '8px' }}>
                Master Reset Completed Successfully!
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                {resetResult.message}
              </p>

              {resetResult.backupCreatedPath && (
                <div style={{
                  padding: '10px 14px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontFamily: 'monospace',
                  marginBottom: '16px',
                  wordBreak: 'break-all',
                  textAlign: 'left'
                }}>
                  🛡️ Pre-reset safety backup saved to:<br />
                  <strong>{resetResult.backupCreatedPath}</strong>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => { setIsResetModalOpen(false); window.location.reload(); }}
                >
                  <RefreshCw size={15} /> Refresh Dashboard & Data
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                padding: '14px',
                borderRadius: '8px',
                color: '#991b1b',
                fontSize: '0.84rem',
                marginBottom: '16px',
                lineHeight: '1.5'
              }}>
                <strong>⚠️ Warning: This action cannot be undone.</strong>
                {selectedResetType === 'FACTORY_RESET' ? (
                  <p style={{ marginTop: '4px' }}>
                    You are about to delete ALL materials, suppliers, transactions, ledgers, and attendance records from the database.
                  </p>
                ) : (
                  <p style={{ marginTop: '4px' }}>
                    You are about to clear all receipts, issues, purchase orders, attendance, and reset material stock balances to 0.00.
                  </p>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">
                  To confirm, type <strong>RESET ALL DATA</strong> in the box below:
                </label>
                <input
                  type="text"
                  required
                  className="form-control"
                  placeholder="RESET ALL DATA"
                  value={confirmationPhrase}
                  onChange={(e) => setConfirmationPhrase(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Administrator Password *</label>
                <input
                  type="password"
                  required
                  className="form-control"
                  placeholder="Enter Admin password (e.g. Admin@123)"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsResetModalOpen(false)}
                  disabled={resetLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn ${selectedResetType === 'FACTORY_RESET' ? 'btn-danger' : 'btn-warning'}`}
                  disabled={resetLoading || (confirmationPhrase.trim().toUpperCase() !== 'RESET ALL DATA' && confirmationPhrase.trim().toUpperCase() !== 'RESET-AMAC-DATA')}
                >
                  {resetLoading ? (
                    <><RefreshCw className="animate-spin" size={16} /> Executing Master Reset...</>
                  ) : (
                    <><Trash2 size={16} /> Confirm & Execute Reset</>
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      </Modal>

      {/* Reset User Password Modal (Admin) */}
      <Modal
        isOpen={isResetUserPassOpen}
        onClose={() => setIsResetUserPassOpen(false)}
        title={`Reset Password for @${targetUserForPass?.username || 'User'}`}
      >
        <form onSubmit={handleExecuteResetUserPass}>
          {targetUserForPass && (
            <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{targetUserForPass.fullName}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Role: <span className="badge badge-normal">{targetUserForPass.role}</span> | Email: {targetUserForPass.email || 'N/A'}
              </div>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label" style={{ fontWeight: 700 }}>
              New Login Password *
            </label>
            <input
              type="text"
              required
              className="form-control"
              placeholder="e.g. NewPass@2026 / Plant@123"
              value={newAdminSetPassword}
              onChange={(e) => setNewAdminSetPassword(e.target.value)}
              autoFocus
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
              This will immediately update the user's password in both the BCrypt cryptographic database and the Admin credential directory.
            </span>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsResetUserPassOpen(false)}
              disabled={resetUserPassLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={resetUserPassLoading || !newAdminSetPassword.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {resetUserPassLoading ? <RefreshCw size={15} className="animate-spin" /> : <KeyRound size={15} />}
              {resetUserPassLoading ? 'Updating Password...' : 'Save New Password'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Granular User Access & Permission Control Studio Modal */}
      {isAccessControlOpen && (
        <div className="modal-backdrop" onClick={() => setIsAccessControlOpen(false)}>
          <div
            className="modal-content modal-permission-studio-v2"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 1. TOP HEADER (58px) */}
            <div className="ps-header">
              <div className="ps-header-left">
                <div className="ps-header-icon">
                  <Shield size={18} />
                </div>
                <div>
                  <h3 className="ps-header-title">User Access & Permission Control Studio</h3>
                  <p className="ps-header-sub">Role Delegation, Security Scope & Granular Capability Allocation</p>
                </div>
              </div>

              <button
                type="button"
                className="ps-header-close"
                onClick={() => setIsAccessControlOpen(false)}
                title="Close Studio"
              >
                <X size={18} />
              </button>
            </div>

            {/* 2. BODY SPLIT VIEW */}
            <form onSubmit={handleSavePermissions} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div className="ps-body">
                {/* LEFT SIDEBAR (290px) */}
                <div className="ps-sidebar">
                  {/* User Profile Card */}
                  {targetUserForAccess && (
                    <div className="ps-user-card">
                      <div className="ps-user-head">
                        <div className="ps-user-avatar">
                          {targetUserForAccess.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="ps-user-details">
                          <div className="ps-user-name" title={targetUserForAccess.fullName}>
                            {(targetUserForAccess.username.toLowerCase() === 'admin' || targetUserForAccess.id === 1 || targetUserForAccess.isPrimaryAdmin) && (
                              <ShieldCheck size={14} color="#059669" />
                            )}
                            <span>{targetUserForAccess.fullName}</span>
                          </div>
                          <div className="ps-user-role">
                            @{targetUserForAccess.username} • <span className="badge badge-normal" style={{ fontSize: '0.68rem', padding: '1px 5px' }}>{targetUserForAccess.role}</span>
                          </div>
                        </div>
                      </div>

                      <div className="ps-meter-container">
                        <div className="ps-meter-label">
                          <span>Access Granted</span>
                          <strong style={{ color: '#4f46e5' }}>
                            {selectedPermissions.includes('all') ? '17/17 (100%)' : `${selectedPermissions.length}/17 (${Math.round((selectedPermissions.length / 17) * 100)}%)`}
                          </strong>
                        </div>
                        <div className="ps-meter-bar">
                          <div
                            className="ps-meter-fill"
                            style={{
                              width: selectedPermissions.includes('all') ? '100%' : `${(selectedPermissions.length / 17) * 100}%`
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Module Categories Navigation */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div className="ps-section-label">Module Categories</div>
                    <div className="ps-nav-list">
                      <button
                        type="button"
                        className={`ps-nav-item ${permissionCategoryFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setPermissionCategoryFilter('all')}
                      >
                        <div className="ps-nav-left">
                          <span style={{ fontSize: '0.9rem' }}>🌐</span>
                          <span>All Modules</span>
                        </div>
                        <span className="ps-nav-badge">17</span>
                      </button>

                      {PERMISSION_SECTIONS.map((sec) => {
                        const SecIcon = sec.icon;
                        const activeCount = sec.items.filter(i => selectedPermissions.includes(i.key) || selectedPermissions.includes('all')).length;
                        return (
                          <button
                            key={sec.category}
                            type="button"
                            className={`ps-nav-item ${permissionCategoryFilter === sec.category ? 'active' : ''}`}
                            onClick={() => setPermissionCategoryFilter(sec.category)}
                          >
                            <div className="ps-nav-left">
                              <SecIcon size={14} color={sec.color} />
                              <span>{sec.category}</span>
                            </div>
                            <span className="ps-nav-badge">{activeCount}/{sec.items.length}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 1-Click Role Presets */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div className="ps-section-label">Quick Role Presets</div>
                    <div className="ps-presets-list">
                      <button
                        type="button"
                        className="ps-preset-btn"
                        onClick={() => applyPreset('admin')}
                      >
                        <Shield size={13} color="#dc2626" />
                        <span>Full Admin (All 17)</span>
                      </button>
                      <button
                        type="button"
                        className="ps-preset-btn"
                        onClick={() => applyPreset('manager')}
                      >
                        <Briefcase size={13} color="#4f46e5" />
                        <span>Store Manager</span>
                      </button>
                      <button
                        type="button"
                        className="ps-preset-btn"
                        onClick={() => applyPreset('store')}
                      >
                        <Boxes size={13} color="#0284c7" />
                        <span>Store Keeper</span>
                      </button>
                      <button
                        type="button"
                        className="ps-preset-btn"
                        onClick={() => applyPreset('purchase')}
                      >
                        <ShoppingCart size={13} color="#059669" />
                        <span>Purchase Officer</span>
                      </button>
                      <button
                        type="button"
                        className="ps-preset-btn"
                        onClick={() => applyPreset('viewer')}
                      >
                        <Eye size={13} color="#d97706" />
                        <span>Auditor / Viewer</span>
                      </button>
                      <button
                        type="button"
                        className="ps-preset-btn clear-btn"
                        onClick={() => applyPreset('clear')}
                      >
                        <Trash2 size={13} color="#ef4444" />
                        <span>Clear All Modules</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* RIGHT CANVAS */}
                <div className="ps-canvas">
                  {PERMISSION_SECTIONS
                    .filter(sec => permissionCategoryFilter === 'all' || permissionCategoryFilter === sec.category)
                    .map((sec) => {
                      const SecIcon = sec.icon;
                      const secKeys = sec.items.map((i) => i.key);
                      const allSelected = secKeys.every((k) => selectedPermissions.includes(k) || selectedPermissions.includes('all'));

                      return (
                        <div key={sec.category} className="ps-category-card">
                          <div className="ps-category-header">
                            <div className="ps-category-title-group">
                              <div className="ps-cat-icon" style={{ background: `${sec.color}15`, color: sec.color }}>
                                <SecIcon size={16} />
                              </div>
                              <div>
                                <h4 className="ps-cat-title">{sec.category}</h4>
                                <p className="ps-cat-sub">{sec.items.length} Plant Capabilities available</p>
                              </div>
                            </div>

                            <button
                              type="button"
                              className="ps-toggle-all"
                              onClick={() => {
                                if (allSelected) {
                                  setSelectedPermissions((prev) => prev.filter((k) => !secKeys.includes(k)));
                                } else {
                                  setSelectedPermissions((prev) => Array.from(new Set([...prev, ...secKeys])));
                                }
                              }}
                            >
                              {allSelected ? '✕ Deselect All' : `✓ Select All (${sec.items.length})`}
                            </button>
                          </div>

                          <div className="ps-cards-grid">
                            {sec.items.map((item) => {
                              const ItemIcon = item.icon;
                              const isChecked = selectedPermissions.includes(item.key) || selectedPermissions.includes('all');
                              const isProtectedAdminItem = (targetUserForAccess?.username.toLowerCase() === 'admin' || targetUserForAccess?.id === 1 || targetUserForAccess?.isPrimaryAdmin);

                              return (
                                <div
                                  key={item.key}
                                  className={`ps-card ${isChecked ? 'active' : ''} ${isProtectedAdminItem ? 'disabled' : ''}`}
                                  onClick={() => {
                                    if (!isProtectedAdminItem) {
                                      handleTogglePermission(item.key);
                                    }
                                  }}
                                >
                                  <div className="ps-card-left">
                                    <div
                                      className="ps-card-icon"
                                      style={{
                                        background: isChecked ? `${sec.color}18` : 'var(--bg-secondary)',
                                        color: isChecked ? sec.color : 'var(--text-muted)'
                                      }}
                                    >
                                      <ItemIcon size={18} />
                                    </div>
                                    <div className="ps-card-info">
                                      <div className="ps-card-title">{item.label}</div>
                                      <div className="ps-card-desc">{item.desc}</div>
                                    </div>
                                  </div>

                                  <div className="ps-card-right">
                                    <span className={`ps-status-pill ${isChecked ? 'granted' : 'restricted'}`}>
                                      {isChecked ? (
                                        <><Check size={11} /> Granted</>
                                      ) : (
                                        <><X size={11} /> Restricted</>
                                      )}
                                    </span>

                                    <div className={`ps-switch ${isChecked ? 'on' : ''}`}>
                                      <div className="ps-switch-knob" />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* 3. STUDIO FOOTER (60px) */}
              <div className="ps-footer">
                <div className="ps-footer-summary">
                  <ShieldCheck size={17} color="#4f46e5" />
                  <span>
                    <strong>{selectedPermissions.includes('all') ? '17' : selectedPermissions.length}</strong> of 17 capabilities enabled • {selectedPermissions.includes('all') ? '0' : 17 - selectedPermissions.length} restricted
                  </span>
                </div>

                <div className="ps-footer-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setIsAccessControlOpen(false)}
                    disabled={accessSaving}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="ps-save-btn"
                    disabled={accessSaving}
                  >
                    {accessSaving ? <RefreshCw size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                    <span>{accessSaving ? 'Saving Changes...' : 'Save Permissions Matrix'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Signature Preview Modal */}
      <Modal isOpen={isUserSigModalOpen} onClose={() => setIsUserSigModalOpen(false)} title={`Digital Signature: ${selectedUserForSig?.fullName || ''}`}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '20px' }}>
          {userSigPreview ? (
            <div style={{ background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}>
              <img src={userSigPreview} alt="Signature Preview" style={{ maxWidth: '300px', maxHeight: '150px' }} />
            </div>
          ) : (
            <div style={{ padding: '30px', color: '#999', fontStyle: 'italic', background: '#f5f5f5', borderRadius: '8px', width: '100%', textAlign: 'center' }}>
              No digital signature uploaded for this user.
            </div>
          )}
          <button type="button" className="btn btn-secondary" onClick={() => setIsUserSigModalOpen(false)}>Close</button>
        </div>
      </Modal>
    </div>
  );
};

