import React, { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  Printer,
  Eye,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Send,
  Zap,
  Clock,
  Award,
  FileCheck,
  ChevronRight,
  ShieldCheck,
  Check,
  RefreshCw
} from 'lucide-react';
import api from '../services/api';
import {
  PurchaseRequest,
  Department,
  Material,
  Supplier,
  User,
  LowStockRequisitionItem,
  AutoRequisitionResult,
  SupplierPriceOption
} from '../types';
import { Modal, PrintablePurchaseRequest } from '../components/ModalAndPrintables';

export const PurchaseRequestsPage: React.FC<{ user: User | null }> = ({ user }) => {
  // Navigation View Tab
  const [activeTab, setActiveTab] = useState<'requests' | 'auto-reorder'>('requests');

  // Standard PR State
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [loading, setLoading] = useState(true);

  // Auto-Requisition State (Below Reorder Level & L1 Supplier)
  const [autoSuggestions, setAutoSuggestions] = useState<LowStockRequisitionItem[]>([]);
  const [autoLoading, setAutoLoading] = useState(false);
  const [selectedAutoIds, setSelectedAutoIds] = useState<number[]>([]);
  const [editableQuantities, setEditableQuantities] = useState<Record<number, number>>({});
  const [isTriggeringAuto, setIsTriggeringAuto] = useState(false);
  const [autoResultModal, setAutoResultModal] = useState<AutoRequisitionResult | null>(null);

  // Supplier Price Comparison Modal
  const [comparisonMaterial, setComparisonMaterial] = useState<{
    code: string;
    name: string;
    uom: string;
    options: SupplierPriceOption[];
  } | null>(null);

  // Manual Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedPr, setSelectedPr] = useState<PurchaseRequest | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [printPr, setPrintPr] = useState<PurchaseRequest | null>(null);

  // Form State
  const [requestDate, setRequestDate] = useState(new Date().toISOString().split('T')[0]);
  const [departmentId, setDepartmentId] = useState('');
  const [priority, setPriority] = useState<'Normal' | 'Urgent' | 'Emergency'>('Normal');
  const [requiredByDate, setRequiredByDate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [items, setItems] = useState<{ materialId: string; requestedQuantity: number; estimatedUnitPrice: number; preferredSupplierId: string; purpose: string; discountTerms: string }[]>([
    { materialId: '', requestedQuantity: 0, estimatedUnitPrice: 0, preferredSupplierId: '', purpose: '', discountTerms: '' }
  ]);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const [prRes, deptRes, matRes, suppRes] = await Promise.all([
        api.get('/purchasing/requests', {
          params: {
            search: search || undefined,
            status: selectedStatus || undefined
          }
        }),
        api.get('/materials/departments'),
        api.get('/stock/summary'),
        api.get('/suppliers')
      ]);
      setRequests(prRes.data);
      setDepartments(deptRes.data);
      setMaterials(matRes.data);
      setSuppliers(suppRes.data);
    } catch (err) {
      console.error('Error fetching purchase requests', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAutoSuggestions = async () => {
    setAutoLoading(true);
    try {
      const res = await api.get('/purchasing/auto-requisitions/suggestions');
      setAutoSuggestions(res.data);

      // Pre-select all items that don't have pending requisitions
      const eligibleIds = (res.data as LowStockRequisitionItem[])
        .filter((item) => !item.hasPendingRequisition)
        .map((item) => item.materialId);
      setSelectedAutoIds(eligibleIds);

      // Initialize editable quantities
      const initialQtys: Record<number, number> = {};
      (res.data as LowStockRequisitionItem[]).forEach((item) => {
        initialQtys[item.materialId] = item.recommendedQuantity;
      });
      setEditableQuantities(initialQtys);
    } catch (err) {
      console.error('Error fetching auto-requisition suggestions', err);
    } finally {
      setAutoLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchAutoSuggestions();
  }, [search, selectedStatus]);

  const handleAddItem = () => {
    setItems([...items, { materialId: '', requestedQuantity: 0, estimatedUnitPrice: 0, preferredSupplierId: '', purpose: '', discountTerms: '' }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;

    if (field === 'materialId') {
      const mat = materials.find((m) => m.id === parseInt(value));
      if (mat) {
        newItems[index].estimatedUnitPrice = mat.standardPrice;
        if (mat.requiredPoQuantity > 0 && (!newItems[index].requestedQuantity || newItems[index].requestedQuantity === 0)) {
          newItems[index].requestedQuantity = mat.requiredPoQuantity;
        }
      }
    }

    setItems(newItems);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (items.some((i) => !i.materialId || i.requestedQuantity <= 0)) {
      setErrorMsg('Please select a material and enter a valid required quantity for all rows.');
      return;
    }

    try {
      const payload = {
        requestDate: new Date(requestDate).toISOString(),
        departmentId: departmentId ? parseInt(departmentId) : null,
        priority,
        requiredByDate: requiredByDate ? new Date(requiredByDate).toISOString() : null,
        purpose: purpose || 'Material replenishment for production operations',
        items: items.map((i) => ({
          materialId: parseInt(i.materialId),
          requestedQuantity: Number(i.requestedQuantity),
          estimatedUnitPrice: Number(i.estimatedUnitPrice),
          preferredSupplierId: i.preferredSupplierId ? parseInt(i.preferredSupplierId) : null,
          purpose: i.purpose || undefined,
          discountTerms: i.discountTerms || undefined
        }))
      };

      const res = await api.post('/purchasing/requests', payload);
      setIsCreateOpen(false);

      // Open printable PR immediately
      const newPrRes = await api.get(`/purchasing/requests/${res.data.id}`);
      setPrintPr(newPrRes.data);

      setItems([{ materialId: '', requestedQuantity: 0, estimatedUnitPrice: 0, preferredSupplierId: '', purpose: '', discountTerms: '' }]);
      setPurpose('');
      fetchRequests();
      fetchAutoSuggestions();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to create purchase request.');
    }
  };

  // Run the 6:00 PM Auto-PR Routine on demand
  const handleTriggerAutoPrNow = async () => {
    setIsTriggeringAuto(true);
    try {
      const res = await api.post('/purchasing/auto-requisitions/trigger-now');
      setAutoResultModal(res.data);
      fetchRequests();
      fetchAutoSuggestions();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to trigger automated purchase requisitions.');
    } finally {
      setIsTriggeringAuto(false);
    }
  };

  // Raise PR for selected items
  const handleRaiseSelectedAutoPrs = async () => {
    if (selectedAutoIds.length === 0) {
      alert('Please select at least one low-stock material to raise a Purchase Request.');
      return;
    }

    const payloadItems = selectedAutoIds.map((matId) => {
      const match = autoSuggestions.find((s) => s.materialId === matId);
      const qty = editableQuantities[matId] || match?.recommendedQuantity || 100;
      return {
        materialId: matId,
        quantity: qty,
        unitPrice: match?.l1UnitPrice || 0,
        supplierId: match?.l1SupplierId,
        supplierName: match?.l1SupplierName,
        remarks: `Manual trigger from Low-Stock Requisition Queue @ L1 Rate Rs. ${match?.l1UnitPrice}`
      };
    });

    setIsTriggeringAuto(true);
    try {
      const res = await api.post('/purchasing/auto-requisitions/create-batch', payloadItems);
      setAutoResultModal(res.data);
      fetchRequests();
      fetchAutoSuggestions();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to generate batch purchase requests.');
    } finally {
      setIsTriggeringAuto(false);
    }
  };

  // Raise PR for a single material
  const handleRaiseSingleAutoPr = async (item: LowStockRequisitionItem) => {
    const qty = editableQuantities[item.materialId] || item.recommendedQuantity;
    const payloadItems = [
      {
        materialId: item.materialId,
        quantity: qty,
        unitPrice: item.l1UnitPrice,
        supplierId: item.l1SupplierId,
        supplierName: item.l1SupplierName,
        remarks: `1-Click Reorder from Low-Stock Queue (L1 Lowest: ${item.l1SupplierName})`
      }
    ];

    setIsTriggeringAuto(true);
    try {
      const res = await api.post('/purchasing/auto-requisitions/create-batch', payloadItems);
      setAutoResultModal(res.data);
      fetchRequests();
      fetchAutoSuggestions();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to generate purchase request.');
    } finally {
      setIsTriggeringAuto(false);
    }
  };

  const handleToggleSelectAuto = (materialId: number) => {
    const match = autoSuggestions.find((s) => s.materialId === materialId);
    if (match?.hasPendingRequisition) return; // Prevent selecting materials with already active orders

    if (selectedAutoIds.includes(materialId)) {
      setSelectedAutoIds(selectedAutoIds.filter((id) => id !== materialId));
    } else {
      setSelectedAutoIds([...selectedAutoIds, materialId]);
    }
  };

  const handleSelectAllAuto = () => {
    const eligibleItems = autoSuggestions.filter((s) => !s.hasPendingRequisition);
    if (eligibleItems.length === 0) return;

    if (selectedAutoIds.length === eligibleItems.length) {
      setSelectedAutoIds([]);
    } else {
      setSelectedAutoIds(eligibleItems.map((s) => s.materialId));
    }
  };

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await api.post(`/purchasing/requests/${id}/status`, { status, remarks: `Status updated to ${status} by ${user?.fullName}` });
      fetchRequests();
      if (isDetailOpen && selectedPr?.id === id) {
        const res = await api.get(`/purchasing/requests/${id}`);
        setSelectedPr(res.data);
      }
    } catch (err) {
      console.error('Error updating status', err);
    }
  };

  const handleViewDetails = async (id: number) => {
    try {
      const res = await api.get(`/purchasing/requests/${id}`);
      setSelectedPr(res.data);
      setIsDetailOpen(true);
    } catch (err) {
      console.error('Error fetching PR details', err);
    }
  };

  const handlePrint = async (id: number) => {
    try {
      const res = await api.get(`/purchasing/requests/${id}`);
      setPrintPr(res.data);
    } catch (err) {
      console.error('Error loading PR for print', err);
    }
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.requestedQuantity * item.estimatedUnitPrice), 0);
  };

  const totalAutoEstimatedBudget = autoSuggestions
    .filter((s) => selectedAutoIds.includes(s.materialId))
    .reduce((sum, s) => {
      const q = editableQuantities[s.materialId] || s.recommendedQuantity;
      return sum + q * s.l1UnitPrice;
    }, 0);

  const canApprove = user?.role === 'Admin' || user?.role === 'StoreManager' || user?.role === 'PurchaseUser';

  return (
    <div className="page-wrapper">
      {/* 1. HEADER WITH ACTIONS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Purchase Requisitions (PR)</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Material indent workflow (Format: GDC-PUR-FF-07 Rev 02) with priority ratings & automated L1 supplier low-stock replenishment
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-sm"
            style={{
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              color: '#ffffff',
              fontWeight: 700,
              boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onClick={handleTriggerAutoPrNow}
            disabled={isTriggeringAuto}
            title="Execute the 6:00 PM Low-Stock Auto-PR routine immediately"
          >
            {isTriggeringAuto ? <RefreshCw size={14} className="spin-icon" /> : <Zap size={14} />}
            Run 6:00 PM Auto-PR Generator Now
          </button>

          <button className="btn btn-primary btn-sm" onClick={() => setIsCreateOpen(true)}>
            <Plus size={15} /> Raise Purchase Request
          </button>
        </div>
      </div>

      {/* 2. DUAL VIEW MODE TABS */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        <button
          onClick={() => setActiveTab('requests')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '0.88rem',
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            background: activeTab === 'requests' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'requests' ? '#fff' : 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          <FileCheck size={15} />
          All Purchase Requests ({requests.length})
        </button>

        <button
          onClick={() => setActiveTab('auto-reorder')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '0.88rem',
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            background: activeTab === 'auto-reorder' ? '#dc2626' : 'rgba(220, 38, 38, 0.08)',
            color: activeTab === 'auto-reorder' ? '#fff' : '#dc2626',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          <AlertCircle size={15} />
          Auto-Requisition Queue (Below Reorder Level)
          <span
            style={{
              padding: '2px 7px',
              borderRadius: '10px',
              fontSize: '0.75rem',
              fontWeight: 800,
              background: activeTab === 'auto-reorder' ? 'rgba(255,255,255,0.25)' : '#dc2626',
              color: '#fff'
            }}
          >
            {autoSuggestions.length}
          </span>
        </button>
      </div>

      {/* 3. AUTO-REQUISITION QUEUE TAB (BELOW REORDER LEVEL WITH L1 SUPPLIER COMPARISON) */}
      {activeTab === 'auto-reorder' && (
        <div>
          {/* Executive Smart Banner */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.05) 0%, rgba(5, 150, 105, 0.05) 100%)',
              border: '1px solid rgba(220, 38, 38, 0.2)',
              borderRadius: '10px',
              padding: '16px 20px',
              marginBottom: '18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#dc2626' }}>
                  ⚠️ {autoSuggestions.length} Material(s) Below Defined Safe Reorder Level
                </span>
                <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(5, 150, 105, 0.12)', color: '#059669', fontWeight: 700 }}>
                  <ShieldCheck size={12} style={{ display: 'inline', marginRight: '3px' }} />
                  L1 Lowest Supplier Engine Active
                </span>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                ⏰ <strong>Automated Daily 6:00 PM Routine:</strong> Every evening at 18:00 IST, Purchase Requests are automatically generated for all deficit materials and assigned to the lowest rate vendor.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ textAlign: 'right', marginRight: '8px' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Selected Indent Budget</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#059669' }}>
                  ₹{totalAutoEstimatedBudget.toLocaleString()}
                </div>
              </div>

              <button
                className="btn btn-primary btn-sm"
                onClick={handleRaiseSelectedAutoPrs}
                disabled={isTriggeringAuto || selectedAutoIds.length === 0}
                style={{ fontWeight: 700 }}
              >
                {isTriggeringAuto ? <RefreshCw size={14} className="spin-icon" /> : <Send size={14} />}
                Raise PR for Selected ({selectedAutoIds.length})
              </button>
            </div>
          </div>

          {/* Auto Reorder Table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      disabled={autoSuggestions.filter((s) => !s.hasPendingRequisition).length === 0}
                      checked={
                        autoSuggestions.filter((s) => !s.hasPendingRequisition).length > 0 &&
                        selectedAutoIds.length === autoSuggestions.filter((s) => !s.hasPendingRequisition).length
                      }
                      onChange={handleSelectAllAuto}
                      title={
                        autoSuggestions.filter((s) => !s.hasPendingRequisition).length === 0
                          ? 'All deficit items already have active POs/PRs'
                          : 'Select all eligible items'
                      }
                    />
                  </th>
                  <th>Material Code & Name</th>
                  <th>Category</th>
                  <th>Current Stock</th>
                  <th>Reorder Level</th>
                  <th style={{ width: '130px' }}>Recommended Order Qty</th>
                  <th>Lowest Rate Supplier (L1)</th>
                  <th>Estimated Value (₹)</th>
                  <th>Pipeline Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {autoLoading ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '30px' }}>
                      Scanning inventory balances and querying L1 supplier rates...
                    </td>
                  </tr>
                ) : autoSuggestions.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: '#059669' }}>
                      <CheckCircle size={32} style={{ marginBottom: '8px', opacity: 0.8 }} />
                      <div style={{ fontWeight: 700, fontSize: '1rem' }}>All materials are in safe buffer!</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Zero deficit items below reorder level.</div>
                    </td>
                  </tr>
                ) : (
                  autoSuggestions.map((item) => {
                    const isSelected = selectedAutoIds.includes(item.materialId);
                    const qty = editableQuantities[item.materialId] ?? item.recommendedQuantity;
                    const estValue = qty * item.l1UnitPrice;

                    return (
                      <tr
                        key={item.materialId}
                        style={{
                          background: item.hasPendingRequisition
                            ? 'rgba(0, 0, 0, 0.02)'
                            : (isSelected ? 'rgba(5, 150, 105, 0.02)' : 'transparent'),
                          opacity: item.hasPendingRequisition ? 0.72 : 1
                        }}
                      >
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            disabled={item.hasPendingRequisition}
                            checked={isSelected && !item.hasPendingRequisition}
                            onChange={() => handleToggleSelectAuto(item.materialId)}
                            title={
                              item.hasPendingRequisition
                                ? `Selection disabled: Order already active (${item.pendingDocNumber})`
                                : 'Select for PO/PR generation'
                            }
                            style={{ cursor: item.hasPendingRequisition ? 'not-allowed' : 'pointer' }}
                          />
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: item.hasPendingRequisition ? 'var(--text-secondary)' : 'var(--accent-primary)' }}>
                            {item.materialCode}
                          </div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{item.materialName}</div>
                        </td>
                        <td>
                          <span className="badge" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', fontSize: '0.72rem' }}>
                            {item.categoryName}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 800, color: item.currentStock <= 0 ? '#dc2626' : '#d97706' }}>
                            {item.currentStock.toLocaleString()} {item.uom}
                          </div>
                          {item.currentStock <= 0 ? (
                            <span className="badge badge-outofstock" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>OUT OF STOCK</span>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: '#dc2626' }}>Deficit: -{item.deficitQuantity.toLocaleString()}</span>
                          )}
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {item.reorderLevel.toLocaleString()} {item.uom}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                              type="number"
                              disabled={item.hasPendingRequisition}
                              className="form-control"
                              style={{ width: '85px', padding: '4px 6px', fontSize: '0.82rem', fontWeight: 700 }}
                              value={qty}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setEditableQuantities({ ...editableQuantities, [item.materialId]: val });
                              }}
                            />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.uom}</span>
                          </div>
                        </td>
                        <td>
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              background: 'rgba(5, 150, 105, 0.08)',
                              border: '1px solid rgba(5, 150, 105, 0.25)',
                              cursor: item.supplierPriceOptions.length > 1 ? 'pointer' : 'default'
                            }}
                            onClick={() => {
                              if (item.supplierPriceOptions.length > 1) {
                                setComparisonMaterial({
                                  code: item.materialCode,
                                  name: item.materialName,
                                  uom: item.uom,
                                  options: item.supplierPriceOptions
                                });
                              }
                            }}
                            title={item.supplierPriceOptions.length > 1 ? 'Click to view full vendor price comparison' : undefined}
                          >
                            <Award size={13} color="#059669" />
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#059669' }}>
                                {item.l1SupplierName}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                ₹{item.l1UnitPrice.toFixed(2)} / {item.uom}{' '}
                                {item.supplierPriceOptions.length > 1 && (
                                  <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                                    (+{item.supplierPriceOptions.length - 1} other)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontWeight: 800, color: 'var(--accent-primary)' }}>
                          ₹{estValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td>
                          {item.hasPendingRequisition ? (
                            <span
                              className="badge badge-excess"
                              style={{ fontSize: '0.75rem', padding: '4px 8px', fontWeight: 700 }}
                              title="Purchase Order is already generated and active in the system"
                            >
                              🔒 Active: {item.pendingDocNumber}
                            </span>
                          ) : (
                            <span className="badge badge-low" style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
                              ⚡ Ready for PO
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleRaiseSingleAutoPr(item)}
                            disabled={item.hasPendingRequisition || isTriggeringAuto}
                            style={{
                              fontSize: '0.75rem',
                              padding: '4px 10px',
                              fontWeight: 700,
                              borderColor: item.hasPendingRequisition ? 'var(--border-color)' : '#059669',
                              color: item.hasPendingRequisition ? 'var(--text-muted)' : '#059669',
                              background: item.hasPendingRequisition ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                              cursor: item.hasPendingRequisition ? 'not-allowed' : 'pointer'
                            }}
                            title={
                              item.hasPendingRequisition
                                ? `Action disabled: Already active in ${item.pendingDocNumber}`
                                : 'Raise Purchase Order & PR for this material'
                            }
                          >
                            {item.hasPendingRequisition ? 'PO Active' : <><Zap size={12} /> Raise PO</>}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. ALL PURCHASE REQUESTS TAB (STANDARD LIST) */}
      {activeTab === 'requests' && (
        <>
          {/* Filters */}
          <div className="card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: '36px' }}
                  placeholder="Search PR Number or Purpose..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div>
                <select
                  className="form-control"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="Submitted">Submitted (Pending Approval)</option>
                  <option value="Approved">Approved</option>
                  <option value="ConvertedToPO">Converted to PO</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>PR Number</th>
                  <th>Date</th>
                  <th>Department</th>
                  <th>Priority</th>
                  <th>Required By</th>
                  <th>Estimated Value (₹)</th>
                  <th>Status</th>
                  <th>Raised By</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '30px' }}>Loading purchase requests...</td>
                  </tr>
                ) : requests.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '30px' }}>No purchase requests recorded.</td>
                  </tr>
                ) : (
                  requests.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{p.prNumber}</td>
                      <td>{new Date(p.requestDate).toLocaleDateString()}</td>
                      <td style={{ fontWeight: 600 }}>{p.departmentName || 'PRODUCTION'}</td>
                      <td>
                        {p.priority === 'Emergency' ? (
                          <span className="badge badge-outofstock">EMERGENCY</span>
                        ) : p.priority === 'Urgent' ? (
                          <span className="badge badge-low">URGENT</span>
                        ) : (
                          <span className="badge" style={{ background: 'var(--border-light)' }}>NORMAL</span>
                        )}
                      </td>
                      <td>{p.requiredByDate ? new Date(p.requiredByDate).toLocaleDateString() : 'Immediate'}</td>
                      <td style={{ fontWeight: 700 }}>₹{p.totalEstimatedValue.toLocaleString()}</td>
                      <td>
                        {p.status === 'Submitted' && <span className="badge badge-submitted">Submitted</span>}
                        {p.status === 'Approved' && <span className="badge badge-approved">Approved</span>}
                        {p.status === 'ConvertedToPO' && <span className="badge badge-excess">PO Issued</span>}
                        {p.status === 'Rejected' && <span className="badge badge-rejected">Rejected</span>}
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>{p.createdBy || 'User'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="btn-icon btn-secondary"
                            onClick={() => handleViewDetails(p.id)}
                            title="View PR Details"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            className="btn-icon btn-secondary"
                            onClick={() => handlePrint(p.id)}
                            title="Print Formal PR Form (GDC-PUR-FF-07)"
                          >
                            <Printer size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 5. SUPPLIER MULTI-PRICE COMPARISON MODAL */}
      {comparisonMaterial && (
        <Modal
          isOpen={true}
          onClose={() => setComparisonMaterial(null)}
          title={`Vendor Price Comparison: ${comparisonMaterial.code} - ${comparisonMaterial.name}`}
          size="md"
        >
          <div style={{ marginBottom: '14px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            The system automatically selected the lowest rate supplier (L1) for this material during the 6:00 PM scan.
          </div>
          <table className="data-table" style={{ marginBottom: '16px' }}>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Supplier Name</th>
                <th>Quoted Price (₹)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {comparisonMaterial.options.map((opt, idx) => (
                <tr key={idx} style={{ background: opt.isL1Lowest ? 'rgba(5, 150, 105, 0.06)' : 'transparent' }}>
                  <td style={{ fontWeight: 800, color: opt.isL1Lowest ? '#059669' : 'inherit' }}>
                    {opt.isL1Lowest ? '🏆 L1 (Lowest)' : `L${idx + 1}`}
                  </td>
                  <td style={{ fontWeight: opt.isL1Lowest ? 700 : 500 }}>{opt.supplierName}</td>
                  <td style={{ fontWeight: 800, color: opt.isL1Lowest ? '#059669' : 'inherit' }}>
                    ₹{opt.price.toFixed(2)} / {comparisonMaterial.uom}
                  </td>
                  <td>
                    {opt.isL1Lowest ? (
                      <span className="badge badge-approved" style={{ fontSize: '0.72rem' }}>
                        Selected (Lowest Rate)
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        +₹{(opt.price - comparisonMaterial.options[0].price).toFixed(2)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="modal-footer">
            <button className="btn btn-primary" onClick={() => setComparisonMaterial(null)}>
              Close Comparison
            </button>
          </div>
        </Modal>
      )}

      {/* 6. AUTO-REQUISITION EXECUTION RESULT MODAL */}
      {autoResultModal && (
        <Modal
          isOpen={true}
          onClose={() => setAutoResultModal(null)}
          title="Automated Purchase Orders & Requisitions Summary"
          size="md"
        >
          <div style={{ textAlign: 'center', padding: '10px 0 16px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: autoResultModal.success ? 'rgba(5, 150, 105, 0.12)' : 'rgba(220, 38, 38, 0.12)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '10px'
              }}
            >
              {autoResultModal.success ? <Check size={24} color="#059669" /> : <AlertCircle size={24} color="#dc2626" />}
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 6px' }}>
              {autoResultModal.success ? 'Purchase Order(s) & Requisition(s) Generated' : 'Auto-Requisition Notice'}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
              {autoResultModal.message}
            </p>
          </div>

          {autoResultModal.createdPoNumbers && autoResultModal.createdPoNumbers.length > 0 && (
            <div style={{ background: 'var(--bg-primary)', padding: '12px 16px', borderRadius: '8px', marginBottom: '14px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                Generated Purchase Orders (Issued to L1 Suppliers):
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {autoResultModal.createdPoNumbers.map((poNum) => (
                  <span key={poNum} className="badge badge-excess" style={{ fontSize: '0.82rem', padding: '4px 10px', fontWeight: 700 }}>
                    🛒 {poNum}
                  </span>
                ))}
              </div>
            </div>
          )}

          {autoResultModal.createdPrNumbers && autoResultModal.createdPrNumbers.length > 0 && (
            <div style={{ background: 'var(--bg-primary)', padding: '12px 16px', borderRadius: '8px', marginBottom: '14px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                Associated Purchase Requisitions:
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {autoResultModal.createdPrNumbers.map((prNum) => (
                  <span key={prNum} className="badge badge-submitted" style={{ fontSize: '0.82rem', padding: '4px 10px' }}>
                    📋 {prNum}
                  </span>
                ))}
              </div>
            </div>
          )}

          {autoResultModal.logs && autoResultModal.logs.length > 0 && (
            <div style={{ maxHeight: '140px', overflowY: 'auto', background: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px', fontSize: '0.78rem', fontFamily: 'monospace', marginBottom: '16px' }}>
              {autoResultModal.logs.map((log, i) => (
                <div key={i} style={{ marginBottom: '3px' }}>• {log}</div>
              ))}
            </div>
          )}

          <div className="modal-footer">
            <button
              className="btn btn-secondary"
              onClick={() => {
                setAutoResultModal(null);
                setActiveTab('requests');
              }}
            >
              View in PR List
            </button>
            <button className="btn btn-primary" onClick={() => setAutoResultModal(null)}>
              Done
            </button>
          </div>
        </Modal>
      )}

      {/* 7. MANUAL CREATE PR MODAL */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Raise Purchase Requisition Form (GDC-PUR-FF-07)"
        size="lg"
      >
        <form onSubmit={handleCreate}>
          {errorMsg && (
            <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
              <AlertCircle size={15} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
              {errorMsg}
            </div>
          )}

          <div className="form-grid-3">
            <div className="form-group">
              <label className="form-label">Request Date *</label>
              <input
                type="date"
                className="form-control"
                required
                value={requestDate}
                onChange={(e) => setRequestDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Department *</label>
              <select
                className="form-control"
                required
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">Select Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Priority Rating *</label>
              <select
                className="form-control"
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
              >
                <option value="Normal">Normal</option>
                <option value="Urgent">Urgent</option>
                <option value="Emergency">Emergency</option>
              </select>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Required By Date</label>
              <input
                type="date"
                className="form-control"
                value={requiredByDate}
                onChange={(e) => setRequiredByDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Purpose / Usage Description</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Ingot replenishment for upcoming casting schedule"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </div>
          </div>

          <h4 style={{ margin: '16px 0 10px', fontSize: '0.95rem' }}>Requested Materials</h4>
          <div className="table-container" style={{ marginBottom: '16px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Material *</th>
                  <th>Current Stock</th>
                  <th>Req Qty *</th>
                  <th>Unit Rate (₹)</th>
                  <th>Preferred Supplier</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const selectedMat = materials.find((m) => m.id === parseInt(item.materialId));
                  return (
                    <tr key={idx}>
                      <td>
                        <select
                          className="form-control"
                          required
                          value={item.materialId}
                          onChange={(e) => handleItemChange(idx, 'materialId', e.target.value)}
                        >
                          <option value="">Select Material</option>
                          {materials.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.materialCode} — {m.materialName} ({m.defaultUom})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
                        {selectedMat ? `${selectedMat.currentStock} ${selectedMat.defaultUom}` : '-'}
                      </td>
                      <td>
                        <input
                          type="number"
                          step="any"
                          required
                          className="form-control"
                          placeholder="Qty"
                          value={item.requestedQuantity || ''}
                          onChange={(e) => handleItemChange(idx, 'requestedQuantity', parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          className="form-control"
                          placeholder="Price"
                          value={item.estimatedUnitPrice || ''}
                          onChange={(e) => handleItemChange(idx, 'estimatedUnitPrice', parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td>
                        <select
                          className="form-control"
                          value={item.preferredSupplierId}
                          onChange={(e) => handleItemChange(idx, 'preferredSupplierId', e.target.value)}
                        >
                          <option value="">Preferred Supplier</option>
                          {suppliers.map((s) => (
                            <option key={s.id} value={s.id}>{s.supplierName}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {items.length > 1 && (
                          <button
                            type="button"
                            className="btn-icon btn-danger"
                            onClick={() => handleRemoveItem(idx)}
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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddItem}>
              <Plus size={14} /> Add Another Material
            </button>
            <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>
              Total Estimated: ₹{calculateTotal().toLocaleString()}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Send size={16} /> Submit Purchase Requisition
            </button>
          </div>
        </form>
      </Modal>

      {/* 8. DETAIL MODAL */}
      {selectedPr && (
        <Modal
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          title={`Purchase Requisition Details: ${selectedPr.prNumber}`}
          size="lg"
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '20px', padding: '14px', background: 'var(--bg-primary)', borderRadius: '8px' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Date</span>
              <div style={{ fontWeight: 700 }}>{new Date(selectedPr.requestDate).toLocaleDateString()}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Department</span>
              <div style={{ fontWeight: 700 }}>{selectedPr.departmentName || 'PRODUCTION'}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Priority</span>
              <div style={{ fontWeight: 700, color: selectedPr.priority === 'Emergency' ? '#dc2626' : 'inherit' }}>{selectedPr.priority}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status</span>
              <div style={{ fontWeight: 800 }}>{selectedPr.status}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Raised By</span>
              <div style={{ fontWeight: 600 }}>{selectedPr.createdBy || 'User'}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Value</span>
              <div style={{ fontWeight: 800, color: 'var(--accent-primary)' }}>₹{selectedPr.totalEstimatedValue.toLocaleString()}</div>
            </div>
          </div>

          <h4 style={{ marginBottom: '10px' }}>Item List</h4>
          <div className="table-container" style={{ marginBottom: '16px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Material Code</th>
                  <th>Material Name</th>
                  <th>Avl Stock</th>
                  <th>Req Qty</th>
                  <th>Unit Rate (₹)</th>
                  <th>Total (₹)</th>
                </tr>
              </thead>
              <tbody>
                {selectedPr.items?.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 700 }}>{item.materialCode}</td>
                    <td>{item.materialName}</td>
                    <td>{item.availableStockAtRequest}</td>
                    <td style={{ fontWeight: 700 }}>{item.requestedQuantity} {item.uom}</td>
                    <td>₹{item.estimatedUnitPrice.toFixed(2)}</td>
                    <td style={{ fontWeight: 700 }}>₹{item.totalAmount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
            <button className="btn btn-secondary" onClick={() => { setIsDetailOpen(false); setPrintPr(selectedPr); }}>
              <Printer size={16} /> Print GDC-PUR-FF-07
            </button>

            {canApprove && selectedPr.status === 'Submitted' && (
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-danger" onClick={() => handleStatusChange(selectedPr.id, 'Rejected')}>
                  <XCircle size={16} /> Reject PR
                </button>
                <button className="btn btn-success" onClick={() => handleStatusChange(selectedPr.id, 'Approved')}>
                  <CheckCircle size={16} /> Approve PR
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* 9. PRINTABLE PR MODAL */}
      {printPr && (
        <PrintablePurchaseRequest pr={printPr} onClose={() => setPrintPr(null)} />
      )}
    </div>
  );
};
export default PurchaseRequestsPage;
