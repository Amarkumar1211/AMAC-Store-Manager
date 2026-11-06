import React, { useState, useEffect, useRef } from 'react';
import {
  Building,
  User as UserIcon,
  ClipboardList,
  Inbox,
  Sparkles,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  FileDown,
  Printer,
  Calendar,
  AlertTriangle,
  Boxes,
  Plus,
  ArrowRight,
  TrendingUp,
  Tag,
  Eye,
  Info,
  ChevronRight,
  RefreshCw,
  FileText,
  ShieldCheck,
  Check,
  PackageCheck,
  Upload,
  Trash2,
  PenTool,
  Image as ImageIcon
} from 'lucide-react';
import api from '../services/api';
import { User, StoreRequisition, MaterialIssue, Department, Material, Supervisor } from '../types';
import { Modal, PrintableIssueSlip } from '../components/ModalAndPrintables';
import { AutoSuggestMaterial } from '../components/AutoSuggestComponents';

interface DepartmentPortalPageProps {
  user: User | null;
}

export const DepartmentPortalPage: React.FC<DepartmentPortalPageProps> = ({ user }) => {
  // Navigation & View State
  const [activeTab, setActiveTab] = useState<'requisitions' | 'issues'>('requisitions');
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(user?.departmentId || null);
  const [loading, setLoading] = useState(false);

  // Master Data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);

  // Department-Specific Data
  const [requisitions, setRequisitions] = useState<StoreRequisition[]>([]);
  const [issues, setIssues] = useState<MaterialIssue[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [search, setSearch] = useState('');

  // Modals State
  const [isRaiseModalOpen, setIsRaiseModalOpen] = useState(false);
  const [selectedDenialReq, setSelectedDenialReq] = useState<StoreRequisition | null>(null);
  const [printIssue, setPrintIssue] = useState<MaterialIssue | null>(null);
  const [selectedReqDetail, setSelectedReqDetail] = useState<StoreRequisition | null>(null);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);

  // Signature Upload State
  const [sigSupervisorName, setSigSupervisorName] = useState<string>('');
  const [signaturePreview, setSignaturePreview] = useState<string>('');
  const [sigSaving, setSigSaving] = useState(false);
  const [sigSuccess, setSigSuccess] = useState('');
  const [sigError, setSigError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Raise Form State
  const [reqRequestedBy, setReqRequestedBy] = useState('');
  const [isCustomSupervisor, setIsCustomSupervisor] = useState(false);
  const [reqRequiredDate, setReqRequiredDate] = useState(new Date().toISOString().split('T')[0]);
  const [reqShift, setReqShift] = useState('Shift A');
  const [reqPurpose, setReqPurpose] = useState('Production Consumption');
  const [reqJobOrder, setReqJobOrder] = useState('');
  const [reqRemarks, setReqRemarks] = useState('');
  const [reqItems, setReqItems] = useState<{
    materialId: string;
    requestedQuantity: number;
    location: string;
    itemRemarks: string;
  }[]>([{ materialId: '', requestedQuantity: 1, location: '', itemRemarks: '' }]);

  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Determine active department object
  const currentDept = departments.find((d) => d.id === selectedDeptId) || {
    id: selectedDeptId || departments[0]?.id || 0,
    name: user?.departmentName || departments[0]?.name || 'PRODUCTION'
  };

  // Supervisors for current department
  const deptSupervisors = supervisors.filter((s) => {
    const sDept = (s.department || '').trim().toLowerCase();
    const curDeptName = (currentDept.name || '').trim().toLowerCase();
    return sDept === curDeptName || curDeptName.includes(sDept) || sDept.includes(curDeptName) || curDeptName === 'all department';
  });

  // Fetch Master Data
  const fetchMasters = async () => {
    try {
      const [deptRes, supRes, matRes] = await Promise.all([
        api.get('/materials/departments'),
        api.get('/supervisors'),
        api.get('/stock/summary')
      ]);
      setDepartments(deptRes.data || []);
      setSupervisors(supRes.data || []);
      setMaterials(matRes.data || []);

      if (user?.departmentId) {
        const exists = deptRes.data.some((d: Department) => d.id === user.departmentId);
        if (exists) {
          setSelectedDeptId(user.departmentId);
        } else {
          const matchByName = deptRes.data.find((d: Department) => d.name === user?.departmentName);
          if (matchByName) {
             setSelectedDeptId(matchByName.id);
          } else {
             const prodDept = deptRes.data.find((d: Department) => d.name.toUpperCase().includes('PROD'));
             setSelectedDeptId(prodDept ? prodDept.id : deptRes.data[0]?.id || 0);
          }
        }
      } else if (deptRes.data && deptRes.data.length > 0) {
        const prodDept = deptRes.data.find((d: Department) => d.name.toUpperCase().includes('PROD'));
        setSelectedDeptId(prodDept ? prodDept.id : deptRes.data[0].id);
      }
    } catch (err) {
      console.error('Error fetching department portal masters', err);
    }
  };

  useEffect(() => {
    fetchMasters();
  }, [user]);

  // Fetch Department Requisitions & Dispatched Issues
  const fetchDeptData = async () => {
    if (!selectedDeptId && !currentDept.name) return;
    setLoading(true);
    try {
      const [reqRes, issRes] = await Promise.all([
        api.get('/store-requisitions', {
          params: {
            departmentId: selectedDeptId || undefined,
            status: statusFilter === 'All' ? undefined : statusFilter,
            search: search || undefined
          }
        }),
        api.get('/issues', {
          params: {
            search: currentDept.name || undefined
          }
        })
      ]);
      setRequisitions(reqRes.data || []);
      const curDeptClean = (currentDept.name || '').trim().toLowerCase();
      const filteredIssues = (issRes.data || []).filter((i: MaterialIssue) => {
        if (!curDeptClean) return true;
        const issDept = (i.departmentName || '').trim().toLowerCase();
        return issDept.includes(curDeptClean) || curDeptClean.includes(issDept);
      });
      setIssues(filteredIssues);
    } catch (err) {
      console.error('Error fetching department data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeptData();
  }, [selectedDeptId, statusFilter, search]);

  // Live Real-Time Requisition Sync Listener (Instant Allow / Deny / Raise reflection)
  useEffect(() => {
    const handleSync = (e: any) => {
      const liveEv = e.detail;
      if (!liveEv) return;

      const curDeptClean = (currentDept.name || '').trim().toLowerCase();
      const evDeptClean = (liveEv.departmentName || '').trim().toLowerCase();
      const matchesDept =
        !selectedDeptId ||
        liveEv.departmentId === selectedDeptId ||
        (evDeptClean && curDeptClean && (curDeptClean.includes(evDeptClean) || evDeptClean.includes(curDeptClean)));

      if (matchesDept || user?.role === 'Admin' || user?.role === 'StoreManager') {
        fetchDeptData();
      }
    };

    window.addEventListener('amac-requisition-sync', handleSync);
    return () => {
      window.removeEventListener('amac-requisition-sync', handleSync);
    };
  }, [selectedDeptId, currentDept.name, user]);

  // Resolve active digital signature for a supervisor or department
  const getActiveSignature = (supervisorName?: string): string => {
    const targetSupName = supervisorName || reqRequestedBy || deptSupervisors[0]?.name || user?.fullName || '';
    if (targetSupName) {
      const supObj = supervisors.find((s) => s.name.trim().toLowerCase() === targetSupName.trim().toLowerCase());
      if (supObj?.signatureDataUrl) return supObj.signatureDataUrl;
      const cached = localStorage.getItem(`sig_sup_${targetSupName.toLowerCase().replace(/\s+/g, '_')}`);
      if (cached) return cached;
    }
    if (selectedDeptId) {
      const deptCached = localStorage.getItem(`sig_dept_${selectedDeptId}`);
      if (deptCached) return deptCached;
    }
    return localStorage.getItem('dept_current_signature') || '';
  };

  // Sync default supervisor on modal open
  const initializeRaiseModal = (prefillMaterialId?: string) => {
    setFormError('');
    setFormSuccess('');
    setIsCustomSupervisor(false);

    if (deptSupervisors.length > 0) {
      setReqRequestedBy(deptSupervisors[0].name);
      if (deptSupervisors[0].shift) {
        setReqShift(deptSupervisors[0].shift.toUpperCase().includes('B') ? 'Shift B' : 'Shift A');
      }
    } else {
      setReqRequestedBy(user?.fullName || user?.username || '');
    }

    if (prefillMaterialId) {
      setReqItems([{ materialId: prefillMaterialId, requestedQuantity: 1, location: '', itemRemarks: '' }]);
    } else {
      setReqItems([{ materialId: '', requestedQuantity: 1, location: '', itemRemarks: '' }]);
    }
    setIsRaiseModalOpen(true);
  };

  // Handle PNG Signature Upload & Conversion
  const handleSignatureFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setSigError('Please upload a valid image file (PNG, JPG, or WebP).');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setSigError('Image file is too large. Please upload an image under 3MB.');
      return;
    }

    setSigError('');
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        setSignaturePreview(reader.result.toString());
      }
    };
    reader.readAsDataURL(file);
  };

  // Save Signature to Backend and Local Cache
  const handleSaveSignature = async () => {
    setSigError('');
    setSigSuccess('');
    setSigSaving(true);

    const supName = sigSupervisorName || deptSupervisors[0]?.name || user?.fullName || 'Supervisor';

    try {
      await api.post('/supervisors/signature', {
        supervisorName: supName,
        department: currentDept.name,
        signatureDataUrl: signaturePreview || null
      });

      // Cache locally for instant slip rendering
      const key = `sig_sup_${supName.toLowerCase().replace(/\s+/g, '_')}`;
      if (signaturePreview) {
        localStorage.setItem(key, signaturePreview);
        if (selectedDeptId) localStorage.setItem(`sig_dept_${selectedDeptId}`, signaturePreview);
        localStorage.setItem('dept_current_signature', signaturePreview);
      } else {
        localStorage.removeItem(key);
        if (selectedDeptId) localStorage.removeItem(`sig_dept_${selectedDeptId}`);
        localStorage.removeItem('dept_current_signature');
      }

      setSigSuccess('🎉 Digital signature saved! It will now be automatically stamped on all new requisitions and issue slips.');
      fetchMasters();
      setTimeout(() => {
        setIsSignatureModalOpen(false);
        setSigSuccess('');
      }, 1500);
    } catch (err: any) {
      setSigError(err.response?.data?.message || 'Failed to save signature.');
    } finally {
      setSigSaving(false);
    }
  };

  // Requisition Item Helpers
  const handleAddItem = () => {
    setReqItems([...reqItems, { materialId: '', requestedQuantity: 1, location: '', itemRemarks: '' }]);
  };

  const handleRemoveItem = (index: number) => {
    setReqItems(reqItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...reqItems];
    (updated[index] as any)[field] = value;
    setReqItems(updated);
  };

  const handleSubmitRequisition = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!selectedDeptId) {
      setFormError('Department is required.');
      return;
    }

    for (const item of reqItems) {
      if (!item.materialId || item.requestedQuantity <= 0) {
        setFormError('Please select a material and enter a valid quantity > 0 for each line.');
        return;
      }
    }

    // Attach active signature automatically
    const activeSig = getActiveSignature(reqRequestedBy);

    try {
      const payload = {
        departmentId: selectedDeptId,
        requestedBy: reqRequestedBy || user?.fullName || user?.username,
        requiredDate: reqRequiredDate ? new Date(reqRequiredDate).toISOString() : null,
        shift: reqShift,
        purpose: reqPurpose,
        jobOrderOrMachine: reqJobOrder || undefined,
        remarks: reqRemarks || undefined,
        supervisorSignature: activeSig || undefined,
        items: reqItems.map((i) => ({
          materialId: parseInt(i.materialId),
          requestedQuantity: parseFloat(i.requestedQuantity.toString()),
          location: i.location || undefined,
          itemRemarks: i.itemRemarks || undefined
        }))
      };

      const res = await api.post('/store-requisitions', payload);
      setFormSuccess(`🎉 Requisition ${res.data.requisitionNumber} raised successfully! ${activeSig ? 'Digital signature stamped.' : ''}`);
      setTimeout(() => {
        setIsRaiseModalOpen(false);
        setFormSuccess('');
        fetchDeptData();
      }, 1500);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to submit requisition. Please verify details.');
    }
  };

  const handleCancelRequisition = async (reqId: number) => {
    if (!window.confirm('Are you sure you want to cancel this pending requisition?')) return;
    try {
      await api.delete(`/store-requisitions/${reqId}`);
      fetchDeptData();
    } catch (err) {
      alert('Failed to cancel requisition.');
    }
  };

  // KPIs Calculations
  const pendingReqs = requisitions.filter((r) => r.status === 'Pending').length;
  const allowedReqs = requisitions.filter((r) => r.status === 'Allowed').length;
  const deniedReqs = requisitions.filter((r) => r.status === 'Denied').length;
  const totalSpend = issues.reduce((acc, i) => acc + (i.totalIssueCost || 0), 0);

  const activeDeptSignature = getActiveSignature();

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* =========================================================================
          1. DEDICATED DEPARTMENT PORTAL HERO BANNER
         ========================================================================= */}
      <div
        style={{
          background: 'linear-gradient(135deg, #064e3b 0%, #065f46 45%, #047857 100%)',
          color: '#ffffff',
          padding: '24px 30px',
          marginBottom: '24px',
          borderRadius: '16px',
          boxShadow: '0 12px 30px -8px rgba(6, 78, 59, 0.45)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Subtle Decorative Background Glow */}
        <div style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '240px',
          height: '240px',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, rgba(6, 78, 59, 0) 70%)',
          borderRadius: '50%',
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', position: 'relative', zIndex: 2 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{
                background: 'rgba(255, 255, 255, 0.18)',
                backdropFilter: 'blur(10px)',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 800,
                letterSpacing: '0.6px',
                textTransform: 'uppercase',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <Building size={13} />
                Department Requisition & Indent Hub
              </span>
              <span style={{
                background: '#10b981',
                color: '#ffffff',
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '0.72rem',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 2px 6px rgba(16, 185, 129, 0.4)'
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ffffff', display: 'inline-block' }} />
                Live Store Link Active
              </span>
            </div>

            <h1 style={{ margin: 0, fontSize: '1.85rem', fontWeight: 900, letterSpacing: '-0.5px', color: '#ffffff' }}>
              {currentDept.name} DEPARTMENT
            </h1>

            <p style={{ margin: '6px 0 0 0', opacity: 0.92, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Supervisor: <strong>{user?.fullName || user?.username}</strong></span>
              <span>•</span>
              <span>Unit-5 Manufacturing</span>
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Department Switcher (For Admins / Store Managers) */}
            {(user?.role === 'Admin' || user?.role === 'StoreManager') && (
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 12px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(255,255,255,0.15)' }}>
                <span style={{ fontSize: '0.75rem', opacity: 0.85, fontWeight: 700 }}>Switch Department:</span>
                <select
                  value={selectedDeptId || ''}
                  onChange={(e) => setSelectedDeptId(Number(e.target.value))}
                  style={{
                    background: '#ffffff',
                    color: '#0f172a',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '5px 12px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Signature Upload & Management Button */}
            <button
              onClick={() => {
                setSigError('');
                setSigSuccess('');
                const defaultName = deptSupervisors[0]?.name || user?.fullName || '';
                setSigSupervisorName(defaultName);
                const currentSig = getActiveSignature(defaultName);
                setSignaturePreview(currentSig);
                setIsSignatureModalOpen(true);
              }}
              style={{
                background: activeDeptSignature ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                border: activeDeptSignature ? '1px solid #34d399' : '1px solid rgba(255, 255, 255, 0.3)',
                padding: '12px 18px',
                borderRadius: '12px',
                fontSize: '0.86rem',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                backdropFilter: 'blur(8px)',
                transition: 'all 0.15s ease'
              }}
              title="Upload / Manage supervisor digital signature for requisitions and issue slips"
            >
              <PenTool size={16} color={activeDeptSignature ? '#34d399' : '#ffffff'} />
              {activeDeptSignature ? (
                <span>✍️ Digital Signature (Active)</span>
              ) : (
                <span>✍️ Upload Signature (PNG)</span>
              )}
            </button>

            {/* Raise Requisition Primary Button */}
            <button
              onClick={() => initializeRaiseModal()}
              style={{
                background: '#ffffff',
                color: '#064e3b',
                fontWeight: 800,
                fontSize: '0.92rem',
                padding: '12px 22px',
                borderRadius: '12px',
                boxShadow: '0 6px 16px rgba(0,0,0,0.18)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <Sparkles size={17} color="#059669" />
              + Raise Store Requisition
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. KPI SUMMARY CARDS (GORGEOUS MODERN GRID)
         ========================================================================= */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}
      >
        {/* Card 1: Total Requisitions */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderLeft: '4px solid #0284c7',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 4px 15px -3px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
              Total Requisitions
            </span>
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(2, 132, 199, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ClipboardList size={18} color="#0284c7" />
            </div>
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: '6px' }}>
            {requisitions.length}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            All-time department indents
          </div>
        </div>

        {/* Card 2: Pending Store Review */}
        <div
          style={{
            background: pendingReqs > 0 ? 'rgba(245, 158, 11, 0.06)' : 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderLeft: '4px solid #f59e0b',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 4px 15px -3px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: pendingReqs > 0 ? '#b45309' : 'var(--text-muted)' }}>
              Pending Store Review
            </span>
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={18} color="#f59e0b" />
            </div>
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 900, color: pendingReqs > 0 ? '#d97706' : 'var(--text-primary)', lineHeight: 1.1, marginBottom: '6px' }}>
            {pendingReqs}
          </div>
          <div style={{ fontSize: '0.74rem', color: pendingReqs > 0 ? '#b45309' : 'var(--text-muted)', fontWeight: pendingReqs > 0 ? 800 : 600 }}>
            {pendingReqs > 0 ? '⏳ In Store Manager Approval Queue' : 'All requests fulfilled'}
          </div>
        </div>

        {/* Card 3: Allowed & Issued Slips */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderLeft: '4px solid #059669',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 4px 15px -3px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
              Allowed & Issued
            </span>
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(5, 150, 105, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PackageCheck size={18} color="#059669" />
            </div>
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#059669', lineHeight: 1.1, marginBottom: '6px' }}>
            {allowedReqs}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Dispatched to shop floor
          </div>
        </div>

        {/* Card 4: Total Material Valuation */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderLeft: '4px solid #6366f1',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 4px 15px -3px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
              Department Spend
            </span>
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={18} color="#6366f1" />
            </div>
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#4f46e5', lineHeight: 1.1, marginBottom: '6px' }}>
            ₹{totalSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Total issued consumption value
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. WORKSPACE TAB CONTROLS (CLEAN SEGMENT SWITCHER)
         ========================================================================= */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <button
            onClick={() => setActiveTab('requisitions')}
            style={{
              padding: '8px 16px',
              fontSize: '0.84rem',
              fontWeight: 800,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: activeTab === 'requisitions' ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : 'transparent',
              color: activeTab === 'requisitions' ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: activeTab === 'requisitions' ? '0 2px 6px rgba(5,150,105,0.3)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <ClipboardList size={15} /> My Material Requisitions ({requisitions.length})
            {pendingReqs > 0 && (
              <span style={{
                background: activeTab === 'requisitions' ? '#ffffff' : '#f59e0b',
                color: activeTab === 'requisitions' ? '#047857' : '#ffffff',
                padding: '1px 7px',
                borderRadius: '10px',
                fontSize: '0.7rem',
                fontWeight: 900
              }}>
                {pendingReqs}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('issues')}
            style={{
              padding: '8px 16px',
              fontSize: '0.84rem',
              fontWeight: 800,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: activeTab === 'issues' ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : 'transparent',
              color: activeTab === 'issues' ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: activeTab === 'issues' ? '0 2px 6px rgba(5,150,105,0.3)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Boxes size={15} /> Dispatched Material Slips ({issues.length})
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={fetchDeptData}
            title="Refresh department data"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: DEPARTMENT REQUISITIONS (INDENTS TRACKING)
         ========================================================================= */}
      {activeTab === 'requisitions' && (
        <div>
          {/* Filter Bar */}
          <div className="card" style={{ padding: '12px 18px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>Status:</span>
              {['All', 'Pending', 'Allowed', 'Denied'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
                  style={{
                    padding: '4px 12px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    borderRadius: '20px',
                    background: statusFilter === st ? '#059669' : undefined,
                    borderColor: statusFilter === st ? '#059669' : undefined
                  }}
                >
                  {st === 'All' ? 'All Requests' : st}
                </button>
              ))}
            </div>

            <div style={{ position: 'relative', width: '300px' }}>
              <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-control form-control-sm"
                style={{ paddingLeft: '34px', fontSize: '0.82rem' }}
                placeholder="Search SREQ #, Material, Purpose..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Requisitions Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Indent No</th>
                    <th>Indent Date</th>
                    <th>Required Date</th>
                    <th>Supervisor / Shift</th>
                    <th>Purpose / Job Ref</th>
                    <th>Requested Materials</th>
                    <th style={{ textAlign: 'right' }}>Est. Cost (₹)</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requisitions.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
                        <Inbox size={36} style={{ margin: '0 auto 12px', opacity: 0.35 }} />
                        <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>No Material Requisitions Found</div>
                        <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>Click "+ Raise Store Requisition" to request materials from Store.</div>
                      </td>
                    </tr>
                  ) : (
                    requisitions.map((req) => (
                      <tr key={req.id}>
                        <td style={{ fontWeight: 800, color: 'var(--primary-color)' }}>
                          {req.requisitionNumber}
                        </td>
                        <td>{new Date(req.requisitionDate).toLocaleDateString('en-GB')}</td>
                        <td>
                          {req.requiredDate ? (
                            <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                              {new Date(req.requiredDate).toLocaleDateString('en-GB')}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Immediate</span>
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{req.requestedBy}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>{req.shift || 'General'}</span>
                            {req.supervisorSignature && (
                              <span style={{ color: '#059669', fontWeight: 800 }} title="Digitally signed with PNG signature">
                                • ✍️ Signed
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{req.purpose || 'Production'}</div>
                          {req.jobOrderOrMachine && (
                            <div style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 600 }}>⚙️ {req.jobOrderOrMachine}</div>
                          )}
                        </td>
                        <td>
                          <div style={{ fontSize: '0.8rem' }}>
                            {req.items?.slice(0, 2).map((item, idx) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                <span style={{ fontWeight: 700 }}>{item.materialCode}:</span>
                                <span>{item.requestedQuantity} {item.defaultUom}</span>
                              </div>
                            ))}
                            {(req.items?.length || 0) > 2 && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800 }}>
                                + {(req.items?.length || 0) - 2} more materials
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#059669' }}>
                          ₹{req.totalEstimatedCost?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {req.status === 'Pending' && (
                            <span style={{ background: '#fef3c7', color: '#b45309', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={12} /> Pending Review
                            </span>
                          )}
                          {req.status === 'Allowed' && (
                            <span style={{ background: '#d1fae5', color: '#065f46', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle2 size={12} /> Allowed & Issued
                            </span>
                          )}
                          {req.status === 'Denied' && (
                            <span style={{ background: '#fee2e2', color: '#991b1b', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <XCircle size={12} /> Denied
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '3px 8px', fontSize: '0.75rem', fontWeight: 700 }}
                              onClick={() => setSelectedReqDetail(req)}
                              title="View line items breakdown"
                            >
                              <Eye size={13} /> View
                            </button>

                            {req.status === 'Denied' && req.denialRemarks && (
                              <button
                                className="btn btn-sm"
                                style={{
                                  background: '#fee2e2',
                                  color: '#991b1b',
                                  borderColor: '#fca5a5',
                                  padding: '3px 8px',
                                  fontSize: '0.75rem',
                                  fontWeight: 800
                                }}
                                onClick={() => setSelectedDenialReq(req)}
                                title="Read Store Manager Rejection Reason"
                              >
                                <AlertTriangle size={13} /> Reason
                              </button>
                            )}

                            {req.status === 'Allowed' && req.resultingIssueSlipNumber && (
                              <button
                                className="btn btn-primary btn-sm"
                                style={{
                                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                                  borderColor: '#059669',
                                  padding: '3px 8px',
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                                onClick={async () => {
                                  try {
                                    const issRes = await api.get('/issues', { params: { search: req.resultingIssueSlipNumber } });
                                    if (issRes.data && issRes.data.length > 0) {
                                      const fullIss = await api.get(`/issues/${issRes.data[0].id}`);
                                      setPrintIssue(fullIss.data);
                                    }
                                  } catch {}
                                }}
                                title="View & Print Issue Slip with Digital Signature (KDC-STR-FF-09)"
                              >
                                <Printer size={13} /> Issue Slip
                              </button>
                            )}

                            {req.status === 'Pending' && (
                              <button
                                className="btn btn-danger btn-sm"
                                style={{ padding: '3px 8px', fontSize: '0.75rem', fontWeight: 700 }}
                                onClick={() => handleCancelRequisition(req.id)}
                                title="Cancel requisition"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: DISPATCHED MATERIAL ISSUE SLIPS HISTORY
         ========================================================================= */}
      {activeTab === 'issues' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Issue Slip No</th>
                  <th>Issue Date</th>
                  <th>Supervisor / Indentor</th>
                  <th>Shift</th>
                  <th>Purpose</th>
                  <th>Items Count</th>
                  <th style={{ textAlign: 'right' }}>Total Value (₹)</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {issues.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
                      <Boxes size={36} style={{ margin: '0 auto 12px', opacity: 0.35 }} />
                      <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>No Material Issue History Found</div>
                      <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>Dispatched issue slips for {currentDept.name} will appear here.</div>
                    </td>
                  </tr>
                ) : (
                  issues.map((iss) => (
                    <tr key={iss.id}>
                      <td style={{ fontWeight: 800, color: 'var(--primary-color)' }}>
                        {iss.issueSlipNumber}
                      </td>
                      <td>{new Date(iss.issueDate).toLocaleDateString('en-GB')}</td>
                      <td style={{ fontWeight: 700 }}>
                        {iss.supervisorName || 'Department Operator'}
                        {iss.supervisorSignature && (
                          <span style={{ fontSize: '0.72rem', color: '#059669', marginLeft: '6px', fontWeight: 800 }} title="Signed">
                            ✍️
                          </span>
                        )}
                      </td>
                      <td>{iss.shift || 'General'}</td>
                      <td>{iss.purpose || 'Production Consumption'}</td>
                      <td>
                        <span style={{ fontWeight: 800 }}>{iss.itemCount || (iss.items ? iss.items.length : 1)}</span> Materials
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#059669' }}>
                        ₹{(iss.totalIssueCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '3px 10px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          onClick={async () => {
                            try {
                              const full = await api.get(`/issues/${iss.id}`);
                              setPrintIssue(full.data);
                            } catch {}
                          }}
                        >
                          <Printer size={13} /> Print Slip
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 1: RAISE DEPARTMENT REQUISITION
         ========================================================================= */}
      <Modal
        isOpen={isRaiseModalOpen}
        onClose={() => setIsRaiseModalOpen(false)}
        title={`Raise Material Requisition — ${currentDept.name} Department`}
        size="lg"
      >
        <form onSubmit={handleSubmitRequisition}>
          {formError && (
            <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
              <AlertTriangle size={16} /> {formError}
            </div>
          )}

          {formSuccess && (
            <div style={{ padding: '10px 14px', background: '#d1fae5', color: '#065f46', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
              <CheckCircle2 size={16} /> {formSuccess}
            </div>
          )}

          <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '10px', marginBottom: '16px', border: '1px solid var(--border-color)' }}>
            <div className="form-grid-3">
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 800 }}>Requesting Department</label>
                <input
                  type="text"
                  className="form-control"
                  disabled
                  value={`${currentDept.name} (Auto-Locked)`}
                  style={{ background: 'var(--card-bg)', fontWeight: 800, color: '#059669' }}
                />
              </div>

              {/* Authorised Supervisor Selector */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label className="form-label" style={{ fontWeight: 800, margin: 0 }}>
                    Supervisor (Indentor) *
                  </label>
                  {deptSupervisors.length > 1 && !isCustomSupervisor && (
                    <span style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: 800 }}>
                      ({deptSupervisors.length} Dept Supervisors)
                    </span>
                  )}
                  {isCustomSupervisor && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomSupervisor(false);
                        if (deptSupervisors.length > 0) setReqRequestedBy(deptSupervisors[0].name);
                      }}
                      style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                    >
                      ↩️ Pick from List
                    </button>
                  )}
                </div>

                {!isCustomSupervisor ? (
                  <select
                    className="form-control"
                    required
                    value={reqRequestedBy}
                    onChange={(e) => {
                      if (e.target.value === '__CUSTOM__') {
                        setIsCustomSupervisor(true);
                        setReqRequestedBy('');
                      } else {
                        setIsCustomSupervisor(false);
                        setReqRequestedBy(e.target.value);
                        const sObj = supervisors.find((s) => s.name === e.target.value);
                        if (sObj?.shift) {
                          setReqShift(sObj.shift.toUpperCase().includes('B') ? 'Shift B' : 'Shift A');
                        }
                      }
                    }}
                    style={{ fontWeight: 700, borderColor: reqRequestedBy ? '#059669' : undefined }}
                  >
                    {!reqRequestedBy && <option value="">-- Select Supervisor --</option>}
                    {deptSupervisors.length > 0 ? (
                      deptSupervisors.map((s) => (
                        <option key={s.id} value={s.name}>
                          👤 {s.name} ({s.shift || 'Shift A'}) {s.phone ? `• 📞 ${s.phone}` : ''}
                        </option>
                      ))
                    ) : (
                      supervisors.map((s) => (
                        <option key={s.id} value={s.name}>
                          👤 {s.name} ({s.department} - {s.shift || 'Shift A'})
                        </option>
                      ))
                    )}
                    <option value="__CUSTOM__">✏️ + Enter Custom / Relief Supervisor...</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder="Enter supervisor name"
                    value={reqRequestedBy}
                    onChange={(e) => setReqRequestedBy(e.target.value)}
                    autoFocus
                  />
                )}
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 800 }}>Required Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={reqRequiredDate}
                  onChange={(e) => setReqRequiredDate(e.target.value)}
                />
              </div>
            </div>

            <div className="form-grid-3" style={{ marginTop: '12px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Shift</label>
                <select className="form-control" value={reqShift} onChange={(e) => setReqShift(e.target.value)}>
                  <option value="Shift A">Shift A (06:00 - 14:30)</option>
                  <option value="Shift B">Shift B (14:30 - 23:00)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Consumption Purpose / Process</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Melt Batch 05, Core Shop Tooling"
                  value={reqPurpose}
                  onChange={(e) => setReqPurpose(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Job Order # / Machine Ref</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Die-04, Job #1094"
                  value={reqJobOrder}
                  onChange={(e) => setReqJobOrder(e.target.value)}
                />
              </div>
            </div>

            {/* Signature Status Indicator in Requisition Form */}
            <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                <PenTool size={14} color="#059669" />
                <span>
                  Digital Signature: {getActiveSignature(reqRequestedBy) ? (
                    <strong style={{ color: '#059669' }}>● Attached & Ready for Issue Slip</strong>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>No PNG signature uploaded yet.</span>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSigSupervisorName(reqRequestedBy || deptSupervisors[0]?.name || user?.fullName || '');
                  setSignaturePreview(getActiveSignature(reqRequestedBy));
                  setIsSignatureModalOpen(true);
                }}
                style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', textDecoration: 'underline' }}
              >
                {getActiveSignature(reqRequestedBy) ? 'Change Signature' : '+ Upload Signature PNG'}
              </button>
            </div>
          </div>

          {/* Line Items */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="form-label" style={{ fontWeight: 800, margin: 0 }}>
                Requested Materials & Quantities
              </label>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Store Manager will check available inventory and approve
              </span>
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '40%' }}>Material *</th>
                    <th style={{ width: '15%', textAlign: 'center' }}>Live Store Stock</th>
                    <th style={{ width: '15%' }}>Requested Qty *</th>
                    <th style={{ width: '25%' }}>Remarks / Job Details</th>
                    <th style={{ width: '5%', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {reqItems.map((item, index) => {
                    const matObj = materials.find((m) => m.id.toString() === item.materialId.toString());
                    return (
                      <tr key={index}>
                        <td>
                          <AutoSuggestMaterial
                            materials={materials}
                            selectedMaterialId={item.materialId ? parseInt(item.materialId) : null}
                            onSelectMaterial={(mat: Material | null) => handleItemChange(index, 'materialId', mat ? mat.id.toString() : '')}
                            placeholder="Search material code or name..."
                          />
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 800 }}>
                          {matObj ? (
                            <span style={{ color: matObj.currentStock > 0 ? '#059669' : '#dc2626' }}>
                              {matObj.currentStock} {matObj.defaultUom}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>-</span>
                          )}
                        </td>
                        <td>
                          <input
                            type="number"
                            step="any"
                            min="0.001"
                            className="form-control"
                            required
                            value={item.requestedQuantity}
                            onChange={(e) => handleItemChange(index, 'requestedQuantity', parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="e.g. Urgent for Melt"
                            value={item.itemRemarks}
                            onChange={(e) => handleItemChange(index, 'itemRemarks', e.target.value)}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {reqItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 800, fontSize: '1rem' }}
                            >
                              ✕
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleAddItem}
              style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
            >
              <Plus size={13} /> + Add Another Material Line
            </button>
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ fontWeight: 700 }}>General Indent Notes (Optional)</label>
            <textarea
              className="form-control"
              rows={2}
              placeholder="Any additional instructions or priority notes for the Store Manager..."
              value={reqRemarks}
              onChange={(e) => setReqRemarks(e.target.value)}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setIsRaiseModalOpen(false)}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                borderColor: '#059669',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Sparkles size={15} /> Submit Requisition to Store
            </button>
          </div>
        </form>
      </Modal>

      {/* =========================================================================
          MODAL 2: UPLOAD & MANAGE SUPERVISOR DIGITAL SIGNATURE (PNG)
         ========================================================================= */}
      <Modal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        title={`Supervisor Digital Signature — ${currentDept.name} Department`}
        size="md"
      >
        <div style={{ padding: '6px 0' }}>
          {sigError && (
            <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
              <AlertTriangle size={16} /> {sigError}
            </div>
          )}

          {sigSuccess && (
            <div style={{ padding: '10px 14px', background: '#d1fae5', color: '#065f46', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
              <CheckCircle2 size={16} /> {sigSuccess}
            </div>
          )}

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ fontWeight: 800 }}>Verified Signatory</label>
            {user?.role === 'Admin' || user?.role === 'StoreManager' ? (
              <select
                className="form-control"
                value={sigSupervisorName}
                onChange={(e) => {
                  const name = e.target.value;
                  setSigSupervisorName(name);
                  setSignaturePreview(getActiveSignature(name));
                }}
                style={{ fontWeight: 700 }}
              >
                {deptSupervisors.length > 0 ? (
                  deptSupervisors.map((s) => (
                    <option key={s.id} value={s.name}>
                      👤 {s.name} ({s.shift || 'General'})
                    </option>
                  ))
                ) : (
                  <option value={user?.fullName || user?.username}>
                    👤 {user?.fullName || user?.username} ({currentDept.name})
                  </option>
                )}
              </select>
            ) : (
              <div style={{
                padding: '10px 14px',
                background: 'rgba(5, 150, 105, 0.08)',
                border: '1px solid rgba(5, 150, 105, 0.25)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ fontWeight: 800, color: '#065f46', fontSize: '0.88rem' }}>
                  👤 {user?.fullName || user?.username} ({currentDept.name})
                </div>
                <span style={{ fontSize: '0.72rem', background: '#059669', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                  Verified Identity
                </span>
              </div>
            )}
          </div>

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept="image/png, image/jpeg, image/webp"
            onChange={handleSignatureFileSelect}
          />

          {/* Drag & Drop / Upload Box */}
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed var(--border-color)',
              borderRadius: '12px',
              padding: '24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: 'var(--bg-secondary)',
              transition: 'border-color 0.15s ease',
              marginBottom: '16px'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#059669')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
          >
            <Upload size={28} color="#059669" style={{ margin: '0 auto 8px' }} />
            <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
              Click or Drag & Drop PNG Signature Image
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Transparent PNG recommended • Max 3MB
            </div>
          </div>

          {/* Live Preview on Slip */}
          <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '14px', marginBottom: '20px' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '8px' }}>
              Official Issue Slip (Form KDC-STR-FF-09) Live Preview:
            </div>
            <div style={{
              background: '#ffffff',
              border: '1px solid #0f172a',
              borderRadius: '6px',
              padding: '12px',
              minHeight: '80px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              alignItems: 'center',
              width: '180px',
              margin: '0 auto'
            }}>
              {signaturePreview ? (
                <div style={{ textAlign: 'center', width: '100%' }}>
                  <img
                    src={signaturePreview}
                    alt="Signature Preview"
                    style={{ maxHeight: '45px', maxWidth: '140px', objectFit: 'contain', display: 'block', margin: '0 auto 4px' }}
                  />
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0f172a', borderTop: '1px solid #0f172a', paddingTop: '2px' }}>
                    {sigSupervisorName || 'Supervisor'}
                  </div>
                  <div style={{ fontSize: '0.62rem', color: '#64748b' }}>REQUESTED BY (Indentor)</div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.74rem' }}>
                  <PenTool size={20} style={{ margin: '0 auto 4px', opacity: 0.4 }} />
                  <div>No Signature Loaded</div>
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
            {signaturePreview ? (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => setSignaturePreview('')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
              >
                <Trash2 size={14} /> Remove Signature
              </button>
            ) : <div />}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsSignatureModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveSignature}
                disabled={sigSaving}
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  borderColor: '#059669',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Check size={16} /> {sigSaving ? 'Saving...' : 'Save Signature'}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* =========================================================================
          MODAL 3: DENIAL REMARK VIEWER
         ========================================================================= */}
      {selectedDenialReq && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedDenialReq(null)}
          title={`Rejection Reason — ${selectedDenialReq.requisitionNumber}`}
          size="md"
        >
          <div style={{ padding: '8px 0' }}>
            <div style={{ padding: '16px', background: '#fee2e2', border: '1px solid #f87171', borderRadius: '10px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#991b1b', fontWeight: 800, marginBottom: '8px' }}>
                <XCircle size={18} /> Requisition Denied by Store Manager
              </div>
              <div style={{ fontSize: '0.92rem', color: '#7f1d1d', fontWeight: 600, lineHeight: 1.5, background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #fca5a5' }}>
                "{selectedDenialReq.denialRemarks}"
              </div>
            </div>

            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <div><strong>Department:</strong> {selectedDenialReq.departmentName}</div>
              <div><strong>Requested By:</strong> {selectedDenialReq.requestedBy}</div>
              <div><strong>Date Raised:</strong> {new Date(selectedDenialReq.requisitionDate).toLocaleString('en-GB')}</div>
            </div>

            <div className="modal-footer" style={{ marginTop: '16px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedDenialReq(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* =========================================================================
          MODAL 4: REQUISITION DETAILS VIEWER
         ========================================================================= */}
      {selectedReqDetail && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedReqDetail(null)}
          title={`Requisition Details — ${selectedReqDetail.requisitionNumber}`}
          size="lg"
        >
          <div style={{ padding: '6px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div>
                <div><strong>Department:</strong> {selectedReqDetail.departmentName}</div>
                <div><strong>Requested By:</strong> {selectedReqDetail.requestedBy} ({selectedReqDetail.shift})</div>
                {selectedReqDetail.supervisorSignature && (
                  <div style={{ marginTop: '4px', color: '#059669', fontSize: '0.75rem', fontWeight: 800 }}>
                    ✍️ Digitally Signed
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div><strong>Status:</strong> {selectedReqDetail.status}</div>
                <div><strong>Est. Valuation:</strong> ₹{selectedReqDetail.totalEstimatedCost?.toFixed(2)}</div>
              </div>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Material Code</th>
                  <th>Material Name</th>
                  <th>Requested Qty</th>
                  <th>Approved Qty</th>
                  <th>Est. Unit Price</th>
                  <th style={{ textAlign: 'right' }}>Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {selectedReqDetail.items?.map((it, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 800 }}>{it.materialCode}</td>
                    <td>{it.materialName}</td>
                    <td>{it.requestedQuantity} {it.defaultUom}</td>
                    <td style={{ fontWeight: 800, color: '#059669' }}>
                      {it.approvedQuantity ?? it.requestedQuantity} {it.defaultUom}
                    </td>
                    <td>₹{it.unitPrice?.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>₹{it.totalCost?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="modal-footer" style={{ marginTop: '16px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedReqDetail(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* =========================================================================
          MODAL 5: PRINTABLE OFFICIAL ISSUE SLIP (KDC-STR-FF-09) WITH SIGNATURE
         ========================================================================= */}
      {printIssue && (
        <PrintableIssueSlip
          issue={printIssue}
          onClose={() => setPrintIssue(null)}
        />
      )}
    </div>
  );
};
export default DepartmentPortalPage;
