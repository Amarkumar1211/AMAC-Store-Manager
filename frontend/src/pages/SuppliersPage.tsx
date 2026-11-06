import React, { useEffect, useState } from 'react';
import {
  Users2,
  Plus,
  Search,
  TrendingDown,
  TrendingUp,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Building,
  Phone,
  Mail,
  RefreshCw,
  MapPin,
  FileSpreadsheet,
  ChevronRight,
  ChevronDown,
  Trash2,
  CheckSquare,
  Square,
  Power,
  ShieldAlert,
  FileText,
  Printer,
  Eye,
  PackageCheck,
  Boxes,
  List,
  Maximize2,
  Minimize2
} from 'lucide-react';
import api from '../services/api';
import { Supplier, User } from '../types';
import { Modal, PrintableGoodsReceiptNote } from '../components/ModalAndPrintables';

export const SuppliersPage: React.FC<{ user: User | null }> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'directory' | 'inward-rates' | 'deflection'>('inward-rates');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inwardRates, setInwardRates] = useState<any[]>([]);
  const [materialDaywiseRates, setMaterialDaywiseRates] = useState<any[]>([]);
  const [deflectionData, setDeflectionData] = useState<any>(null);

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [deflectionFilter, setDeflectionFilter] = useState<'ALL' | 'OVERRUN' | 'SAVINGS'>('ALL');

  // Day-wise rates view controls
  const [inwardViewMode, setInwardViewMode] = useState<'material-wise' | 'chronological'>('material-wise');
  const [expandedMaterialIds, setExpandedMaterialIds] = useState<number[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Multi-Selection State for Admin Deletion
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<number[]>([]);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Supplier Details Modal State
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [isViewSuppOpen, setIsViewSuppOpen] = useState(false);
  const [lastFiveInvoices, setLastFiveInvoices] = useState<any[]>([]);
  const [supplierInwards, setSupplierInwards] = useState<any[]>([]);
  const [loadingInwards, setLoadingInwards] = useState(false);

  // Dedicated Invoice / GRN Detail Modal State (When clicking on an invoice)
  const [selectedInvoiceDetails, setSelectedInvoiceDetails] = useState<any | null>(null);
  const [isInvoiceDetailOpen, setIsInvoiceDetailOpen] = useState(false);
  const [loadingInvoiceDetail, setLoadingInvoiceDetail] = useState(false);
  const [isPrintGrnOpen, setIsPrintGrnOpen] = useState(false);

  // Delete Confirmation Modals
  const [deleteModalConfig, setDeleteModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionType: 'SINGLE' | 'BATCH' | 'ALL_INACTIVE' | 'ALL';
    targetId?: number;
  }>({
    isOpen: false,
    title: '',
    message: '',
    actionType: 'SINGLE'
  });

  // Supplier Add Modal
  const [isAddSuppOpen, setIsAddSuppOpen] = useState(false);
  const [suppName, setSuppName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const isAdmin = user?.role === 'Admin';
  const canManage = isAdmin || user?.role === 'StoreManager' || user?.role === 'PurchaseUser';

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const params: any = { search: search || undefined };
      if (statusFilter === 'ACTIVE') params.isActive = true;
      if (statusFilter === 'INACTIVE') params.isActive = false;

      const res = await api.get('/suppliers', { params });
      setSuppliers(res.data);
      setSelectedSupplierIds([]);
    } catch (err) {
      console.error('Error fetching suppliers', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchInwardRates = async () => {
    setLoading(true);
    try {
      const [ratesRes, matDayRes] = await Promise.all([
        api.get('/suppliers/inward-invoice-rates', { params: { search: search || undefined } }),
        api.get('/suppliers/material-daywise-rates', { params: { search: search || undefined } })
      ]);
      setInwardRates(ratesRes.data || []);
      const matData = matDayRes.data || [];
      setMaterialDaywiseRates(matData);
      // Auto-expand first 10 materials
      setExpandedMaterialIds(matData.slice(0, 10).map((m: any) => m.materialId));
    } catch (err) {
      console.error('Error fetching inward rates', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDeflectionAnalysis = async () => {
    setLoading(true);
    try {
      const res = await api.get('/suppliers/price-deflection-analysis', { params: { search: search || undefined } });
      setDeflectionData(res.data);
    } catch (err) {
      console.error('Error fetching deflection analysis', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'directory') {
      fetchSuppliers();
    } else if (activeTab === 'inward-rates') {
      fetchInwardRates();
    } else if (activeTab === 'deflection') {
      fetchDeflectionAnalysis();
    }
  }, [activeTab, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'directory') fetchSuppliers();
    else if (activeTab === 'inward-rates') fetchInwardRates();
    else if (activeTab === 'deflection') fetchDeflectionAnalysis();
  };

  const toggleExpandMaterial = (matId: number) => {
    setExpandedMaterialIds((prev) =>
      prev.includes(matId) ? prev.filter((id) => id !== matId) : [...prev, matId]
    );
  };

  const expandAllMaterials = () => {
    setExpandedMaterialIds(materialDaywiseRates.map((m: any) => m.materialId));
  };

  const collapseAllMaterials = () => {
    setExpandedMaterialIds([]);
  };

  const handleOpenSupplierDetails = async (supp: Supplier) => {
    setSelectedSupplier(supp);
    setIsViewSuppOpen(true);
    setLoadingInwards(true);
    try {
      const [inwardRatesRes, invoicesRes] = await Promise.all([
        api.get('/suppliers/inward-invoice-rates', { params: { supplierId: supp.id } }),
        api.get('/receipts', { params: { supplierId: supp.id, limit: 5 } })
      ]);
      setSupplierInwards(inwardRatesRes.data || []);
      setLastFiveInvoices((invoicesRes.data || []).slice(0, 5));
    } catch (err) {
      console.error('Error fetching supplier inward history', err);
      setSupplierInwards([]);
      setLastFiveInvoices([]);
    } finally {
      setLoadingInwards(false);
    }
  };

  const handleOpenInvoiceDetails = async (receiptId: number) => {
    setLoadingInvoiceDetail(true);
    setIsInvoiceDetailOpen(true);
    try {
      const res = await api.get(`/receipts/${receiptId}`);
      setSelectedInvoiceDetails(res.data);
    } catch (err) {
      console.error('Error fetching invoice details', err);
    } finally {
      setLoadingInvoiceDetail(false);
    }
  };

  // Selection handlers for multi-delete
  const toggleSelectSupplier = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedSupplierIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedSupplierIds.length === suppliers.length) {
      setSelectedSupplierIds([]);
    } else {
      setSelectedSupplierIds(suppliers.map((s) => s.id));
    }
  };

  // Toggle Active/Inactive Status (Admin Only)
  const handleToggleActive = async (suppId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return;
    try {
      const res = await api.put(`/suppliers/${suppId}/toggle-active`);
      setActionMessage({ type: 'success', text: res.data.message });
      if (selectedSupplier && selectedSupplier.id === suppId) {
        setSelectedSupplier({ ...selectedSupplier, isActive: res.data.isActive });
      }
      fetchSuppliers();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update status.' });
    }
  };

  // Execute Deletions (Admin Only)
  const handleExecuteDeletion = async () => {
    const { actionType, targetId } = deleteModalConfig;
    setDeleteModalConfig((prev) => ({ ...prev, isOpen: false }));

    try {
      if (actionType === 'SINGLE' && targetId) {
        const res = await api.delete(`/suppliers/${targetId}`);
        setActionMessage({ type: 'success', text: res.data.message });
        if (isViewSuppOpen && selectedSupplier?.id === targetId) {
          setIsViewSuppOpen(false);
        }
      } else if (actionType === 'BATCH') {
        const res = await api.post('/suppliers/batch-delete', { supplierIds: selectedSupplierIds });
        setActionMessage({ type: 'success', text: res.data.message });
        setSelectedSupplierIds([]);
      } else if (actionType === 'ALL_INACTIVE') {
        const res = await api.post('/suppliers/delete-all', { inactiveOnly: true });
        setActionMessage({ type: 'success', text: res.data.message });
      } else if (actionType === 'ALL') {
        const res = await api.post('/suppliers/delete-all', { inactiveOnly: false });
        setActionMessage({ type: 'success', text: res.data.message });
      }
      fetchSuppliers();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.response?.data?.message || 'Failed to delete supplier(s).' });
    }
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      await api.post('/suppliers', {
        supplierName: suppName,
        contactPerson,
        phone,
        email,
        address,
        gstNumber
      });
      setIsAddSuppOpen(false);
      setSuppName('');
      setContactPerson('');
      setPhone('');
      setEmail('');
      setAddress('');
      setGstNumber('');
      fetchSuppliers();
      setActionMessage({ type: 'success', text: 'Supplier registered successfully.' });
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to add supplier.');
    }
  };

  const categories = ['ALL', ...Array.from(new Set(materialDaywiseRates.map((m: any) => m.categoryName).filter(Boolean)))];

  const filteredMaterialDaywise = materialDaywiseRates.filter((m: any) => {
    if (selectedCategory !== 'ALL' && m.categoryName !== selectedCategory) return false;
    return true;
  });

  const filteredDeflectionMaterials = (deflectionData?.materials || []).filter((m: any) => {
    if (deflectionFilter === 'OVERRUN') return m.status === 'OVERRUN';
    if (deflectionFilter === 'SAVINGS') return m.status === 'SAVINGS';
    return true;
  });

  return (
    <div className="page-wrapper">
      {/* Action Notification Banner */}
      {actionMessage && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: actionMessage.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: actionMessage.type === 'success' ? '#166534' : '#991b1b',
            border: `1px solid ${actionMessage.type === 'success' ? '#86efac' : '#fca5a5'}`,
            fontSize: '0.9rem',
            fontWeight: 600
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {actionMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            {actionMessage.text}
          </div>
          <button
            onClick={() => setActionMessage(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 800, color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Material Rates Ledger & Supplier Intelligence</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Material Code & Name day-wise rate tracking, inward invoice pricing history & budget deflection
          </p>
        </div>

        {canManage && activeTab === 'directory' && (
          <button className="btn btn-primary btn-sm" onClick={() => setIsAddSuppOpen(true)}>
            <Plus size={15} /> Add Supplier
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'inward-rates' ? 'active' : ''}`}
          onClick={() => setActiveTab('inward-rates')}
        >
          <Calendar size={16} /> Material Code Name & Day-Wise Rates
        </button>

        <button
          className={`tab-btn ${activeTab === 'directory' ? 'active' : ''}`}
          onClick={() => setActiveTab('directory')}
        >
          <Users2 size={16} /> Supplier Directory
        </button>

        <button
          className={`tab-btn ${activeTab === 'deflection' ? 'active' : ''}`}
          onClick={() => setActiveTab('deflection')}
        >
          <TrendingDown size={16} /> Rate Deflection & Month's Budget Impact
        </button>
      </div>

      {/* Search & Action Toolbar */}
      <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '280px', maxWidth: '440px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-control"
            style={{ paddingLeft: '36px' }}
            placeholder={
              activeTab === 'inward-rates' ? 'Search Material Code (M001), Name, Supplier, Invoice...' :
              activeTab === 'directory' ? 'Search supplier / company name...' :
              'Search material code, description...'
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button type="submit" className="btn btn-secondary btn-sm">
          <Search size={15} /> Search
        </button>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            setSearch('');
            setSelectedCategory('ALL');
            if (activeTab === 'inward-rates') fetchInwardRates();
            else if (activeTab === 'directory') fetchSuppliers();
            else if (activeTab === 'deflection') fetchDeflectionAnalysis();
          }}
        >
          <RefreshCw size={15} /> Reset
        </button>

        {/* TAB 1: Inward Rates View Toggle & Expand Controls */}
        {activeTab === 'inward-rates' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', background: 'var(--bg-hover)', borderRadius: '8px', padding: '2px' }}>
              <button
                type="button"
                className={`btn btn-sm ${inwardViewMode === 'material-wise' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ borderRadius: '6px', fontSize: '0.78rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => setInwardViewMode('material-wise')}
              >
                <Boxes size={13} /> Group by Material Code & Name ({filteredMaterialDaywise.length})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${inwardViewMode === 'chronological' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ borderRadius: '6px', fontSize: '0.78rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => setInwardViewMode('chronological')}
              >
                <List size={13} /> Chronological Feed ({inwardRates.length})
              </button>
            </div>

            {inwardViewMode === 'material-wise' && (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.76rem', padding: '4px 8px' }}
                  onClick={expandAllMaterials}
                  title="Expand All Materials"
                >
                  <Maximize2 size={13} /> Expand All
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.76rem', padding: '4px 8px' }}
                  onClick={collapseAllMaterials}
                  title="Collapse All Materials"
                >
                  <Minimize2 size={13} /> Collapse All
                </button>
              </div>
            )}
          </div>
        )}

        {/* Directory Tab Filters */}
        {activeTab === 'directory' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', background: 'var(--bg-hover)', borderRadius: '8px', padding: '2px' }}>
              <button
                type="button"
                className={`btn btn-sm ${statusFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ borderRadius: '6px', fontSize: '0.78rem', padding: '4px 10px' }}
                onClick={() => setStatusFilter('ALL')}
              >
                All ({suppliers.length})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${statusFilter === 'ACTIVE' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ borderRadius: '6px', fontSize: '0.78rem', padding: '4px 10px' }}
                onClick={() => setStatusFilter('ACTIVE')}
              >
                Active
              </button>
              <button
                type="button"
                className={`btn btn-sm ${statusFilter === 'INACTIVE' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ borderRadius: '6px', fontSize: '0.78rem', padding: '4px 10px' }}
                onClick={() => setStatusFilter('INACTIVE')}
              >
                Inactive
              </button>
            </div>

            {isAdmin && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={toggleSelectAll}
                  style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  {selectedSupplierIds.length === suppliers.length && suppliers.length > 0 ? (
                    <><CheckSquare size={14} /> Deselect All</>
                  ) : (
                    <><Square size={14} /> Select All</>
                  )}
                </button>

                {selectedSupplierIds.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() =>
                      setDeleteModalConfig({
                        isOpen: true,
                        title: `Delete ${selectedSupplierIds.length} Selected Suppliers`,
                        message: `Are you sure you want to delete or deactivate ${selectedSupplierIds.length} selected suppliers?`,
                        actionType: 'BATCH'
                      })
                    }
                    style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Trash2 size={14} /> Delete Selected ({selectedSupplierIds.length})
                  </button>
                )}

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() =>
                    setDeleteModalConfig({
                      isOpen: true,
                      title: 'Delete All Inactive Suppliers',
                      message: 'Are you sure you want to permanently remove/deactivate all inactive suppliers?',
                      actionType: 'ALL_INACTIVE'
                    })
                  }
                  style={{ fontSize: '0.78rem', color: '#dc2626', borderColor: '#fca5a5' }}
                >
                  <Trash2 size={13} /> Clean Inactive
                </button>
              </>
            )}
          </div>
        )}
      </form>

      {/* Category Filter Chips for Material-Wise Rates */}
      {activeTab === 'inward-rates' && inwardViewMode === 'material-wise' && categories.length > 2 && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`btn btn-sm ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.74rem', padding: '3px 10px', borderRadius: '20px', whiteSpace: 'nowrap' }}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* TAB 1: DATE-WISE INWARD INVOICE RATES AS PER MATERIAL CODE & NAME */}
      {activeTab === 'inward-rates' && (
        <>
          {inwardViewMode === 'material-wise' ? (
            /* VIEW A: GROUPED BY MATERIAL CODE & NAME WITH DAY-WISE RATE TIMELINE */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {filteredMaterialDaywise.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No material day-wise rates found matching your search.
                </div>
              ) : (
                filteredMaterialDaywise.map((m: any) => {
                  const isExpanded = expandedMaterialIds.includes(m.materialId);
                  const isOverrun = m.rateDeflection > 0.01;
                  const isSavings = m.rateDeflection < -0.01;

                  return (
                    <div
                      key={m.materialId}
                      className="card"
                      style={{
                        padding: 0,
                        overflow: 'hidden',
                        borderRadius: '12px',
                        border: '1px solid var(--border-color)',
                        marginBottom: 0
                      }}
                    >
                      {/* Material Header Card */}
                      <div
                        onClick={() => toggleExpandMaterial(m.materialId)}
                        style={{
                          padding: '14px 18px',
                          background: isExpanded ? 'var(--bg-hover)' : 'var(--bg-card)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          gap: '12px',
                          flexWrap: 'wrap',
                          transition: 'background 0.2s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '280px', flex: 1 }}>
                          <div style={{
                            padding: '6px 12px',
                            background: 'rgba(79, 70, 229, 0.12)',
                            color: 'var(--accent-primary)',
                            borderRadius: '8px',
                            fontWeight: 800,
                            fontSize: '0.95rem',
                            fontFamily: 'monospace'
                          }}>
                            {m.materialCode}
                          </div>

                          <div>
                            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                              {m.materialName}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                              <span className="badge badge-low" style={{ fontSize: '0.7rem' }}>
                                {m.categoryName}
                              </span>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                UOM: <strong>{m.uom}</strong>
                              </span>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                • {m.dayWiseRates.length} Inward Entries
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Pricing Summary Columns */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Standard Base Rate</div>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                              ₹{m.standardBaseRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Latest Inward Rate</div>
                            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                              ₹{m.latestRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Rate Range (Min - Max)</div>
                            <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                              ₹{m.minRate.toFixed(2)} - ₹{m.maxRate.toFixed(2)}
                            </div>
                          </div>

                          <div>
                            {isOverrun ? (
                              <span className="badge badge-outofstock" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
                                <TrendingUp size={13} /> +₹{m.rateDeflection.toFixed(2)} (+{m.deflectionPercentage}%)
                              </span>
                            ) : isSavings ? (
                              <span className="badge badge-normal" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
                                <TrendingDown size={13} /> -₹{Math.abs(m.rateDeflection).toFixed(2)} ({m.deflectionPercentage}%)
                              </span>
                            ) : (
                              <span className="badge badge-low" style={{ fontSize: '0.75rem' }}>
                                Exact Standard (₹0.00)
                              </span>
                            )}
                          </div>

                          <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: 'var(--bg-hover)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-muted)'
                          }}>
                            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Day-Wise Rates Table */}
                      {isExpanded && (
                        <div style={{ borderTop: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
                          <div className="table-container" style={{ margin: 0, border: 'none', borderRadius: 0 }}>
                            <table className="data-table" style={{ fontSize: '0.84rem' }}>
                              <thead>
                                <tr style={{ background: 'var(--bg-hover)' }}>
                                  <th style={{ width: '40px' }}>#</th>
                                  <th>Inward Date</th>
                                  <th>Supplier Invoice No & Date</th>
                                  <th>GRN Number</th>
                                  <th>Supplier / Vendor</th>
                                  <th style={{ textAlign: 'right' }}>Received Qty</th>
                                  <th style={{ textAlign: 'right' }}>Day-Wise Invoice Rate (₹)</th>
                                  <th style={{ textAlign: 'right' }}>Total Inward (₹)</th>
                                  <th style={{ textAlign: 'right' }}>Deflection vs Standard (₹)</th>
                                  <th>Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {m.dayWiseRates.map((d: any, idx: number) => {
                                  const dOverrun = d.rateDeflection > 0.01;
                                  const dSavings = d.rateDeflection < -0.01;
                                  return (
                                    <tr key={d.id || idx}>
                                      <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{idx + 1}</td>
                                      <td style={{ fontWeight: 700 }}>
                                        {new Date(d.receiptDate).toLocaleDateString()}
                                      </td>
                                      <td>
                                        <div style={{ fontWeight: 600 }}>{d.invoiceNumber || 'Direct Inward'}</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                          {d.invoiceDate ? new Date(d.invoiceDate).toLocaleDateString() : '-'}
                                        </div>
                                      </td>
                                      <td style={{ fontFamily: 'monospace', color: 'var(--accent-primary)', fontWeight: 600 }}>
                                        {d.grnNumber}
                                      </td>
                                      <td style={{ fontWeight: 600 }}>
                                        {d.supplierName || 'Primary Vendor'}
                                      </td>
                                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                        {d.receivedQuantity.toLocaleString()} {m.uom}
                                      </td>
                                      <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                                        ₹{d.invoiceUnitRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                        ₹{d.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                      <td style={{ textAlign: 'right', fontWeight: 700, color: dOverrun ? '#dc2626' : dSavings ? '#16a34a' : 'var(--text-muted)' }}>
                                        {d.rateDeflection > 0 ? `+₹${d.rateDeflection.toFixed(2)} (+${d.deflectionPercentage}%)` :
                                         d.rateDeflection < 0 ? `-₹${Math.abs(d.rateDeflection).toFixed(2)} (${d.deflectionPercentage}%)` : '₹0.00'}
                                      </td>
                                      <td>
                                        <button
                                          type="button"
                                          className="btn btn-secondary btn-sm"
                                          style={{ fontSize: '0.75rem', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                          onClick={() => handleOpenInvoiceDetails(d.id)}
                                        >
                                          <Eye size={12} /> View Invoice
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* VIEW B: RAW CHRONOLOGICAL INWARD FEED */
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Inward Date / GRN</th>
                    <th>Invoice No & Date</th>
                    <th>Material Code</th>
                    <th>Material Description</th>
                    <th>Supplier</th>
                    <th>Received Qty</th>
                    <th style={{ textAlign: 'right' }}>Invoice Rate (₹)</th>
                    <th style={{ textAlign: 'right' }}>Total Inward (₹)</th>
                    <th style={{ textAlign: 'right' }}>Standard Rate (₹)</th>
                    <th style={{ textAlign: 'right' }}>Deflection (₹)</th>
                    <th>Deflection %</th>
                    <th>Budget Impact Status</th>
                  </tr>
                </thead>
                <tbody>
                  {inwardRates.length === 0 ? (
                    <tr>
                      <td colSpan={12} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                        No inward invoice rate records found.
                      </td>
                    </tr>
                  ) : (
                    inwardRates.map((r) => {
                      const isOverrun = r.rateDeflection > 0.01;
                      const isSavings = r.rateDeflection < -0.01;
                      return (
                        <tr key={r.id}>
                          <td>
                            <div style={{ fontWeight: 700 }}>{new Date(r.receiptDate).toLocaleDateString()}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontFamily: 'monospace' }}>{r.grnNumber}</div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{r.invoiceNumber || 'N/A'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {r.invoiceDate ? new Date(r.invoiceDate).toLocaleDateString() : '-'}
                            </div>
                          </td>
                          <td style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{r.materialCode}</td>
                          <td style={{ fontWeight: 600 }}>
                            {r.materialName}
                            <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {r.categoryName || 'GENERAL'}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.85rem' }}>{r.supplierName || '-'}</td>
                          <td style={{ fontWeight: 700 }}>{r.receivedQuantity.toLocaleString()} {r.uom}</td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--text-primary)' }}>
                            ₹{r.invoiceUnitRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>
                            ₹{r.totalInvoiceAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                            ₹{r.standardBaseRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: isOverrun ? '#dc2626' : isSavings ? '#16a34a' : 'var(--text-muted)' }}>
                            {r.rateDeflection > 0 ? `+₹${r.rateDeflection.toFixed(2)}` : r.rateDeflection < 0 ? `-₹${Math.abs(r.rateDeflection).toFixed(2)}` : '₹0.00'}
                          </td>
                          <td>
                            <span className={`badge ${isOverrun ? 'badge-outofstock' : isSavings ? 'badge-normal' : 'badge-low'}`}>
                              {r.deflectionPercentage > 0 ? `+${r.deflectionPercentage}%` : `${r.deflectionPercentage}%`}
                            </span>
                          </td>
                          <td>
                            {isOverrun ? (
                              <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <TrendingUp size={14} /> Overrun (+₹{r.batchCostVariance.toLocaleString()})
                              </span>
                            ) : isSavings ? (
                              <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <TrendingDown size={14} /> Savings (-₹{Math.abs(r.batchCostVariance).toLocaleString()})
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Exact Standard Rate
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* TAB 2: SUPPLIER DIRECTORY */}
      {activeTab === 'directory' && (
        <>
          <div style={{ marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Showing <strong>{suppliers.length}</strong> suppliers. Click on any card to view full profile & recent invoices.
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '14px' }}>
            {suppliers.length === 0 ? (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                No suppliers found matching current filter.
              </div>
            ) : (
              suppliers.map((s) => {
                const displayName = (s.supplierName && s.supplierName.trim())
                  ? s.supplierName.trim()
                  : ((s.contactPerson && s.contactPerson.trim()) ? s.contactPerson.trim() : 'Unnamed Supplier');
                const isSelected = selectedSupplierIds.includes(s.id);

                return (
                  <div
                    key={s.id}
                    onClick={() => handleOpenSupplierDetails(s)}
                    className="card"
                    style={{
                      padding: '16px 18px',
                      marginBottom: 0,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      background: !s.isActive ? 'rgba(239, 68, 68, 0.03)' : 'var(--bg-card)',
                      opacity: !s.isActive ? 0.75 : 1
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent-primary)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = isSelected ? 'var(--accent-primary)' : 'var(--border-color)';
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                      {isAdmin && (
                        <div
                          onClick={(e) => toggleSelectSupplier(s.id, e)}
                          style={{
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            color: isSelected ? 'var(--accent-primary)' : 'var(--text-muted)'
                          }}
                        >
                          {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                        </div>
                      )}

                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        background: !s.isActive ? 'rgba(239, 68, 68, 0.1)' : 'rgba(79, 70, 229, 0.1)',
                        color: !s.isActive ? '#ef4444' : '#4f46e5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Building size={18} />
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <h3 style={{
                          fontSize: '0.95rem',
                          fontWeight: 700,
                          lineHeight: '1.3',
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }} title={displayName}>
                          {displayName}
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                          <span className={`badge ${s.isActive ? 'badge-low' : 'badge-outofstock'}`} style={{ fontSize: '0.68rem', padding: '1px 5px' }}>
                            {s.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteModalConfig({
                              isOpen: true,
                              title: `Delete Supplier: ${displayName}`,
                              message: `Are you sure you want to delete supplier '${displayName}'? If transaction history exists, it will be deactivated.`,
                              actionType: 'SINGLE',
                              targetId: s.id
                            });
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#dc2626')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                          title="Delete Supplier (Admin Only)"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}

                      <ChevronRight size={18} color="var(--text-muted)" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* TAB 3: RATE DEFLECTION & MONTH'S BUDGET IMPACT */}
      {activeTab === 'deflection' && (
        <>
          {deflectionData && (
            <div className="kpi-grid" style={{ marginBottom: '24px' }}>
              <div className="kpi-card" style={{ '--kpi-color': '#ef4444' } as React.CSSProperties}>
                <div className="kpi-content">
                  <h4>Monthly Budget Overrun</h4>
                  <div className="kpi-value" style={{ color: '#dc2626' }}>
                    +₹{deflectionData.totalMonthlyBudgetOverrun.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="kpi-subtext">Extra cost from inward price hikes</div>
                </div>
                <div className="kpi-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                  <TrendingUp size={22} />
                </div>
              </div>

              <div className="kpi-card" style={{ '--kpi-color': '#10b981' } as React.CSSProperties}>
                <div className="kpi-content">
                  <h4>Monthly Budget Savings</h4>
                  <div className="kpi-value" style={{ color: '#16a34a' }}>
                    -₹{deflectionData.totalMonthlyBudgetSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="kpi-subtext">Cost reductions from lower rates</div>
                </div>
                <div className="kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                  <TrendingDown size={22} />
                </div>
              </div>

              <div className="kpi-card" style={{ '--kpi-color': deflectionData.netMonthlyBudgetImpact > 0 ? '#f59e0b' : '#0284c7' } as React.CSSProperties}>
                <div className="kpi-content">
                  <h4>Net Monthly Budget Impact</h4>
                  <div className="kpi-value" style={{ color: deflectionData.netMonthlyBudgetImpact > 0 ? '#d97706' : '#0284c7' }}>
                    {deflectionData.netMonthlyBudgetImpact >= 0 ? `+₹${deflectionData.netMonthlyBudgetImpact.toLocaleString()}` : `-₹${Math.abs(deflectionData.netMonthlyBudgetImpact).toLocaleString()}`}
                  </div>
                  <div className="kpi-subtext">Net variance on monthly plant budget</div>
                </div>
                <div className="kpi-icon" style={{ background: 'rgba(2, 132, 199, 0.1)', color: '#0284c7' }}>
                  <DollarSign size={22} />
                </div>
              </div>

              <div className="kpi-card" style={{ '--kpi-color': '#4f46e5' } as React.CSSProperties}>
                <div className="kpi-content">
                  <h4>Items with Price Deflection</h4>
                  <div className="kpi-value">{deflectionData.totalMaterialsWithDeflection} / {deflectionData.totalMaterialsMonitored}</div>
                  <div className="kpi-subtext">Materials with active rate variances</div>
                </div>
                <div className="kpi-icon" style={{ background: 'rgba(79, 70, 229, 0.1)', color: '#4f46e5' }}>
                  <AlertTriangle size={22} />
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
              Material Rate Deflections & Effect on Month's Budget
            </h3>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className={`btn btn-sm ${deflectionFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setDeflectionFilter('ALL')}
              >
                All Materials
              </button>
              <button
                className={`btn btn-sm ${deflectionFilter === 'OVERRUN' ? 'btn-danger' : 'btn-secondary'}`}
                onClick={() => setDeflectionFilter('OVERRUN')}
              >
                🔴 Price Overruns Only
              </button>
              <button
                className={`btn btn-sm ${deflectionFilter === 'SAVINGS' ? 'btn-success' : 'btn-secondary'}`}
                onClick={() => setDeflectionFilter('SAVINGS')}
              >
                🟢 Price Savings Only
              </button>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Material Code</th>
                  <th>Material Description</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Standard Rate (₹)</th>
                  <th style={{ textAlign: 'right' }}>Inward Invoice Rate (₹)</th>
                  <th style={{ textAlign: 'right' }}>Rate Deflection (₹)</th>
                  <th>Deflection %</th>
                  <th>Monthly Requirement</th>
                  <th style={{ textAlign: 'right' }}>Effect on Month's Budget (₹)</th>
                  <th>Latest Inward Invoice</th>
                  <th>Monthly Budget Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeflectionMaterials.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      No materials matching current deflection filter.
                    </td>
                  </tr>
                ) : (
                  filteredDeflectionMaterials.map((m: any) => {
                    const isOverrun = m.status === 'OVERRUN';
                    const isSavings = m.status === 'SAVINGS';
                    return (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{m.materialCode}</td>
                        <td style={{ fontWeight: 600 }}>{m.materialName}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{m.categoryName || 'GENERAL'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          ₹{m.standardBaseRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--text-primary)' }}>
                          ₹{m.latestInvoiceRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: isOverrun ? '#dc2626' : isSavings ? '#16a34a' : 'var(--text-muted)' }}>
                          {m.rateDeflection > 0 ? `+₹${m.rateDeflection.toFixed(2)}` : m.rateDeflection < 0 ? `-₹${Math.abs(m.rateDeflection).toFixed(2)}` : '₹0.00'}
                        </td>
                        <td>
                          <span className={`badge ${isOverrun ? 'badge-outofstock' : isSavings ? 'badge-normal' : 'badge-low'}`}>
                            {m.deflectionPercentage > 0 ? `+${m.deflectionPercentage}%` : `${m.deflectionPercentage}%`}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {m.monthlyRequirement.toLocaleString()} {m.uom}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '0.92rem', color: isOverrun ? '#dc2626' : isSavings ? '#16a34a' : 'var(--text-muted)' }}>
                          {m.monthlyBudgetEffect > 0 ? `+₹${m.monthlyBudgetEffect.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` :
                           m.monthlyBudgetEffect < 0 ? `-₹${Math.abs(m.monthlyBudgetEffect).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00'}
                        </td>
                        <td>
                          <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                            {m.latestInvoiceNumber || 'N/A'}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {m.latestInwardDate ? new Date(m.latestInwardDate).toLocaleDateString() : '-'}
                          </div>
                        </td>
                        <td>
                          {isOverrun ? (
                            <span className="badge badge-outofstock" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <TrendingUp size={13} /> Budget Overrun (+₹{m.monthlyBudgetEffect.toLocaleString()}/mo)
                            </span>
                          ) : isSavings ? (
                            <span className="badge badge-normal" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <TrendingDown size={13} /> Budget Savings (-₹{Math.abs(m.monthlyBudgetEffect).toLocaleString()}/mo)
                            </span>
                          ) : (
                            <span className="badge badge-low">
                              On Target (0.00%)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* SUPPLIER DETAILS MODAL */}
      <Modal
        isOpen={isViewSuppOpen}
        onClose={() => setIsViewSuppOpen(false)}
        title={`Supplier Profile: ${selectedSupplier?.supplierName || selectedSupplier?.contactPerson || 'Vendor Details'}`}
      >
        {selectedSupplier && (
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px',
              background: 'var(--bg-hover)',
              borderRadius: '12px',
              marginBottom: '20px',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, flex: 1 }}>
                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '12px',
                  background: !selectedSupplier.isActive ? 'rgba(239, 68, 68, 0.15)' : 'rgba(79, 70, 229, 0.15)',
                  color: !selectedSupplier.isActive ? '#ef4444' : '#4f46e5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Building size={26} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {selectedSupplier.supplierName || selectedSupplier.contactPerson || 'Unnamed Supplier'}
                  </h3>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className={`badge ${selectedSupplier.isActive ? 'badge-normal' : 'badge-outofstock'}`}>
                      {selectedSupplier.isActive ? 'Active Vendor' : 'Inactive Vendor'}
                    </span>
                    {selectedSupplier.gstNumber && (
                      <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                        GSTIN: <strong>{selectedSupplier.gstNumber}</strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {isAdmin && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${selectedSupplier.isActive ? 'btn-secondary' : 'btn-success'}`}
                    onClick={() => handleToggleActive(selectedSupplier.id)}
                    style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Power size={14} /> {selectedSupplier.isActive ? 'Mark Inactive' : 'Activate'}
                  </button>

                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() =>
                      setDeleteModalConfig({
                        isOpen: true,
                        title: `Delete Supplier: ${selectedSupplier.supplierName}`,
                        message: `Are you sure you want to delete '${selectedSupplier.supplierName}'? (Admin Authorization)`,
                        actionType: 'SINGLE',
                        targetId: selectedSupplier.id
                      })
                    }
                    style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              )}
            </div>

            {/* Contact & Location Details Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div style={{ padding: '12px 14px', background: 'var(--bg-hover)', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users2 size={13} /> Contact Person
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                  {selectedSupplier.contactPerson || 'Not Specified'}
                </div>
              </div>

              <div style={{ padding: '12px 14px', background: 'var(--bg-hover)', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Phone size={13} /> Phone / Mobile
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                  {selectedSupplier.phone ? (
                    <a href={`tel:${selectedSupplier.phone}`} style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>
                      {selectedSupplier.phone}
                    </a>
                  ) : 'Not Specified'}
                </div>
              </div>

              <div style={{ padding: '12px 14px', background: 'var(--bg-hover)', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Mail size={13} /> Email Address
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', wordBreak: 'break-all' }}>
                  {selectedSupplier.email ? (
                    <a href={`mailto:${selectedSupplier.email}`} style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>
                      {selectedSupplier.email}
                    </a>
                  ) : 'Not Specified'}
                </div>
              </div>

              <div style={{ padding: '12px 14px', background: 'var(--bg-hover)', borderRadius: '10px', gridColumn: '1 / -1' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={13} /> Plant / Company Address
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  {selectedSupplier.address || 'Address not on file.'}
                </div>
              </div>
            </div>

            {/* SECTION: LAST FIVE INVOICES FROM THIS SUPPLIER */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={16} color="var(--accent-primary)" />
                  Last 5 Invoices from this Supplier ({lastFiveInvoices.length})
                </h4>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Click any invoice to view complete details & items
                </span>
              </div>

              {loadingInwards ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                  Loading invoice history...
                </div>
              ) : lastFiveInvoices.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', background: 'var(--bg-hover)', borderRadius: '10px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  No invoices recorded yet for this supplier.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {lastFiveInvoices.map((inv) => (
                    <div
                      key={inv.id}
                      onClick={() => handleOpenInvoiceDetails(inv.id)}
                      style={{
                        padding: '12px 16px',
                        background: 'var(--bg-hover)',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        gap: '12px',
                        flexWrap: 'wrap'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent-primary)';
                        e.currentTarget.style.background = 'var(--bg-card)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                        e.currentTarget.style.background = 'var(--bg-hover)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          background: 'rgba(79, 70, 229, 0.1)',
                          color: '#4f46e5',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <FileText size={18} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                            Invoice: <strong>{inv.invoiceNumber || 'No Invoice No'}</strong>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '12px', marginTop: '2px' }}>
                            <span>GRN: <strong style={{ color: 'var(--accent-primary)' }}>{inv.grnNumber}</strong></span>
                            <span>Date: {new Date(inv.receiptDate).toLocaleDateString()}</span>
                            {inv.itemCount && <span>Items: {inv.itemCount}</span>}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Total Amount</div>
                          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                            ₹{inv.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{ fontSize: '0.78rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenInvoiceDetails(inv.id);
                          }}
                        >
                          <Eye size={13} /> View Info
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SECTION: ALL INWARD INVOICE RATES FROM THIS SUPPLIER */}
            {supplierInwards.length > 0 && (
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileSpreadsheet size={16} /> All Inward Invoice Rates Log ({supplierInwards.length} records)
                </h4>

                <div className="table-container" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                  <table className="data-table" style={{ fontSize: '0.82rem' }}>
                    <thead>
                      <tr>
                        <th>Date / GRN</th>
                        <th>Invoice No</th>
                        <th>Material</th>
                        <th>Received Qty</th>
                        <th style={{ textAlign: 'right' }}>Invoice Rate (₹)</th>
                        <th style={{ textAlign: 'right' }}>Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplierInwards.slice(0, 15).map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{new Date(item.receiptDate).toLocaleDateString()}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--accent-primary)' }}>{item.grnNumber}</div>
                          </td>
                          <td>{item.invoiceNumber || '-'}</td>
                          <td style={{ fontWeight: 600 }}>
                            {item.materialCode} - {item.materialName}
                          </td>
                          <td>{item.receivedQuantity} {item.uom}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{item.invoiceUnitRate.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{item.totalInvoiceAmount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="modal-footer" style={{ marginTop: '20px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsViewSuppOpen(false)}>
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* DEDICATED INVOICE DETAILS MODAL */}
      <Modal
        isOpen={isInvoiceDetailOpen}
        onClose={() => setIsInvoiceDetailOpen(false)}
        title={`Invoice / Inward Details: ${selectedInvoiceDetails?.invoiceNumber || selectedInvoiceDetails?.grnNumber || 'Invoice View'}`}
      >
        {loadingInvoiceDetail ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Loading invoice information...
          </div>
        ) : selectedInvoiceDetails ? (
          <div>
            {/* Invoice Header Details */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              padding: '16px',
              background: 'var(--bg-hover)',
              borderRadius: '12px',
              marginBottom: '20px'
            }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Supplier / Vendor</div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  {selectedInvoiceDetails.supplierName || 'N/A'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Supplier Invoice Number</div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--accent-primary)' }}>
                  {selectedInvoiceDetails.invoiceNumber || 'N/A'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Invoice Date</div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                  {selectedInvoiceDetails.invoiceDate ? new Date(selectedInvoiceDetails.invoiceDate).toLocaleDateString() : 'N/A'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>GRN Receipt Number</div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', fontFamily: 'monospace' }}>
                  {selectedInvoiceDetails.grnNumber}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Inward Receipt Date</div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                  {new Date(selectedInvoiceDetails.receiptDate).toLocaleDateString()}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Purchase Order (PO)</div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                  {selectedInvoiceDetails.poNumber || 'Direct Inward'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>DC Number / Vehicle</div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                  {selectedInvoiceDetails.dcNumber || '-'} {selectedInvoiceDetails.vehicleNumber ? `(${selectedInvoiceDetails.vehicleNumber})` : ''}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Received By User</div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                  {selectedInvoiceDetails.receivedBy || 'Store In-Charge'}
                </div>
              </div>
            </div>

            {/* Itemized Table */}
            <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PackageCheck size={16} color="var(--accent-primary)" />
              Inward Material Items & Unit Rates ({selectedInvoiceDetails.items?.length || 0})
            </h4>

            <div className="table-container" style={{ marginBottom: '16px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Material Code</th>
                    <th>Material Description</th>
                    <th>Received Quantity</th>
                    <th style={{ textAlign: 'right' }}>Invoice Unit Rate (₹)</th>
                    <th style={{ textAlign: 'right' }}>Line Item Total (₹)</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoiceDetails.items?.map((item: any, idx: number) => (
                    <tr key={item.id || idx}>
                      <td>{idx + 1}</td>
                      <td style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{item.materialCode}</td>
                      <td style={{ fontWeight: 600 }}>{item.materialName}</td>
                      <td style={{ fontWeight: 700 }}>{item.receivedQuantity} {item.uom}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800 }}>
                        ₹{item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--text-primary)' }}>
                        ₹{item.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.remarks || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total Summary Footer */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 18px',
              background: 'var(--bg-hover)',
              borderRadius: '10px',
              marginBottom: '20px'
            }}>
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Grand Total Invoice Value:</span>
              <span style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--accent-primary)' }}>
                ₹{selectedInvoiceDetails.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsPrintGrnOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Printer size={15} /> Print Invoice / GRN
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsInvoiceDetailOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Printable GRN Document */}
      {isPrintGrnOpen && selectedInvoiceDetails && (
        <PrintableGoodsReceiptNote
          receipt={selectedInvoiceDetails}
          onClose={() => setIsPrintGrnOpen(false)}
        />
      )}

      {/* Admin Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalConfig.isOpen}
        onClose={() => setDeleteModalConfig((prev) => ({ ...prev, isOpen: false }))}
        title={deleteModalConfig.title}
      >
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: '#fee2e2',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto'
          }}>
            <ShieldAlert size={32} />
          </div>

          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '8px' }}>
            Confirm Administrator Deletion
          </h3>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px', lineHeight: '1.5' }}>
            {deleteModalConfig.message}
          </p>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setDeleteModalConfig((prev) => ({ ...prev, isOpen: false }))}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleExecuteDeletion}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Trash2 size={16} /> Yes, Confirm Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Supplier Modal */}
      <Modal isOpen={isAddSuppOpen} onClose={() => setIsAddSuppOpen(false)} title="Register New Vendor / Supplier">
        <form onSubmit={handleAddSupplier}>
          {errorMsg && (
            <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
              <AlertCircle size={15} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
              {errorMsg}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Supplier / Company Name *</label>
            <input type="text" required className="form-control" placeholder="e.g. BALAJI CHEMICALS" value={suppName} onChange={(e) => setSuppName(e.target.value)} />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Contact Person</label>
              <input type="text" className="form-control" placeholder="e.g. Ramesh Kumar" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input type="text" className="form-control" placeholder="e.g. 9845190175" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input type="email" className="form-control" placeholder="sales@supplier.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">GSTIN / Tax ID</label>
              <input type="text" className="form-control" placeholder="e.g. 29AABCS1429B1ZB" value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Address / Plant Location</label>
            <textarea className="form-control" rows={2} placeholder="Industrial area, city, pincode..." value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setIsAddSuppOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary"><CheckCircle size={16} /> Save Supplier</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
