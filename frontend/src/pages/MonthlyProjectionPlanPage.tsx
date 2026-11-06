import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarRange,
  UploadCloud,
  Download,
  FileSpreadsheet,
  TrendingUp,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  Loader2,
  Boxes,
  DollarSign,
  ShieldCheck,
  RefreshCw,
  ArrowRight,
  Info,
  Sliders,
  Plus,
  BarChart3,
  PieChart as PieIcon,
  Check,
  FileText,
  Printer,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
  Zap,
  Activity
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  CartesianGrid
} from 'recharts';
import api from '../services/api';
import { User } from '../types';

interface ProjectionPlanItem {
  id: number;
  materialCode: string;
  materialName: string;
  categoryName: string | null;
  userDepartmentName: string | null;
  defaultUom: string;
  currentStock: number;
  monthlyRequirement: number;
  standardPrice: number;
  projectedCost: number;
  dailyRequirementAverage: number;
  targetSafetyStock: number;
  daysOfStock: number;
  stockStatus: string;
}

interface ProjectionPlanData {
  activeMonth: string;
  targetDaysStock?: number;
  totalMaterials: number;
  totalPlannedMaterials: number;
  totalProjectedQuantity: number;
  totalProjectedCost: number;
  items: ProjectionPlanItem[];
}

export const MonthlyProjectionPlanPage: React.FC<{ user: User | null }> = ({ user }) => {
  const isAdminOrManager = user?.role === 'Admin' || user?.role === 'StoreManager';

  const [activeTab, setActiveTab] = useState<'plan-ledger' | 'procurement-gap' | 'analytics' | 'import-studio'>('plan-ledger');
  const [planData, setPlanData] = useState<ProjectionPlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedHealthStatus, setSelectedHealthStatus] = useState<string>('All');

  // Upload Plan State
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.toLocaleString('default', { month: 'long' })} ${d.getFullYear()}`;
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchPlan = async () => {
    setLoading(true);
    try {
      const res = await api.get('/projection-plan');
      setPlanData(res.data);
      if (res.data?.activeMonth) {
        setSelectedMonth(res.data.activeMonth);
      }
    } catch (err) {
      console.error('Error fetching projection plan', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlan();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadResult(null);
    }
  };

  const handleUploadPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Please select an Excel file (.xlsx or .xls) to upload.');
      return;
    }

    setUploading(true);
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('monthYear', selectedMonth);

      const res = await api.post('/projection-plan/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setUploadResult({
        success: true,
        message: res.data.message,
        details: res.data
      });
      showToast(`✅ Monthly Projection Plan for ${selectedMonth} applied successfully!`);
      setSelectedFile(null);
      fetchPlan();
    } catch (err: any) {
      setUploadResult({
        success: false,
        message: err.response?.data?.message || 'Failed to upload and apply projection plan.'
      });
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const res = await api.get('/projection-plan/template', { responseType: 'blob' });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AMAC_Monthly_Projection_Plan_Template_${new Date().toISOString().slice(0, 7)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast('✅ Downloaded Projection Plan Template (.xlsx)');
    } catch (err) {
      console.error('Error downloading template', err);
      alert('Failed to download template.');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // Enriched Items with Procurement Gaps & Buffer Coverage
  const enrichedItems = useMemo(() => {
    const targetDays = planData?.targetDaysStock || 22;
    return (planData?.items || []).map((item) => {
      const dailyReq = item.dailyRequirementAverage > 0 ? item.dailyRequirementAverage : item.monthlyRequirement / 30;
      const targetBuffer = item.targetSafetyStock > 0 ? item.targetSafetyStock : dailyReq * targetDays;
      const coverageDays = dailyReq > 0 ? item.currentStock / dailyReq : (item.currentStock > 0 ? 999 : 0);
      const deficitQty = Math.max(0, targetBuffer - item.currentStock);
      const deficitCost = deficitQty * item.standardPrice;

      let healthRating: 'optimal' | 'low' | 'critical' | 'outofstock' = 'optimal';
      if (item.currentStock <= 0) healthRating = 'outofstock';
      else if (coverageDays < Math.max(1, Math.round(targetDays * 0.3))) healthRating = 'critical';
      else if (coverageDays < targetDays) healthRating = 'low';

      return {
        ...item,
        dailyReq,
        target22DayBuffer: targetBuffer,
        coverageDays,
        deficitQty,
        deficitCost,
        healthRating
      };
    });
  }, [planData]);

  // Filter Items
  const filteredItems = useMemo(() => {
    return enrichedItems.filter((item) => {
      const matchesSearch =
        search === '' ||
        item.materialCode.toLowerCase().includes(search.toLowerCase()) ||
        item.materialName.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        selectedCategory === 'All' || (item.categoryName || 'GENERAL') === selectedCategory;
      const matchesHealth =
        selectedHealthStatus === 'All' ||
        (selectedHealthStatus === 'Deficit' && item.deficitQty > 0) ||
        (selectedHealthStatus === 'Optimal' && item.healthRating === 'optimal') ||
        (selectedHealthStatus === 'Critical' && (item.healthRating === 'critical' || item.healthRating === 'outofstock'));
      return matchesSearch && matchesCategory && matchesHealth;
    });
  }, [enrichedItems, search, selectedCategory, selectedHealthStatus]);

  const categories = Array.from(
    new Set((planData?.items || []).map((i) => i.categoryName || 'GENERAL'))
  ).sort();

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const targetDays = planData?.targetDaysStock || 22;
    const totalDeficitQty = enrichedItems.reduce((acc, i) => acc + i.deficitQty, 0);
    const totalDeficitCost = enrichedItems.reduce((acc, i) => acc + i.deficitCost, 0);
    const deficitItemsCount = enrichedItems.filter((i) => i.deficitQty > 0).length;
    const optimalItemsCount = enrichedItems.filter((i) => i.healthRating === 'optimal').length;
    const criticalCount = enrichedItems.filter((i) => i.healthRating === 'critical' || i.healthRating === 'outofstock').length;

    return {
      targetDays,
      totalDeficitQty,
      totalDeficitCost,
      deficitItemsCount,
      optimalItemsCount,
      criticalCount,
      twentyTwoDayBufferCost: ((planData?.totalProjectedCost || 0) / 30) * targetDays
    };
  }, [enrichedItems, planData]);

  // Category Distribution for Analytics
  const categoryProjectionData = useMemo(() => {
    const map: { [key: string]: number } = {};
    enrichedItems.forEach((i) => {
      const cat = i.categoryName || 'General';
      map[cat] = (map[cat] || 0) + i.projectedCost;
    });
    return Object.entries(map)
      .map(([name, cost]) => ({ name, cost }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 6);
  }, [enrichedItems]);

  const COLORS = ['#059669', '#2563eb', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];

  return (
    <div className="page-wrapper">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="pbi-toast">
          {toastMessage}
        </div>
      )}

      {/* 1. ENTERPRISE HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
            <span>Home</span>
            <span>/</span>
            <span>Production & Planning</span>
            <span>/</span>
            <span style={{ color: '#059669', fontWeight: 700 }}>Monthly Projection Plan</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Monthly Production Projection Plan
            </h1>
            {planData?.activeMonth && (
              <span
                style={{
                  background: 'rgba(5, 150, 105, 0.12)',
                  color: '#059669',
                  padding: '3px 10px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  border: '1px solid rgba(5, 150, 105, 0.25)'
                }}
              >
                ● ACTIVE: {planData.activeMonth.toUpperCase()}
              </span>
            )}
          </div>
          <p className="page-sub">
            Automated material planning studio calculating monthly requirements, {summaryMetrics.targetDays}-day target safety stocks & procurement replenishment gaps.
          </p>
        </div>

        {/* Master Action Buttons & Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={downloadingTemplate}
            onClick={downloadTemplate}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.8rem' }}
          >
            {downloadingTemplate ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Template (.xlsx)
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchPlan}
            title="Refresh Live Data"
          >
            <RefreshCw size={14} /> Refresh
          </button>

          {isAdminOrManager && (
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'import-studio' ? 'btn-primary' : 'btn-emerald'}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.8rem' }}
              onClick={() => setActiveTab('import-studio')}
            >
              <UploadCloud size={14} /> Import Plan Excel
            </button>
          )}
        </div>
      </div>

      {/* 2. EXECUTIVE METRIC CARDS (Emerald Mint & Azure Theme) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '12px',
          marginBottom: '20px'
        }}
      >
        {/* Card 1: Planned Materials */}
        <div className="pbi-kpi-card" style={{ borderLeft: '4px solid #059669' }}>
          <div className="pbi-kpi-header">
            <span className="pbi-kpi-label">Materials in Plan</span>
            <span className="pbi-pill-green">Active Scope</span>
          </div>
          <div className="pbi-kpi-val text-emerald">
            {planData?.totalPlannedMaterials || 0}{' '}
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>/ {planData?.totalMaterials || 0} SKUs</span>
          </div>
          <div className="pbi-kpi-footer">
            <span>{summaryMetrics.optimalItemsCount} Optimal Buffer</span>
            <span className="text-muted">Coverage: {(((planData?.totalPlannedMaterials || 0) / (planData?.totalMaterials || 1)) * 100).toFixed(0)}%</span>
          </div>
        </div>

        {/* Card 2: Total Projected Consumption Units */}
        <div className="pbi-kpi-card" style={{ borderLeft: '4px solid #2563eb' }}>
          <div className="pbi-kpi-header">
            <span className="pbi-kpi-label">Monthly Demand Volume</span>
            <span className="pbi-pill-blue">Forecast</span>
          </div>
          <div className="pbi-kpi-val text-blue">
            {(planData?.totalProjectedQuantity || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}{' '}
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Units</span>
          </div>
          <div className="pbi-kpi-footer">
            <span>Avg Daily: {((planData?.totalProjectedQuantity || 0) / 30).toLocaleString(undefined, { maximumFractionDigits: 0 })} Units/day</span>
            <span className="text-muted">{planData?.activeMonth || 'Current Month'}</span>
          </div>
        </div>

        {/* Card 3: Total Projected Budget (₹) */}
        <div className="pbi-kpi-card" style={{ borderLeft: '4px solid #d97706' }}>
          <div className="pbi-kpi-header">
            <span className="pbi-kpi-label">Projected Plan Budget</span>
            <span className="pbi-pill-amber">Gross Value</span>
          </div>
          <div className="pbi-kpi-val text-amber">
            ₹{((planData?.totalProjectedCost || 0) / 100000).toFixed(2)} Lakhs
          </div>
          <div className="pbi-kpi-footer">
            <span>₹{(planData?.totalProjectedCost || 0).toLocaleString()}</span>
            <span className="text-muted">Standard Rates</span>
          </div>
        </div>

        {/* Card 4: Target Safety Buffer Capital */}
        <div className="pbi-kpi-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <div className="pbi-kpi-header">
            <span className="pbi-kpi-label">{summaryMetrics.targetDays}-Day Safety Stock Value</span>
            <span className="pbi-pill-purple">Configured SLA</span>
          </div>
          <div className="pbi-kpi-val text-purple">
            ₹{(summaryMetrics.twentyTwoDayBufferCost / 100000).toFixed(2)} Lakhs
          </div>
          <div className="pbi-kpi-footer">
            <span>Target Buffer: {summaryMetrics.targetDays} Work Days</span>
            <span className="text-muted">Safety Capital</span>
          </div>
        </div>

        {/* Card 5: Net Replenishment Deficit (Action Required) */}
        <div className="pbi-kpi-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div className="pbi-kpi-header">
            <span className="pbi-kpi-label">Procurement Deficit Gap</span>
            <span className="pbi-pill-red">{summaryMetrics.deficitItemsCount} Deficit SKUs</span>
          </div>
          <div className="pbi-kpi-val text-red">
            ₹{(summaryMetrics.totalDeficitCost / 100000).toFixed(2)} Lakhs
          </div>
          <div className="pbi-kpi-footer">
            <span>{summaryMetrics.totalDeficitQty.toLocaleString(undefined, { maximumFractionDigits: 0 })} Units Required</span>
            <span className="text-red font-bold">{summaryMetrics.criticalCount} Critical</span>
          </div>
        </div>
      </div>

      {/* 3. NAVIGATION SECTION TABS */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '18px', gap: '8px' }}>
        <button
          className={`pbi-tab-btn ${activeTab === 'plan-ledger' ? 'active' : ''}`}
          onClick={() => setActiveTab('plan-ledger')}
          style={{ fontSize: '0.84rem', padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <TrendingUp size={15} /> Monthly Projection & Safety Stock Ledger
        </button>
        <button
          className={`pbi-tab-btn ${activeTab === 'procurement-gap' ? 'active' : ''}`}
          onClick={() => setActiveTab('procurement-gap')}
          style={{ fontSize: '0.84rem', padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <ShieldAlert size={15} /> Procurement Deficit Calculator ({summaryMetrics.deficitItemsCount})
        </button>
        <button
          className={`pbi-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
          style={{ fontSize: '0.84rem', padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <BarChart3 size={15} /> Category Budget Analytics
        </button>
        {isAdminOrManager && (
          <button
            className={`pbi-tab-btn ${activeTab === 'import-studio' ? 'active' : ''}`}
            onClick={() => setActiveTab('import-studio')}
            style={{ fontSize: '0.84rem', padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <UploadCloud size={15} /> Excel Upload & Plan Studio
          </button>
        )}
      </div>

      {/* =========================================================================
          TAB 1: MONTHLY PROJECTION & SAFETY STOCK LEDGER
         ========================================================================= */}
      {activeTab === 'plan-ledger' && (
        <div>
          {/* Filter & Search Bar */}
          <div className="card" style={{ padding: '12px 18px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '280px' }}>
                <div style={{ position: 'relative', width: '100%', maxWidth: '340px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search material code or description..."
                    style={{ paddingLeft: '32px', fontSize: '0.82rem', height: '34px' }}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <select
                  className="pbi-filter-select"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="All">Category: All ({categories.length})</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <select
                  className="pbi-filter-select"
                  value={selectedHealthStatus}
                  onChange={(e) => setSelectedHealthStatus(e.target.value)}
                >
                  <option value="All">Buffer Health: All</option>
                  <option value="Deficit">Replenishment Deficit Only ({summaryMetrics.deficitItemsCount})</option>
                  <option value="Critical">Critical & Out of Stock ({summaryMetrics.criticalCount})</option>
                  <option value="Optimal">Optimal Safe Buffer ({summaryMetrics.optimalItemsCount})</option>
                </select>
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Showing <strong>{filteredItems.length}</strong> of <strong>{planData?.totalMaterials || 0}</strong> items
              </div>
            </div>
          </div>

          {/* High-Density Data Table */}
          <div className="table-container" style={{ border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <table className="pbi-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Material Description</th>
                  <th>Category</th>
                  <th>UOM</th>
                  <th style={{ textAlign: 'right' }}>Current Stock</th>
                  <th style={{ textAlign: 'right', background: 'rgba(5, 150, 105, 0.08)', color: '#059669' }}>
                    Monthly Req [B]
                  </th>
                  <th style={{ textAlign: 'right' }}>Daily Avg (Req/30)</th>
                  <th style={{ textAlign: 'right', background: 'rgba(139, 92, 246, 0.08)', color: '#7c3aed' }}>
                    {summaryMetrics.targetDays}-Day Target Buffer
                  </th>
                  <th style={{ textAlign: 'right' }}>Std Price (₹)</th>
                  <th style={{ textAlign: 'right' }}>Projected Cost (₹)</th>
                  <th style={{ textAlign: 'center' }}>Days of Stock</th>
                  <th>Buffer Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={12} style={{ textAlign: 'center', padding: '40px' }}>
                      <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px auto', display: 'block', color: '#059669' }} />
                      Loading monthly projection plan ledger...
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      No materials found matching your search or filters.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 800, color: '#059669' }}>{item.materialCode}</td>
                      <td style={{ fontWeight: 600, maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.materialName}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                          {item.categoryName || 'GENERAL'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700 }}>{item.defaultUom}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        {item.currentStock.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 800,
                          color: item.monthlyRequirement > 0 ? '#059669' : 'var(--text-muted)',
                          background: 'rgba(5, 150, 105, 0.04)'
                        }}
                      >
                        {item.monthlyRequirement.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </td>
                      <td style={{ textAlign: 'right', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                        {item.dailyReq.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 700,
                          color: '#7c3aed',
                          background: 'rgba(139, 92, 246, 0.04)'
                        }}
                      >
                        {item.target22DayBuffer.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{item.standardPrice.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#d97706' }}>
                        ₹{item.projectedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>
                        <span
                          style={{
                            color:
                              item.coverageDays <= 0 ? '#dc2626' : item.coverageDays < 7 ? '#dc2626' : item.coverageDays < 22 ? '#d97706' : '#059669'
                          }}
                        >
                          {item.coverageDays < 999 ? `${item.coverageDays.toFixed(1)} Days` : '999+ Days'}
                        </span>
                      </td>
                      <td>
                        {item.healthRating === 'optimal' && <span className="pbi-pill-green">● Optimal ({item.coverageDays.toFixed(0)}d)</span>}
                        {item.healthRating === 'low' && <span className="pbi-pill-amber">▲ Low Buffer ({item.coverageDays.toFixed(0)}d)</span>}
                        {item.healthRating === 'critical' && <span className="pbi-pill-red">⚠️ Critical ({item.coverageDays.toFixed(0)}d)</span>}
                        {item.healthRating === 'outofstock' && <span className="pbi-pill-red">⚫ Out of Stock</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredItems.length > 0 && (
                <tfoot>
                  <tr style={{ background: 'var(--bg-secondary)', fontWeight: 800, fontSize: '0.78rem' }}>
                    <td colSpan={5} style={{ textAlign: 'right' }}>PLAN TOTALS:</td>
                    <td style={{ textAlign: 'right', color: '#059669', fontSize: '0.88rem' }}>
                      {filteredItems.reduce((acc, i) => acc + i.monthlyRequirement, 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    </td>
                    <td colSpan={3}></td>
                    <td style={{ textAlign: 'right', color: '#d97706', fontSize: '0.88rem' }}>
                      ₹{filteredItems.reduce((acc, i) => acc + i.projectedCost, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: PROCUREMENT DEFICIT CALCULATOR (Actionable Reorder Gap)
         ========================================================================= */}
      {activeTab === 'procurement-gap' && (
        <div>
          <div className="pbi-summary-card" style={{ marginBottom: '16px' }}>
            <div className="pbi-summary-icon">
              <ShieldAlert size={16} color="#ef4444" />
            </div>
            <div className="pbi-summary-text">
              <strong>Replenishment Deficit Analysis:</strong> Total required purchase capital to bring all materials up to the {summaryMetrics.targetDays}-day safety buffer is{' '}
              <strong className="text-red">₹{(summaryMetrics.totalDeficitCost / 100000).toFixed(2)} Lakhs</strong> across {summaryMetrics.deficitItemsCount} items.
            </div>
          </div>

          <div className="table-container" style={{ border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <table className="pbi-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Material Description</th>
                  <th>UOM</th>
                  <th style={{ textAlign: 'right' }}>Current Stock</th>
                  <th style={{ textAlign: 'right' }}>{summaryMetrics.targetDays}-Day Target Buffer</th>
                  <th style={{ textAlign: 'right', background: 'rgba(239, 68, 68, 0.08)', color: '#dc2626' }}>
                    Deficit Replenishment Gap
                  </th>
                  <th style={{ textAlign: 'right' }}>Unit Rate (₹)</th>
                  <th style={{ textAlign: 'right', background: 'rgba(239, 68, 68, 0.08)', color: '#dc2626' }}>
                    Est Purchase Cost (₹)
                  </th>
                  <th style={{ textAlign: 'center' }}>Days of Stock</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                {enrichedItems
                  .filter((i) => i.deficitQty > 0)
                  .sort((a, b) => b.deficitCost - a.deficitCost)
                  .map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 800, color: '#dc2626' }}>{item.materialCode}</td>
                      <td style={{ fontWeight: 600 }}>{item.materialName}</td>
                      <td style={{ fontWeight: 700 }}>{item.defaultUom}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: item.currentStock <= 0 ? '#dc2626' : 'var(--text-primary)' }}>
                        {item.currentStock.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {item.target22DayBuffer.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#dc2626', background: 'rgba(239, 68, 68, 0.04)' }}>
                        +{item.deficitQty.toLocaleString(undefined, { maximumFractionDigits: 1 })} {item.defaultUom}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{item.standardPrice.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#dc2626', background: 'rgba(239, 68, 68, 0.04)' }}>
                        ₹{item.deficitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>
                        <span style={{ color: item.coverageDays <= 0 ? '#dc2626' : '#d97706' }}>
                          {item.coverageDays.toFixed(1)} Days
                        </span>
                      </td>
                      <td>
                        {item.currentStock <= 0 ? (
                          <span className="pbi-badge-out">EMERGENCY (0 STOCK)</span>
                        ) : item.coverageDays < 7 ? (
                          <span className="pbi-badge-crit">CRITICAL (&lt;7d)</span>
                        ) : (
                          <span className="pbi-pill-amber">REORDER NEEDED</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: CATEGORY BUDGET ANALYTICS
         ========================================================================= */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '16px' }}>
          {/* Chart 1: Category Budget Ranking */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <BarChart3 size={16} color="#059669" /> Top Category Projected Spend Ranking (₹)
              </div>
            </div>
            <div style={{ height: 260, width: '100%' }}>
              <ResponsiveContainer>
                <BarChart data={categoryProjectionData} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis type="number" stroke="var(--text-muted)" fontSize={11} tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`} />
                  <YAxis type="category" dataKey="name" stroke="var(--text-muted)" fontSize={11} width={130} />
                  <Tooltip formatter={(v: any) => `₹${Number(v).toLocaleString()}`} />
                  <Bar dataKey="cost" name="Projected Budget (₹)" fill="#059669" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Category Share Pie */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <PieIcon size={16} color="#2563eb" /> Category Share of Monthly Requirement Budget (%)
              </div>
            </div>
            <div style={{ height: 260, width: '100%' }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={categoryProjectionData}
                    dataKey="cost"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {categoryProjectionData.map((_, idx) => (
                      <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => `₹${Number(v).toLocaleString()}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: EXCEL UPLOAD & PLAN STUDIO
         ========================================================================= */}
      {activeTab === 'import-studio' && isAdminOrManager && (
        <div className="card" style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'rgba(5, 150, 105, 0.12)',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <UploadCloud size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>Import Monthly Projection Plan Spreadsheet</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                Upload the monthly projection plan Excel file to automatically calibrate all monthly requirements & safety stocks across the system.
              </p>
            </div>
          </div>

          {uploadResult && (
            <div
              style={{
                padding: '14px 18px',
                borderRadius: '8px',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: uploadResult.success ? '#dcfce7' : '#fee2e2',
                color: uploadResult.success ? '#166534' : '#991b1b',
                border: `1px solid ${uploadResult.success ? '#86efac' : '#fca5a5'}`,
                fontWeight: 600,
                fontSize: '0.88rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {uploadResult.success ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                {uploadResult.message}
              </div>
              <button
                type="button"
                onClick={() => setUploadResult(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 800, color: 'inherit' }}
              >
                ✕
              </button>
            </div>
          )}

          <form onSubmit={handleUploadPlan} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', marginBottom: '6px' }}>
                Plan Target Month & Year *
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. August 2026"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', marginBottom: '6px' }}>
                Select Projection Plan Excel File (.xlsx, .xls) *
              </label>
              <input
                type="file"
                accept=".xlsx, .xls"
                className="form-control"
                onChange={handleFileChange}
                required
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={downloadTemplate}
                disabled={downloadingTemplate}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Download size={14} /> Download Clean Template
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={uploading || !selectedFile}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#059669', borderColor: '#059669', fontWeight: 700 }}
              >
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                {uploading ? 'Processing & Calibrating Plan...' : 'Upload & Apply Projection Plan'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
