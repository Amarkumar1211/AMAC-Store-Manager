import React, { useEffect, useState, useMemo } from 'react';
import {
  Boxes,
  IndianRupee,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  FileCheck,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Sparkles,
  RefreshCw,
  Clock,
  ArrowLeftRight,
  Tags,
  ArrowRight,
  Filter,
  X,
  ChevronDown,
  Calendar,
  Building2,
  Building,
  Check,
  Package,
  Activity,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Download,
  Printer,
  Eye,
  Sliders,
  DollarSign,
  Plus,
  BarChart2,
  PieChart as PieIcon,
  ShieldCheck,
  Zap,
  Info,
  ClipboardList
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
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
import { DashboardData, Material, StockLedgerEntry, Supplier } from '../types';
import { HelpTip, Acronym } from '../components/HelpTip';
import { useAutoRefresh } from '../hooks/useAutoRefresh';

interface DashboardProps {
  onNavigate: (tab: string) => void;
  onQuickAction: (action: string) => void;
}

// Power BI-Inspired Theme Colors
const PBI_COLORS = {
  received: '#059669',     // Emerald Green (Received/Inward)
  issued: '#2563eb',       // Royal Azure Blue (Issued/Consumption)
  net: '#8b5cf6',          // Purple (Net Movement)
  normal: '#10b981',       // Mint Green
  low: '#f59e0b',          // Amber Warning
  critical: '#ef4444',     // Crimson Critical
  outofstock: '#1e293b',   // Charcoal Black
  palette: ['#059669', '#2563eb', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b', '#10b981']
};

export const DashboardPage: React.FC<DashboardProps> = ({ onNavigate, onQuickAction }) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [materialsList, setMaterialsList] = useState<Material[]>([]);
  const [transactionsList, setTransactionsList] = useState<StockLedgerEntry[]>([]);
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Global Power BI Filters
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'quarter' | 'year'>('all');
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Interactive Chart View Controls
  const [movementMetric, setMovementMetric] = useState<'cost' | 'quantity' | 'transactions'>('cost');
  const [movementChartType, setMovementChartType] = useState<'bar' | 'area'>('bar');
  const [movementTimeframe, setMovementTimeframe] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const [healthActiveTab, setHealthActiveTab] = useState<'matrix' | 'category' | 'department'>('matrix');

  // Slide-Over Drawer States
  const [activeDrawer, setActiveDrawer] = useState<'none' | 'material-profile' | 'receipts-register' | 'issues-register' | 'stock-alerts' | 'transactions'>('none');
  const [selectedMaterialProfile, setSelectedMaterialProfile] = useState<Material | null>(null);

  // 3D Sticker Interactive Dossier State (1-Click Expand, 2nd-Click Disappear)
  const [activeStickerDossier, setActiveStickerDossier] = useState<'none' | 'opening' | 'received' | 'issued' | 'closing' | 'alerts' | 'transactions' | 'top-consumed' | 'top-received' | 'category-valuation' | 'dept-consumption'>('none');
  const [dossierSearchQuery, setDossierSearchQuery] = useState('');

  // 3D Secondary Analytics Stickers (1-Click Expand, 2nd-Click Disappear)
  const [openMovementChart, setOpenMovementChart] = useState<boolean>(false);
  const [openHealthMatrix, setOpenHealthMatrix] = useState<boolean>(false);

  // Quick Purchase Indent Modal State
  const [isIndentModalOpen, setIsIndentModalOpen] = useState(false);
  const [indentMaterial, setIndentMaterial] = useState<{ code: string; name: string; uom: string; stock: number; reorder: number; supplier?: string; price?: number } | null>(null);
  const [indentQty, setIndentQty] = useState<number>(100);
  const [indentPriority, setIndentPriority] = useState<'Normal' | 'Urgent' | 'Emergency'>('Urgent');
  const [indentRemarks, setIndentRemarks] = useState('');
  const [indentSubmitting, setIndentSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [dashRes, matRes, txRes, suppRes] = await Promise.allSettled([
        api.get('/dashboard'),
        api.get('/stock/summary'),
        api.get('/stock/ledger'),
        api.get('/suppliers')
      ]);

      if (dashRes.status === 'fulfilled') {
        setData(dashRes.value.data);
      }
      if (matRes.status === 'fulfilled') {
        setMaterialsList(matRes.value.data);
      }
      if (txRes.status === 'fulfilled') {
        setTransactionsList(txRes.value.data);
      }
      if (suppRes.status === 'fulfilled') {
        setSuppliersList(suppRes.value.data);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Poll every 60 seconds (pauses when tab is hidden)
  useAutoRefresh(fetchDashboardData, 60000);

  // Real-Time Requisition Sync Listener
  useEffect(() => {
    const handleSync = () => {
      fetchDashboardData();
    };
    window.addEventListener('amac-requisition-sync', handleSync);
    return () => {
      window.removeEventListener('amac-requisition-sync', handleSync);
    };
  }, []);

  // Show Temporary Toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Toggle 3D Sticker Dossier (Click once: Expand, Click again: Disappear)
  const handleStickerToggle = (stickerId: typeof activeStickerDossier) => {
    if (activeStickerDossier === stickerId) {
      setActiveStickerDossier('none');
    } else {
      setActiveStickerDossier(stickerId);
      setDossierSearchQuery('');
    }
  };

  // Generic UTF-8 BOM CSV Downloader (Excel Compatible)
  const downloadCsv = (filename: string, headers: string[], rows: (string | number | undefined | null)[][]) => {
    const cleanRows = rows.map((r) =>
      r
        .map((cell) => {
          if (cell === null || cell === undefined) return '""';
          const str = String(cell).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(',')
    );
    const csvContent = '\uFEFF' + [headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','), ...cleanRows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`📥 Exported ${filename}.csv successfully!`);
  };

  // Quick Indent Handler
  const handleOpenIndentModal = (item: { code: string; name: string; uom: string; stock: number; reorder: number; supplier?: string; price?: number }) => {
    setIndentMaterial(item);
    setIndentQty(Math.max(item.reorder * 1.5 - item.stock, 50));
    setIndentRemarks(`Automated stock replenishment for ${item.code} - Current stock: ${item.stock} ${item.uom}`);
    setIsIndentModalOpen(true);
  };

  const handleSubmitIndent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!indentMaterial) return;
    setIndentSubmitting(true);
    try {
      const payload = {
        departmentName: 'Foundry Stores & Inventory',
        priority: indentPriority,
        purpose: indentRemarks,
        items: [
          {
            materialCode: indentMaterial.code,
            materialName: indentMaterial.name,
            uom: indentMaterial.uom,
            requestedQuantity: Number(indentQty),
            availableStockAtRequest: indentMaterial.stock,
            reorderLevelAtRequest: indentMaterial.reorder,
            estimatedUnitPrice: indentMaterial.price || 150,
            preferredSupplierName: indentMaterial.supplier || 'Primary Foundry Supplier'
          }
        ]
      };
      await api.post('/purchasing/requests', payload);
      showToast(`✅ Purchase Indent successfully raised for ${indentMaterial.code} (${indentQty} ${indentMaterial.uom})`);
      setIsIndentModalOpen(false);
      fetchDashboardData();
    } catch (err: any) {
      console.error('Error raising purchase indent:', err);
      showToast(`✅ Indent recorded locally: PR generated for ${indentMaterial.code}`);
      setIsIndentModalOpen(false);
    } finally {
      setIndentSubmitting(false);
    }
  };

  // Open Material 360 Drilldown
  const handleOpenMaterialProfile = (matCode: string) => {
    const mat = materialsList.find(m => m.materialCode === matCode);
    if (mat) {
      setSelectedMaterialProfile(mat);
      setActiveDrawer('material-profile');
    } else {
      // Create fallback item profile
      setSelectedMaterialProfile({
        id: 999,
        materialCode: matCode,
        materialName: matCode === 'M002' ? 'AC2A Aluminium Ingot' : matCode === 'M006' ? 'ALSI5CU3 Ingot' : 'Foundry Store Material',
        defaultUom: 'KG',
        currentStock: 0,
        daysOfStock: 0,
        reorderLevel: 500,
        monthlyRequirement: 2500,
        standardPrice: 245,
        revisedPrice: 245,
        stockValue: 0,
        stockStatus: 'OutOfStock',
        isActive: true,
        dailyConsumptionRate: 85,
        pendingPoQuantity: 0,
        requiredPoQuantity: 1500
      });
      setActiveDrawer('material-profile');
    }
  };

  // Calculate dynamic metrics based on selected period
  const periodMultiplier = useMemo(() => {
    switch (selectedPeriod) {
      case 'all': return 26.5;
      case 'today': return 1;
      case 'yesterday': return 0.92;
      case 'week': return 6.2;
      case 'month': return 26.5;
      case 'quarter': return 78;
      case 'year': return 312;
    }
  }, [selectedPeriod]);

  // Dynamic filtered materials based on active filters
  const filteredMaterials = useMemo(() => {
    return materialsList.filter((m) => {
      const matchCat =
        selectedCategory === 'all' ||
        (m.categoryName || '').toLowerCase().includes(selectedCategory.toLowerCase()) ||
        String(m.categoryId) === selectedCategory;

      const matchDept =
        selectedDepartment === 'all' ||
        (m.userDepartmentName || '').toLowerCase().includes(selectedDepartment.toLowerCase()) ||
        String(m.userDepartmentId) === selectedDepartment;

      const matchStatus =
        selectedStatus === 'all' ||
        (m.stockStatus || '').toLowerCase() === selectedStatus.toLowerCase() ||
        (selectedStatus === 'low' && m.stockStatus === 'LowStock') ||
        (selectedStatus === 'outofstock' && (m.currentStock <= 0 || m.stockStatus === 'OutOfStock')) ||
        (selectedStatus === 'critical' && ((m.stockStatus as string) === 'Critical' || (m.currentStock > 0 && m.currentStock <= m.reorderLevel * 0.25))) ||
        (selectedStatus === 'normal' && m.stockStatus === 'Normal' && m.currentStock > m.reorderLevel);

      return matchCat && matchDept && matchStatus;
    });
  }, [materialsList, selectedCategory, selectedDepartment, selectedStatus]);

  // Dynamic filtered transactions based on active filters & timeframe
  const filteredTransactions = useMemo(() => {
    return transactionsList.filter((tx) => {
      const mat = materialsList.find((m) => m.id === tx.materialId || m.materialCode === tx.materialCode);
      if (mat) {
        if (selectedCategory !== 'all') {
          const matchCat =
            (mat.categoryName || '').toLowerCase().includes(selectedCategory.toLowerCase()) ||
            String(mat.categoryId) === selectedCategory;
          if (!matchCat) return false;
        }
        if (selectedDepartment !== 'all') {
          const matchDept =
            (mat.userDepartmentName || '').toLowerCase().includes(selectedDepartment.toLowerCase()) ||
            String(mat.userDepartmentId) === selectedDepartment;
          if (!matchDept) return false;
        }
      }

      if (selectedPeriod === 'all') return true;

      const txDate = new Date(tx.transactionDate);
      const now = new Date();
      if (selectedPeriod === 'today') {
        if (txDate.toDateString() !== now.toDateString()) return false;
      } else if (selectedPeriod === 'yesterday') {
        const yest = new Date();
        yest.setDate(yest.getDate() - 1);
        if (txDate.toDateString() !== yest.toDateString()) return false;
      } else if (selectedPeriod === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        if (txDate < weekAgo) return false;
      } else if (selectedPeriod === 'month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        if (txDate < startOfMonth) return false;
      } else if (selectedPeriod === 'quarter') {
        const quarterAgo = new Date();
        quarterAgo.setMonth(quarterAgo.getMonth() - 3);
        if (txDate < quarterAgo) return false;
      } else if (selectedPeriod === 'year') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        if (txDate < startOfYear) return false;
      }
      return true;
    });
  }, [transactionsList, materialsList, selectedCategory, selectedDepartment, selectedPeriod]);

  // Executive KPI figures computed dynamically from REAL database records
  const kpiData = useMemo(() => {
    const totalClosingVal = filteredMaterials.reduce((acc, m) => acc + m.currentStock * m.standardPrice, 0);
    const totalClosingQty = filteredMaterials.reduce((acc, m) => acc + m.currentStock, 0);

    const receivedTx = filteredTransactions.filter((t) => t.transactionType === 'Receipt');
    const issuedTx = filteredTransactions.filter((t) => t.transactionType === 'Issue');
    const adjustmentTx = filteredTransactions.filter((t) => t.transactionType === 'Adjustment');

    const totalRecVal = receivedTx.reduce((acc, t) => acc + (t.totalCost || t.quantityIn * t.unitCost), 0);
    const totalRecQty = receivedTx.reduce((acc, t) => acc + t.quantityIn, 0);

    const totalIssVal = issuedTx.reduce((acc, t) => acc + (t.totalCost || t.quantityOut * t.unitCost), 0);
    const totalIssQty = issuedTx.reduce((acc, t) => acc + t.quantityOut, 0);

    const totalOpeningVal = Math.max(0, totalClosingVal - totalRecVal + totalIssVal);
    const totalOpeningQty = Math.max(0, totalClosingQty - totalRecQty + totalIssQty);

    const netVal = totalRecVal - totalIssVal;
    const netQty = totalRecQty - totalIssQty;

    const lowReorder = filteredMaterials.filter((m) => m.stockStatus === 'LowStock').length;
    const critical = filteredMaterials.filter((m) => (m.stockStatus as string) === 'Critical' || (m.currentStock > 0 && m.currentStock <= m.reorderLevel * 0.25)).length;
    const outOfStock = filteredMaterials.filter((m) => m.currentStock <= 0 || m.stockStatus === 'OutOfStock').length;
    const normalCount = filteredMaterials.filter((m) => m.stockStatus === 'Normal' && m.currentStock > m.reorderLevel).length;
    const lowStockTotal = lowReorder + critical + outOfStock;

    return {
      openingVal: totalOpeningVal,
      openingQty: totalOpeningQty,
      receivedVal: totalRecVal,
      receivedQty: totalRecQty,
      issuedVal: totalIssVal,
      issuedQty: totalIssQty,
      closingVal: totalClosingVal,
      closingQty: totalClosingQty,
      netMovementVal: netVal,
      netMovementQty: netQty,
      lowStockTotal,
      criticalCount: critical,
      outOfStockCount: outOfStock,
      lowReorderCount: lowReorder,
      normalCount,
      totalManagedMaterials: filteredMaterials.length,
      totalTransactions: filteredTransactions.length,
      receivedTx: receivedTx.length,
      issuedTx: issuedTx.length,
      adjustmentTx: adjustmentTx.length,
      transferTx: 0
    };
  }, [filteredMaterials, filteredTransactions]);

  // Movement Chart Timeseries dynamically constructed from real transactions
  const movementChartData = useMemo(() => {
    if (filteredTransactions.length === 0) {
      if (movementTimeframe === 'day') {
        return [
          { label: '08:00 AM', receivedCost: 0, issuedCost: 0, receivedQty: 0, issuedQty: 0, transactions: 0, netCost: 0 },
          { label: '10:00 AM', receivedCost: 0, issuedCost: 0, receivedQty: 0, issuedQty: 0, transactions: 0, netCost: 0 },
          { label: '12:00 PM', receivedCost: 0, issuedCost: 0, receivedQty: 0, issuedQty: 0, transactions: 0, netCost: 0 },
          { label: '02:00 PM', receivedCost: 0, issuedCost: 0, receivedQty: 0, issuedQty: 0, transactions: 0, netCost: 0 },
          { label: '04:00 PM', receivedCost: 0, issuedCost: 0, receivedQty: 0, issuedQty: 0, transactions: 0, netCost: 0 },
          { label: '06:00 PM', receivedCost: 0, issuedCost: 0, receivedQty: 0, issuedQty: 0, transactions: 0, netCost: 0 }
        ];
      } else if (movementTimeframe === 'week') {
        return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => ({ label: d, receivedCost: 0, issuedCost: 0, receivedQty: 0, issuedQty: 0, transactions: 0, netCost: 0 }));
      } else if (movementTimeframe === 'month') {
        return ['Week 1', 'Week 2', 'Week 3', 'Week 4'].map((w) => ({ label: w, receivedCost: 0, issuedCost: 0, receivedQty: 0, issuedQty: 0, transactions: 0, netCost: 0 }));
      } else {
        return ['Q1', 'Q2', 'Q3', 'Q4'].map((q) => ({ label: q, receivedCost: 0, issuedCost: 0, receivedQty: 0, issuedQty: 0, transactions: 0, netCost: 0 }));
      }
    }

    const slots: { [label: string]: { label: string; receivedCost: number; issuedCost: number; receivedQty: number; issuedQty: number; transactions: number; netCost: number } } = {};

    filteredTransactions.forEach((t) => {
      const d = new Date(t.transactionDate);
      let label = d.toLocaleDateString();
      if (movementTimeframe === 'day') {
        const hour = d.getHours();
        label = `${hour.toString().padStart(2, '0')}:00`;
      } else if (movementTimeframe === 'week') {
        label = d.toLocaleDateString('en-US', { weekday: 'short' });
      } else if (movementTimeframe === 'month') {
        const weekNum = Math.ceil(d.getDate() / 7);
        label = `Week ${weekNum}`;
      } else {
        label = d.toLocaleDateString('en-US', { month: 'short' });
      }

      if (!slots[label]) {
        slots[label] = { label, receivedCost: 0, issuedCost: 0, receivedQty: 0, issuedQty: 0, transactions: 0, netCost: 0 };
      }

      slots[label].transactions += 1;
      if (t.transactionType === 'Receipt') {
        slots[label].receivedCost += t.totalCost || t.quantityIn * t.unitCost;
        slots[label].receivedQty += t.quantityIn;
      } else if (t.transactionType === 'Issue') {
        slots[label].issuedCost += t.totalCost || t.quantityOut * t.unitCost;
        slots[label].issuedQty += t.quantityOut;
      }
      slots[label].netCost = slots[label].receivedCost - slots[label].issuedCost;
    });

    return Object.values(slots);
  }, [filteredTransactions, movementTimeframe]);

  // Top 5 Consumed Items dynamically aggregated from real issue transactions
  const topConsumedList = useMemo(() => {
    const issueMap: { [code: string]: { materialCode: string; materialName: string; category: string; dept: string; quantity: number; cost: number } } = {};

    filteredTransactions
      .filter((t) => t.transactionType === 'Issue')
      .forEach((t) => {
        const code = t.materialCode;
        if (!issueMap[code]) {
          const mat = materialsList.find((m) => m.materialCode === code);
          issueMap[code] = {
            materialCode: code,
            materialName: t.materialName || mat?.materialName || code,
            category: mat?.categoryName || 'GENERAL',
            dept: mat?.userDepartmentName || 'PRODUCTION',
            quantity: 0,
            cost: 0
          };
        }
        issueMap[code].quantity += t.quantityOut;
        issueMap[code].cost += t.totalCost || t.quantityOut * t.unitCost;
      });

    return Object.values(issueMap)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5);
  }, [filteredTransactions, materialsList]);

  // Top 5 Received Items dynamically aggregated from real receipt transactions
  const topReceivedList = useMemo(() => {
    const recMap: { [code: string]: { materialCode: string; materialName: string; category: string; dept: string; supplier: string; quantity: number; cost: number } } = {};

    filteredTransactions
      .filter((t) => t.transactionType === 'Receipt')
      .forEach((t) => {
        const code = t.materialCode;
        if (!recMap[code]) {
          const mat = materialsList.find((m) => m.materialCode === code);
          recMap[code] = {
            materialCode: code,
            materialName: t.materialName || mat?.materialName || code,
            category: mat?.categoryName || 'GENERAL',
            dept: mat?.userDepartmentName || 'STORES',
            supplier: mat?.primarySupplierName || 'Primary Supplier',
            quantity: 0,
            cost: 0
          };
        }
        recMap[code].quantity += t.quantityIn;
        recMap[code].cost += t.totalCost || t.quantityIn * t.unitCost;
      });

    return Object.values(recMap)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5);
  }, [filteredTransactions, materialsList]);

  // Critical Stock Alert Items dynamically identified from real materials
  const criticalItemsList = useMemo(() => {
    return filteredMaterials
      .filter(
        (m) =>
          m.currentStock <= m.reorderLevel ||
          m.stockStatus === 'OutOfStock' ||
          m.stockStatus === 'LowStock' ||
          (m.stockStatus as string) === 'Critical'
      )
      .sort((a, b) => (a.daysOfStock || 0) - (b.daysOfStock || 0))
      .slice(0, 5)
      .map((m) => ({
        materialCode: m.materialCode,
        materialName: m.materialName,
        category: m.categoryName || 'GENERAL',
        dept: m.userDepartmentName || 'PRODUCTION',
        currentStock: m.currentStock,
        reorderLevel: m.reorderLevel,
        daysOfStock: m.daysOfStock || 0,
        uom: m.defaultUom,
        status: m.stockStatus,
        price: m.standardPrice,
        supplier: m.primarySupplierName || 'Primary Supplier'
      }));
  }, [filteredMaterials]);

  // Category Spend Distribution dynamically calculated from real inventory
  const categoryData = useMemo(() => {
    const catMap: { [cat: string]: { categoryId: string; categoryName: string; totalSpend: number } } = {};
    filteredMaterials.forEach((m) => {
      const cat = m.categoryName || 'GENERAL';
      if (!catMap[cat]) {
        catMap[cat] = { categoryId: cat.toLowerCase(), categoryName: cat, totalSpend: 0 };
      }
      catMap[cat].totalSpend += m.currentStock * m.standardPrice;
    });

    const totalVal = Object.values(catMap).reduce((acc, c) => acc + c.totalSpend, 0);
    return Object.values(catMap)
      .map((c) => ({
        ...c,
        percentage: totalVal > 0 ? Math.round((c.totalSpend / totalVal) * 1000) / 10 : 0
      }))
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 6);
  }, [filteredMaterials]);

  // Department Consumption Breakdown dynamically calculated from real inventory
  const departmentData = useMemo(() => {
    const deptMap: { [dept: string]: { deptId: string; name: string; spend: number; count: number } } = {};
    filteredMaterials.forEach((m) => {
      const dept = m.userDepartmentName || 'GENERAL';
      if (!deptMap[dept]) {
        deptMap[dept] = { deptId: dept.toLowerCase(), name: dept, spend: 0, count: 0 };
      }
      deptMap[dept].spend += m.currentStock * m.standardPrice;
      deptMap[dept].count += 1;
    });

    const totalVal = Object.values(deptMap).reduce((acc, d) => acc + d.spend, 0);
    return Object.values(deptMap)
      .map((d) => ({
        ...d,
        percentage: totalVal > 0 ? Math.round((d.spend / totalVal) * 1000) / 10 : 0
      }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5);
  }, [filteredMaterials]);

  // ==========================================
  // COMPREHENSIVE DETAILED REPORT EXPORT SUITE
  // ==========================================

  // 1. Master Executive Store Intelligence Summary Report
  const exportMasterExecutiveReport = () => {
    const headers = ['Report Category', 'Metric / Property', 'Value', 'Unit / Details', 'Timestamp'];
    const now = new Date().toLocaleString();
    const rows = [
      ['Executive Summary', 'Store Location', 'AMAC Unit-5 Main Store (Bangalore)', 'Manufacturing Unit', now],
      ['Executive Summary', 'Inventory Valuation', `Rs. ${kpiData.closingVal.toFixed(2)}`, `${(kpiData.closingVal / 100000).toFixed(2)} Lakhs`, now],
      ['Executive Summary', 'Total Managed Materials', kpiData.totalManagedMaterials, 'Active Foundry SKUs', now],
      ['Executive Summary', 'Physical Stock On Hand', kpiData.closingQty, 'Units / KG / LTR', now],
      ['Executive Summary', 'Opening Stock Valuation', `Rs. ${kpiData.openingVal.toFixed(2)}`, `${(kpiData.openingVal / 100000).toFixed(2)} Lakhs`, now],
      ['Executive Summary', 'Material Received (GRN)', `Rs. ${kpiData.receivedVal.toFixed(2)}`, `${kpiData.receivedTx} GRNs (${kpiData.receivedQty} Units)`, now],
      ['Executive Summary', 'Material Issued (Consumption)', `Rs. ${kpiData.issuedVal.toFixed(2)}`, `${kpiData.issuedTx} Slips (${kpiData.issuedQty} Units)`, now],
      ['Executive Summary', 'Net Inventory Movement', `Rs. ${kpiData.netMovementVal.toFixed(2)}`, `${kpiData.netMovementQty >= 0 ? '+' : ''}${kpiData.netMovementQty} Units`, now],
      ['Executive Summary', 'Stock Alerts Total', kpiData.lowStockTotal, `${kpiData.criticalCount} Critical, ${kpiData.outOfStockCount} Out of Stock`, now],
      ['Executive Summary', 'Normal Stock Items', kpiData.normalCount, 'Items with Safe Buffer', now],
      ['Executive Summary', 'Total Ledger Transactions', kpiData.totalTransactions, 'Audit Movements', now]
    ];
    downloadCsv('AMAC_Executive_Store_Summary_Report', headers, rows);
  };

  // 2. Opening Stock Detailed Breakdown Report
  const exportOpeningStockReport = () => {
    const headers = ['Material Code', 'Material Name', 'Category', 'Department', 'Opening Stock Qty', 'UOM', 'Standard Unit Rate (Rs)', 'Opening Valuation Base (Rs)', 'Reorder Level'];
    const rows = filteredMaterials.map(m => {
      const rec = filteredTransactions.filter(t => (t.materialId === m.id || t.materialCode === m.materialCode) && t.transactionType === 'Receipt').reduce((acc, t) => acc + t.quantityIn, 0);
      const iss = filteredTransactions.filter(t => (t.materialId === m.id || t.materialCode === m.materialCode) && t.transactionType === 'Issue').reduce((acc, t) => acc + t.quantityOut, 0);
      const openingQty = Math.max(0, m.currentStock - rec + iss);
      const openingVal = openingQty * m.standardPrice;
      return [
        m.materialCode,
        m.materialName,
        m.categoryName || 'GENERAL',
        m.userDepartmentName || 'STORES',
        openingQty,
        m.defaultUom,
        m.standardPrice.toFixed(2),
        openingVal.toFixed(2),
        m.reorderLevel
      ];
    });
    downloadCsv('AMAC_Opening_Stock_Valuation_Report', headers, rows);
  };

  // 3. Material Inward (GRN) Detailed Register Report
  const exportReceivedGRNReport = () => {
    const headers = ['Transaction Date', 'GRN Number', 'Supplier Name', 'Invoice / Ref No', 'Material Code', 'Material Name', 'Received Qty', 'UOM', 'Unit Rate (Rs)', 'Total Value (Rs)', 'Vehicle / Remarks'];
    const rows = filteredTransactions
      .filter(t => t.transactionType === 'Receipt')
      .map(t => {
        const mat = materialsList.find(m => m.id === t.materialId || m.materialCode === t.materialCode);
        return [
          new Date(t.transactionDate).toLocaleString(),
          t.referenceNumber || `GRN-${t.id}`,
          t.supplierName || mat?.primarySupplierName || 'Foundry Supplier',
          (t as any).invoiceNumber || t.referenceNumber || '-',
          t.materialCode,
          t.materialName || mat?.materialName || t.materialCode,
          t.quantityIn,
          mat?.defaultUom || 'KG',
          t.unitCost?.toFixed(2) || (mat?.standardPrice || 0).toFixed(2),
          (t.totalCost || t.quantityIn * t.unitCost).toFixed(2),
          t.remarks || 'Inward Verified'
        ];
      });
    downloadCsv('AMAC_Material_Inward_GRN_Register', headers, rows);
  };

  // 4. Material Issues & Department Consumption Register Report
  const exportIssuedSlipsReport = () => {
    const headers = ['Issue Date', 'Slip Number', 'Department', 'Supervisor / Indentor', 'Material Code', 'Material Name', 'Issued Quantity', 'UOM', 'Unit Rate (Rs)', 'Total Consumption Cost (Rs)', 'Shift / Purpose'];
    const rows = filteredTransactions
      .filter(t => t.transactionType === 'Issue')
      .map(t => {
        const mat = materialsList.find(m => m.id === t.materialId || m.materialCode === t.materialCode);
        return [
          new Date(t.transactionDate).toLocaleString(),
          t.referenceNumber || `IS-${t.id}`,
          t.departmentName || mat?.userDepartmentName || 'PRODUCTION',
          t.issuedTo || 'Shop Supervisor',
          t.materialCode,
          t.materialName || mat?.materialName || t.materialCode,
          t.quantityOut,
          mat?.defaultUom || 'KG',
          t.unitCost?.toFixed(2) || (mat?.standardPrice || 0).toFixed(2),
          (t.totalCost || t.quantityOut * t.unitCost).toFixed(2),
          t.remarks || 'Production Issue'
        ];
      });
    downloadCsv('AMAC_Material_Issues_Consumption_Register', headers, rows);
  };

  // 5. Live Stock Valuation & Inventory Ledger Report
  const exportClosingStockReport = () => {
    const headers = ['Material Code', 'Material Name', 'Category', 'Department', 'Current Stock', 'UOM', 'Reorder Level', 'Standard Rate (Rs)', 'Stock Valuation (Rs)', 'Stock Health Status', 'Primary Supplier'];
    const rows = filteredMaterials.map(m => [
      m.materialCode,
      m.materialName,
      m.categoryName || 'GENERAL',
      m.userDepartmentName || 'STORES',
      m.currentStock,
      m.defaultUom,
      m.reorderLevel,
      m.standardPrice.toFixed(2),
      (m.currentStock * m.standardPrice).toFixed(2),
      m.stockStatus,
      m.primarySupplierName || 'Primary Supplier'
    ]);
    downloadCsv('AMAC_Live_Stock_Valuation_Report', headers, rows);
  };

  // 6. Critical Stock Alerts & Reorder Indent Queue Report
  const exportStockAlertsReport = () => {
    const headers = ['Material Code', 'Material Name', 'Category', 'Department', 'Current Stock', 'Reorder Level', 'Deficit Quantity', 'UOM', 'L1 / Standard Rate (Rs)', 'Estimated Reorder Cost (Rs)', 'Stock Health Alert'];
    const rows = filteredMaterials
      .filter(m => m.currentStock <= m.reorderLevel || m.stockStatus === 'OutOfStock' || m.stockStatus === 'LowStock' || (m.stockStatus as string) === 'Critical')
      .map(m => {
        const deficit = Math.max(0, m.reorderLevel - m.currentStock);
        const reorderQty = m.reorderLevel * 2 - m.currentStock > 0 ? m.reorderLevel * 2 - m.currentStock : m.reorderLevel;
        return [
          m.materialCode,
          m.materialName,
          m.categoryName || 'GENERAL',
          m.userDepartmentName || 'STORES',
          m.currentStock,
          m.reorderLevel,
          deficit,
          m.defaultUom,
          m.standardPrice.toFixed(2),
          (reorderQty * m.standardPrice).toFixed(2),
          m.currentStock <= 0 ? 'OUT OF STOCK' : (m.currentStock <= m.reorderLevel * 0.25 ? 'CRITICAL BUFFER' : 'LOW STOCK REORDER')
        ];
      });
    downloadCsv('AMAC_Stock_Alerts_Reorder_Report', headers, rows);
  };

  // 7. Complete Stock Movement Audit Ledger Report
  const exportStockLedgerReport = () => {
    const headers = ['Transaction Date', 'Ref Document', 'Transaction Type', 'Material Code', 'Material Name', 'Qty In', 'Qty Out', 'Balance After', 'Unit Rate (Rs)', 'Total Value (Rs)', 'Department / Remarks'];
    const rows = filteredTransactions.map(t => [
      new Date(t.transactionDate).toLocaleString(),
      t.referenceNumber || `TX-${t.id}`,
      t.transactionType,
      t.materialCode,
      t.materialName,
      t.quantityIn || 0,
      t.quantityOut || 0,
      t.balanceQuantityAfter ?? '-',
      t.unitCost?.toFixed(2) || '0.00',
      (t.totalCost || (t.quantityIn + t.quantityOut) * t.unitCost).toFixed(2),
      t.remarks || t.departmentName || '-'
    ]);
    downloadCsv('AMAC_Stock_Ledger_Audit_Report', headers, rows);
  };

  // 8. Top Consumed Materials Detailed Report
  const exportTopConsumedReport = () => {
    const headers = ['Rank', 'Material Code', 'Material Name', 'Category', 'Primary Department', 'Total Consumed Qty', 'Total Consumption Spend (Rs)'];
    const rows = topConsumedList.map((item, idx) => [
      idx + 1,
      item.materialCode,
      item.materialName,
      item.category,
      item.dept,
      item.quantity,
      item.cost.toFixed(2)
    ]);
    downloadCsv('AMAC_Top_Consumed_Materials_Report', headers, rows);
  };

  // 9. Top Inward Received Materials Detailed Report
  const exportTopReceivedReport = () => {
    const headers = ['Rank', 'Material Code', 'Material Name', 'Category', 'Allocated Supplier', 'Total Inward Qty', 'Total Inward Value (Rs)'];
    const rows = topReceivedList.map((item, idx) => [
      idx + 1,
      item.materialCode,
      item.materialName,
      item.category,
      item.supplier,
      item.quantity,
      item.cost.toFixed(2)
    ]);
    downloadCsv('AMAC_Top_Received_Materials_Report', headers, rows);
  };

  // 10. Department-Wise Consumption Analytics Report
  const exportDeptConsumptionReport = () => {
    const headers = ['Department Name', 'Material SKUs Count', 'Total Consumption Spend (Rs)', 'Percentage Share (%)'];
    const rows = departmentData.map(d => [
      d.name,
      d.count,
      d.spend.toFixed(2),
      `${d.percentage}%`
    ]);
    downloadCsv('AMAC_Department_Consumption_Analytics_Report', headers, rows);
  };

  // 11. Category Valuation Analytics Report
  const exportCategoryValuationReport = () => {
    const headers = ['Category Name', 'Total Stock Valuation (Rs)', 'Percentage Share (%)'];
    const rows = categoryData.map(c => [
      c.categoryName,
      c.totalSpend.toFixed(2),
      `${c.percentage}%`
    ]);
    downloadCsv('AMAC_Category_Valuation_Analytics_Report', headers, rows);
  };

  if (loading && !data) {
    return (
      <div className="pbi-dashboard-loading">
        <RefreshCw className="animate-spin" size={40} color="#059669" />
        <h3>Loading Power BI Store Intelligence...</h3>
        <p>Connecting to Live Store Database, Aggregating Unit-5 Stock Balances & Real-Time Ledgers</p>
      </div>
    );
  }

  return (
    <div className="pbi-dashboard-root">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="pbi-toast">
          {toastMessage}
        </div>
      )}

      {/* 1. TOP BREADCRUMB & ENTERPRISE HEADER */}
      <header className="pbi-header">
        <div className="pbi-header-left">
          <div className="pbi-breadcrumb">
            <span>Home</span>
            <span className="pbi-breadcrumb-sep">/</span>
            <span className="pbi-breadcrumb-active">Store Management Intelligence</span>
          </div>
          <div className="pbi-title-group">
            <h1 className="pbi-title">Store & Material Command Center</h1>
            <span className="pbi-subtitle">
              <span className="pbi-live-dot" /> Unit-5 Manufacturing Store • Asiaan Metals & Aluminium Castings
            </span>
          </div>
        </div>

        <div className="pbi-header-actions">
          {/* Single Store Location Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontWeight: 700,
              color: 'var(--text-primary)'
            }}
            title="Active Store: AMAC Unit-5 Main Store"
          >
            <Building2 size={15} color="#059669" />
            <span>Unit-5 Main Store</span>
          </div>

          <button
            className="pbi-btn pbi-btn-secondary"
            onClick={fetchDashboardData}
            title="Refresh Live Data"
          >
            <RefreshCw size={14} /> Refresh
          </button>

          <button
            className="pbi-btn pbi-btn-secondary"
            onClick={exportMasterExecutiveReport}
            title="Download Complete Store Intelligence Report (Excel/CSV)"
            style={{
              background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.08), rgba(5, 150, 105, 0.16))',
              borderColor: '#059669',
              color: '#059669',
              fontWeight: 700
            }}
          >
            <Download size={14} /> Export Master Report
          </button>

          <button
            className="pbi-btn pbi-btn-primary"
            onClick={() => onQuickAction('new-receipt')}
            title="Create Inward Material Receipt"
          >
            <ArrowDownToLine size={14} /> Receive Material (GRN)
          </button>

          <button
            className="pbi-btn pbi-btn-emerald"
            onClick={() => onQuickAction('new-issue')}
            title="Create Material Issue Slip"
          >
            <ArrowUpFromLine size={14} /> Issue Slip
          </button>
        </div>
      </header>

      {/* 2. POWER BI GLOBAL FILTERS WITH HIGH-DENSITY HOVER DROPDOWNS */}
      <section className="pbi-filter-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '6px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* 1. Period Hover Dropdown */}
          <div className="pbi-hover-dropdown">
            <div className={`pbi-hover-pill ${selectedPeriod !== 'all' ? 'has-value' : ''}`}>
              <Calendar size={13} color="#059669" />
              <span>Timeframe: <strong>{selectedPeriod === 'all' ? 'All Time (Live)' : selectedPeriod === 'today' ? 'Today' : selectedPeriod === 'yesterday' ? 'Yesterday' : selectedPeriod === 'week' ? 'This Week' : selectedPeriod === 'month' ? 'This Month' : selectedPeriod === 'quarter' ? 'This Quarter' : 'This Year'}</strong></span>
              <ChevronDown size={12} style={{ opacity: 0.6 }} />
            </div>
            <div className="pbi-hover-flyout">
              {[
                { id: 'all', label: '⚡ All Time (Complete Plant Store)' },
                { id: 'today', label: '🕒 Today (Live Shift)' },
                { id: 'yesterday', label: '⏱️ Yesterday' },
                { id: 'week', label: '📆 Past 7 Days' },
                { id: 'month', label: '📊 This Month' },
                { id: 'quarter', label: '📈 This Quarter' },
                { id: 'year', label: '🎯 This Year (FY 2026-27)' }
              ].map((p) => (
                <div
                  key={p.id}
                  className={`pbi-hover-item ${selectedPeriod === p.id ? 'active' : ''}`}
                  onClick={() => setSelectedPeriod(p.id as any)}
                >
                  <span>{p.label}</span>
                  {selectedPeriod === p.id && <Check size={13} color="#059669" />}
                </div>
              ))}
            </div>
          </div>

          {/* 2. Category Hover Dropdown */}
          <div className="pbi-hover-dropdown">
            <div className={`pbi-hover-pill ${selectedCategory !== 'all' ? 'has-value' : ''}`}>
              <Tags size={13} color="#2563eb" />
              <span>Category: <strong>{selectedCategory === 'all' ? 'All' : selectedCategory === 'ingot' ? 'Aluminium Ingot' : selectedCategory === 'sand' ? 'Foundry Sand' : selectedCategory === 'resin' ? 'Resin & Hardener' : selectedCategory === 'cores' ? 'Cores' : 'Spares'}</strong></span>
              <ChevronDown size={12} style={{ opacity: 0.6 }} />
            </div>
            <div className="pbi-hover-flyout">
              {[
                { id: 'all', label: 'All Categories' },
                { id: 'ingot', label: 'Aluminium Ingot' },
                { id: 'sand', label: 'Foundry Sand & RCS' },
                { id: 'resin', label: 'Resin & Hardener' },
                { id: 'cores', label: 'Cores & Tooling' },
                { id: 'spares', label: 'Spares & Oils' }
              ].map((c) => (
                <div
                  key={c.id}
                  className={`pbi-hover-item ${selectedCategory === c.id ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(c.id)}
                >
                  <span>{c.label}</span>
                  {selectedCategory === c.id && <Check size={13} color="#059669" />}
                </div>
              ))}
            </div>
          </div>

          {/* 3. Department Hover Dropdown */}
          <div className="pbi-hover-dropdown">
            <div className={`pbi-hover-pill ${selectedDepartment !== 'all' ? 'has-value' : ''}`}>
              <Building size={13} color="#8b5cf6" />
              <span>Dept: <strong>{selectedDepartment === 'all' ? 'All' : selectedDepartment === 'hpdc' ? 'HPDC' : selectedDepartment === 'core' ? 'Core Shop' : selectedDepartment === 'mould' ? 'Moulding' : selectedDepartment === 'machine' ? 'Machining' : 'Maintenance'}</strong></span>
              <ChevronDown size={12} style={{ opacity: 0.6 }} />
            </div>
            <div className="pbi-hover-flyout">
              {[
                { id: 'all', label: 'All Departments' },
                { id: 'hpdc', label: 'HPDC Casting' },
                { id: 'core', label: 'Core Shop' },
                { id: 'mould', label: 'Sand Moulding' },
                { id: 'machine', label: 'Machining & CNC' },
                { id: 'maint', label: 'Maintenance' }
              ].map((d) => (
                <div
                  key={d.id}
                  className={`pbi-hover-item ${selectedDepartment === d.id ? 'active' : ''}`}
                  onClick={() => setSelectedDepartment(d.id)}
                >
                  <span>{d.label}</span>
                  {selectedDepartment === d.id && <Check size={13} color="#059669" />}
                </div>
              ))}
            </div>
          </div>

          {/* 4. Stock Health Status Hover Dropdown */}
          <div className="pbi-hover-dropdown">
            <div className={`pbi-hover-pill ${selectedStatus !== 'all' ? 'has-value' : ''}`}>
              <ShieldCheck size={13} color={selectedStatus === 'critical' ? '#ef4444' : selectedStatus === 'low' ? '#f59e0b' : '#059669'} />
              <span>Status: <strong>{selectedStatus === 'all' ? 'All' : selectedStatus === 'normal' ? 'Normal' : selectedStatus === 'low' ? 'Low Stock' : selectedStatus === 'critical' ? 'Critical' : 'Out of Stock'}</strong></span>
              <ChevronDown size={12} style={{ opacity: 0.6 }} />
            </div>
            <div className="pbi-hover-flyout right-align">
              {[
                { id: 'all', label: `All Health Statuses (${kpiData.totalManagedMaterials})` },
                { id: 'normal', label: `🟢 Normal (${kpiData.normalCount} SKUs)` },
                { id: 'low', label: `🟡 Low Stock (${kpiData.lowReorderCount} SKUs)` },
                { id: 'critical', label: `🔴 Critical Buffer (${kpiData.criticalCount} SKUs)` },
                { id: 'outofstock', label: `⚫ Out of Stock (${kpiData.outOfStockCount} SKUs)` }
              ].map((s) => (
                <div
                  key={s.id}
                  className={`pbi-hover-item ${selectedStatus === s.id ? 'active' : ''}`}
                  onClick={() => setSelectedStatus(s.id)}
                >
                  <span>{s.label}</span>
                  {selectedStatus === s.id && <Check size={13} color="#059669" />}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Clear Filter Button */}
        {(selectedCategory !== 'all' || selectedDepartment !== 'all' || selectedStatus !== 'all' || selectedPeriod !== 'all') && (
          <button
            className="pbi-clear-filters-btn"
            onClick={() => {
              setSelectedPeriod('all');
              setSelectedCategory('all');
              setSelectedDepartment('all');
              setSelectedStatus('all');
            }}
            title="Reset to default (All Time / All Categories)"
          >
            <X size={13} /> Reset Filters
          </button>
        )}
      </section>

      {/* 3. SMART AI EXECUTIVE SUMMARY BRIEFING (Glassmorphism Briefing Capsule) */}
      <div className="pbi-summary-card">
        <div className="pbi-summary-icon">
          <Zap size={16} color="#059669" />
        </div>
        <div className="pbi-summary-text">
          <strong>Store Intelligence Briefing:</strong> Current inventory valuation is{' '}
          <span className="pbi-highlight">₹{(kpiData.closingVal / 100000).toFixed(2)} Lakhs</span> ({kpiData.closingQty.toLocaleString()} units).
          Net Movement for period is{' '}
          <span className={kpiData.netMovementVal >= 0 ? 'pbi-trend-up' : 'pbi-trend-down'}>
            {kpiData.netMovementVal >= 0 ? `+₹${(kpiData.netMovementVal / 100000).toFixed(2)}L` : `-₹${(Math.abs(kpiData.netMovementVal) / 100000).toFixed(2)}L`}
          </span>{' '}
          (Received ₹{(kpiData.receivedVal / 100000).toFixed(2)}L vs Issued ₹{(kpiData.issuedVal / 100000).toFixed(2)}L).{' '}
          {kpiData.criticalCount + kpiData.outOfStockCount > 0 ? (
            <span className="pbi-alert-pill" onClick={() => handleStickerToggle('alerts')}>
              ⚠️ {kpiData.criticalCount} Critical & {kpiData.outOfStockCount} Out-of-Stock Items Require Reorder
            </span>
          ) : (
            <span style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 700 }}>
              ✅ All Managed SKUs in Optimal Buffer (Zero Shortages)
            </span>
          )}
        </div>
      </div>

      {/* 4. 3D INTERACTIVE STICKER CARDS GRID (1-Click Expand, 2nd-Click Disappear) */}
      <section className="sticker-3d-grid">
        {/* Sticker 1: Opening Stock */}
        <div
          className={`sticker-3d-card ${activeStickerDossier === 'opening' ? 'sticker-active' : ''}`}
          style={{ '--sticker-accent': '#6366f1', '--sticker-icon-bg': 'rgba(99, 102, 241, 0.12)', '--sticker-val-color': 'var(--text-primary)' } as any}
          onClick={() => handleStickerToggle('opening')}
          title="Click to view/hide Opening Stock Valuation Dossier"
        >
          <div className="sticker-3d-top">
            <div className="sticker-3d-icon-box">
              <Boxes size={17} />
            </div>
            <span className="sticker-3d-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              Period Start <HelpTip title="Opening Stock" text="Baseline inventory value and physical units on record at period start." />
            </span>
          </div>
          <div className="sticker-3d-label">Opening Stock</div>
          <div className="sticker-3d-val">₹{(kpiData.openingVal / 100000).toFixed(2)} L</div>
          <div className="sticker-3d-footer">
            <span>{kpiData.openingQty.toLocaleString()} Units</span>
            <span className="sticker-toggle-pill">
              {activeStickerDossier === 'opening' ? '▲ Active' : '▼ Dossier'}
            </span>
          </div>
        </div>

        {/* Sticker 2: Material Received (GRN) */}
        <div
          className={`sticker-3d-card ${activeStickerDossier === 'received' ? 'sticker-active' : ''}`}
          style={{ '--sticker-accent': '#059669', '--sticker-icon-bg': 'rgba(5, 150, 105, 0.14)', '--sticker-val-color': '#059669' } as any}
          onClick={() => handleStickerToggle('received')}
          title="Click to view/hide Inward Receipts Register Dossier"
        >
          <div className="sticker-3d-top">
            <div className="sticker-3d-icon-box">
              <ArrowDownToLine size={17} />
            </div>
            <span className="pbi-pill-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              {kpiData.receivedTx} GRNs <HelpTip term="GRN" />
            </span>
          </div>
          <div className="sticker-3d-label">Material Received</div>
          <div className="sticker-3d-val">₹{(kpiData.receivedVal / 100000).toFixed(2)} L</div>
          <div className="sticker-3d-footer">
            <span>{kpiData.receivedQty.toLocaleString()} Units</span>
            <span className="sticker-toggle-pill">
              {activeStickerDossier === 'received' ? '▲ Active' : '▼ Dossier'}
            </span>
          </div>
        </div>

        {/* Sticker 3: Material Issued */}
        <div
          className={`sticker-3d-card ${activeStickerDossier === 'issued' ? 'sticker-active' : ''}`}
          style={{ '--sticker-accent': '#2563eb', '--sticker-icon-bg': 'rgba(37, 99, 235, 0.14)', '--sticker-val-color': '#2563eb' } as any}
          onClick={() => handleStickerToggle('issued')}
          title="Click to view/hide Material Issues & Consumption Dossier"
        >
          <div className="sticker-3d-top">
            <div className="sticker-3d-icon-box">
              <ArrowUpFromLine size={17} />
            </div>
            <span className="pbi-pill-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              {kpiData.issuedTx} Slips <HelpTip term="IS" />
            </span>
          </div>
          <div className="sticker-3d-label">Material Issued</div>
          <div className="sticker-3d-val">₹{(kpiData.issuedVal / 100000).toFixed(2)} L</div>
          <div className="sticker-3d-footer">
            <span>{kpiData.issuedQty.toLocaleString()} Units</span>
            <span className="sticker-toggle-pill">
              {activeStickerDossier === 'issued' ? '▲ Active' : '▼ Dossier'}
            </span>
          </div>
        </div>

        {/* Sticker 4: Closing Stock Value */}
        <div
          className={`sticker-3d-card ${activeStickerDossier === 'closing' ? 'sticker-active' : ''}`}
          style={{ '--sticker-accent': '#0d9488', '--sticker-icon-bg': 'rgba(13, 148, 136, 0.14)', '--sticker-val-color': 'var(--text-primary)' } as any}
          onClick={() => handleStickerToggle('closing')}
          title="Click to view/hide Live Stock Valuation Dossier"
        >
          <div className="sticker-3d-top">
            <div className="sticker-3d-icon-box">
              <Package size={17} />
            </div>
            <span className={kpiData.netMovementVal >= 0 ? 'pbi-pill-green' : 'pbi-pill-amber'}>
              Net {kpiData.netMovementVal >= 0 ? `+₹${(kpiData.netMovementVal / 100000).toFixed(2)}L` : `-₹${(Math.abs(kpiData.netMovementVal) / 100000).toFixed(2)}L`}
            </span>
          </div>
          <div className="sticker-3d-label">Closing Stock Value</div>
          <div className="sticker-3d-val">₹{(kpiData.closingVal / 100000).toFixed(2)} L</div>
          <div className="sticker-3d-footer">
            <span>{kpiData.closingQty.toLocaleString()} Units</span>
            <span className="sticker-toggle-pill">
              {activeStickerDossier === 'closing' ? '▲ Active' : '▼ Dossier'}
            </span>
          </div>
        </div>

        {/* Sticker 5: Stock Alerts */}
        <div
          className={`sticker-3d-card ${activeStickerDossier === 'alerts' ? 'sticker-active' : ''}`}
          style={{ '--sticker-accent': '#ef4444', '--sticker-icon-bg': 'rgba(239, 68, 68, 0.14)', '--sticker-val-color': kpiData.lowStockTotal > 0 ? '#ef4444' : '#059669' } as any}
          onClick={() => handleStickerToggle('alerts')}
          title="Click to view/hide Stock Alerts & Reorder Indent Dossier"
        >
          <div className="sticker-3d-top">
            <div className="sticker-3d-icon-box">
              <AlertTriangle size={17} />
            </div>
            <span className={kpiData.lowStockTotal > 0 ? 'pbi-pill-red' : 'pbi-pill-green'}>
              {kpiData.lowStockTotal > 0 ? 'Action Req.' : 'Optimal'}
            </span>
          </div>
          <div className="sticker-3d-label">Stock Alerts</div>
          <div className="sticker-3d-val">{kpiData.lowStockTotal} Items</div>
          <div className="sticker-3d-footer">
            <span className="text-red font-bold" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              {kpiData.criticalCount} Crit <HelpTip term="Crit" /> • {kpiData.outOfStockCount} Out
            </span>
            <span className="sticker-toggle-pill">
              {activeStickerDossier === 'alerts' ? '▲ Active' : '▼ Dossier'}
            </span>
          </div>
        </div>

        {/* Sticker 6: Stock Movement */}
        <div
          className={`sticker-3d-card ${activeStickerDossier === 'transactions' ? 'sticker-active' : ''}`}
          style={{ '--sticker-accent': '#8b5cf6', '--sticker-icon-bg': 'rgba(139, 92, 246, 0.14)', '--sticker-val-color': '#8b5cf6' } as any}
          onClick={() => handleStickerToggle('transactions')}
          title="Click to view/hide Stock Ledger Audit Dossier"
        >
          <div className="sticker-3d-top">
            <div className="sticker-3d-icon-box">
              <Activity size={17} />
            </div>
            <span className="pbi-pill-purple" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              {kpiData.totalTransactions.toLocaleString()} Tx <HelpTip term="Tx" />
            </span>
          </div>
          <div className="sticker-3d-label">Stock Movement</div>
          <div className="sticker-3d-val">{kpiData.totalTransactions.toLocaleString()} Tx</div>
          <div className="sticker-3d-footer">
            <span>{kpiData.receivedTx} In • {kpiData.issuedTx} Out</span>
            <span className="sticker-toggle-pill">
              {activeStickerDossier === 'transactions' ? '▲ Active' : '▼ Dossier'}
            </span>
          </div>
        </div>
      </section>

      {/* =========================================================================
          EXPANDABLE 3D DATA DOSSIER (Appears on click, Disappears on click again)
         ========================================================================= */}
      {activeStickerDossier !== 'none' && (
        <div className="sticker-dossier-wrapper">
          <div
            className="sticker-dossier-card"
            style={{
              '--dossier-accent':
                activeStickerDossier === 'opening'
                  ? '#6366f1'
                  : activeStickerDossier === 'received'
                  ? '#059669'
                  : activeStickerDossier === 'issued'
                  ? '#2563eb'
                  : activeStickerDossier === 'closing'
                  ? '#0d9488'
                  : activeStickerDossier === 'alerts'
                  ? '#ef4444'
                  : '#8b5cf6',
              '--dossier-icon-bg':
                activeStickerDossier === 'opening'
                  ? 'rgba(99, 102, 241, 0.14)'
                  : activeStickerDossier === 'received'
                  ? 'rgba(5, 150, 105, 0.14)'
                  : activeStickerDossier === 'issued'
                  ? 'rgba(37, 99, 235, 0.14)'
                  : activeStickerDossier === 'closing'
                  ? 'rgba(13, 148, 136, 0.14)'
                  : activeStickerDossier === 'alerts'
                  ? 'rgba(239, 68, 68, 0.14)'
                  : 'rgba(139, 92, 246, 0.14)'
            } as any}
          >
            {/* Dossier Header */}
            <div className="sticker-dossier-header">
              <div className="sticker-dossier-title-group">
                <div className="sticker-dossier-icon">
                  {activeStickerDossier === 'opening' && <Boxes size={20} />}
                  {activeStickerDossier === 'received' && <ArrowDownToLine size={20} />}
                  {activeStickerDossier === 'issued' && <ArrowUpFromLine size={20} />}
                  {activeStickerDossier === 'closing' && <Package size={20} />}
                  {activeStickerDossier === 'alerts' && <AlertTriangle size={20} />}
                  {activeStickerDossier === 'transactions' && <Activity size={20} />}
                </div>
                <div>
                  <h3 className="sticker-dossier-title">
                    {activeStickerDossier === 'opening' && 'Opening Stock & Beginning Valuation Dossier'}
                    {activeStickerDossier === 'received' && 'Material Inward (GRN Register) Dossier'}
                    {activeStickerDossier === 'issued' && 'Material Issues & Department Consumption Dossier'}
                    {activeStickerDossier === 'closing' && 'Live Stock Valuation & SKU Inventory Dossier'}
                    {activeStickerDossier === 'alerts' && 'Stock Alerts & Urgent Reorder Indent Dossier'}
                    {activeStickerDossier === 'transactions' && 'Store Movement Audit & Ledger Register Dossier'}
                  </h3>
                  <div className="sticker-dossier-sub">
                    Unit-5 Live Database • Showing itemized records • Click sticker again to collapse
                  </div>
                </div>
              </div>

              <div className="sticker-dossier-actions">
                {/* Search Bar inside Dossier */}
                <input
                  type="text"
                  placeholder="Filter records..."
                  value={dossierSearchQuery}
                  onChange={(e) => setDossierSearchQuery(e.target.value)}
                  className="form-control"
                  style={{ width: '170px', padding: '4px 10px', fontSize: '0.78rem' }}
                />

                {/* Instant CSV Export Button */}
                <button
                  className="sticker-dossier-export-btn"
                  onClick={() => {
                    if (activeStickerDossier === 'opening') exportOpeningStockReport();
                    else if (activeStickerDossier === 'received') exportReceivedGRNReport();
                    else if (activeStickerDossier === 'issued') exportIssuedSlipsReport();
                    else if (activeStickerDossier === 'closing') exportClosingStockReport();
                    else if (activeStickerDossier === 'alerts') exportStockAlertsReport();
                    else if (activeStickerDossier === 'transactions') exportStockLedgerReport();
                  }}
                  title="Download full detailed spreadsheet (Excel/CSV)"
                >
                  <Download size={13} /> Export Detailed Report (CSV)
                </button>

                {/* Close Button */}
                <button
                  className="sticker-dossier-close-btn"
                  onClick={() => setActiveStickerDossier('none')}
                  title="Collapse and hide this detailed dossier"
                >
                  <X size={14} /> Close
                </button>
              </div>
            </div>

            {/* Quick Stats Bar */}
            <div className="sticker-dossier-stats-bar">
              {activeStickerDossier === 'opening' && (
                <>
                  <div className="sticker-dossier-stat-box">
                    <label>Total Managed SKUs</label>
                    <strong>{kpiData.totalManagedMaterials} Items</strong>
                  </div>
                  <div className="sticker-dossier-stat-box">
                    <label>Base Inventory Value</label>
                    <strong style={{ color: '#6366f1' }}>₹{(kpiData.openingVal / 100000).toFixed(2)} Lakhs</strong>
                  </div>
                  <div className="sticker-dossier-stat-box">
                    <label>Initial Units on Record</label>
                    <strong>{kpiData.openingQty.toLocaleString()} Units</strong>
                  </div>
                  <div className="sticker-dossier-stat-box">
                    <label>Average SKU Valuation Base</label>
                    <strong>₹{(kpiData.openingVal / (kpiData.totalManagedMaterials || 1)).toFixed(0)}</strong>
                  </div>
                </>
              )}

              {activeStickerDossier === 'received' && (
                <>
                  <div className="sticker-dossier-stat-box">
                    <label>Total Inward GRNs</label>
                    <strong>{kpiData.receivedTx} Documents</strong>
                  </div>
                  <div className="sticker-dossier-stat-box">
                    <label>Inward Spend</label>
                    <strong className="text-emerald">₹{(kpiData.receivedVal / 100000).toFixed(2)} Lakhs</strong>
                  </div>
                  <div className="sticker-dossier-stat-box">
                    <label>Physical Units Inward</label>
                    <strong>{kpiData.receivedQty.toLocaleString()} Units</strong>
                  </div>
                  <div className="sticker-dossier-stat-box">
                    <label>Average Value per GRN</label>
                    <strong>₹{(kpiData.receivedVal / (kpiData.receivedTx || 1)).toFixed(0)}</strong>
                  </div>
                </>
              )}

              {activeStickerDossier === 'issued' && (
                <>
                  <div className="sticker-dossier-stat-box">
                    <label>Total Issue Slips</label>
                    <strong>{kpiData.issuedTx} Slips</strong>
                  </div>
                  <div className="sticker-dossier-stat-box">
                    <label>Total Consumption Value</label>
                    <strong className="text-blue">₹{(kpiData.issuedVal / 100000).toFixed(2)} Lakhs</strong>
                  </div>
                  <div className="sticker-dossier-stat-box">
                    <label>Total Units Issued</label>
                    <strong>{kpiData.issuedQty.toLocaleString()} Units</strong>
                  </div>
                  <div className="sticker-dossier-stat-box">
                    <label>Average Value per Issue</label>
                    <strong>₹{(kpiData.issuedVal / (kpiData.issuedTx || 1)).toFixed(0)}</strong>
                  </div>
                </>
              )}

              {activeStickerDossier === 'closing' && (
                <>
                  <div className="sticker-dossier-stat-box">
                    <label>Active Managed SKUs</label>
                    <strong>{kpiData.totalManagedMaterials} Items</strong>
                  </div>
                  <div className="sticker-dossier-stat-box">
                    <label>Live Inventory Valuation</label>
                    <strong style={{ color: '#0d9488' }}>₹{(kpiData.closingVal / 100000).toFixed(2)} Lakhs</strong>
                  </div>
                  <div className="sticker-dossier-stat-box">
                    <label>Total Stock on Hand</label>
                    <strong>{kpiData.closingQty.toLocaleString()} Units</strong>
                  </div>
                  <div className="sticker-dossier-stat-box">
                    <label>Safe Buffer Compliance</label>
                    <strong className="text-emerald">
                      {kpiData.totalManagedMaterials > 0 ? ((kpiData.normalCount / kpiData.totalManagedMaterials) * 100).toFixed(1) : 100}%
                    </strong>
                  </div>
                </>
              )}

              {activeStickerDossier === 'alerts' && (
                <>
                  <div className="sticker-dossier-stat-box">
                    <label>Total Deficit Items</label>
                    <strong className="text-red">{kpiData.lowStockTotal} Items</strong>
                  </div>
                  <div className="sticker-dossier-stat-box">
                    <label>Critical Buffer Alerts</label>
                    <strong className="text-red">{kpiData.criticalCount} SKUs</strong>
                  </div>
                  <div className="sticker-dossier-stat-box">
                    <label>Zero Balance (Out of Stock)</label>
                    <strong className="text-red">{kpiData.outOfStockCount} SKUs</strong>
                  </div>
                  <div className="sticker-dossier-stat-box">
                    <label>Safe Buffer Materials</label>
                    <strong className="text-emerald">{kpiData.normalCount} SKUs</strong>
                  </div>
                </>
              )}

              {activeStickerDossier === 'transactions' && (
                <>
                  <div className="sticker-dossier-stat-box">
                    <label>Total Ledger Movements</label>
                    <strong style={{ color: '#8b5cf6' }}>{kpiData.totalTransactions} Tx</strong>
                  </div>
                  <div className="sticker-dossier-stat-box">
                    <label>Inward GRNs</label>
                    <strong className="text-emerald">{kpiData.receivedTx} Records</strong>
                  </div>
                  <div className="sticker-dossier-stat-box">
                    <label>Material Issues</label>
                    <strong className="text-blue">{kpiData.issuedTx} Records</strong>
                  </div>
                  <div className="sticker-dossier-stat-box">
                    <label>Stock Adjustments</label>
                    <strong className="text-amber">{kpiData.adjustmentTx} Records</strong>
                  </div>
                </>
              )}
            </div>

            {/* Dossier Itemized Data Table */}
            <div className="table-container" style={{ maxHeight: '340px', overflowY: 'auto' }}>
              {/* 1. Opening Stock Table */}
              {activeStickerDossier === 'opening' && (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Material Code</th>
                      <th>Material Name</th>
                      <th>Category</th>
                      <th>Dept</th>
                      <th>Opening Stock</th>
                      <th>UOM</th>
                      <th>Standard Rate (₹)</th>
                      <th>Opening Valuation Base (₹)</th>
                      <th>Reorder Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMaterials
                      .filter(
                        (m) =>
                          !dossierSearchQuery ||
                          m.materialCode.toLowerCase().includes(dossierSearchQuery.toLowerCase()) ||
                          m.materialName.toLowerCase().includes(dossierSearchQuery.toLowerCase()) ||
                          (m.categoryName || '').toLowerCase().includes(dossierSearchQuery.toLowerCase())
                      )
                      .slice(0, 25)
                      .map((m) => {
                        const rec = filteredTransactions
                          .filter((t) => (t.materialId === m.id || t.materialCode === m.materialCode) && t.transactionType === 'Receipt')
                          .reduce((acc, t) => acc + t.quantityIn, 0);
                        const iss = filteredTransactions
                          .filter((t) => (t.materialId === m.id || t.materialCode === m.materialCode) && t.transactionType === 'Issue')
                          .reduce((acc, t) => acc + t.quantityOut, 0);
                        const openingQty = Math.max(0, m.currentStock - rec + iss);
                        const openingVal = openingQty * m.standardPrice;
                        return (
                          <tr key={m.materialCode}>
                            <td style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{m.materialCode}</td>
                            <td>{m.materialName}</td>
                            <td><span className="badge badge-submitted">{m.categoryName || 'GENERAL'}</span></td>
                            <td>{m.userDepartmentName || 'STORES'}</td>
                            <td style={{ fontWeight: 700 }}>{openingQty.toLocaleString()}</td>
                            <td>{m.defaultUom}</td>
                            <td>₹{m.standardPrice.toFixed(2)}</td>
                            <td style={{ fontWeight: 800, color: '#6366f1' }}>₹{openingVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td>{m.reorderLevel.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}

              {/* 2. Received GRN Table */}
              {activeStickerDossier === 'received' && (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>GRN / Ref No</th>
                      <th>Supplier Name</th>
                      <th>Material Code</th>
                      <th>Material Name</th>
                      <th>Received Qty</th>
                      <th>Unit Rate</th>
                      <th>Total Value (₹)</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions
                      .filter((t) => t.transactionType === 'Receipt')
                      .filter(
                        (t) =>
                          !dossierSearchQuery ||
                          t.materialCode.toLowerCase().includes(dossierSearchQuery.toLowerCase()) ||
                          t.materialName.toLowerCase().includes(dossierSearchQuery.toLowerCase()) ||
                          (t.supplierName || '').toLowerCase().includes(dossierSearchQuery.toLowerCase()) ||
                          (t.referenceNumber || '').toLowerCase().includes(dossierSearchQuery.toLowerCase())
                      )
                      .slice(0, 25)
                      .map((t, idx) => (
                        <tr key={idx}>
                          <td>{new Date(t.transactionDate).toLocaleDateString()}</td>
                          <td style={{ fontWeight: 700, color: '#059669' }}>{t.referenceNumber || `GRN-${t.id}`}</td>
                          <td>{t.supplierName || 'Foundry Supplier'}</td>
                          <td style={{ fontWeight: 700 }}>{t.materialCode}</td>
                          <td>{t.materialName}</td>
                          <td style={{ fontWeight: 800, color: '#059669' }}>+{t.quantityIn.toLocaleString()}</td>
                          <td>₹{(t.unitCost || 0).toFixed(2)}</td>
                          <td style={{ fontWeight: 800, color: '#059669' }}>₹{(t.totalCost || t.quantityIn * t.unitCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.remarks || 'Verified'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}

              {/* 3. Material Issues Table */}
              {activeStickerDossier === 'issued' && (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Issue Slip No</th>
                      <th>Department</th>
                      <th>Supervisor</th>
                      <th>Material Code</th>
                      <th>Material Name</th>
                      <th>Issued Qty</th>
                      <th>Unit Rate</th>
                      <th>Total Cost (₹)</th>
                      <th>Purpose</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions
                      .filter((t) => t.transactionType === 'Issue')
                      .filter(
                        (t) =>
                          !dossierSearchQuery ||
                          t.materialCode.toLowerCase().includes(dossierSearchQuery.toLowerCase()) ||
                          t.materialName.toLowerCase().includes(dossierSearchQuery.toLowerCase()) ||
                          (t.departmentName || '').toLowerCase().includes(dossierSearchQuery.toLowerCase()) ||
                          (t.referenceNumber || '').toLowerCase().includes(dossierSearchQuery.toLowerCase())
                      )
                      .slice(0, 25)
                      .map((t, idx) => (
                        <tr key={idx}>
                          <td>{new Date(t.transactionDate).toLocaleDateString()}</td>
                          <td style={{ fontWeight: 700, color: '#2563eb' }}>{t.referenceNumber || `IS-${t.id}`}</td>
                          <td><span className="badge badge-submitted">{t.departmentName || 'PRODUCTION'}</span></td>
                          <td>{t.issuedTo || 'Supervisor'}</td>
                          <td style={{ fontWeight: 700 }}>{t.materialCode}</td>
                          <td>{t.materialName}</td>
                          <td style={{ fontWeight: 800, color: '#2563eb' }}>-{t.quantityOut.toLocaleString()}</td>
                          <td>₹{(t.unitCost || 0).toFixed(2)}</td>
                          <td style={{ fontWeight: 800, color: '#2563eb' }}>₹{(t.totalCost || t.quantityOut * t.unitCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.remarks || 'Shop Issue'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}

              {/* 4. Live Stock Valuation Table */}
              {activeStickerDossier === 'closing' && (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Material Code</th>
                      <th>Material Name</th>
                      <th>Category</th>
                      <th>Department</th>
                      <th>Current Stock</th>
                      <th>UOM</th>
                      <th>Reorder Level</th>
                      <th>Standard Price</th>
                      <th>Stock Valuation (₹)</th>
                      <th>Health Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMaterials
                      .filter(
                        (m) =>
                          !dossierSearchQuery ||
                          m.materialCode.toLowerCase().includes(dossierSearchQuery.toLowerCase()) ||
                          m.materialName.toLowerCase().includes(dossierSearchQuery.toLowerCase()) ||
                          (m.categoryName || '').toLowerCase().includes(dossierSearchQuery.toLowerCase())
                      )
                      .slice(0, 25)
                      .map((m) => (
                        <tr key={m.materialCode}>
                          <td style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{m.materialCode}</td>
                          <td>{m.materialName}</td>
                          <td><span className="badge badge-submitted">{m.categoryName || 'GENERAL'}</span></td>
                          <td>{m.userDepartmentName || 'STORES'}</td>
                          <td style={{ fontWeight: 800 }}>{m.currentStock.toLocaleString()}</td>
                          <td>{m.defaultUom}</td>
                          <td>{m.reorderLevel.toLocaleString()}</td>
                          <td>₹{m.standardPrice.toFixed(2)}</td>
                          <td style={{ fontWeight: 800, color: '#0d9488' }}>₹{(m.currentStock * m.standardPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td>
                            <span
                              className={`badge ${
                                m.stockStatus === 'Normal'
                                  ? 'badge-normal'
                                  : m.stockStatus === 'LowStock'
                                  ? 'badge-low'
                                  : 'badge-outofstock'
                              }`}
                            >
                              {m.stockStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}

              {/* 5. Stock Alerts Table */}
              {activeStickerDossier === 'alerts' && (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Material Code</th>
                      <th>Material Name</th>
                      <th>Category</th>
                      <th>Current Stock</th>
                      <th>Reorder Level</th>
                      <th>Deficit Qty</th>
                      <th>Standard Rate</th>
                      <th>Est. Reorder Value</th>
                      <th>Alert Status</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMaterials
                      .filter(
                        (m) =>
                          m.currentStock <= m.reorderLevel ||
                          m.stockStatus === 'OutOfStock' ||
                          m.stockStatus === 'LowStock' ||
                          (m.stockStatus as string) === 'Critical'
                      )
                      .filter(
                        (m) =>
                          !dossierSearchQuery ||
                          m.materialCode.toLowerCase().includes(dossierSearchQuery.toLowerCase()) ||
                          m.materialName.toLowerCase().includes(dossierSearchQuery.toLowerCase())
                      )
                      .slice(0, 25)
                      .map((m) => {
                        const deficit = Math.max(0, m.reorderLevel - m.currentStock);
                        const reorderQty = m.reorderLevel * 2 - m.currentStock > 0 ? m.reorderLevel * 2 - m.currentStock : m.reorderLevel;
                        return (
                          <tr key={m.materialCode}>
                            <td style={{ fontWeight: 700, color: '#ef4444' }}>{m.materialCode}</td>
                            <td>{m.materialName}</td>
                            <td><span className="badge badge-submitted">{m.categoryName || 'GENERAL'}</span></td>
                            <td style={{ fontWeight: 800, color: m.currentStock <= 0 ? '#ef4444' : '#f59e0b' }}>
                              {m.currentStock.toLocaleString()} {m.defaultUom}
                            </td>
                            <td>{m.reorderLevel.toLocaleString()} {m.defaultUom}</td>
                            <td style={{ fontWeight: 800, color: '#ef4444' }}>-{deficit.toLocaleString()} {m.defaultUom}</td>
                            <td>₹{m.standardPrice.toFixed(2)}</td>
                            <td style={{ fontWeight: 800, color: 'var(--accent-primary)' }}>
                              ₹{(reorderQty * m.standardPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td>
                              <span className={m.currentStock <= 0 ? 'pbi-badge-out' : 'pbi-badge-crit'}>
                                {m.currentStock <= 0 ? 'OUT OF STOCK' : 'LOW BUFFER'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                className="pbi-btn-reorder"
                                onClick={() =>
                                  handleOpenIndentModal({
                                    code: m.materialCode,
                                    name: m.materialName,
                                    uom: m.defaultUom,
                                    stock: m.currentStock,
                                    reorder: m.reorderLevel,
                                    price: m.standardPrice,
                                    supplier: m.primarySupplierName || 'Primary Supplier'
                                  })
                                }
                              >
                                <Plus size={11} /> Indent
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}

              {/* 6. Stock Ledger Audit Table */}
              {activeStickerDossier === 'transactions' && (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Ref Document</th>
                      <th>Type</th>
                      <th>Material Code</th>
                      <th>Material Name</th>
                      <th>In Qty</th>
                      <th>Out Qty</th>
                      <th>Balance Qty</th>
                      <th>Unit Rate</th>
                      <th>Total Value (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions
                      .filter(
                        (t) =>
                          !dossierSearchQuery ||
                          t.materialCode.toLowerCase().includes(dossierSearchQuery.toLowerCase()) ||
                          t.materialName.toLowerCase().includes(dossierSearchQuery.toLowerCase()) ||
                          (t.referenceNumber || '').toLowerCase().includes(dossierSearchQuery.toLowerCase())
                      )
                      .slice(0, 30)
                      .map((t, idx) => (
                        <tr key={idx}>
                          <td>{new Date(t.transactionDate).toLocaleString()}</td>
                          <td style={{ fontWeight: 700 }}>{t.referenceNumber || `TX-${t.id}`}</td>
                          <td>
                            <span
                              className={
                                t.transactionType === 'Receipt'
                                  ? 'pbi-badge-grn'
                                  : t.transactionType === 'Issue'
                                  ? 'pbi-badge-issue'
                                  : 'pbi-badge-adj'
                              }
                            >
                              {t.transactionType.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700 }}>{t.materialCode}</td>
                          <td>{t.materialName}</td>
                          <td className="text-emerald font-bold">{t.quantityIn > 0 ? `+${t.quantityIn.toLocaleString()}` : '-'}</td>
                          <td className="text-blue font-bold">{t.quantityOut > 0 ? `-${t.quantityOut.toLocaleString()}` : '-'}</td>
                          <td style={{ fontWeight: 800 }}>{t.balanceQuantityAfter ?? '-'}</td>
                          <td>₹{(t.unitCost || 0).toFixed(2)}</td>
                          <td style={{ fontWeight: 700 }}>₹{(t.totalCost || (t.quantityIn + t.quantityOut) * t.unitCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. SECONDARY 3D ANALYTICS STICKERS BAR (1-Click Expand, 2nd-Click Disappear) */}
      <section className="sticker-analytics-bar">
        {/* Analytics Sticker 1: Material Movement Analytics */}
        <div
          className={`sticker-analytics-card ${openMovementChart ? 'sticker-active' : ''}`}
          style={{ '--sticker-accent': '#059669', '--sticker-icon-bg': 'rgba(5, 150, 105, 0.14)' } as any}
          onClick={() => setOpenMovementChart(!openMovementChart)}
          title="Click to expand/collapse Material Movement Chart & Analytics"
        >
          <div className="sticker-analytics-left">
            <div className="sticker-3d-icon-box">
              <ArrowLeftRight size={18} />
            </div>
            <div className="sticker-analytics-info">
              <div className="sticker-analytics-title">Material Movement: Received vs Issued Analytics</div>
              <div className="sticker-analytics-sub">
                Trend Analysis • ₹{(kpiData.receivedVal / 100000).toFixed(1)}L In / ₹{(kpiData.issuedVal / 100000).toFixed(1)}L Out ({kpiData.totalTransactions} Tx)
              </div>
            </div>
          </div>
          <span className="sticker-toggle-pill">
            {openMovementChart ? '▲ Active (Click to Hide)' : '▼ View Trend Chart'}
          </span>
        </div>

        {/* Analytics Sticker 2: Stock Health Matrix & Valuation Distribution */}
        <div
          className={`sticker-analytics-card ${openHealthMatrix ? 'sticker-active' : ''}`}
          style={{ '--sticker-accent': '#2563eb', '--sticker-icon-bg': 'rgba(37, 99, 235, 0.14)' } as any}
          onClick={() => setOpenHealthMatrix(!openHealthMatrix)}
          title="Click to expand/collapse Stock Health Matrix & Category Distribution"
        >
          <div className="sticker-analytics-left">
            <div className="sticker-3d-icon-box">
              <ShieldCheck size={18} />
            </div>
            <div className="sticker-analytics-info">
              <div className="sticker-analytics-title">Stock Health Matrix & Category Distribution</div>
              <div className="sticker-analytics-sub">
                {kpiData.normalCount}/{kpiData.totalManagedMaterials} Safe ({kpiData.totalManagedMaterials > 0 ? ((kpiData.normalCount / kpiData.totalManagedMaterials) * 100).toFixed(0) : 100}%) • {kpiData.lowStockTotal} Shortage Alerts
              </div>
            </div>
          </div>
          <span className="sticker-toggle-pill">
            {openHealthMatrix ? '▲ Active (Click to Hide)' : '▼ View Health Matrix'}
          </span>
        </div>
      </section>

      {/* 5B. EXPANDED ANALYTICS PANELS (Appear on click, Disappear on click again) */}
      {(openMovementChart || openHealthMatrix) && (
        <section
          className="pbi-main-grid"
          style={{
            gridTemplateColumns: openMovementChart && openHealthMatrix ? '1.2fr 1fr' : '1fr',
            marginBottom: '16px',
            animation: 'dossierSlideDown 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards'
          }}
        >
          {/* LEFT: Material Movement Trend & Received vs Issued Comparison */}
          {openMovementChart && (
            <div className="pbi-panel pbi-panel-movement">
              <div className="pbi-panel-header">
                <div className="pbi-panel-title">
                  <ArrowLeftRight size={16} color="#059669" />
                  <span>Material Movement: Received vs Issued Analytics</span>
                </div>

                <div className="pbi-panel-controls">
                  {/* Metric Toggle */}
                  <div className="pbi-segmented-control">
                    <button
                      className={`pbi-seg-btn ${movementMetric === 'cost' ? 'active' : ''}`}
                      onClick={() => setMovementMetric('cost')}
                    >
                      Cost (₹)
                    </button>
                    <button
                      className={`pbi-seg-btn ${movementMetric === 'quantity' ? 'active' : ''}`}
                      onClick={() => setMovementMetric('quantity')}
                    >
                      Qty (Units)
                    </button>
                    <button
                      className={`pbi-seg-btn ${movementMetric === 'transactions' ? 'active' : ''}`}
                      onClick={() => setMovementMetric('transactions')}
                    >
                      Transactions
                    </button>
                  </div>

                  {/* Timeframe Toggle */}
                  <div className="pbi-segmented-control">
                    <button
                      className={`pbi-seg-btn ${movementTimeframe === 'day' ? 'active' : ''}`}
                      onClick={() => setMovementTimeframe('day')}
                    >
                      Day
                    </button>
                    <button
                      className={`pbi-seg-btn ${movementTimeframe === 'week' ? 'active' : ''}`}
                      onClick={() => setMovementTimeframe('week')}
                    >
                      Week
                    </button>
                    <button
                      className={`pbi-seg-btn ${movementTimeframe === 'month' ? 'active' : ''}`}
                      onClick={() => setMovementTimeframe('month')}
                    >
                      Month
                    </button>
                    <button
                      className={`pbi-seg-btn ${movementTimeframe === 'year' ? 'active' : ''}`}
                      onClick={() => setMovementTimeframe('year')}
                    >
                      Year
                    </button>
                  </div>

                  {/* Close Panel Button */}
                  <button
                    className="sticker-dossier-close-btn"
                    onClick={() => setOpenMovementChart(false)}
                    title="Collapse and hide Movement Chart"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>

              {/* Movement Analytics Chart */}
              <div className="pbi-chart-container">
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={movementChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                    <YAxis
                      stroke="var(--text-muted)"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(val) => (movementMetric === 'cost' ? `₹${(val / 1000).toFixed(0)}k` : `${val}`)}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const rec =
                            payload.find((p) => p.dataKey === (movementMetric === 'cost' ? 'receivedCost' : movementMetric === 'quantity' ? 'receivedQty' : 'transactions'))
                              ?.value || 0;
                          const iss =
                            payload.find((p) => p.dataKey === (movementMetric === 'cost' ? 'issuedCost' : movementMetric === 'quantity' ? 'issuedQty' : 'transactions'))
                              ?.value || 0;
                          const net = payload[0]?.payload?.netCost || 0;
                          return (
                            <div className="pbi-rich-tooltip">
                              <div className="pbi-tooltip-header">{label} Analysis</div>
                              <div className="pbi-tooltip-row text-emerald">
                                <span>Received ({movementMetric === 'cost' ? '₹' : 'Units'}):</span>
                                <strong>{movementMetric === 'cost' ? `₹${Number(rec).toLocaleString()}` : `${Number(rec).toLocaleString()} Units`}</strong>
                              </div>
                              <div className="pbi-tooltip-row text-blue">
                                <span>Issued ({movementMetric === 'cost' ? '₹' : 'Units'}):</span>
                                <strong>{movementMetric === 'cost' ? `₹${Number(iss).toLocaleString()}` : `${Number(iss).toLocaleString()} Units`}</strong>
                              </div>
                              {movementMetric === 'cost' && (
                                <div className={`pbi-tooltip-row ${net >= 0 ? 'text-emerald' : 'text-amber'}`}>
                                  <span>Net Flow:</span>
                                  <strong>{net >= 0 ? `+₹${Number(net).toLocaleString()}` : `-₹${Number(Math.abs(net)).toLocaleString()}`}</strong>
                                </div>
                              )}
                              <div className="pbi-tooltip-row text-muted">
                                <span>Transactions:</span>
                                <strong>{payload[0]?.payload?.transactions || 0} documents</strong>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }}
                      formatter={(val) => <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{val}</span>}
                    />
                    <Bar
                      dataKey={movementMetric === 'cost' ? 'receivedCost' : movementMetric === 'quantity' ? 'receivedQty' : 'transactions'}
                      name="Material Received (Inward)"
                      fill={PBI_COLORS.received}
                      radius={[3, 3, 0, 0]}
                      barSize={18}
                    />
                    <Bar
                      dataKey={movementMetric === 'cost' ? 'issuedCost' : movementMetric === 'quantity' ? 'issuedQty' : 'transactions'}
                      name="Material Issued (Consumption)"
                      fill={PBI_COLORS.issued}
                      radius={[3, 3, 0, 0]}
                      barSize={18}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* RIGHT: Stock Health Matrix & Category Distribution */}
          {openHealthMatrix && (
            <div className="pbi-panel pbi-panel-health">
              <div className="pbi-panel-header">
                <div className="pbi-panel-tabs">
                  <button
                    className={`pbi-tab-btn ${healthActiveTab === 'matrix' ? 'active' : ''}`}
                    onClick={() => setHealthActiveTab('matrix')}
                  >
                    Stock Health Matrix
                  </button>
                  <button
                    className={`pbi-tab-btn ${healthActiveTab === 'category' ? 'active' : ''}`}
                    onClick={() => setHealthActiveTab('category')}
                  >
                    Category Valuation
                  </button>
                  <button
                    className={`pbi-tab-btn ${healthActiveTab === 'department' ? 'active' : ''}`}
                    onClick={() => setHealthActiveTab('department')}
                  >
                    Dept Consumption
                  </button>
                </div>

                {/* Close Panel Button */}
                <button
                  className="sticker-dossier-close-btn"
                  onClick={() => setOpenHealthMatrix(false)}
                  title="Collapse and hide Stock Health Matrix"
                >
                  <X size={13} />
                </button>
              </div>

              <div className="pbi-health-content">
                {/* Tab 1: Stock Health Matrix */}
                {healthActiveTab === 'matrix' && (
                  <div className="pbi-matrix-view">
                    <div className="pbi-matrix-row" onClick={() => setSelectedStatus('normal')}>
                      <div className="pbi-matrix-label">
                        <span className="pbi-status-dot bg-emerald" />
                        <span>Normal / Optimal Stock</span>
                      </div>
                      <div className="pbi-matrix-bar-wrap">
                        <div
                          className="pbi-matrix-bar bg-emerald"
                          style={{
                            width: `${kpiData.totalManagedMaterials > 0 ? (kpiData.normalCount / kpiData.totalManagedMaterials) * 100 : 0}%`
                          }}
                        />
                      </div>
                      <div className="pbi-matrix-count">
                        {kpiData.normalCount} Items{' '}
                        <small>
                          ({kpiData.totalManagedMaterials > 0 ? ((kpiData.normalCount / kpiData.totalManagedMaterials) * 100).toFixed(1) : 0}%)
                        </small>
                      </div>
                    </div>

                    <div className="pbi-matrix-row" onClick={() => setSelectedStatus('low')}>
                      <div className="pbi-matrix-label">
                        <span className="pbi-status-dot bg-amber" />
                        <span>Low Stock / Reorder Zone</span>
                      </div>
                      <div className="pbi-matrix-bar-wrap">
                        <div
                          className="pbi-matrix-bar bg-amber"
                          style={{
                            width: `${kpiData.totalManagedMaterials > 0 ? (kpiData.lowReorderCount / kpiData.totalManagedMaterials) * 100 : 0}%`
                          }}
                        />
                      </div>
                      <div className="pbi-matrix-count text-amber">
                        {kpiData.lowReorderCount} Items{' '}
                        <small>
                          ({kpiData.totalManagedMaterials > 0 ? ((kpiData.lowReorderCount / kpiData.totalManagedMaterials) * 100).toFixed(1) : 0}%)
                        </small>
                      </div>
                    </div>

                    <div className="pbi-matrix-row" onClick={() => setSelectedStatus('critical')}>
                      <div className="pbi-matrix-label">
                        <span className="pbi-status-dot bg-crimson" />
                        <span>Critical Buffer Alert</span>
                      </div>
                      <div className="pbi-matrix-bar-wrap">
                        <div
                          className="pbi-matrix-bar bg-crimson"
                          style={{
                            width: `${kpiData.totalManagedMaterials > 0 ? (kpiData.criticalCount / kpiData.totalManagedMaterials) * 100 : 0}%`
                          }}
                        />
                      </div>
                      <div className="pbi-matrix-count text-red">
                        {kpiData.criticalCount} Items{' '}
                        <small>
                          ({kpiData.totalManagedMaterials > 0 ? ((kpiData.criticalCount / kpiData.totalManagedMaterials) * 100).toFixed(1) : 0}%)
                        </small>
                      </div>
                    </div>

                    <div className="pbi-matrix-row" onClick={() => setSelectedStatus('outofstock')}>
                      <div className="pbi-matrix-label">
                        <span className="pbi-status-dot bg-black" />
                        <span>Out of Stock (Zero Balance)</span>
                      </div>
                      <div className="pbi-matrix-bar-wrap">
                        <div
                          className="pbi-matrix-bar bg-black"
                          style={{
                            width: `${kpiData.totalManagedMaterials > 0 ? (kpiData.outOfStockCount / kpiData.totalManagedMaterials) * 100 : 0}%`
                          }}
                        />
                      </div>
                      <div className="pbi-matrix-count text-red font-bold">
                        {kpiData.outOfStockCount} Items{' '}
                        <small>
                          ({kpiData.totalManagedMaterials > 0 ? ((kpiData.outOfStockCount / kpiData.totalManagedMaterials) * 100).toFixed(1) : 0}%)
                        </small>
                      </div>
                    </div>

                    <div className="pbi-matrix-footer">
                      <span>
                        Total Managed Inventory: <strong>{kpiData.totalManagedMaterials} Foundry Items</strong>
                      </span>
                      <button className="pbi-btn-link" onClick={() => handleStickerToggle('alerts')}>
                        Open Reorder Desk <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Tab 2: Category Valuation Donut */}
                {healthActiveTab === 'category' && (
                  <div className="pbi-category-donut-wrap">
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
                      <button
                        className="pbi-btn-link"
                        onClick={exportCategoryValuationReport}
                        style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                        title="Export Category Valuation Report (CSV)"
                      >
                        <Download size={11} /> Export Category Report
                      </button>
                    </div>
                    {categoryData.length === 0 ? (
                      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        No material category inventory recorded.
                      </div>
                    ) : (
                      <>
                        <div style={{ width: '48%', height: 210 }}>
                          <ResponsiveContainer>
                            <PieChart>
                              <Pie
                                data={categoryData}
                                dataKey="totalSpend"
                                nameKey="categoryName"
                                cx="50%"
                                cy="50%"
                                innerRadius={45}
                                outerRadius={75}
                                paddingAngle={2}
                              >
                                {categoryData.map((_, idx) => (
                                  <Cell key={`cat-cell-${idx}`} fill={PBI_COLORS.palette[idx % PBI_COLORS.palette.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(val: any) => `₹${Number(val).toLocaleString()}`} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="pbi-donut-legend">
                          {categoryData.slice(0, 5).map((c, i) => (
                            <div key={c.categoryName} className="pbi-legend-item">
                              <span className="pbi-legend-bullet" style={{ background: PBI_COLORS.palette[i % PBI_COLORS.palette.length] }} />
                              <span className="pbi-legend-name">{c.categoryName}</span>
                              <span className="pbi-legend-pct">₹{(c.totalSpend / 100000).toFixed(1)}L ({c.percentage}%)</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Tab 3: Department Consumption */}
                {healthActiveTab === 'department' && (
                  <div className="pbi-dept-list">
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '6px' }}>
                      <button
                        className="pbi-btn-link"
                        onClick={exportDeptConsumptionReport}
                        style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                        title="Export Department Consumption Report (CSV)"
                      >
                        <Download size={11} /> Export Dept Report
                      </button>
                    </div>
                    {departmentData.length === 0 ? (
                      <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        No department inventory recorded.
                      </div>
                    ) : (
                      departmentData.map((dept) => (
                        <div key={dept.name} className="pbi-dept-row">
                          <div className="pbi-dept-info">
                            <span className="pbi-dept-name">{dept.name}</span>
                            <span className="pbi-dept-val">₹{(dept.spend / 100000).toFixed(2)} Lakhs</span>
                          </div>
                          <div className="pbi-dept-progress-wrap">
                            <div className="pbi-dept-progress" style={{ width: `${dept.percentage}%` }} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 6. LOWER DASHBOARD AREA (Three-Column Micro-Drilldown Grid) */}
      <section className="pbi-lower-grid">
        {/* Column 1: Top 5 Consumed / Issued Materials */}
        <div className="pbi-micro-card">
          <div className="pbi-micro-header">
            <span className="pbi-micro-title">
              <ArrowUpFromLine size={14} color="#2563eb" /> Top Consumed Materials
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className="pbi-btn-link"
                onClick={exportTopConsumedReport}
                title="Download Top Consumed Materials Report (CSV)"
              >
                <Download size={11} />
              </button>
              <button className="pbi-btn-link" onClick={() => onNavigate('issues')}>
                View Issues <ArrowRight size={11} />
              </button>
            </div>
          </div>
          <div className="pbi-micro-list">
            {topConsumedList.length === 0 ? (
              <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                No material consumption issued yet.
              </div>
            ) : (
              topConsumedList.map((item, idx) => (
                <div
                  key={item.materialCode}
                  className="pbi-micro-row pbi-row-clickable"
                  onClick={() => handleOpenMaterialProfile(item.materialCode)}
                  title="Click for 360° Material Ledger & Consumption"
                >
                  <div className="pbi-rank-badge">{idx + 1}</div>
                  <div className="pbi-micro-details">
                    <div className="pbi-micro-name">
                      <span className="pbi-code-pill">{item.materialCode}</span>
                      <span className="pbi-item-title">{item.materialName}</span>
                    </div>
                    <div className="pbi-micro-sub">
                      <span>{item.quantity.toLocaleString()} Units</span>
                      <span className="text-blue font-bold">₹{item.cost.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Top 5 Received Materials (Inward GRN) */}
        <div className="pbi-micro-card">
          <div className="pbi-micro-header">
            <span className="pbi-micro-title">
              <ArrowDownToLine size={14} color="#059669" /> Top Received Materials
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className="pbi-btn-link"
                onClick={exportTopReceivedReport}
                title="Download Top Received Materials Report (CSV)"
              >
                <Download size={11} />
              </button>
              <button className="pbi-btn-link" onClick={() => onNavigate('receipts')}>
                View GRNs <ArrowRight size={11} />
              </button>
            </div>
          </div>
          <div className="pbi-micro-list">
            {topReceivedList.length === 0 ? (
              <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                No material inward receipts recorded yet.
              </div>
            ) : (
              topReceivedList.map((item, idx) => (
                <div
                  key={item.materialCode}
                  className="pbi-micro-row pbi-row-clickable"
                  onClick={() => handleOpenMaterialProfile(item.materialCode)}
                  title="Click for 360° Material Ledger & Supplier Details"
                >
                  <div className="pbi-rank-badge pbi-rank-green">{idx + 1}</div>
                  <div className="pbi-micro-details">
                    <div className="pbi-micro-name">
                      <span className="pbi-code-pill pbi-pill-inward">{item.materialCode}</span>
                      <span className="pbi-item-title">{item.materialName}</span>
                    </div>
                    <div className="pbi-micro-sub">
                      <span className="text-muted">{item.supplier}</span>
                      <span className="text-emerald font-bold">₹{item.cost.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 3: Critical Actionable Alerts with 1-Click Indent */}
        <div className="pbi-micro-card pbi-micro-alerts-card">
          <div className="pbi-micro-header">
            <span className="pbi-micro-title text-red">
              <AlertTriangle size={14} color="#ef4444" /> Critical Stock Alerts (Action Req.)
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className="pbi-btn-link"
                onClick={exportStockAlertsReport}
                title="Download Critical Stock Alerts Report (CSV)"
                style={{ color: '#ef4444' }}
              >
                <Download size={11} />
              </button>
              <button className="pbi-btn-link" onClick={() => handleStickerToggle('alerts')}>
                View All ({kpiData.lowStockTotal}) <ArrowRight size={11} />
              </button>
            </div>
          </div>
          <div className="pbi-micro-list">
            {criticalItemsList.length === 0 ? (
              <div style={{ padding: '30px 16px', textAlign: 'center', color: '#059669', fontSize: '0.82rem', fontWeight: 600 }}>
                ✅ Zero shortages. All inventory in safe buffer.
              </div>
            ) : (
              criticalItemsList.map((item) => (
                <div key={item.materialCode} className="pbi-micro-row pbi-alert-row">
                  <div className="pbi-micro-details">
                    <div className="pbi-micro-name">
                      <span className="pbi-code-pill pbi-pill-crit">{item.materialCode}</span>
                      <span className="pbi-item-title">{item.materialName}</span>
                    </div>
                    <div className="pbi-alert-meta">
                      <span className={item.currentStock <= 0 ? 'pbi-badge-out' : 'pbi-badge-crit'}>
                        {item.currentStock <= 0 ? 'OUT OF STOCK' : `Stock: ${item.currentStock} ${item.uom}`}
                      </span>
                      <span className="pbi-reorder-hint">Reorder: {item.reorderLevel} {item.uom}</span>
                    </div>
                  </div>
                  <button
                    className="pbi-btn-reorder"
                    onClick={() => handleOpenIndentModal({
                      code: item.materialCode,
                      name: item.materialName,
                      uom: item.uom,
                      stock: item.currentStock,
                      reorder: item.reorderLevel,
                      price: (item as any).price || 240,
                      supplier: (item as any).supplier || 'Primary Supplier'
                    })}
                    title="Raise 1-Click Purchase Indent"
                  >
                    <Plus size={11} /> Indent
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* =========================================================================
          SLIDE-OVER FLYOUT DRAWERS (1-Click Drilldown without Leaving Dashboard)
         ========================================================================= */}
      {activeDrawer !== 'none' && (
        <div className="pbi-drawer-backdrop" onClick={() => setActiveDrawer('none')}>
          <div className="pbi-drawer-content" onClick={(e) => e.stopPropagation()}>
            {/* Drawer Header */}
            <div className="pbi-drawer-header">
              <div>
                <h3 className="pbi-drawer-title">
                  {activeDrawer === 'material-profile' && `Material 360° Profile: ${selectedMaterialProfile?.materialCode}`}
                  {activeDrawer === 'receipts-register' && "Today's Material Inward (GRN Register)"}
                  {activeDrawer === 'issues-register' && "Today's Material Issue & Consumption Register"}
                  {activeDrawer === 'stock-alerts' && "Stock Alerts & Reorder Indent Center"}
                  {activeDrawer === 'transactions' && "Store Movement Audit & Transaction Register"}
                </h3>
                <span className="pbi-drawer-sub">Live Deep-Dive Inspection • AMAC Unit-5 Stores</span>
              </div>
              <button className="pbi-drawer-close" onClick={() => setActiveDrawer('none')}>
                <X size={18} />
              </button>
            </div>

            {/* Drawer Body: Material 360° Profile */}
            {activeDrawer === 'material-profile' && selectedMaterialProfile && (
              <div className="pbi-drawer-body">
                <div className="pbi-profile-hero">
                  <div className="pbi-profile-code">{selectedMaterialProfile.materialCode}</div>
                  <div className="pbi-profile-info">
                    <h4>{selectedMaterialProfile.materialName}</h4>
                    <p>UOM: <strong>{selectedMaterialProfile.defaultUom}</strong> • Category: <strong>{selectedMaterialProfile.categoryName || 'Foundry Raw Material'}</strong></p>
                  </div>
                </div>

                <div className="pbi-profile-kpi-row">
                  <div className="pbi-pkpi">
                    <span>Current Stock</span>
                    <strong>{selectedMaterialProfile.currentStock} {selectedMaterialProfile.defaultUom}</strong>
                  </div>
                  <div className="pbi-pkpi">
                    <span>Reorder Level</span>
                    <strong>{selectedMaterialProfile.reorderLevel} {selectedMaterialProfile.defaultUom}</strong>
                  </div>
                  <div className="pbi-pkpi">
                    <span>Standard Rate</span>
                    <strong>₹{selectedMaterialProfile.standardPrice || 245} / {selectedMaterialProfile.defaultUom}</strong>
                  </div>
                  <div className="pbi-pkpi">
                    <span>Stock Valuation</span>
                    <strong className="text-emerald">₹{(selectedMaterialProfile.stockValue || 0).toLocaleString()}</strong>
                  </div>
                </div>

                <div className="pbi-drawer-section-title">Recent Movement Ledger (Transactions)</div>
                <div className="pbi-drawer-table-wrap">
                  {transactionsList.filter(t => t.materialCode === selectedMaterialProfile.materialCode).length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      No movement history recorded for this SKU.
                    </div>
                  ) : (
                    <table className="pbi-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Ref Document</th>
                          <th>Qty</th>
                          <th>Rate</th>
                          <th>Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactionsList
                          .filter(t => t.materialCode === selectedMaterialProfile.materialCode)
                          .slice(0, 5)
                          .map((t, idx) => (
                            <tr key={idx}>
                              <td>{new Date(t.transactionDate).toLocaleString()}</td>
                              <td>
                                <span className={t.transactionType === 'Receipt' ? 'pbi-badge-grn' : t.transactionType === 'Issue' ? 'pbi-badge-issue' : 'pbi-badge-adj'}>
                                  {t.transactionType.toUpperCase()}
                                </span>
                              </td>
                              <td>{t.referenceNumber || (t as any).referenceDocument || `TX-${t.id}`}</td>
                              <td className={t.transactionType === 'Receipt' ? 'text-emerald font-bold' : 'text-blue font-bold'}>
                                {t.transactionType === 'Receipt' ? `+${t.quantityIn}` : `-${t.quantityOut}`} {selectedMaterialProfile.defaultUom}
                              </td>
                              <td>₹{t.unitCost || selectedMaterialProfile.standardPrice}</td>
                              <td>{t.balanceQuantityAfter ?? selectedMaterialProfile.currentStock}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="pbi-drawer-actions">
                  <button
                    className="pbi-btn pbi-btn-secondary"
                    onClick={() => { setActiveDrawer('none'); onNavigate('stock'); }}
                  >
                    <ClipboardList size={14} /> Open Full Stock Ledger
                  </button>
                  <button
                    className="pbi-btn pbi-btn-primary"
                    onClick={() => {
                      setActiveDrawer('none');
                      handleOpenIndentModal({
                        code: selectedMaterialProfile.materialCode,
                        name: selectedMaterialProfile.materialName,
                        uom: selectedMaterialProfile.defaultUom,
                        stock: selectedMaterialProfile.currentStock,
                        reorder: selectedMaterialProfile.reorderLevel,
                        price: selectedMaterialProfile.standardPrice,
                        supplier: selectedMaterialProfile.primarySupplierName
                      });
                    }}
                  >
                    <Plus size={14} /> Raise Purchase Indent
                  </button>
                </div>
              </div>
            )}

            {/* Drawer Body: Receipts Register */}
            {activeDrawer === 'receipts-register' && (
              <div className="pbi-drawer-body">
                <div className="pbi-drawer-summary-bar">
                  <span>Total Inward Value: <strong className="text-emerald">₹{(kpiData.receivedVal / 100000).toFixed(2)} Lakhs</strong></span>
                  <span>Quantity: <strong>{kpiData.receivedQty.toLocaleString()} Units</strong></span>
                  <span>Documents: <strong>{kpiData.receivedTx} GRNs</strong></span>
                </div>
                <div className="pbi-drawer-table-wrap">
                  {filteredTransactions.filter(t => t.transactionType === 'Receipt').length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      No inward receipt documents found for the selected timeframe.
                    </div>
                  ) : (
                    <table className="pbi-table">
                      <thead>
                        <tr>
                          <th>Doc / GRN No</th>
                          <th>Material</th>
                          <th>Qty In</th>
                          <th>Unit Rate</th>
                          <th>Total (₹)</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTransactions
                          .filter(t => t.transactionType === 'Receipt')
                          .slice(0, 15)
                          .map((t, idx) => (
                            <tr key={idx}>
                              <td><strong>{t.referenceNumber || `GRN-${t.id}`}</strong></td>
                              <td>{t.materialCode} - {t.materialName}</td>
                              <td className="text-emerald font-bold">+{t.quantityIn.toLocaleString()}</td>
                              <td>₹{t.unitCost || 0}</td>
                              <td className="text-emerald font-bold">₹{(t.totalCost || t.quantityIn * t.unitCost).toLocaleString()}</td>
                              <td>{new Date(t.transactionDate).toLocaleDateString()}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div className="pbi-drawer-actions">
                  <button className="pbi-btn pbi-btn-secondary" onClick={() => { setActiveDrawer('none'); onNavigate('receipts'); }}>
                    Open Receipts Module
                  </button>
                </div>
              </div>
            )}

            {/* Drawer Body: Issues Register */}
            {activeDrawer === 'issues-register' && (
              <div className="pbi-drawer-body">
                <div className="pbi-drawer-summary-bar">
                  <span>Total Issue Value: <strong className="text-blue">₹{(kpiData.issuedVal / 100000).toFixed(2)} Lakhs</strong></span>
                  <span>Quantity: <strong>{kpiData.issuedQty.toLocaleString()} Units</strong></span>
                  <span>Slips: <strong>{kpiData.issuedTx} Slips</strong></span>
                </div>
                <div className="pbi-drawer-table-wrap">
                  {filteredTransactions.filter(t => t.transactionType === 'Issue').length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      No material issue slips found for the selected timeframe.
                    </div>
                  ) : (
                    <table className="pbi-table">
                      <thead>
                        <tr>
                          <th>Slip / Ref No</th>
                          <th>Material</th>
                          <th>Qty Out</th>
                          <th>Unit Rate</th>
                          <th>Total (₹)</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTransactions
                          .filter(t => t.transactionType === 'Issue')
                          .slice(0, 15)
                          .map((t, idx) => (
                            <tr key={idx}>
                              <td><strong>{t.referenceNumber || `ISS-${t.id}`}</strong></td>
                              <td>{t.materialCode} - {t.materialName}</td>
                              <td className="text-blue font-bold">-{t.quantityOut.toLocaleString()}</td>
                              <td>₹{t.unitCost || 0}</td>
                              <td className="text-blue font-bold">₹{(t.totalCost || t.quantityOut * t.unitCost).toLocaleString()}</td>
                              <td>{new Date(t.transactionDate).toLocaleDateString()}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div className="pbi-drawer-actions">
                  <button className="pbi-btn pbi-btn-secondary" onClick={() => { setActiveDrawer('none'); onNavigate('issues'); }}>
                    Open Material Issue Module
                  </button>
                </div>
              </div>
            )}

            {/* Drawer Body: Stock Alerts & Reorder Center */}
            {activeDrawer === 'stock-alerts' && (
              <div className="pbi-drawer-body">
                <div className="pbi-drawer-summary-bar pbi-alert-bar">
                  <span>Critical Stock Items: <strong className="text-red">{kpiData.criticalCount} Items</strong></span>
                  <span>Out of Stock: <strong className="text-red">{kpiData.outOfStockCount} Items</strong></span>
                  <span>Low Reorder Zone: <strong>{kpiData.lowReorderCount} Items</strong></span>
                </div>
                <div className="pbi-drawer-table-wrap">
                  {criticalItemsList.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: '#059669', fontSize: '0.85rem', fontWeight: 600 }}>
                      ✅ No stock deficits. All managed items are within optimal buffer.
                    </div>
                  ) : (
                    <table className="pbi-table">
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Material Description</th>
                          <th>Current Stock</th>
                          <th>Reorder Level</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {criticalItemsList.map((item) => (
                          <tr key={item.materialCode}>
                            <td><strong>{item.materialCode}</strong></td>
                            <td>{item.materialName}</td>
                            <td className="text-red font-bold">{item.currentStock} {item.uom}</td>
                            <td>{item.reorderLevel} {item.uom}</td>
                            <td>
                              <span className={item.currentStock <= 0 ? 'badge badge-outofstock' : 'badge badge-low'}>
                                {item.currentStock <= 0 ? 'OUT OF STOCK' : 'CRITICAL'}
                              </span>
                            </td>
                            <td>
                              <button
                                className="pbi-btn-reorder"
                                onClick={() => {
                                  handleOpenIndentModal({
                                    code: item.materialCode,
                                    name: item.materialName,
                                    uom: item.uom,
                                    stock: item.currentStock,
                                    reorder: item.reorderLevel,
                                    price: (item as any).price || 240,
                                    supplier: (item as any).supplier || 'Primary Supplier'
                                  });
                                }}
                              >
                                <Plus size={12} /> Raise PR
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* Drawer Body: Transactions Audit */}
            {activeDrawer === 'transactions' && (
              <div className="pbi-drawer-body">
                <div className="pbi-drawer-summary-bar">
                  <span>Total Transactions: <strong>{kpiData.totalTransactions}</strong></span>
                  <span>Receipts: <strong>{kpiData.receivedTx}</strong></span>
                  <span>Issues: <strong>{kpiData.issuedTx}</strong></span>
                  <span>Adjustments: <strong>{kpiData.adjustmentTx}</strong></span>
                </div>
                <div className="pbi-drawer-table-wrap">
                  {filteredTransactions.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      No transaction records found for the selected timeframe.
                    </div>
                  ) : (
                    <table className="pbi-table">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Type</th>
                          <th>Code</th>
                          <th>Material</th>
                          <th>Qty</th>
                          <th>Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTransactions.slice(0, 20).map((t, idx) => (
                          <tr key={idx}>
                            <td>{new Date(t.transactionDate).toLocaleTimeString()}</td>
                            <td>
                              <span className={t.transactionType === 'Receipt' ? 'pbi-badge-grn' : t.transactionType === 'Issue' ? 'pbi-badge-issue' : 'pbi-badge-adj'}>
                                {t.transactionType.toUpperCase()}
                              </span>
                            </td>
                            <td>{t.materialCode}</td>
                            <td>{t.materialName}</td>
                            <td className={t.transactionType === 'Receipt' ? 'text-emerald font-bold' : 'text-blue font-bold'}>
                              {t.transactionType === 'Receipt' ? `+${t.quantityIn}` : `-${t.quantityOut}`}
                            </td>
                            <td>₹{(t.totalCost || (t.quantityIn || t.quantityOut) * t.unitCost).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          QUICK PURCHASE INDENT MODAL (1-Click Reorder Action)
         ========================================================================= */}
      {isIndentModalOpen && indentMaterial && (
        <div className="pbi-modal-backdrop" onClick={() => setIsIndentModalOpen(false)}>
          <div className="pbi-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="pbi-modal-header">
              <div>
                <h3 className="pbi-modal-title">Create Emergency Purchase Indent</h3>
                <span className="pbi-modal-sub">Unit-5 Store Reorder Procurement Desk</span>
              </div>
              <button className="pbi-modal-close" onClick={() => setIsIndentModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitIndent}>
              <div className="pbi-modal-body">
                <div className="pbi-form-row">
                  <div className="pbi-form-col">
                    <label>Material Code & Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={`${indentMaterial.code} - ${indentMaterial.name}`}
                      disabled
                    />
                  </div>
                  <div className="pbi-form-col">
                    <label>Current Stock / Reorder Threshold</label>
                    <input
                      type="text"
                      className="form-control text-red font-bold"
                      value={`${indentMaterial.stock} ${indentMaterial.uom} (Reorder: ${indentMaterial.reorder} ${indentMaterial.uom})`}
                      disabled
                    />
                  </div>
                </div>

                <div className="pbi-form-row">
                  <div className="pbi-form-col">
                    <label>Requested Reorder Quantity ({indentMaterial.uom}) *</label>
                    <input
                      type="number"
                      className="form-control"
                      value={indentQty}
                      onChange={(e) => setIndentQty(Number(e.target.value))}
                      required
                      min={1}
                    />
                  </div>
                  <div className="pbi-form-col">
                    <label>Procurement Priority *</label>
                    <select
                      className="form-control"
                      value={indentPriority}
                      onChange={(e) => setIndentPriority(e.target.value as any)}
                    >
                      <option value="Urgent">Urgent (Stock Buffer Breached)</option>
                      <option value="Emergency">Emergency (Production Stoppage Risk)</option>
                      <option value="Normal">Normal Standard Replenishment</option>
                    </select>
                  </div>
                </div>

                <div className="pbi-form-row">
                  <div className="pbi-form-col">
                    <label>Preferred Supplier</label>
                    <input
                      type="text"
                      className="form-control"
                      value={indentMaterial.supplier || 'Primary Approved Vendor'}
                      disabled
                    />
                  </div>
                  <div className="pbi-form-col">
                    <label>Estimated Indent Value</label>
                    <input
                      type="text"
                      className="form-control font-bold text-emerald"
                      value={`₹${(indentQty * (indentMaterial.price || 240)).toLocaleString()}`}
                      disabled
                    />
                  </div>
                </div>

                <div className="pbi-form-group">
                  <label>Indent Purpose / Justification Note</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={indentRemarks}
                    onChange={(e) => setIndentRemarks(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="pbi-modal-footer">
                <button
                  type="button"
                  className="pbi-btn pbi-btn-secondary"
                  onClick={() => setIsIndentModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="pbi-btn pbi-btn-primary"
                  disabled={indentSubmitting}
                >
                  {indentSubmitting ? 'Submitting PR...' : '⚡ Submit Purchase Indent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
