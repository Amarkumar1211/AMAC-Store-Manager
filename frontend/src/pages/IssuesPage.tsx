import React, { useEffect, useState } from 'react';
import {
  ArrowUpFromLine,
  Plus,
  Search,
  FileDown,
  Printer,
  Eye,
  Trash2,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  XCircle,
  Edit3,
  Clock,
  Check,
  X,
  FileText,
  ChevronRight,
  ShieldAlert,
  Building,
  User as UserIcon,
  Tag,
  Calendar,
  Sparkles,
  Info
} from 'lucide-react';
import api from '../services/api';
import { MaterialIssue, Department, Material, User, StoreRequisition, StoreRequisitionItem, Supervisor } from '../types';
import { Modal, PrintableIssueSlip } from '../components/ModalAndPrintables';
import { AutoSuggestMaterial } from '../components/AutoSuggestComponents';

export const IssuesPage: React.FC<{ user: User | null; initialCreateOpen?: boolean; onResetQuickAction?: () => void }> = ({
  user,
  initialCreateOpen = false,
  onResetQuickAction
}) => {
  // Navigation & View State
  const [activeView, setActiveView] = useState<'requisitions' | 'issues'>('requisitions');
  const [reqStatusFilter, setReqStatusFilter] = useState<'All' | 'Pending' | 'Allowed' | 'Denied'>('Pending');

  // Data State
  const [requisitions, setRequisitions] = useState<StoreRequisition[]>([]);
  const [issues, setIssues] = useState<MaterialIssue[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Requisition Modals State
  const [isRaiseReqOpen, setIsRaiseReqOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<StoreRequisition | null>(null);
  const [isAnalyseOpen, setIsAnalyseOpen] = useState(false);
  const [isDenyModalOpen, setIsDenyModalOpen] = useState(false);
  const [denialRemarks, setDenialRemarks] = useState('');
  const [isEditingReq, setIsEditingReq] = useState(false);
  const [processingReqId, setProcessingReqId] = useState<number | null>(null);

  // Analysis / Edit Items State
  const [analysisItems, setAnalysisItems] = useState<{
    materialId: number;
    materialCode: string;
    materialName: string;
    defaultUom: string;
    currentStock: number;
    requestedQuantity: number;
    approvedQuantity: number;
    unitPrice: number;
    totalCost: number;
    batchNumber?: string;
    location?: string;
    itemRemarks?: string;
    availableBatches?: any[];
  }[]>([]);

  // Raise Requisition Form State
  const [reqDeptId, setReqDeptId] = useState('');
  const [reqRequestedBy, setReqRequestedBy] = useState(user?.fullName || user?.username || '');
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
  }[]>([
    { materialId: '', requestedQuantity: 1, location: '', itemRemarks: '' }
  ]);

  // Issue Slips Direct Modal State
  const [isCreateIssueOpen, setIsCreateIssueOpen] = useState(initialCreateOpen);
  const [selectedIssue, setSelectedIssue] = useState<MaterialIssue | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [printIssue, setPrintIssue] = useState<MaterialIssue | null>(null);

  // Direct Issue Form State
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [departmentId, setDepartmentId] = useState('');
  const [supervisorName, setSupervisorName] = useState('');
  const [shift, setShift] = useState('Shift A');
  const [purpose, setPurpose] = useState('Production Consumption');
  const [issuedTo, setIssuedTo] = useState('');
  const [remarks, setRemarks] = useState('');
  const [directItems, setDirectItems] = useState<{
    materialId: string;
    batchNumber: string;
    requestedQuantity: number;
    issuedQuantity: number;
    location: string;
    remarks: string;
    availableBatches?: any[];
    batchStockInfo?: string;
  }[]>([
    { materialId: '', batchNumber: '', requestedQuantity: 0, issuedQuantity: 0, location: '', remarks: '' }
  ]);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Supervisors State
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [isCustomReqSupervisor, setIsCustomReqSupervisor] = useState(false);
  const [isCustomDirectSupervisor, setIsCustomDirectSupervisor] = useState(false);

  // Fetch Master Data once on mount
  const fetchMasters = async () => {
    try {
      const [deptRes, matRes, supRes] = await Promise.allSettled([
        api.get('/materials/departments'),
        api.get('/stock/summary'),
        api.get('/supervisors')
      ]);
      if (deptRes.status === 'fulfilled') setDepartments(deptRes.value.data || []);
      if (matRes.status === 'fulfilled') setMaterials(matRes.value.data || []);
      if (supRes.status === 'fulfilled') setSupervisors(supRes.value.data || []);
    } catch (err) {
      console.error('Error fetching master data in IssuesPage', err);
    }
  };

  // Fetch Requisitions & Issues (robust with Promise.allSettled)
  const fetchData = async (showLoading: boolean = true) => {
    if (showLoading) setLoading(true);
    try {
      const [reqRes, issRes] = await Promise.allSettled([
        api.get('/store-requisitions', {
          params: {
            status: reqStatusFilter === 'All' ? undefined : reqStatusFilter,
            search: search || undefined
          }
        }),
        api.get('/issues', { params: { search: search || undefined } })
      ]);

      if (reqRes.status === 'fulfilled') {
        setRequisitions(reqRes.value.data || []);
      }
      if (issRes.status === 'fulfilled') {
        setIssues(issRes.value.data || []);
      }
    } catch (err) {
      console.error('Error fetching requisition and issue data', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Helper to match supervisors belonging to a given department ID
  const getSupervisorsForDept = (deptIdOrName: string | number) => {
    let deptName = '';
    if (typeof deptIdOrName === 'number' || !isNaN(Number(deptIdOrName))) {
      const found = departments.find((d) => d.id === Number(deptIdOrName));
      deptName = found ? found.name : String(deptIdOrName);
    } else {
      deptName = String(deptIdOrName);
    }

    const dClean = deptName.trim().toLowerCase();
    if (!dClean) return [];

    const matched = supervisors.filter((s) => {
      const sDept = (s.department || '').trim().toLowerCase();
      if (!sDept) return false;
      return sDept === dClean || dClean.includes(sDept) || sDept.includes(dClean) || dClean === 'all department';
    });

    return matched;
  };

  // Matching supervisors for the currently selected requisition department
  const matchingReqSupervisors = getSupervisorsForDept(reqDeptId);
  const matchingDirectSupervisors = getSupervisorsForDept(departmentId);

  const handleReqDeptChange = (selectedDeptId: string) => {
    setReqDeptId(selectedDeptId);
    setIsCustomReqSupervisor(false);

    if (!selectedDeptId) {
      setReqRequestedBy('');
      return;
    }

    const matched = getSupervisorsForDept(selectedDeptId);
    if (matched.length === 1) {
      // Automatic selection when exactly 1 supervisor matches!
      setReqRequestedBy(matched[0].name);
      if (matched[0].shift) {
        setReqShift(matched[0].shift.toUpperCase().includes('B') ? 'Shift B' : 'Shift A');
      }
    } else if (matched.length > 1) {
      // Multiple supervisors: default to the first one, allowing user to pick from the department list
      setReqRequestedBy(matched[0].name);
      if (matched[0].shift) {
        setReqShift(matched[0].shift.toUpperCase().includes('B') ? 'Shift B' : 'Shift A');
      }
    } else {
      // Fallback if no specific supervisor mapped: pick first available plant supervisor or keep current
      if (supervisors.length > 0) {
        setReqRequestedBy(supervisors[0].name);
      }
    }
  };

  const handleDirectDeptChange = (selectedDeptId: string) => {
    setDepartmentId(selectedDeptId);
    setIsCustomDirectSupervisor(false);

    if (!selectedDeptId) {
      setSupervisorName('');
      return;
    }

    const matched = getSupervisorsForDept(selectedDeptId);
    if (matched.length === 1) {
      setSupervisorName(matched[0].name);
      if (matched[0].shift) {
        setShift(matched[0].shift.toUpperCase().includes('B') ? 'Shift B' : 'Shift A');
      }
    } else if (matched.length > 1) {
      setSupervisorName(matched[0].name);
      if (matched[0].shift) {
        setShift(matched[0].shift.toUpperCase().includes('B') ? 'Shift B' : 'Shift A');
      }
    } else if (supervisors.length > 0) {
      setSupervisorName(supervisors[0].name);
    }
  };

  useEffect(() => {
    fetchMasters();
  }, []);

  useEffect(() => {
    fetchData(true);
  }, [search, reqStatusFilter]);

  // Live Real-Time Requisition Sync Listener (Instant Department Indent reflection)
  useEffect(() => {
    const handleSync = () => {
      fetchData(false);
    };

    window.addEventListener('amac-requisition-sync', handleSync);
    return () => {
      window.removeEventListener('amac-requisition-sync', handleSync);
    };
  }, []);

  useEffect(() => {
    if (initialCreateOpen) {
      setIsCreateIssueOpen(true);
    }
  }, [initialCreateOpen]);

  // Pending Requisitions count
  const pendingCount = requisitions.filter((r) => r.status === 'Pending').length;

  // ---------------------------------------------------------------------------
  // Requisition Handlers
  // ---------------------------------------------------------------------------
  const handleAddReqItem = () => {
    setReqItems([...reqItems, { materialId: '', requestedQuantity: 1, location: '', itemRemarks: '' }]);
  };

  const handleRemoveReqItem = (index: number) => {
    setReqItems(reqItems.filter((_, i) => i !== index));
  };

  const handleReqItemChange = (index: number, field: string, value: any) => {
    const newItems = [...reqItems];
    (newItems[index] as any)[field] = value;
    setReqItems(newItems);
  };

  const handleRaiseRequisition = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    for (const item of reqItems) {
      if (!item.materialId || item.requestedQuantity <= 0) {
        setErrorMsg('Please select a material and enter a valid quantity for all rows.');
        return;
      }
    }

    try {
      const payload = {
        departmentId: reqDeptId ? parseInt(reqDeptId) : null,
        requestedBy: reqRequestedBy || user?.fullName || user?.username,
        requiredDate: reqRequiredDate ? new Date(reqRequiredDate).toISOString() : null,
        shift: reqShift || 'General',
        purpose: reqPurpose || 'Production Consumption',
        jobOrderOrMachine: reqJobOrder || undefined,
        remarks: reqRemarks || undefined,
        items: reqItems.map((i) => ({
          materialId: parseInt(i.materialId),
          requestedQuantity: Number(i.requestedQuantity),
          location: i.location || undefined,
          itemRemarks: i.itemRemarks || undefined
        }))
      };

      const res = await api.post('/store-requisitions', payload);
      setIsRaiseReqOpen(false);
      setSuccessMsg(`✅ Requisition ${res.data.requisitionNumber} raised successfully! Store Manager notified.`);
      setTimeout(() => setSuccessMsg(''), 6000);

      // Reset form
      setReqItems([{ materialId: '', requestedQuantity: 1, location: '', itemRemarks: '' }]);
      setReqRemarks('');
      setReqJobOrder('');
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to submit material requisition.');
    }
  };

  const handleOpenAnalyse = async (req: StoreRequisition) => {
    try {
      const res = await api.get(`/store-requisitions/${req.id}`);
      const fullReq: StoreRequisition = res.data;
      setSelectedReq(fullReq);
      setIsEditingReq(false);

      // Build analysis items
      const itemsWithBatches = await Promise.all(
        fullReq.items.map(async (i) => {
          let batches = [];
          try {
            const bRes = await api.get(`/batches/by-material/${i.materialId}`, { params: { activeOnly: true } });
            batches = bRes.data;
          } catch {}

          return {
            materialId: i.materialId,
            materialCode: i.materialCode,
            materialName: i.materialName,
            defaultUom: i.defaultUom,
            currentStock: i.currentStock,
            requestedQuantity: i.requestedQuantity,
            approvedQuantity: i.approvedQuantity > 0 ? i.approvedQuantity : i.requestedQuantity,
            unitPrice: i.unitPrice,
            totalCost: i.totalCost,
            batchNumber: i.batchNumber,
            location: i.location,
            itemRemarks: i.itemRemarks,
            availableBatches: batches
          };
        })
      );

      setAnalysisItems(itemsWithBatches);
      setIsAnalyseOpen(true);
    } catch (err) {
      console.error('Error opening analysis drawer', err);
    }
  };

  const handleUpdateApprovedQty = (index: number, qty: number) => {
    const updated = [...analysisItems];
    updated[index].approvedQuantity = qty;
    updated[index].totalCost = qty * updated[index].unitPrice;
    setAnalysisItems(updated);
  };

  const handleUpdateBatch = (index: number, batchNo: string) => {
    const updated = [...analysisItems];
    updated[index].batchNumber = batchNo;
    setAnalysisItems(updated);
  };

  const handleSaveRequisitionEdits = async () => {
    if (!selectedReq) return;
    setErrorMsg('');
    try {
      const payload = {
        departmentId: selectedReq.departmentId,
        requiredDate: selectedReq.requiredDate,
        requestedBy: selectedReq.requestedBy,
        shift: selectedReq.shift,
        purpose: selectedReq.purpose,
        jobOrderOrMachine: selectedReq.jobOrderOrMachine,
        remarks: selectedReq.remarks,
        items: analysisItems.map((i) => ({
          materialId: i.materialId,
          batchNumber: i.batchNumber || undefined,
          requestedQuantity: i.requestedQuantity,
          approvedQuantity: i.approvedQuantity,
          location: i.location || undefined,
          itemRemarks: i.itemRemarks || undefined
        }))
      };

      const res = await api.put(`/store-requisitions/${selectedReq.id}`, payload);
      setSelectedReq(res.data);
      setIsEditingReq(false);
      setSuccessMsg(`✅ Requisition ${res.data.requisitionNumber} quantities updated.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to update requisition.');
    }
  };

  const handleAllowRequisition = async () => {
    if (!selectedReq) return;
    setErrorMsg('');
    setProcessingReqId(selectedReq.id);

    try {
      const payload = {
        supervisorName: selectedReq.requestedBy,
        issuedTo: selectedReq.requestedBy,
        shift: selectedReq.shift,
        remarks: selectedReq.remarks,
        customApprovedItems: analysisItems.map((i) => ({
          materialId: i.materialId,
          batchNumber: i.batchNumber || undefined,
          approvedQuantity: i.approvedQuantity,
          location: i.location || undefined,
          remarks: i.itemRemarks || undefined
        }))
      };

      const res = await api.post(`/store-requisitions/${selectedReq.id}/allow`, payload);
      setIsAnalyseOpen(false);
      setSuccessMsg(res.data.message || `✅ Requisition ${selectedReq.requisitionNumber} ALLOWED! Issue Slip ${res.data.issueSlipNumber} generated.`);
      setTimeout(() => setSuccessMsg(''), 8000);

      // Open print slip immediately
      if (res.data.issueSlipNumber) {
        try {
          const issRes = await api.get('/issues', { params: { search: res.data.issueSlipNumber } });
          if (issRes.data && issRes.data.length > 0) {
            const fullIss = await api.get(`/issues/${issRes.data[0].id}`);
            setPrintIssue(fullIss.data);
          }
        } catch {}
      }

      fetchData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to allow requisition.');
    } finally {
      setProcessingReqId(null);
    }
  };

  const handleOpenDenyModal = (req: StoreRequisition) => {
    setSelectedReq(req);
    setDenialRemarks('');
    setErrorMsg('');
    setIsDenyModalOpen(true);
  };

  const handleConfirmDenial = async () => {
    if (!selectedReq) return;
    if (!denialRemarks.trim()) {
      setErrorMsg('Please provide a mandatory denial reason / remark explaining why the request cannot be approved.');
      return;
    }

    try {
      const res = await api.post(`/store-requisitions/${selectedReq.id}/deny`, {
        denialRemarks: denialRemarks.trim()
      });
      setIsDenyModalOpen(false);
      setIsAnalyseOpen(false);
      setSuccessMsg(res.data.message || `❌ Requisition ${selectedReq.requisitionNumber} Denied.`);
      setTimeout(() => setSuccessMsg(''), 6000);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to deny requisition.');
    }
  };

  // ---------------------------------------------------------------------------
  // Direct Issue Slip Handlers
  // ---------------------------------------------------------------------------
  const handleAddDirectItem = () => {
    setDirectItems([...directItems, { materialId: '', batchNumber: '', requestedQuantity: 0, issuedQuantity: 0, location: '', remarks: '' }]);
  };

  const handleRemoveDirectItem = (index: number) => {
    setDirectItems(directItems.filter((_, i) => i !== index));
  };

  const handleDirectItemChange = async (index: number, field: string, value: any) => {
    const newItems = [...directItems];
    (newItems[index] as any)[field] = value;

    if (field === 'requestedQuantity' && (!newItems[index].issuedQuantity || newItems[index].issuedQuantity === 0)) {
      newItems[index].issuedQuantity = value;
    }

    if (field === 'materialId') {
      newItems[index].batchNumber = '';
      newItems[index].batchStockInfo = undefined;
      newItems[index].availableBatches = [];

      const matId = parseInt(value);
      if (matId > 0) {
        try {
          const batchRes = await api.get(`/batches/by-material/${matId}`, { params: { activeOnly: true } });
          newItems[index].availableBatches = batchRes.data;
        } catch {}
      }
    }

    if (field === 'batchNumber') {
      const selectedBatch = newItems[index].availableBatches?.find((b: any) => b.batchNumber.toLowerCase() === String(value || '').toLowerCase());
      if (selectedBatch) {
        const mat = materials.find((m) => m.id === parseInt(newItems[index].materialId));
        newItems[index].batchStockInfo = `🏷️ Batch ${selectedBatch.batchNumber} Stock: ${selectedBatch.currentStock} ${mat?.defaultUom || 'KG'} @ ₹${selectedBatch.unitPrice}/kg`;
      } else {
        newItems[index].batchStockInfo = undefined;
      }
    }

    setDirectItems(newItems);
  };

  const handleCreateDirectIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    for (const item of directItems) {
      if (!item.materialId || item.issuedQuantity <= 0) {
        setErrorMsg('Please select a material and enter a valid issued quantity for all rows.');
        return;
      }

      const mat = materials.find((m) => m.id === parseInt(item.materialId));
      if (mat && mat.currentStock < item.issuedQuantity) {
        setErrorMsg(`Insufficient stock for '${mat.materialCode} - ${mat.materialName}'. Available: ${mat.currentStock} ${mat.defaultUom}, Requested: ${item.issuedQuantity} ${mat.defaultUom}. Negative stock is prevented.`);
        return;
      }
    }

    try {
      const payload = {
        issueDate: new Date(issueDate).toISOString(),
        departmentId: departmentId ? parseInt(departmentId) : null,
        supervisorName: supervisorName || undefined,
        shift: shift || 'General',
        purpose: purpose || 'Production Consumption',
        issuedTo: issuedTo || undefined,
        remarks: remarks || undefined,
        items: directItems.map((i) => ({
          materialId: parseInt(i.materialId),
          batchNumber: i.batchNumber ? i.batchNumber.trim() : undefined,
          requestedQuantity: Number(i.requestedQuantity),
          issuedQuantity: Number(i.issuedQuantity),
          location: i.location || undefined,
          remarks: i.remarks || undefined
        }))
      };

      const res = await api.post('/issues', payload);
      setIsCreateIssueOpen(false);
      if (onResetQuickAction) onResetQuickAction();

      const newIssueRes = await api.get(`/issues/${res.data.id}`);
      setPrintIssue(newIssueRes.data);

      setDirectItems([{ materialId: '', batchNumber: '', requestedQuantity: 0, issuedQuantity: 0, location: '', remarks: '' }]);
      setSupervisorName('');
      setIssuedTo('');
      setRemarks('');
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to create issue slip.');
    }
  };

  const handleViewIssueDetails = async (id: number) => {
    try {
      const res = await api.get(`/issues/${id}`);
      setSelectedIssue(res.data);
      setIsDetailOpen(true);
    } catch (err) {
      console.error('Error fetching issue details', err);
    }
  };

  const handleDownloadExcel = async () => {
    try {
      const res = await api.get('/reports/consumption/excel', { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `AMAC_Material_Consumption_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Download error', err);
      alert('Failed to download consumption report.');
    }
  };

  return (
    <div className="page-wrapper">
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 8px', borderRadius: '4px', background: 'rgba(5, 150, 105, 0.12)', color: '#059669' }}>
              • Store Requisition & Consumption Hub
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Form KDC-STR-FF-09 Rev 01</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Material Store Requisitions & Issues
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
            Department indent requests, Store Manager stock analysis, 1-click allow & denial reviews, and issued slips.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={handleDownloadExcel} className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <FileDown size={15} /> Export Consumption Excel
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setIsCreateIssueOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={15} /> Direct Issue Slip
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setIsRaiseReqOpen(true)}
            style={{
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              borderColor: '#059669',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 3px 8px rgba(5,150,105,0.3)'
            }}
          >
            <Sparkles size={15} /> + Raise Material Requisition
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {successMsg && (
        <div style={{ padding: '12px 18px', background: 'rgba(5, 150, 105, 0.12)', border: '1px solid #059669', color: '#047857', borderRadius: '10px', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem', fontWeight: 600 }}>
          <CheckCircle size={18} color="#059669" />
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div style={{ padding: '12px 18px', background: 'rgba(220, 38, 38, 0.1)', border: '1px solid #dc2626', color: '#b91c1c', borderRadius: '10px', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem', fontWeight: 600 }}>
          <AlertCircle size={18} color="#dc2626" />
          {errorMsg}
        </div>
      )}

      {/* Primary Tab Switcher */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <button
          className={`btn btn-sm ${activeView === 'requisitions' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveView('requisitions')}
          style={{
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: activeView === 'requisitions' ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : 'var(--bg-secondary)',
            borderColor: activeView === 'requisitions' ? '#059669' : 'var(--border-color)',
            boxShadow: activeView === 'requisitions' ? '0 2px 6px rgba(5,150,105,0.3)' : 'none'
          }}
        >
          <Building size={15} />
          Department Requisitions (Store Indents)
          {pendingCount > 0 && (
            <span style={{
              background: activeView === 'requisitions' ? '#ffffff' : '#ea580c',
              color: activeView === 'requisitions' ? '#047857' : '#ffffff',
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '1px 7px',
              borderRadius: '10px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
            }}>
              {pendingCount} Pending Review
            </span>
          )}
        </button>

        <button
          className={`btn btn-sm ${activeView === 'issues' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveView('issues')}
          style={{
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: activeView === 'issues' ? '#2563eb' : 'var(--bg-secondary)',
            borderColor: activeView === 'issues' ? '#2563eb' : 'var(--border-color)'
          }}
        >
          <ArrowUpFromLine size={15} />
          Dispatched Issue Slips ({issues.length})
        </button>
      </div>

      {/* =========================================================================
          VIEW 1: DEPARTMENT REQUISITIONS (STORE INDENTS)
         ========================================================================= */}
      {activeView === 'requisitions' && (
        <div>
          {/* Status Sub-Filters and Search Bar */}
          <div className="card" style={{ padding: '14px 18px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginRight: '4px' }}>FILTER:</span>
              {(['Pending', 'All', 'Allowed', 'Denied'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setReqStatusFilter(st)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '6px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    border: '1px solid',
                    cursor: 'pointer',
                    background: reqStatusFilter === st
                      ? st === 'Pending' ? '#fff7ed' : st === 'Allowed' ? '#ecfdf5' : st === 'Denied' ? '#fef2f2' : 'var(--bg-secondary)'
                      : 'transparent',
                    borderColor: reqStatusFilter === st
                      ? st === 'Pending' ? '#f97316' : st === 'Allowed' ? '#059669' : st === 'Denied' ? '#dc2626' : 'var(--border-color)'
                      : 'var(--border-color)',
                    color: reqStatusFilter === st
                      ? st === 'Pending' ? '#ea580c' : st === 'Allowed' ? '#047857' : st === 'Denied' ? '#b91c1c' : 'var(--text-primary)'
                      : 'var(--text-muted)'
                  }}
                >
                  {st === 'Pending' && '⏳ Pending Review'}
                  {st === 'All' && '📑 All Requests'}
                  {st === 'Allowed' && '✅ Allowed & Issued'}
                  {st === 'Denied' && '❌ Denied'}
                </button>
              ))}
            </div>

            <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-control form-control-sm"
                style={{ paddingLeft: '34px', fontSize: '0.8rem' }}
                placeholder="Search Requisition No, Requester, Department, Material..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Requisitions Data Table */}
          <div className="card" style={{ padding: 0 }}>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Requisition #</th>
                    <th>Date & Shift</th>
                    <th>Department & Requester</th>
                    <th>Purpose / Job Machine</th>
                    <th>Requested Line Items</th>
                    <th style={{ textAlign: 'right' }}>Est. Value (₹)</th>
                    <th style={{ textAlign: 'center' }}>Review Status</th>
                    <th style={{ textAlign: 'right' }}>Store Manager Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '36px' }}>Loading department requisitions...</td>
                    </tr>
                  ) : requisitions.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                        No material requisitions matching filter '{reqStatusFilter}'. Click <strong>+ Raise Material Requisition</strong> to create one.
                      </td>
                    </tr>
                  ) : (
                    requisitions.map((req) => (
                      <tr key={req.id} style={{ background: req.status === 'Pending' ? 'rgba(249, 115, 22, 0.02)' : undefined }}>
                        <td style={{ fontWeight: 800, color: 'var(--accent-primary)' }}>
                          {req.requisitionNumber}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                            {new Date(req.requisitionDate).toLocaleDateString()}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {req.shift} Shift
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: '#1e293b' }}>
                            {req.departmentName || 'General Store'}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <UserIcon size={12} /> {req.requestedBy || 'Staff'}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{req.purpose}</div>
                          {req.jobOrderOrMachine && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              Ref: {req.jobOrderOrMachine}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                            {req.items.length} Line Item{req.items.length > 1 ? 's' : ''}:
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {req.items.map((i) => `${i.materialName} (${i.requestedQuantity} ${i.defaultUom})`).join(', ')}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#059669' }}>
                          ₹{req.totalEstimatedCost.toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {req.status === 'Pending' && (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '3px 10px',
                              borderRadius: '12px',
                              background: '#fff7ed',
                              color: '#ea580c',
                              border: '1px solid #fed7aa',
                              fontSize: '0.74rem',
                              fontWeight: 800
                            }}>
                              <Clock size={12} className="animate-spin" /> Pending Review
                            </span>
                          )}
                          {req.status === 'Allowed' && (
                            <div>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 9px',
                                borderRadius: '12px',
                                background: '#ecfdf5',
                                color: '#047857',
                                border: '1px solid #a7f3d0',
                                fontSize: '0.74rem',
                                fontWeight: 800
                              }}>
                                <Check size={12} /> Allowed & Issued
                              </span>
                              {req.resultingIssueSlipNumber && (
                                <div style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 700, marginTop: '2px' }}>
                                  Slip: {req.resultingIssueSlipNumber}
                                </div>
                              )}
                            </div>
                          )}
                          {req.status === 'Denied' && (
                            <div>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 9px',
                                borderRadius: '12px',
                                background: '#fef2f2',
                                color: '#b91c1c',
                                border: '1px solid #fecaca',
                                fontSize: '0.74rem',
                                fontWeight: 800
                              }}>
                                <X size={12} /> Denied
                              </span>
                              {req.denialRemarks && (
                                <div style={{ fontSize: '0.7rem', color: '#b91c1c', maxWidth: '140px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }} title={req.denialRemarks}>
                                  "{req.denialRemarks}"
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => handleOpenAnalyse(req)}
                              title="Analyse stock, edit approved quantities & review"
                            >
                              <Eye size={13} /> Analyse
                            </button>

                            {req.status === 'Pending' && (
                              <>
                                <button
                                  className="btn btn-sm"
                                  style={{ background: '#059669', color: '#ffffff', borderColor: '#059669', padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  onClick={() => handleOpenAnalyse(req)}
                                  title="Allow and issue material"
                                >
                                  <Check size={13} /> Allow
                                </button>
                                <button
                                  className="btn btn-sm"
                                  style={{ background: '#dc2626', color: '#ffffff', borderColor: '#dc2626', padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  onClick={() => handleOpenDenyModal(req)}
                                  title="Deny requisition with remark"
                                >
                                  <X size={13} /> Deny
                                </button>
                              </>
                            )}

                            {req.status === 'Allowed' && req.resultingIssueSlipNumber && (
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '4px 8px' }}
                                onClick={async () => {
                                  try {
                                    const issRes = await api.get('/issues', { params: { search: req.resultingIssueSlipNumber } });
                                    if (issRes.data && issRes.data.length > 0) {
                                      const fullIss = await api.get(`/issues/${issRes.data[0].id}`);
                                      setPrintIssue(fullIss.data);
                                    }
                                  } catch {}
                                }}
                                title="Print generated Issue Slip"
                              >
                                <Printer size={13} />
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
          VIEW 2: DISPATCHED MATERIAL ISSUE SLIPS
         ========================================================================= */}
      {activeView === 'issues' && (
        <div>
          {/* Filter Controls */}
          <div className="card" style={{ padding: '14px 18px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ position: 'relative', width: '360px', maxWidth: '100%' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-control form-control-sm"
                style={{ paddingLeft: '34px', fontSize: '0.8rem' }}
                placeholder="Search Slip No, Supervisor, Shift, Purpose..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Issues Table */}
          <div className="card" style={{ padding: 0 }}>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Slip No</th>
                    <th>Issue Date</th>
                    <th>Department</th>
                    <th>Supervisor / Issued To</th>
                    <th>Shift</th>
                    <th>Items Count</th>
                    <th style={{ textAlign: 'right' }}>Total Value (₹)</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '30px' }}>Loading issue slips...</td>
                    </tr>
                  ) : issues.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                        No issue slips found.
                      </td>
                    </tr>
                  ) : (
                    issues.map((iss) => (
                      <tr key={iss.id}>
                        <td style={{ fontWeight: 800, color: 'var(--accent-primary)' }}>{iss.issueSlipNumber}</td>
                        <td>{new Date(iss.issueDate).toLocaleDateString()}</td>
                        <td><span className="badge badge-info">{iss.departmentName || 'PRODUCTION'}</span></td>
                        <td>{iss.supervisorName || iss.issuedTo || '-'}</td>
                        <td><span className="badge badge-secondary">{iss.shift || 'General'}</span></td>
                        <td>{iss.itemCount} Items</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#059669' }}>₹{iss.totalIssueCost.toLocaleString()}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '4px 8px' }}
                              onClick={() => handleViewIssueDetails(iss.id)}
                              title="View Details"
                            >
                              <Eye size={13} />
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '4px 8px' }}
                              onClick={async () => {
                                const res = await api.get(`/issues/${iss.id}`);
                                setPrintIssue(res.data);
                              }}
                              title="Print Formal Requisition Slip"
                            >
                              <Printer size={13} />
                            </button>
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
          MODAL 1: RAISE MATERIAL REQUISITION (STORE INDENT)
         ========================================================================= */}
      <Modal
        isOpen={isRaiseReqOpen}
        onClose={() => setIsRaiseReqOpen(false)}
        title="Raise Department Store Requisition (Material Indent)"
        size="lg"
      >
        <form onSubmit={handleRaiseRequisition}>
          {errorMsg && (
            <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
              <AlertCircle size={16} />
              {errorMsg}
            </div>
          )}

          <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: '8px', marginBottom: '16px' }}>
            <div className="form-grid-3">
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Requesting Department *</label>
                <select
                  className="form-control"
                  required
                  value={reqDeptId}
                  onChange={(e) => handleReqDeptChange(e.target.value)}
                >
                  <option value="">-- Select Department --</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Authorised Supervisor Selector */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label className="form-label" style={{ fontWeight: 700, margin: 0 }}>
                    Authorised Supervisor (Indentor) *
                  </label>
                  {matchingReqSupervisors.length > 1 && !isCustomReqSupervisor && (
                    <span style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: 800 }}>
                      ({matchingReqSupervisors.length} Dept Supervisors)
                    </span>
                  )}
                  {isCustomReqSupervisor && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomReqSupervisor(false);
                        if (matchingReqSupervisors.length > 0) setReqRequestedBy(matchingReqSupervisors[0].name);
                      }}
                      style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                    >
                      ↩️ Pick from Dept List
                    </button>
                  )}
                </div>

                {!isCustomReqSupervisor ? (
                  <select
                    className="form-control"
                    required
                    value={reqRequestedBy}
                    onChange={(e) => {
                      if (e.target.value === '__CUSTOM__') {
                        setIsCustomReqSupervisor(true);
                        setReqRequestedBy('');
                      } else {
                        setIsCustomReqSupervisor(false);
                        setReqRequestedBy(e.target.value);
                        const sObj = supervisors.find((s) => s.name === e.target.value);
                        if (sObj?.shift) {
                          setReqShift(sObj.shift.toUpperCase().includes('B') ? 'Shift B' : 'Shift A');
                        }
                      }
                    }}
                    style={{ fontWeight: 600, borderColor: reqRequestedBy ? '#059669' : undefined }}
                  >
                    {!reqRequestedBy && <option value="">-- Select Supervisor --</option>}
                    {matchingReqSupervisors.length > 0 ? (
                      matchingReqSupervisors.map((s) => (
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
                    <option value="__CUSTOM__">✏️ + Enter Custom / Other Supervisor Name...</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder="Enter supervisor / shift in-charge name"
                    value={reqRequestedBy}
                    onChange={(e) => setReqRequestedBy(e.target.value)}
                    autoFocus
                  />
                )}
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Required Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={reqRequiredDate}
                  onChange={(e) => setReqRequiredDate(e.target.value)}
                />
              </div>
            </div>

            <div className="form-grid-3" style={{ marginTop: '10px' }}>
              <div className="form-group">
                <label className="form-label">Shift</label>
                <select className="form-control" value={reqShift} onChange={(e) => setReqShift(e.target.value)}>
                  <option value="Shift A">Shift A (06:00 - 14:30)</option>
                  <option value="Shift B">Shift B (14:30 - 23:00)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Consumption Purpose / Process</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Melt Batch 04 / Foundry Core"
                  value={reqPurpose}
                  onChange={(e) => setReqPurpose(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Job Order # / Machine Ref</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Die-04, Job #1084"
                  value={reqJobOrder}
                  onChange={(e) => setReqJobOrder(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 10px' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>Requested Materials & Quantities</h4>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Store Manager will analyse available inventory & allow/deny</span>
          </div>

          <div className="table-container" style={{ marginBottom: '16px', overflow: 'visible' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '42%' }}>Material *</th>
                  <th style={{ width: '18%' }}>Live Store Stock</th>
                  <th style={{ width: '18%' }}>Requested Qty *</th>
                  <th style={{ width: '18%' }}>Remarks / Job Details</th>
                  <th style={{ width: '4%' }}></th>
                </tr>
              </thead>
              <tbody>
                {reqItems.map((item, idx) => {
                  const selectedMat = materials.find((m) => m.id === parseInt(item.materialId));

                  return (
                    <tr key={idx}>
                      <td>
                        <AutoSuggestMaterial
                          materials={materials}
                          selectedMaterialId={item.materialId}
                          onSelectMaterial={(mat) => {
                            handleReqItemChange(idx, 'materialId', mat ? mat.id.toString() : '');
                          }}
                          placeholder="Search material code or description..."
                        />
                      </td>
                      <td style={{ fontWeight: 700, color: selectedMat?.currentStock && selectedMat.currentStock > 0 ? '#059669' : '#dc2626' }}>
                        {selectedMat ? `${selectedMat.currentStock} ${selectedMat.defaultUom}` : '-'}
                      </td>
                      <td>
                        <input
                          type="number"
                          step="any"
                          required
                          min="0.01"
                          className="form-control"
                          placeholder="Qty"
                          value={item.requestedQuantity || ''}
                          onChange={(e) => handleReqItemChange(idx, 'requestedQuantity', parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. Urgent for Melt"
                          value={item.itemRemarks}
                          onChange={(e) => handleReqItemChange(idx, 'itemRemarks', e.target.value)}
                        />
                      </td>
                      <td>
                        {reqItems.length > 1 && (
                          <button
                            type="button"
                            className="btn-icon btn-danger"
                            onClick={() => handleRemoveReqItem(idx)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddReqItem} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={14} /> Add Another Material Line
          </button>

          <div className="form-group" style={{ marginTop: '16px' }}>
            <label className="form-label">General Requisition Notes (Optional)</label>
            <textarea
              className="form-control"
              rows={2}
              placeholder="Any additional notes for the Store Manager..."
              value={reqRemarks}
              onChange={(e) => setReqRemarks(e.target.value)}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setIsRaiseReqOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ background: '#059669', borderColor: '#059669', fontWeight: 700 }}>
              <CheckCircle size={16} /> Submit Requisition to Store
            </button>
          </div>
        </form>
      </Modal>

      {/* =========================================================================
          MODAL 2: STORE MANAGER ANALYSE, EDIT & ALLOW/DENY MODAL
         ========================================================================= */}
      {selectedReq && (
        <Modal
          isOpen={isAnalyseOpen}
          onClose={() => setIsAnalyseOpen(false)}
          title={`Requisition Analysis: ${selectedReq.requisitionNumber}`}
          size="lg"
        >
          <div>
            {/* Requester Header Brief */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', padding: '14px', background: 'var(--bg-primary)', borderRadius: '8px', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Department</span>
                <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{selectedReq.departmentName || 'General Store'}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Requested By</span>
                <div style={{ fontWeight: 700 }}>{selectedReq.requestedBy || 'Staff'}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Date & Shift</span>
                <div style={{ fontWeight: 700 }}>{new Date(selectedReq.requisitionDate).toLocaleDateString()} ({selectedReq.shift})</div>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Purpose</span>
                <div style={{ fontWeight: 700 }}>{selectedReq.purpose}</div>
              </div>
            </div>

            {/* Status Callouts */}
            {selectedReq.status === 'Allowed' && (
              <div style={{ padding: '12px 16px', background: '#ecfdf5', border: '1px solid #059669', color: '#047857', borderRadius: '8px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>✅ Requisition Allowed & Issued</strong>
                  <div style={{ fontSize: '0.78rem', marginTop: '2px' }}>
                    Processed by <strong>{selectedReq.processedByUsername || 'Store Manager'}</strong>. Generated Issue Slip: <strong>{selectedReq.resultingIssueSlipNumber}</strong>.
                  </div>
                </div>
                {selectedReq.resultingIssueSlipNumber && (
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ background: '#059669', borderColor: '#059669' }}
                    onClick={async () => {
                      try {
                        const issRes = await api.get('/issues', { params: { search: selectedReq.resultingIssueSlipNumber } });
                        if (issRes.data && issRes.data.length > 0) {
                          const fullIss = await api.get(`/issues/${issRes.data[0].id}`);
                          setPrintIssue(fullIss.data);
                        }
                      } catch {}
                    }}
                  >
                    <Printer size={14} /> Print Issue Slip
                  </button>
                )}
              </div>
            )}

            {selectedReq.status === 'Denied' && (
              <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #dc2626', color: '#b91c1c', borderRadius: '8px', marginBottom: '16px' }}>
                <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <XCircle size={16} /> Requisition Denied by {selectedReq.processedByUsername || 'Store Manager'}
                </div>
                <div style={{ fontSize: '0.84rem', marginTop: '6px', background: '#ffffff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #fecaca' }}>
                  <strong>Denial Remark / Reason:</strong> "{selectedReq.denialRemarks}"
                </div>
              </div>
            )}

            {/* Inventory Health & Stock Analysis Table */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800 }}>
                Store Inventory Analysis & Allocation Matrix
              </h4>
              {selectedReq.status === 'Pending' && (
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  💡 Store Manager can edit <strong>Approved Qty</strong> before allowing.
                </span>
              )}
            </div>

            <div className="table-container" style={{ marginBottom: '16px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th style={{ textAlign: 'right' }}>Live Stock</th>
                    <th style={{ textAlign: 'right' }}>Requested</th>
                    <th style={{ textAlign: 'right', width: '130px' }}>Approved Qty</th>
                    <th>Batch (if any)</th>
                    <th style={{ textAlign: 'right' }}>Rate (₹)</th>
                    <th style={{ textAlign: 'right' }}>Line Total (₹)</th>
                    <th>Stock Health</th>
                  </tr>
                </thead>
                <tbody>
                  {analysisItems.map((item, idx) => {
                    const isSufficient = item.currentStock >= item.approvedQuantity;

                    return (
                      <tr key={idx} style={{ background: !isSufficient ? 'rgba(220, 38, 38, 0.04)' : undefined }}>
                        <td>
                          <div style={{ fontWeight: 800, color: '#0284c7' }}>{item.materialCode}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>{item.materialName}</div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: item.currentStock > 0 ? '#059669' : '#dc2626' }}>
                          {item.currentStock.toLocaleString()} {item.defaultUom}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {item.requestedQuantity} {item.defaultUom}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {selectedReq.status === 'Pending' ? (
                            <input
                              type="number"
                              step="any"
                              min="0"
                              max={item.currentStock}
                              className="form-control form-control-sm"
                              style={{ textAlign: 'right', fontWeight: 800, borderColor: !isSufficient ? '#dc2626' : undefined }}
                              value={item.approvedQuantity}
                              onChange={(e) => handleUpdateApprovedQty(idx, parseFloat(e.target.value) || 0)}
                            />
                          ) : (
                            <span style={{ fontWeight: 800, color: '#059669' }}>
                              {item.approvedQuantity} {item.defaultUom}
                            </span>
                          )}
                        </td>
                        <td>
                          {selectedReq.status === 'Pending' && item.availableBatches && item.availableBatches.length > 0 ? (
                            <select
                              className="form-control form-control-sm"
                              value={item.batchNumber || ''}
                              onChange={(e) => handleUpdateBatch(idx, e.target.value)}
                            >
                              <option value="">General Stock</option>
                              {item.availableBatches.map((b: any) => (
                                <option key={b.id} value={b.batchNumber}>
                                  Batch {b.batchNumber} ({b.currentStock} {item.defaultUom})
                                </option>
                              ))}
                            </select>
                          ) : item.batchNumber ? (
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0284c7' }}>
                              🏷️ {item.batchNumber}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>General</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontSize: '0.8rem' }}>
                          ₹{item.unitPrice.toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800 }}>
                          ₹{item.totalCost.toLocaleString()}
                        </td>
                        <td>
                          {isSufficient ? (
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#059669', background: '#ecfdf5', padding: '2px 8px', borderRadius: '4px' }}>
                              ● Stock OK
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#dc2626', background: '#fef2f2', padding: '2px 8px', borderRadius: '4px' }}>
                              ⚠️ Deficit
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Total Valuation Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Requisition Items</span>
                <div style={{ fontWeight: 800 }}>{analysisItems.length} Materials</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Approved Valuation</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#059669' }}>
                  ₹{analysisItems.reduce((acc, i) => acc + i.totalCost, 0).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsAnalyseOpen(false)}>
                Close
              </button>

              {selectedReq.status === 'Pending' && (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleSaveRequisitionEdits}
                    title="Save adjusted approved quantities"
                  >
                    <Edit3 size={15} /> Save Quantities
                  </button>

                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => handleOpenDenyModal(selectedReq)}
                    style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <XCircle size={15} /> Deny Requisition
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleAllowRequisition}
                    disabled={processingReqId === selectedReq.id}
                    style={{
                      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                      borderColor: '#059669',
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 3px 8px rgba(5,150,105,0.3)'
                    }}
                  >
                    <CheckCircle size={15} /> Allow & Issue Material
                  </button>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* =========================================================================
          MODAL 3: DENY REQUISITION (WITH MANDATORY REMARK)
         ========================================================================= */}
      {selectedReq && (
        <Modal
          isOpen={isDenyModalOpen}
          onClose={() => setIsDenyModalOpen(false)}
          title={`Deny Material Requisition: ${selectedReq.requisitionNumber}`}
          size="md"
        >
          <div>
            <div style={{ padding: '12px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ fontWeight: 800, color: '#991b1b', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={16} /> Rejection / Denial Notice
              </div>
              <div style={{ fontSize: '0.82rem', color: '#7f1d1d' }}>
                You are about to deny requisition <strong>{selectedReq.requisitionNumber}</strong> raised by <strong>{selectedReq.requestedBy}</strong> ({selectedReq.departmentName}).
                Please provide a clear reason explaining why this material cannot be issued.
              </div>
            </div>

            {/* Quick-Preset Denial Reason Chips */}
            <div style={{ marginBottom: '12px' }}>
              <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700 }}>Quick Reason Presets (Click to insert):</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {[
                  'Insufficient stock in store (PO already in process)',
                  'Exceeds monthly department quota allocation',
                  'Incorrect material specification or grade requested',
                  'Duplicate requisition already fulfilled',
                  'Alternative material available in Store (Contact Incharge)'
                ].map((preset, pIdx) => (
                  <button
                    key={pIdx}
                    type="button"
                    onClick={() => setDenialRemarks(preset)}
                    style={{
                      padding: '3px 9px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 800, color: '#dc2626' }}>
                Denial Remark / Reason for Rejection * (Mandatory)
              </label>
              <textarea
                className="form-control"
                rows={3}
                required
                placeholder="Enter detailed reason for denying this material request..."
                value={denialRemarks}
                onChange={(e) => setDenialRemarks(e.target.value)}
              />
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setIsDenyModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{ fontWeight: 800 }}
                onClick={handleConfirmDenial}
                disabled={!denialRemarks.trim()}
              >
                <XCircle size={15} /> Confirm Requisition Denial
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* =========================================================================
          MODAL 4: DIRECT ISSUE SLIP MODAL
         ========================================================================= */}
      <Modal
        isOpen={isCreateIssueOpen}
        onClose={() => {
          setIsCreateIssueOpen(false);
          if (onResetQuickAction) onResetQuickAction();
        }}
        title="Create Direct Material Issue Slip (KDC-STR-FF-09)"
        size="lg"
      >
        <form onSubmit={handleCreateDirectIssue}>
          {errorMsg && (
            <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
              <AlertCircle size={16} />
              {errorMsg}
            </div>
          )}

          <div className="form-grid-3">
            <div className="form-group">
              <label className="form-label">Issue Date *</label>
              <input
                type="date"
                className="form-control"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 700 }}>Issuing Department *</label>
              <select
                className="form-control"
                required
                value={departmentId}
                onChange={(e) => handleDirectDeptChange(e.target.value)}
              >
                <option value="">-- Select Department --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Direct Issue Supervisor Selector */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label className="form-label" style={{ fontWeight: 700, margin: 0 }}>
                  Supervisor / Authorised Person *
                </label>
                {matchingDirectSupervisors.length > 1 && !isCustomDirectSupervisor && (
                  <span style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: 800 }}>
                    ({matchingDirectSupervisors.length} Dept Supervisors)
                  </span>
                )}
                {isCustomDirectSupervisor && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomDirectSupervisor(false);
                      if (matchingDirectSupervisors.length > 0) setSupervisorName(matchingDirectSupervisors[0].name);
                    }}
                    style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                  >
                    ↩️ Pick from Dept List
                  </button>
                )}
              </div>

              {!isCustomDirectSupervisor ? (
                <select
                  className="form-control"
                  required
                  value={supervisorName}
                  onChange={(e) => {
                    if (e.target.value === '__CUSTOM__') {
                      setIsCustomDirectSupervisor(true);
                      setSupervisorName('');
                    } else {
                      setIsCustomDirectSupervisor(false);
                      setSupervisorName(e.target.value);
                      const sObj = supervisors.find((s) => s.name === e.target.value);
                      if (sObj?.shift) {
                        setShift(sObj.shift.toUpperCase().includes('B') ? 'Shift B' : 'Shift A');
                      }
                    }
                  }}
                  style={{ fontWeight: 600, borderColor: supervisorName ? '#059669' : undefined }}
                >
                  {!supervisorName && <option value="">-- Select Supervisor --</option>}
                  {matchingDirectSupervisors.length > 0 ? (
                    matchingDirectSupervisors.map((s) => (
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
                  <option value="__CUSTOM__">✏️ + Enter Custom / Other Supervisor Name...</option>
                </select>
              ) : (
                <input
                  type="text"
                  className="form-control"
                  required
                  placeholder="Enter supervisor / shift in-charge name"
                  value={supervisorName}
                  onChange={(e) => setSupervisorName(e.target.value)}
                  autoFocus
                />
              )}
            </div>
          </div>

          <div className="form-grid-3">
            <div className="form-group">
              <label className="form-label">Shift</label>
              <select className="form-control" value={shift} onChange={(e) => setShift(e.target.value)}>
                <option value="Shift A">Shift A (06:00 - 14:30)</option>
                <option value="Shift B">Shift B (14:30 - 23:00)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Purpose / Machine / Job</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Melt batch 4 / Casting"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Issued To</label>
              <input
                type="text"
                className="form-control"
                placeholder="Operator name"
                value={issuedTo}
                onChange={(e) => setIssuedTo(e.target.value)}
              />
            </div>
          </div>

          <h4 style={{ margin: '16px 0 10px', fontSize: '0.95rem' }}>Materials to Issue</h4>
          <div className="table-container" style={{ marginBottom: '16px', overflow: 'visible' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '34%' }}>Material *</th>
                  <th style={{ width: '20%' }}>Batch / Heat No</th>
                  <th style={{ width: '14%' }}>Stock</th>
                  <th style={{ width: '14%' }}>Issued Qty *</th>
                  <th style={{ width: '14%' }}>Store Location</th>
                  <th style={{ width: '4%' }}></th>
                </tr>
              </thead>
              <tbody>
                {directItems.map((item, idx) => {
                  const selectedMat = materials.find((m) => m.id === parseInt(item.materialId));

                  return (
                    <tr key={idx}>
                      <td>
                        <AutoSuggestMaterial
                          materials={materials}
                          selectedMaterialId={item.materialId}
                          onSelectMaterial={(mat) => {
                            handleDirectItemChange(idx, 'materialId', mat ? mat.id.toString() : '');
                          }}
                          onMaterialCreated={(newMat) => {
                            setMaterials((prev) => [...prev, newMat]);
                            handleDirectItemChange(idx, 'materialId', newMat.id.toString());
                          }}
                          placeholder="Search code or name..."
                        />
                        {item.batchStockInfo && (
                          <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700, marginTop: '4px' }}>
                            {item.batchStockInfo}
                          </div>
                        )}
                      </td>
                      <td>
                        {item.availableBatches && item.availableBatches.length > 0 ? (
                          <select
                            className="form-control"
                            value={item.batchNumber}
                            onChange={(e) => handleDirectItemChange(idx, 'batchNumber', e.target.value)}
                          >
                            <option value="">-- All / General Stock --</option>
                            {item.availableBatches.map((b: any) => (
                              <option key={b.id} value={b.batchNumber}>
                                {b.batchNumber} ({b.currentStock} {selectedMat?.defaultUom || 'KG'} @ ₹{b.unitPrice})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Optional Batch Code"
                            value={item.batchNumber}
                            onChange={(e) => handleDirectItemChange(idx, 'batchNumber', e.target.value.toUpperCase())}
                          />
                        )}
                      </td>
                      <td style={{ fontWeight: 700, color: selectedMat?.currentStock && selectedMat.currentStock > 0 ? '#059669' : '#dc2626' }}>
                        {selectedMat ? `${selectedMat.currentStock} ${selectedMat.defaultUom}` : '-'}
                      </td>
                      <td>
                        <input
                          type="number"
                          step="any"
                          required
                          className="form-control"
                          placeholder="Qty"
                          value={item.issuedQuantity || ''}
                          onChange={(e) => handleDirectItemChange(idx, 'issuedQuantity', parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Bin / Bay"
                          value={item.location}
                          onChange={(e) => handleDirectItemChange(idx, 'location', e.target.value)}
                        />
                      </td>
                      <td>
                        {directItems.length > 1 && (
                          <button
                            type="button"
                            className="btn-icon btn-danger"
                            onClick={() => handleRemoveDirectItem(idx)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddDirectItem}>
            <Plus size={14} /> Add Another Material Line
          </button>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setIsCreateIssueOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <CheckCircle size={16} /> Issue Material & Print Slip
            </button>
          </div>
        </form>
      </Modal>

      {/* =========================================================================
          MODAL 5: VIEW ISSUE SLIP DETAIL MODAL
         ========================================================================= */}
      {selectedIssue && (
        <Modal
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          title={`Issue Slip Details: ${selectedIssue.issueSlipNumber}`}
          size="lg"
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '20px', padding: '14px', background: 'var(--bg-primary)', borderRadius: '8px' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Issue Date</span>
              <div style={{ fontWeight: 700 }}>{new Date(selectedIssue.issueDate).toLocaleDateString()}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Department</span>
              <div style={{ fontWeight: 700 }}>{selectedIssue.departmentName || 'PRODUCTION'}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Supervisor / Recipient</span>
              <div style={{ fontWeight: 700 }}>{selectedIssue.supervisorName || selectedIssue.issuedTo || 'N/A'}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Shift</span>
              <div style={{ fontWeight: 700 }}>{selectedIssue.shift || 'General'}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Purpose</span>
              <div style={{ fontWeight: 700 }}>{selectedIssue.purpose || 'Production'}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Cost</span>
              <div style={{ fontWeight: 800, color: 'var(--accent-primary)' }}>₹{selectedIssue.totalIssueCost.toLocaleString()}</div>
            </div>
          </div>

          <h4 style={{ marginBottom: '10px' }}>Issued Items</h4>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Material Code</th>
                  <th>Material Name</th>
                  <th>Batch / Heat No</th>
                  <th style={{ textAlign: 'right' }}>Issued Qty</th>
                  <th style={{ textAlign: 'right' }}>Unit Cost (₹)</th>
                  <th style={{ textAlign: 'right' }}>Total Cost (₹)</th>
                </tr>
              </thead>
              <tbody>
                {selectedIssue.items?.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 700 }}>{item.materialCode}</td>
                    <td>{item.materialName}</td>
                    <td>
                      {item.batchNumber ? (
                        <span style={{ background: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, fontSize: '0.78rem' }}>
                          🏷️ {item.batchNumber}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{item.issuedQuantity} {item.uom}</td>
                    <td style={{ textAlign: 'right' }}>₹{item.unitCost.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#059669' }}>₹{item.totalCost.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="modal-footer">
            <button className="btn btn-primary" onClick={() => { setIsDetailOpen(false); setPrintIssue(selectedIssue); }}>
              <Printer size={16} /> Print Formal Slip
            </button>
          </div>
        </Modal>
      )}

      {/* Printable Slip Modal */}
      {printIssue && (
        <PrintableIssueSlip issue={printIssue} onClose={() => setPrintIssue(null)} />
      )}
    </div>
  );
};
