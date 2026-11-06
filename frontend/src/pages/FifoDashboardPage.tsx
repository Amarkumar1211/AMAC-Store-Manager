import React, { useState, useEffect, useMemo } from 'react';
import {
  RefreshCw,
  Maximize2,
  Minimize2,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Info,
  Clock,
  Calendar,
  Sparkles,
  TrendingDown,
  ArrowDownCircle,
  Award,
  PenTool,
  Boxes,
  FileSpreadsheet,
  Building2,
  X,
  ExternalLink,
  ChevronRight,
  Flame,
  Activity,
  Sun,
  Moon
} from 'lucide-react';
import api from '../services/api';
import { User } from '../types';
import { useAutoRefresh } from '../hooks/useAutoRefresh';

interface FifoBatchItem {
  queuePosition: number;
  batchNumber: string;
  stockQuantity: number;
  receiptDate: string;
  daysInPlant: number;
  location?: string;
  heatNumber?: string;
  fifoStatus: string;
}

interface FifoLane {
  laneId: number;
  divisionName: string;
  section: string;
  materialGrade: string;
  subGrade: string;
  colorCode: string;
  tagStyle: string;
  matchedMaterialId?: number;
  matchedMaterialCode?: string;
  matchedMaterialName?: string;
  currentStockKg: number;
  ballCount: number;
  maxStockKg: number;
  reorderStockKg: number;
  minStockKg: number;
  ballScaleKg: number;
  healthStatus: 'OPTIMAL' | 'REORDER_ALERT' | 'CRITICAL_MIN' | 'OVERSTOCK_MAX' | 'EMPTY';
  statusColor: string;
  batches: FifoBatchItem[];
}

interface FifoAudit {
  auditDate: string;
  auditTime: string;
  shift: string;
  checkedBy: string;
  checkedBySignatureUrl?: string;
  verifiedBy: string;
  verifiedBySignatureUrl?: string;
  remarks: string;
  updatedAt: string;
}

interface FifoBoardData {
  companyName: string;
  unitName: string;
  motto: string;
  date: string;
  currentShift: string;
  totalPlantIngotStockKg: number;
  totalPlantConsumablesStockKg: number;
  totalActiveBalls: number;
  lanes: FifoLane[];
  auditSignOff: FifoAudit;
}

interface FifoDashboardPageProps {
  user: User | null;
  onNavigateToRequisitions?: () => void;
  onNavigateToIssues?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: (val: boolean) => void;
}

export const FifoDashboardPage: React.FC<FifoDashboardPageProps> = ({
  user,
  onNavigateToRequisitions,
  onNavigateToIssues,
  isFullscreen: parentFullscreen,
  onToggleFullscreen
}) => {
  const [boardData, setBoardData] = useState<FifoBoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLane, setSelectedLane] = useState<FifoLane | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  // Ticker State
  const [tickerConfig, setTickerConfig] = useState({
    text: '*** UNIT-5 FIFO MANAGEMENT SYSTEM *** ENSURE STRICT FIFO COMPLIANCE *** MAINTAIN OPTIMAL STOCK LEVELS *** REPORT ANY DISCREPANCIES IMMEDIATELY *** SAFETY FIRST: ALWAYS WEAR PPE ***',
    bgColor: '#0F172A',
    textColor: '#38BDF8'
  });

  // Theme State: 'dark' | 'light'
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('fifo_board_theme') as 'dark' | 'light') || 'dark';
  });

  // Full Screen State
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const isFullscreen = parentFullscreen !== undefined ? parentFullscreen : internalFullscreen;

  // Audit Modal State
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditCheckedBy, setAuditCheckedBy] = useState(user?.fullName || user?.username || 'Store In-Charge');
  const [auditVerifiedBy, setAuditVerifiedBy] = useState('Plant Quality In-Charge');
  const [auditShift, setAuditShift] = useState('Shift A');
  const [auditRemarks, setAuditRemarks] = useState('All material racks verified in strict FIFO gravity alignment.');
  const [savingAudit, setSavingAudit] = useState(false);
  const [auditSuccess, setAuditSuccess] = useState('');

  const isDark = themeMode === 'dark';

  // Toggle Theme Mode
  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark';
    setThemeMode(next);
    localStorage.setItem('fifo_board_theme', next);
  };

  // Toggle Native & Layout Fullscreen
  const toggleFullscreen = () => {
    const nextVal = !isFullscreen;
    if (nextVal) {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
          console.warn('Error entering fullscreen:', err);
        });
      }
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
    setInternalFullscreen(nextVal);
    onToggleFullscreen?.(nextVal);
  };

  // Sync with browser native fullscreen change (e.g. Esc key)
  useEffect(() => {
    const handleFsChange = () => {
      const isFs = !!document.fullscreenElement;
      setInternalFullscreen(isFs);
      onToggleFullscreen?.(isFs);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, [onToggleFullscreen]);

  // Live Clock Tick
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Board Data
  const fetchFifoBoard = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/fifo/board');
      setBoardData(res.data);
      if (res.data?.auditSignOff) {
        setAuditCheckedBy(res.data.auditSignOff.checkedBy || user?.fullName || 'Store In-Charge');
        setAuditVerifiedBy(res.data.auditSignOff.verifiedBy || 'Plant Quality In-Charge');
        setAuditShift(res.data.auditSignOff.shift || 'Shift A');
        setAuditRemarks(res.data.auditSignOff.remarks || 'All material racks verified in strict FIFO gravity alignment.');
      }

      try {
        const configRes = await api.get('/system/config');
        if (Array.isArray(configRes.data)) {
          const loaded: any = {};
          configRes.data.forEach((item: any) => {
            if (item.key) loaded[item.key] = item.value;
          });
          if (loaded.FifoTickerText || loaded.FifoTickerBgColor) {
            setTickerConfig({
              text: loaded.FifoTickerText || '*** UNIT-5 FIFO MANAGEMENT SYSTEM *** ENSURE STRICT FIFO COMPLIANCE *** MAINTAIN OPTIMAL STOCK LEVELS *** REPORT ANY DISCREPANCIES IMMEDIATELY *** SAFETY FIRST: ALWAYS WEAR PPE ***',
              bgColor: loaded.FifoTickerBgColor || '#0F172A',
              textColor: loaded.FifoTickerTextColor || '#38BDF8'
            });
          }
        }
      } catch (err) {
        // Ignore config fetch errors silently (fallback to defaults)
      }
    } catch (err: any) {
      console.error('Error fetching FIFO board:', err);
      setError(err.response?.data?.message || 'Failed to load FIFO Board data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFifoBoard();
  }, []);

  // 10s smart auto-refresh for near real-time TV display
  useAutoRefresh(fetchFifoBoard, 10000);

  // Save Audit Sign-off
  const handleSaveAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAudit(true);
    setAuditSuccess('');
    try {
      const payload = {
        auditDate: new Date().toISOString().split('T')[0],
        auditTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        shift: auditShift,
        checkedBy: auditCheckedBy,
        verifiedBy: auditVerifiedBy,
        remarks: auditRemarks
      };
      await api.post('/fifo/audit', payload);
      setAuditSuccess('FIFO Daily Audit successfully recorded and timestamped!');
      setTimeout(() => {
        setIsAuditModalOpen(false);
        setAuditSuccess('');
        fetchFifoBoard();
      }, 1200);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save audit.');
    } finally {
      setSavingAudit(false);
    }
  };

  // Split lanes into Ingot & Consumable sections and group by division
  const ingotDivisions = useMemo(() => {
    const ingots = boardData?.lanes.filter((l) => l.section === 'ALUMINIUM ALLOY INGOTS') || [];
    const divisionsMap = new Map<string, FifoLane[]>();
    
    ingots.forEach((lane) => {
      const divName = lane.divisionName || 'DIVISION';
      if (!divisionsMap.has(divName)) {
        divisionsMap.set(divName, []);
      }
      divisionsMap.get(divName)!.push(lane);
    });

    return Array.from(divisionsMap.entries()).map(([name, lanes]) => ({ name, lanes }));
  }, [boardData]);

  const consumableLanes = useMemo(() => {
    return boardData?.lanes.filter((l) => l.section === 'CONSUMABLES') || [];
  }, [boardData]);

  // Total Summary Metrics
  const summaryStats = useMemo(() => {
    if (!boardData) return { optimalCount: 0, reorderCount: 0, emptyCount: 0 };
    let optimalCount = 0;
    let reorderCount = 0;
    let emptyCount = 0;
    boardData.lanes.forEach((l) => {
      if (l.healthStatus === 'OPTIMAL') optimalCount++;
      else if (l.healthStatus === 'REORDER_ALERT' || l.healthStatus === 'CRITICAL_MIN') reorderCount++;
      else if (l.healthStatus === 'EMPTY') emptyCount++;
    });
    return { optimalCount, reorderCount, emptyCount };
  }, [boardData]);

  // Master Color Theme Tokens
  const theme = {
    pageBg: isDark ? '#080C15' : '#F1F5F9',
    cardBg: isDark ? 'linear-gradient(180deg, #111728 0%, #0D1322 100%)' : '#FFFFFF',
    cardBorder: isDark ? '#1E293B' : '#CBD5E1',
    boardOuterBg: isDark ? '#0A0F1D' : '#F8FAFC',
    boardOuterBorder: isDark ? '#1D4ED8' : '#2563EB',
    sectionHeaderIngot: '#135033',
    sectionHeaderConsumable: '#135033',
    chuteWellBorder: isDark ? '#475569' : '#94A3B8',
    textPrimary: isDark ? '#F8FAFC' : '#0F172A',
    textSecondary: isDark ? '#94A3B8' : '#64748B',
    kpiBg: isDark ? 'linear-gradient(135deg, #111728 0%, #0D1322 100%)' : '#FFFFFF',
    digitalLedBg: isDark ? '#050811' : '#0F172A',
    digitalLedBorder: isDark ? '#1E293B' : '#334155',
    digitalLedText: '#38BDF8',
    guidelineMax: '#10B981', // 🟢 Max is Safe Green
    guidelineReorder: '#F59E0B', // 🟡 Reorder is Amber Warning
    guidelineMin: '#EF4444', // 🔴 Min is Critical Red
    shadow: isDark ? '0 12px 30px -5px rgba(0, 0, 0, 0.6)' : '0 4px 20px rgba(0, 0, 0, 0.08)'
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '4px',
        padding: '6px 12px',
        backgroundColor: theme.pageBg,
        height: '100vh',
        minHeight: '100vh',
        maxHeight: '100vh',
        overflow: 'hidden',
        color: theme.textPrimary,
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        boxSizing: 'border-box',
        transition: 'background-color 0.2s ease, color 0.2s ease'
      }}
    >
      {/* ========================================================================= */}
      {/* 1. TOP MASTER HEADER & CONTROLS (AMAC BRANDING & LOGO)                     */}
      {/* ========================================================================= */}
      <div
        style={{
          background: theme.cardBg,
          borderRadius: '8px',
          padding: '4px 12px',
          border: `1px solid ${theme.cardBorder}`,
          boxShadow: theme.shadow,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          flexShrink: 0
        }}
      >
        {/* Left: AUTHENTIC AMAC LOGO & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              overflow: 'hidden',
              backgroundColor: '#FFFFFF',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              border: '1.5px solid rgba(255, 255, 255, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              padding: '2px'
            }}
          >
            <img
              src="/amac_logo.png"
              alt="AMAC Logo"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onError={(e) => {
                e.currentTarget.src = '/amac_logo.jpg';
              }}
            />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h1 style={{ fontSize: '1.05rem', fontWeight: 900, margin: 0, letterSpacing: '0.5px', color: theme.textPrimary }}>
                ASIAAN METALS & ALUMINIUM CASTING PVT LTD
              </h1>
            </div>
            <div style={{ fontSize: '0.68rem', color: theme.textSecondary, fontWeight: 600, marginTop: '1px' }}>
              Quality • Discipline • Safety • Efficiency &nbsp;|&nbsp;{' '}
              <span style={{ color: '#2563EB', fontWeight: 800 }}>UNIT-5 PLANT FIFO MANAGEMENT SYSTEM</span>
            </div>
          </div>
        </div>

        {/* Center: Live Date, Clock, and Shift Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <div
            style={{
              backgroundColor: isDark ? '#050811' : '#F1F5F9',
              padding: '3px 8px',
              borderRadius: '5px',
              border: `1px solid ${theme.cardBorder}`,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.74rem'
            }}
          >
            <Calendar size={12} color="#2563EB" />
            <span style={{ fontWeight: 700, color: theme.textPrimary }}>{boardData?.date || new Date().toISOString().split('T')[0]}</span>
          </div>

          <div
            style={{
              backgroundColor: isDark ? '#050811' : '#F1F5F9',
              padding: '3px 8px',
              borderRadius: '5px',
              border: `1px solid ${theme.cardBorder}`,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.74rem'
            }}
          >
            <Clock size={12} color="#F59E0B" />
            <span style={{ fontWeight: 800, color: theme.textPrimary, fontFamily: 'monospace' }}>{currentTime}</span>
          </div>

          <div
            style={{
              backgroundColor: isDark ? '#064E3B' : '#ECFDF5',
              border: `1px solid ${isDark ? '#059669' : '#A7F3D0'}`,
              padding: '3px 8px',
              borderRadius: '5px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.74rem',
              color: isDark ? '#34D399' : '#059669',
              fontWeight: 800
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#10B981',
                boxShadow: '0 0 6px #10B981',
                animation: 'pulse 2s infinite'
              }}
            />
            {boardData?.currentShift || 'Shift A'} (Active)
          </div>
        </div>

        {/* Right Toolbar: Fullscreen, Dark/Light Mode, Audit Sign-off */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
          {/* ☀️ / 🌙 THEME TOGGLE BUTTON */}
          <button
            onClick={toggleTheme}
            className="btn btn-sm"
            style={{
              backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
              border: `1px solid ${theme.cardBorder}`,
              color: theme.textPrimary,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 700,
              padding: '3px 7px',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '0.72rem'
            }}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? <Sun size={12} color="#F59E0B" /> : <Moon size={12} color="#4F46E5" />}
            <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
          </button>

          {/* ⛶ FULL SCREEN TOGGLE BUTTON */}
          <button
            onClick={toggleFullscreen}
            className="btn btn-sm"
            style={{
              background: isFullscreen ? 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)' : isDark ? '#1E293B' : '#E2E8F0',
              border: `1px solid ${isFullscreen ? '#4338CA' : theme.cardBorder}`,
              color: isFullscreen ? '#FFFFFF' : theme.textPrimary,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 800,
              padding: '3px 7px',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '0.72rem',
              boxShadow: isFullscreen ? '0 0 8px rgba(79, 70, 229, 0.4)' : 'none'
            }}
            title={isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}
          >
            {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Full Screen'}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={fetchFifoBoard}
            className="btn btn-secondary btn-sm"
            style={{
              backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
              borderColor: theme.cardBorder,
              color: theme.textPrimary,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 700,
              padding: '3px 7px',
              borderRadius: '5px',
              fontSize: '0.72rem'
            }}
            title="Refresh Live Stock"
          >
            <RefreshCw size={11} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>



      {/* ========================================================================= */}
      {/* 3. MAIN FIFO 13-LANE BOARD (REPLICATING PPTX SHOPFLOOR DESIGN)            */}
      {/* ========================================================================= */}
      <div
        style={{
          background: theme.boardOuterBg,
          borderRadius: '8px',
          padding: '4px 8px',
          border: `2px solid ${theme.boardOuterBorder}`,
          boxShadow: isDark ? '0 15px 35px -10px rgba(0, 0, 0, 0.7)' : '0 6px 20px rgba(0, 0, 0, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          position: 'relative'
        }}
      >
        {/* Top Board Title Banner */}
        <div
          style={{
            textAlign: 'center',
            marginBottom: '2px',
            flexShrink: 0
          }}
        >
          <div
            style={{
              display: 'inline-block',
              background: '#135033',
              color: '#FFFFFF',
              fontWeight: 900,
              fontSize: '1.56rem',
              letterSpacing: '2px',
              padding: '4px 26px',
              borderRadius: '12px',
              boxShadow: '0 3px 10px rgba(37, 99, 235, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.25)'
            }}
          >
            FIFO SYSTEMS
          </div>
        </div>

        {/* Board Main Grid: Level Guide + 10 Ingot Lanes + 3 Consumables Lanes */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '65px 1.8fr 1fr', // Sidebar halved, Consumables given proper flex ratio
            gap: '6px',
            alignItems: 'stretch',
            flex: 1,
            minHeight: 0,
            position: 'relative'
          }}
        >
          {/* ------------------------------------------------------------- */}
          {/* Left Column: BALL LEVEL GUIDE                                 */}
          {/* ------------------------------------------------------------- */}
          <div
            style={{
              background: theme.cardBg,
              borderRadius: '6px',
              border: `1px solid ${theme.cardBorder}`,
              padding: '4px 2px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: isDark ? 'inset 0 2px 6px rgba(0,0,0,0.3)' : '0 2px 6px rgba(0,0,0,0.03)',
              position: 'relative',
              gridRow: '1 / span 2'
            }}
          >
            <div style={{ textAlign: 'center', borderBottom: `1px solid ${theme.cardBorder}`, paddingBottom: '2px' }}>
              <div style={{ fontSize: '0.55rem', fontWeight: 900, color: '#2563EB', lineHeight: 1.1 }}>
                LEVEL<br/>GUIDE
              </div>
            </div>

            {/* Level 1: 🟢 MAXIMUM STOCK (GREEN - SAFE / OPTIMAL CAPACITY) */}
            <div
              style={{
                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
                border: `1.5px solid ${isDark ? 'rgba(16, 185, 129, 0.5)' : '#6EE7B7'}`,
                borderRadius: '5px',
                padding: '6px 2px',
                textAlign: 'center',
                boxShadow: '0 2px 5px rgba(16, 185, 129, 0.1)'
              }}
            >
              <div style={{ fontSize: '0.54rem', fontWeight: 900, color: '#059669', lineHeight: 1.1, marginBottom: '4px' }}>MAX</div>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle at 35% 28%, #FFFFFF 0%, #10B981 42%, #040810 100%)',
                  margin: '0 auto',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.35), inset 0 -2px 3px rgba(0,0,0,0.25)'
                }}
              />
            </div>

            {/* Level 2: 🟡 RE-ORDER STOCK (AMBER - WARNING / RE-ORDER TRIGGER) */}
            <div
              style={{
                backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FFFBEB',
                border: `1.5px solid ${isDark ? 'rgba(245, 158, 11, 0.5)' : '#FCD34D'}`,
                borderRadius: '5px',
                padding: '6px 2px',
                textAlign: 'center',
                boxShadow: '0 2px 5px rgba(245, 158, 11, 0.1)'
              }}
            >
              <div style={{ fontSize: '0.54rem', fontWeight: 900, color: '#D97706', lineHeight: 1.1, marginBottom: '4px' }}>RE-ORDER</div>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle at 35% 28%, #FFFFFF 0%, #F59E0B 42%, #040810 100%)',
                  margin: '0 auto',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.35), inset 0 -2px 3px rgba(0,0,0,0.25)'
                }}
              />
            </div>

            {/* Level 3: 🔴 MINIMUM STOCK (RED - CRITICAL / DANGER BUFFER) */}
            <div
              style={{
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2',
                border: `1.5px solid ${isDark ? 'rgba(239, 68, 68, 0.5)' : '#FCA5A5'}`,
                borderRadius: '5px',
                padding: '6px 2px',
                textAlign: 'center',
                boxShadow: '0 2px 5px rgba(239, 68, 68, 0.1)'
              }}
            >
              <div style={{ fontSize: '0.54rem', fontWeight: 900, color: '#DC2626', lineHeight: 1.1, marginBottom: '4px' }}>MIN</div>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle at 35% 28%, #FFFFFF 0%, #EF4444 42%, #040810 100%)',
                  margin: '0 auto',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.35), inset 0 -2px 3px rgba(0,0,0,0.25)'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '2px' }}>
              <div style={{ 
                background: isDark ? 'rgba(37, 99, 235, 0.15)' : '#EFF6FF',
                border: `1px solid ${isDark ? 'rgba(37, 99, 235, 0.3)' : '#BFDBFE'}`,
                borderRadius: '4px', padding: '3px 2px', textAlign: 'center',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}>
                <div style={{ fontSize: '0.42rem', fontWeight: 800, color: '#2563EB', textTransform: 'uppercase' }}>Ingots</div>
                <div style={{ fontSize: '0.48rem', fontWeight: 900, color: theme.textPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ 
                    width: '10px', height: '10px', borderRadius: '50%', 
                    background: 'radial-gradient(circle at 35% 28%, #FFFFFF 0%, #2563EB 42%, #040810 100%)', 
                    margin: '0 4px 0 0', 
                    boxShadow: isDark ? '0 1px 2px rgba(0,0,0,0.85), inset 0 -1px 2px rgba(0,0,0,0.55)' : '0 1px 2px rgba(0,0,0,0.3), inset 0 -1px 2px rgba(0,0,0,0.2)' 
                  }} /> 
                  = 1000kg
                </div>
              </div>
              <div style={{ 
                background: isDark ? 'rgba(139, 92, 246, 0.15)' : '#F5F3FF',
                border: `1px solid ${isDark ? 'rgba(139, 92, 246, 0.3)' : '#DDD6FE'}`,
                borderRadius: '4px', padding: '3px 2px', textAlign: 'center',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}>
                <div style={{ fontSize: '0.42rem', fontWeight: 800, color: '#8B5CF6', textTransform: 'uppercase' }}>Consumables</div>
                <div style={{ fontSize: '0.48rem', fontWeight: 900, color: theme.textPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ 
                    width: '10px', height: '10px', borderRadius: '50%', 
                    background: 'radial-gradient(circle at 35% 28%, #FFFFFF 0%, #8B5CF6 42%, #040810 100%)', 
                    margin: '0 4px 0 0', 
                    boxShadow: isDark ? '0 1px 2px rgba(0,0,0,0.85), inset 0 -1px 2px rgba(0,0,0,0.55)' : '0 1px 2px rgba(0,0,0,0.3), inset 0 -1px 2px rgba(0,0,0,0.2)' 
                  }} /> 
                  = 200kg
                </div>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* Middle Section: ALUMINIUM ALLOY INGOT DIVISIONS               */}
          {/* ------------------------------------------------------------- */}
          <div
            style={{
              background: theme.cardBg,
              borderRadius: '6px',
              border: `1px solid ${theme.cardBorder}`,
              padding: '4px 6px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: theme.shadow,
              minHeight: 0,
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Section Header Banner */}
            <div
              style={{
                background: theme.sectionHeaderIngot,
                color: '#FFFFFF',
                fontWeight: 900,
                fontSize: '1.4rem',
                textAlign: 'center',
                padding: '4px 0',
                borderRadius: '4px',
                letterSpacing: '1px',
                marginBottom: '3px',
                boxShadow: '0 2px 5px rgba(0,0,0,0.25)',
                flexShrink: 0
              }}
            >
              ALUMINIUM ALLOY INGOTS
            </div>

            {/* Division Grid */}
            <div
              style={{
                display: 'flex',
                gap: '4px',
                flex: 1,
                minHeight: 0,
                position: 'relative'
              }}
            >
              {ingotDivisions.map((div, index) => {
                // Determine banner color based on division name
                let bannerBg = isDark ? '#1E3A8A' : '#E0E7FF'; // Default
                let bannerColor = isDark ? '#FFFFFF' : '#1E3A8A';
                if (div.name.includes('01')) {
                  bannerBg = 'linear-gradient(90deg, #1E3A8A 0%, #172554 100%)';
                  bannerColor = '#FFFFFF';
                } else if (div.name.includes('02')) {
                  bannerBg = 'linear-gradient(90deg, #2563EB 0%, #1D4ED8 100%)';
                  bannerColor = '#FFFFFF';
                } else if (div.name.includes('03')) {
                  bannerBg = 'linear-gradient(90deg, #10B981 0%, #059669 100%)';
                  bannerColor = '#FFFFFF';
                } else if (div.name.includes('04')) {
                  bannerBg = 'linear-gradient(90deg, #F59E0B 0%, #D97706 100%)';
                  bannerColor = '#FFFFFF';
                }

                return (
                  <div
                    key={div.name}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      flex: div.lanes.length + 0.8, // Add 0.8 weight for the label column to give it space
                      borderRight: index < ingotDivisions.length - 1 ? `1px solid ${theme.cardBorder}` : 'none',
                      paddingRight: index < ingotDivisions.length - 1 ? '8px' : '0',
                      paddingLeft: index > 0 ? '8px' : '0',
                      position: 'relative'
                    }}
                  >

                    {/* Lanes Container within Division */}
                    <div
                      style={{
                        display: 'flex',
                        gap: '6px',
                        flex: 1,
                        position: 'relative',
                        alignItems: 'flex-start'
                      }}
                    >
                      {/* Actual Lanes */}
                      <div style={{ display: 'flex', flex: 1, gap: '6px', zIndex: 1, position: 'relative', alignItems: 'flex-start', paddingLeft: index === 0 ? '16px' : '0' }}>
                        {div.lanes.map((lane) => (
                          <div key={lane.laneId} style={{ flex: 1, zIndex: 1 }}>
                            <FifoChuteLane
                              lane={lane}
                              isDark={isDark}
                              theme={theme}
                              isFullscreen={isFullscreen}
                              onClick={() => setSelectedLane(lane)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* Right Section: 3 CONSUMABLES & ADDITIVES LANES                */}
          {/* ------------------------------------------------------------- */}
          <div
            style={{
              background: theme.cardBg,
              borderRadius: '6px',
              border: `1px solid ${theme.cardBorder}`,
              padding: '4px 6px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: theme.shadow,
              minHeight: 0,
              position: 'relative',
              overflow: 'hidden'   // ← prevents batch labels bleeding into footer
            }}
          >
            {/* Section Header Banner */}
            <div
              style={{
                background: theme.sectionHeaderConsumable,
                color: '#FFFFFF',
                fontWeight: 900,
                fontSize: '1.4rem',
                textAlign: 'center',
                padding: '4px 0',
                borderRadius: '4px',
                letterSpacing: '1px',
                marginBottom: '3px',
                boxShadow: '0 2px 5px rgba(0,0,0,0.25)',
                flexShrink: 0
              }}
            >
              CONSUMABLES
            </div>

            {/* Consumables Layout */}
            <div style={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: 'column' }}>


              {/* Chutes and Table Container */}
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                {/* Chutes Layout - Side Wise Limits for Consumables */}
                <div style={{ display: 'flex', flex: 1, gap: '6px', minHeight: 0 }}>
                  {consumableLanes.map((lane, index) => (
                    <div key={lane.laneId} style={{ display: 'flex', flex: 1, flexDirection: 'row', position: 'relative', borderRight: index < consumableLanes.length - 1 ? `1px solid ${theme.cardBorder}` : 'none', paddingRight: index < consumableLanes.length - 1 ? '6px' : '0', paddingLeft: index > 0 ? '6px' : '0' }}>
                      
                      {/* Actual Lane */}
                      <div style={{ display: 'flex', flex: 1, position: 'relative', zIndex: 1 }}>
                        <div style={{ flex: 1, zIndex: 1 }}>
                          <FifoChuteLane
                            lane={lane}
                            isDark={isDark}
                            theme={theme}
                            isFullscreen={isFullscreen}
                            onClick={() => setSelectedLane(lane)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* BOTTOM KPI BAR (Placed below the lanes)                                   */}
          {/* ========================================================================= */}
          <div
            style={{
              gridColumn: '2',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '6px',
              margin: '4px 0'
            }}
          >
            <div
              style={{
                background: theme.kpiBg,
                border: `1px solid ${theme.cardBorder}`,
                borderRadius: '6px',
                padding: '1px 6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: theme.shadow
              }}
            >
              <div style={{ width: '18px', height: '18px', borderRadius: '4px', backgroundColor: isDark ? 'rgba(37, 99, 235, 0.2)' : 'rgba(37, 99, 235, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB', flexShrink: 0 }}>
                <Boxes size={12} />
              </div>
              <div>
                <div style={{ fontSize: '0.5rem', color: theme.textSecondary, fontWeight: 700, textTransform: 'uppercase' }}>Total Ingot Stock</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 900, color: isDark ? '#38BDF8' : '#1D4ED8', lineHeight: 1.1 }}>
                  {(boardData?.totalPlantIngotStockKg || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} <span style={{ fontSize: '0.55rem', color: theme.textSecondary, fontWeight: 700 }}>KG</span>
                </div>
              </div>
            </div>

            <div
              style={{
                background: theme.kpiBg,
                border: `1px solid ${theme.cardBorder}`,
                borderRadius: '6px',
                padding: '1px 6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: theme.shadow
              }}
            >
              <div style={{ width: '18px', height: '18px', borderRadius: '4px', backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(217, 119, 6, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706', flexShrink: 0 }}>
                <Activity size={12} />
              </div>
              <div>
                <div style={{ fontSize: '0.5rem', color: theme.textSecondary, fontWeight: 700, textTransform: 'uppercase' }}>Total FIFO Balls</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 900, color: isDark ? '#FCD34D' : '#D97706', lineHeight: 1.1 }}>
                  {boardData?.totalActiveBalls || 0} <span style={{ fontSize: '0.55rem', color: theme.textSecondary, fontWeight: 700 }}>Balls</span>
                </div>
              </div>
            </div>

            <div
              style={{
                background: theme.kpiBg,
                border: `1px solid ${theme.cardBorder}`,
                borderRadius: '6px',
                padding: '1px 6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: theme.shadow
              }}
            >
              <div style={{ width: '18px', height: '18px', borderRadius: '4px', backgroundColor: isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(124, 58, 237, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C3AED', flexShrink: 0 }}>
                <ShieldCheck size={12} />
              </div>
              <div>
                <div style={{ fontSize: '0.5rem', color: theme.textSecondary, fontWeight: 700, textTransform: 'uppercase' }}>Lane Health Status</div>
                <div style={{ fontSize: '0.6rem', fontWeight: 800, marginTop: '1px' }}>
                  <span style={{ color: '#10B981' }}>{summaryStats.optimalCount} Optimal</span> • <span style={{ color: '#F59E0B' }}>{summaryStats.reorderCount} Alert</span> • <span style={{ color: theme.textSecondary }}>{summaryStats.emptyCount} Empty</span>
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              gridColumn: '3',
              display: 'flex',
              gap: '6px',
              margin: '4px 0'
            }}
          >
            <div
              style={{
                background: theme.kpiBg,
                border: `1px solid ${theme.cardBorder}`,
                borderRadius: '6px',
                padding: '1px 6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: theme.shadow,
                flex: 1
              }}
            >
              <div style={{ width: '18px', height: '18px', borderRadius: '4px', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(5, 150, 105, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981', flexShrink: 0 }}>
                <Flame size={12} />
              </div>
              <div>
                <div style={{ fontSize: '0.5rem', color: theme.textSecondary, fontWeight: 700, textTransform: 'uppercase' }}>TOTAL CONSUMABLES</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 900, color: isDark ? '#34D399' : '#059669', lineHeight: 1.1 }}>
                  {(boardData?.totalPlantConsumablesStockKg || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} <span style={{ fontSize: '0.55rem', color: theme.textSecondary, fontWeight: 700 }}>KG</span>
                </div>
              </div>
            </div>
          </div>
        </div>



        {/* ========================================================================= */}
        {/* 4. BOTTOM NEWS TICKER FOOTER                                              */}
        {/* ========================================================================= */}
        <div style={{
          height: '60px',
          backgroundColor: tickerConfig.bgColor,
          color: tickerConfig.textColor,
          fontWeight: 800,
          fontSize: '1.25rem',
          letterSpacing: '1px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          boxShadow: '0 -4px 12px rgba(0,0,0,0.25)',
          borderTop: `2px solid ${isDark ? '#334155' : '#1E293B'}`,
          flexShrink: 0,
          marginTop: 'auto'
        }}>
          <style>{`
            @keyframes newsTicker {
              0% { transform: translateX(100vw); }
              100% { transform: translateX(-100%); }
            }
          `}</style>
          <div 
            style={{ display: 'inline-block', animation: 'newsTicker 30s linear infinite', paddingRight: '50px' }}
            dangerouslySetInnerHTML={{ __html: tickerConfig.text }}
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. INTERACTIVE BATCH QUEUE DRAWER / MODAL                                 */}
      {/* ========================================================================= */}
      {selectedLane && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div
            style={{
              backgroundColor: isDark ? '#111827' : '#FFFFFF',
              borderRadius: '16px',
              border: '2px solid #3B82F6',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
              width: '100%',
              maxWidth: '850px',
              maxHeight: '90vh',
              overflowY: 'auto',
              color: theme.textPrimary,
              padding: '24px'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `1px solid ${theme.cardBorder}`, paddingBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    style={{
                      backgroundColor: selectedLane.colorCode,
                      color: '#FFFFFF',
                      fontWeight: 900,
                      fontSize: '0.85rem',
                      padding: '4px 12px',
                      borderRadius: '6px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                    }}
                  >
                    Lane #{selectedLane.laneId} • {selectedLane.materialGrade}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: theme.textSecondary, fontWeight: 600 }}>
                    {selectedLane.subGrade}
                  </span>
                </div>
                <h3 style={{ margin: '8px 0 0 0', fontSize: '1.25rem', fontWeight: 800 }}>
                  Active FIFO Ingot & Batch Traceability Queue
                </h3>
              </div>
              <button
                onClick={() => setSelectedLane(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: theme.textSecondary,
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={24} />
              </button>
            </div>

            {/* Stock Metric Highlights */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '12px',
                margin: '16px 0'
              }}
            >
              <div style={{ backgroundColor: isDark ? '#050811' : '#F8FAFC', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${theme.cardBorder}` }}>
                <div style={{ fontSize: '0.7rem', color: theme.textSecondary, fontWeight: 700 }}>CURRENT TOTAL STOCK</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#2563EB' }}>
                  {selectedLane.currentStockKg.toLocaleString()} <span style={{ fontSize: '0.75rem', color: theme.textSecondary }}>KG</span>
                </div>
              </div>

              <div style={{ backgroundColor: isDark ? '#050811' : '#F8FAFC', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${theme.cardBorder}` }}>
                <div style={{ fontSize: '0.7rem', color: theme.textSecondary, fontWeight: 700 }}>FIFO BALL COUNT</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#D97706' }}>
                  {selectedLane.ballCount} <span style={{ fontSize: '0.75rem', color: theme.textSecondary }}>Balls</span>
                </div>
              </div>

              <div style={{ backgroundColor: isDark ? '#050811' : '#F8FAFC', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${theme.cardBorder}` }}>
                <div style={{ fontSize: '0.7rem', color: theme.textSecondary, fontWeight: 700 }}>RE-ORDER THRESHOLD</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#F59E0B' }}>
                  {selectedLane.reorderStockKg.toLocaleString()} <span style={{ fontSize: '0.75rem', color: theme.textSecondary }}>KG</span>
                </div>
              </div>

              <div style={{ backgroundColor: isDark ? '#050811' : '#F8FAFC', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${theme.cardBorder}` }}>
                <div style={{ fontSize: '0.7rem', color: theme.textSecondary, fontWeight: 700 }}>HEALTH STATUS</div>
                <div style={{ fontSize: '1rem', fontWeight: 900, color: selectedLane.statusColor, marginTop: '2px' }}>
                  {selectedLane.healthStatus.replace('_', ' ')}
                </div>
              </div>
            </div>

            {/* FIFO Batches Table */}
            <div style={{ marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#2563EB' }}>
                  📦 Batches in Physical Queue (Ordered by Receipt Date - Oldest Drawn First)
                </h4>
                <span style={{ fontSize: '0.75rem', color: theme.textSecondary }}>
                  Total {selectedLane.batches.length} active lots
                </span>
              </div>

              {selectedLane.batches.length > 0 ? (
                <div style={{ overflowX: 'auto', borderRadius: '8px', border: `1px solid ${theme.cardBorder}` }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: isDark ? '#050811' : '#F8FAFC', color: theme.textSecondary, fontWeight: 800, borderBottom: `1px solid ${theme.cardBorder}` }}>
                      <tr>
                        <th style={{ padding: '8px 12px' }}>FIFO #</th>
                        <th style={{ padding: '8px 12px' }}>Batch / Lot No</th>
                        <th style={{ padding: '8px 12px' }}>Inward Date</th>
                        <th style={{ padding: '8px 12px' }}>Plant Age</th>
                        <th style={{ padding: '8px 12px' }}>Stock (KG)</th>
                        <th style={{ padding: '8px 12px' }}>Storage Bay</th>
                        <th style={{ padding: '8px 12px' }}>FIFO Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedLane.batches.map((b, idx) => (
                        <tr
                          key={b.batchNumber + idx}
                          style={{
                            borderBottom: `1px solid ${theme.cardBorder}`,
                            backgroundColor: idx === 0 ? (isDark ? 'rgba(16, 185, 129, 0.08)' : '#ECFDF5') : 'transparent'
                          }}
                        >
                          <td style={{ padding: '8px 12px', fontWeight: 800, color: idx === 0 ? '#10B981' : theme.textSecondary }}>
                            {idx === 0 ? '🔥 #1 (Next)' : `#${b.queuePosition}`}
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: 700, color: theme.textPrimary }}>
                            {b.batchNumber}
                            {b.heatNumber && <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>Heat: {b.heatNumber}</div>}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            {new Date(b.receiptDate).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontWeight: 700,
                                fontSize: '0.72rem',
                                backgroundColor: b.daysInPlant > 30 ? 'rgba(239, 68, 68, 0.15)' : b.daysInPlant > 14 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                color: b.daysInPlant > 30 ? '#DC2626' : b.daysInPlant > 14 ? '#D97706' : '#059669'
                              }}
                            >
                              {b.daysInPlant} Days
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: 800, color: '#2563EB' }}>
                            {b.stockQuantity.toLocaleString()} KG
                          </td>
                          <td style={{ padding: '8px 12px', color: theme.textSecondary }}>
                            {b.location || 'FIFO-BAY-01'}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontWeight: 800,
                                fontSize: '0.72rem',
                                backgroundColor: idx === 0 ? '#059669' : isDark ? '#1E293B' : '#E2E8F0',
                                color: idx === 0 ? '#FFFFFF' : theme.textPrimary
                              }}
                            >
                              {b.fifoStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px', backgroundColor: isDark ? '#050811' : '#F8FAFC', borderRadius: '8px', color: theme.textSecondary }}>
                  No active batches recorded in this chute.
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', borderTop: `1px solid ${theme.cardBorder}`, paddingTop: '16px' }}>
              <button
                type="button"
                onClick={() => setSelectedLane(null)}
                className="btn btn-secondary"
                style={{ backgroundColor: isDark ? '#1E293B' : '#F1F5F9', borderColor: theme.cardBorder, color: theme.textPrimary }}
              >
                Close Traceability Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. DAILY AUDIT SIGN-OFF MODAL                                             */}
      {/* ========================================================================= */}
      {isAuditModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div
            style={{
              backgroundColor: isDark ? '#111827' : '#FFFFFF',
              borderRadius: '16px',
              border: '2px solid #10B981',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
              width: '100%',
              maxWidth: '560px',
              color: theme.textPrimary,
              padding: '24px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${theme.cardBorder}`, paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={24} color="#10B981" />
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                  Daily FIFO Shift Audit & Verification
                </h3>
              </div>
              <button
                onClick={() => setIsAuditModalOpen(false)}
                style={{ background: 'none', border: 'none', color: theme.textSecondary, cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {auditSuccess && (
              <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#ECFDF5', color: '#059669', fontSize: '0.85rem', fontWeight: 700, border: '1px solid #A7F3D0' }}>
                ✔ {auditSuccess}
              </div>
            )}

            <form onSubmit={handleSaveAudit} style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: theme.textSecondary, marginBottom: '4px', display: 'block' }}>
                    Audit Shift
                  </label>
                  <select
                    className="form-control"
                    value={auditShift}
                    onChange={(e) => setAuditShift(e.target.value)}
                    style={{ backgroundColor: isDark ? '#050811' : '#F8FAFC', borderColor: theme.cardBorder, color: theme.textPrimary }}
                  >
                    <option value="Shift A">Shift A (06:00 - 14:30)</option>
                    <option value="Shift B">Shift B (14:30 - 23:00)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: theme.textSecondary, marginBottom: '4px', display: 'block' }}>
                    Audit Time Stamp
                  </label>
                  <input
                    type="text"
                    disabled
                    value={`${boardData?.date || new Date().toISOString().split('T')[0]} ${currentTime}`}
                    className="form-control"
                    style={{ backgroundColor: isDark ? '#050811' : '#F8FAFC', borderColor: theme.cardBorder, color: theme.textSecondary }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: theme.textSecondary, marginBottom: '4px', display: 'block' }}>
                  Checked By (Store In-Charge)
                </label>
                <input
                  type="text"
                  required
                  value={auditCheckedBy}
                  onChange={(e) => setAuditCheckedBy(e.target.value)}
                  className="form-control"
                  style={{ backgroundColor: isDark ? '#050811' : '#F8FAFC', borderColor: theme.cardBorder, color: theme.textPrimary }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: theme.textSecondary, marginBottom: '4px', display: 'block' }}>
                  Verified By (Quality / Production Manager)
                </label>
                <input
                  type="text"
                  required
                  value={auditVerifiedBy}
                  onChange={(e) => setAuditVerifiedBy(e.target.value)}
                  className="form-control"
                  style={{ backgroundColor: isDark ? '#050811' : '#F8FAFC', borderColor: theme.cardBorder, color: theme.textPrimary }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: theme.textSecondary, marginBottom: '4px', display: 'block' }}>
                  Auditor Remarks / Physical Inspection Notes
                </label>
                <textarea
                  rows={3}
                  value={auditRemarks}
                  onChange={(e) => setAuditRemarks(e.target.value)}
                  className="form-control"
                  style={{ backgroundColor: isDark ? '#050811' : '#F8FAFC', borderColor: theme.cardBorder, color: theme.textPrimary }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsAuditModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ backgroundColor: isDark ? '#1E293B' : '#F1F5F9', borderColor: theme.cardBorder, color: theme.textPrimary }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAudit}
                  className="btn btn-primary"
                  style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', borderColor: '#059669', color: '#FFFFFF' }}
                >
                  {savingAudit ? 'Recording Sign-off...' : 'Sign & Submit Daily Audit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// SUB-COMPONENT: Individual Gravity Chute Lane
//
// Architecture:
//   • ALL tubes share the same FIXED HEIGHT — like physical cylinders on a rack.
//   • Ball size = fixed height / maxCapacityBalls  (so threshold marks align exactly).
//   • Balls are positioned ABSOLUTELY from the tube bottom — overstock balls rise
//     above the tube top naturally (no clipping), since the tube is open-top.
//   • Level mark labels sit OUTSIDE the tube to the LEFT with a colored tick.
// =============================================================================
interface FifoChuteLaneProps {
  lane: FifoLane;
  isDark: boolean;
  theme: any;
  isFullscreen: boolean;
  onClick: () => void;
}

const FifoChuteLane: React.FC<FifoChuteLaneProps> = ({ lane, isDark, theme, isFullscreen, onClick }) => {
  const displayBallCount = lane.ballCount;

  const ballGradient = `radial-gradient(circle at 35% 28%, #FFFFFF 0%, ${lane.statusColor} 42%, #040810 100%)`;

  // ── Fixed dimensions — SAME for every lane ─────────────────────────────────
  const TUBE_W   = isFullscreen ? 48  : 38;   // tube width (px)
  const TUBE_H   = isFullscreen ? 420 : 360;  // Taller tubes to perfectly fill available layout space
  const MAX_BALL = isFullscreen ? 32  : 26;   // maximum ball diameter (px)
  const TUBE_GAP = isFullscreen ? 36  : 26;

  const BALLS_PER_TUBE = Math.floor(TUBE_H / MAX_BALL); // perfectly fill physical tube height

  // ── Ball sizing & Tube calculation ──────────────────────────────────────────
  const numTubes = Math.max(1, Math.ceil(displayBallCount / BALLS_PER_TUBE)); // Only spawn tubes for actual stock
  const ballPx = MAX_BALL;

  // ── Label style ─────────────────────────────────────────────────────────────
  const lbFs = isFullscreen ? '0.54rem' : '0.42rem';
  const tick = isFullscreen ? 8 : 6;

  // ── Ball batch labels (packed per ball slot) ────────────────────────────────
  const ballLabels: string[] = [];
  let batchIdx = 0;
  let batchRem = lane.batches.length > 0 ? lane.batches[0].stockQuantity : 0;
  for (let i = 0; i < displayBallCount; i++) {
    let lbl = '';
    let space = lane.ballScaleKg;
    while (space > 0 && batchIdx < lane.batches.length) {
      if (lbl) lbl += ', ';
      lbl += lane.batches[batchIdx].batchNumber;
      if (batchRem <= space) {
        space -= batchRem;
        batchIdx++;
        batchRem = batchIdx < lane.batches.length ? lane.batches[batchIdx].stockQuantity : 0;
      } else { batchRem -= space; space = 0; }
    }
    // If we've run out of explicit batches but still have ledger stock to draw, label it.
    if (!lbl) lbl = 'Unallocated';
    ballLabels.push(lbl);
  }

  const Mark = ({ btm, color, val, side, wrapText = false }: { btm: number; color: string; val: number; side: 'left' | 'right', wrapText?: boolean }) => {
    return (
      <div style={{
        position: 'absolute', bottom: btm, 
        [side === 'left' ? 'right' : 'left']: '100%',
        display: 'flex', alignItems: 'center',
        flexDirection: side === 'left' ? 'row' : 'row-reverse',
        transform: 'translateY(50%)', zIndex: 10, pointerEvents: 'none'
      }}>
        <span style={{
          fontSize: lbFs, fontWeight: 900, color,
          whiteSpace: wrapText ? 'pre-line' : 'nowrap', 
          lineHeight: wrapText ? 1.1 : 1, 
          textAlign: wrapText ? 'center' : (side === 'left' ? 'right' : 'left'),
          [side === 'left' ? 'marginRight' : 'marginLeft']: '3px',
          textShadow: isDark ? '0 1px 4px #000' : '0 1px 2px #fff'
        }}>{wrapText ? val.toLocaleString().replace(/,/g, ',\n') : val.toLocaleString()}</span>
        <div style={{ width: tick, height: 2, background: color, flexShrink: 0 }} />
      </div>
    );
  };

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'flex-start', cursor: 'pointer',
        transition: 'transform 0.12s ease', borderRadius: '8px',
        padding: '2px', height: '100%', minHeight: 0
      }}
      title={`${lane.materialGrade} — ${lane.currentStockKg.toLocaleString()} Kg`}
    >

      {/* ── GRADE PILL ──────────────────────────────────────────────────────── */}
      <div style={{ width: '100%', flexShrink: 0, marginBottom: '10px' }}>
        <div style={{
          width: '100%', backgroundColor: lane.colorCode, color: '#FFF',
          fontWeight: 900, fontSize: isFullscreen ? '1.04rem' : '0.89rem',
          textAlign: 'center', padding: '3px 1px', borderRadius: '5px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.3)', whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis',
          border: '1.5px solid rgba(255,255,255,0.35)'
        }}>
          {lane.materialGrade}
        </div>
        <div style={{
          fontSize: '0.52rem', color: theme.textSecondary, marginTop: '1px',
          fontWeight: 700, textAlign: 'center', height: '12px',
          overflow: 'hidden', whiteSpace: 'nowrap'
        }}>
          {lane.subGrade.split(' ')[0]}
        </div>
      </div>

      {/* ── BOTTOM GROUP (Tube + Arrow + Badge) ── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        {/* ── MULTI-TUBE ASSEMBLY ─────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', flexDirection: 'row', gap: `${TUBE_GAP}px`,
          alignItems: 'flex-end', marginBottom: '10px', marginTop: '0'
        }}>
          {Array.from({ length: numTubes }).map((_, tubeIdx) => {
            const tubeStartIdx = tubeIdx * BALLS_PER_TUBE;
            const tubeEndIdx = tubeStartIdx + BALLS_PER_TUBE;
            const isLastTube = tubeIdx === numTubes - 1;

            const targetMinBalls = lane.minStockKg / lane.ballScaleKg;
            const targetReorderBalls = lane.reorderStockKg / lane.ballScaleKg;
            const targetMaxBalls = lane.maxStockKg / lane.ballScaleKg;

            // Pinning logic: simply cap at TUBE_H - 2 for lines exceeding the tube
            let maxPx = targetMaxBalls > tubeStartIdx && targetMaxBalls <= tubeEndIdx ? (targetMaxBalls - tubeStartIdx) * ballPx : (targetMaxBalls > tubeEndIdx && isLastTube ? TUBE_H - 2 : null);
            let reodrPx = targetReorderBalls > tubeStartIdx && targetReorderBalls <= tubeEndIdx ? (targetReorderBalls - tubeStartIdx) * ballPx : (targetReorderBalls > tubeEndIdx && isLastTube ? TUBE_H - 2 : null);
            let minPx = targetMinBalls > tubeStartIdx && targetMinBalls <= tubeEndIdx ? (targetMinBalls - tubeStartIdx) * ballPx : (targetMinBalls > tubeEndIdx && isLastTube ? TUBE_H - 2 : null);

            // Resolve overlapping top-down to ensure max marking never exceeds the tube mark
            if (maxPx !== null && maxPx > TUBE_H - 2) maxPx = TUBE_H - 2;

            const shouldWrap = numTubes > 1;
            const stagger = shouldWrap ? 18 : 14;

            if (reodrPx !== null && maxPx !== null && reodrPx > maxPx - stagger) reodrPx = maxPx - stagger;
            
            if (minPx !== null && reodrPx !== null && minPx > reodrPx - stagger) minPx = reodrPx - stagger;
            else if (minPx !== null && maxPx !== null && minPx > maxPx - stagger) minPx = maxPx - stagger;

            // Only need tubeBallLabels for the balls now
            const tubeBallLabels = ballLabels.slice(tubeStartIdx, tubeEndIdx);

            return (
              <div key={tubeIdx} style={{
                position: 'relative', width: TUBE_W, height: TUBE_H,
                flexShrink: 0, overflow: 'visible'
              }}>
                {/* GLASS CYLINDER SHELL */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: isDark
                    ? 'rgba(255,255,255,0.025)'
                    : 'linear-gradient(90deg,rgba(0,0,0,0.05) 0%,rgba(0,0,0,0.01) 30%,rgba(0,0,0,0.01) 70%,rgba(0,0,0,0.05) 100%)',
                  borderLeft:  '4px solid rgba(200,200,200,0.85)',
                  borderRight: '4px solid rgba(200,200,200,0.85)',
                  pointerEvents: 'none', zIndex: 1
                }}>
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0, left: '2px', width: '4px',
                    background: 'linear-gradient(90deg,rgba(255,255,255,0.45) 0%,transparent 100%)',
                    pointerEvents: 'none'
                  }} />

                  {/* Empty state hatching ONLY if it's the first tube and completely empty */}
                  {tubeIdx === 0 && displayBallCount === 0 && (
                    <>
                      <div style={{
                        position: 'absolute', inset: 0, opacity: isDark ? 0.1 : 0.06,
                        backgroundImage: 'repeating-linear-gradient(45deg,#000 0,#000 2px,transparent 2px,transparent 9px)', pointerEvents: 'none'
                      }} />
                      <div style={{
                        position: 'absolute', top: '50%', left: 0, right: 0,
                        transform: 'translateY(-50%)', textAlign: 'center',
                        color: theme.textSecondary, fontSize: '1.1rem',
                        fontWeight: 900, opacity: 0.45, pointerEvents: 'none'
                      }}>—</div>
                    </>
                  )}

                  {/* DASHED THRESHOLD LINES */}
                  {minPx !== null && <div style={{ position:'absolute', bottom: minPx, left:0, right:0, borderTop:'2px dashed rgba(239,68,68,0.9)', zIndex:3 }} />}
                  {reodrPx !== null && <div style={{ position:'absolute', bottom: reodrPx, left:0, right:0, borderTop:'2px dashed rgba(245,158,11,0.9)', zIndex:3 }} />}
                  {maxPx !== null && <div style={{ position:'absolute', bottom: maxPx, left:0, right:0, borderTop:'2px dashed rgba(16,185,129,0.9)', zIndex:3 }} />}
                </div>

                {/* BALL LAYER */}
                {tubeBallLabels.map((lbl, localIdx) => {
                  const globalIdx = tubeStartIdx + localIdx;
                  if (globalIdx >= displayBallCount) return null;

                  const fromBottom = localIdx * ballPx;
                  const isTopBall = globalIdx === displayBallCount - 1;
                  const remainder = lane.currentStockKg - Math.floor(lane.currentStockKg / lane.ballScaleKg) * lane.ballScaleKg;
                  const isPartial = isTopBall && remainder > 0;
                  
                  let clipPath = 'none';
                  if (isPartial) {
                    const emptyPct = 100 - (remainder / lane.ballScaleKg) * 100;
                    clipPath = `inset(${emptyPct}% 0 0 0)`;
                  }

                  return (
                    <div
                      key={`ball-${globalIdx}`}
                      title={lbl ? `Batch: ${lbl}` : undefined}
                      style={{
                        position: 'absolute', bottom: fromBottom, left: '50%', transform: 'translateX(-50%)',
                        width:  ballPx, height: ballPx, borderRadius: '50%', background: ballGradient,
                        boxShadow: isDark ? '0 2px 4px rgba(0,0,0,0.85), inset 0 -2px 3px rgba(0,0,0,0.55)' : '0 2px 4px rgba(0,0,0,0.3),  inset 0 -2px 3px rgba(0,0,0,0.2)',
                        zIndex: 4 + localIdx, clipPath: clipPath,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >
                      {lbl && lbl !== 'Unallocated' && (
                        <span style={{
                          color: '#000000', fontSize: isFullscreen ? '0.44rem' : '0.38rem', fontWeight: 900,
                          textShadow: '0 0 4px rgba(255,255,255,0.9), 0 1px 1px rgba(255,255,255,1)',
                          textAlign: 'center', lineHeight: 1, letterSpacing: '-0.3px',
                          width: '95%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }}>
                          {lbl.split(', ')[0]}
                        </span>
                      )}
                    </div>
                  );
                })}

                {/* LEVEL MARK LABELS */}
                {minPx !== null && <Mark btm={minPx} color="#EF4444" val={lane.minStockKg} side="right" wrapText={shouldWrap} />}
                {reodrPx !== null && <Mark btm={reodrPx} color="#F59E0B" val={lane.reorderStockKg} side="right" wrapText={shouldWrap} />}
                {maxPx !== null && <Mark btm={maxPx} color="#10B981" val={lane.maxStockKg} side="right" wrapText={shouldWrap} />}
              </div>
            );
          })}
        </div>{/* end tube assembly */}



      {/* ── STOCK BADGE ─────────────────────────────────────────────────────── */}
      <div style={{ width:'100%', flexShrink:0 }}>
        <div style={{
          width:'100%',
          background: isDark 
            ? 'linear-gradient(145deg, #1E293B, #0F172A)' 
            : 'linear-gradient(145deg, #FFFFFF, #F8FAFC)',
          border: `1px solid ${lane.currentStockKg > 0 ? (isDark ? '#3B82F6' : '#2563EB') : (isDark ? '#334155' : '#E2E8F0')}`,
          borderRadius: '8px',
          padding: '6px 2px',
          textAlign: 'center',
          boxShadow: lane.currentStockKg > 0 
            ? (isDark ? '0 4px 12px rgba(59, 130, 246, 0.25), inset 0 1px 1px rgba(255,255,255,0.1)' : '0 4px 12px rgba(37, 99, 235, 0.15), inset 0 1px 1px rgba(255,255,255,0.8)')
            : '0 2px 4px rgba(0,0,0,0.05)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {lane.currentStockKg > 0 && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, #3B82F6, transparent)' }} />
          )}
          <div style={{ fontSize: '0.45rem', color: theme.textSecondary, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Total Stock
          </div>
          <div style={{ 
            fontSize: '0.9rem', 
            fontWeight: 900, 
            color: lane.currentStockKg > 0 ? (isDark ? '#60A5FA' : '#1D4ED8') : theme.textSecondary, 
            fontFamily: 'monospace',
            textShadow: lane.currentStockKg > 0 && isDark ? '0 0 10px rgba(96, 165, 250, 0.4)' : 'none',
            marginTop: '1px'
          }}>
            {lane.currentStockKg > 0 ? `${Math.round(lane.currentStockKg).toLocaleString()} kg` : '—'}
          </div>
        </div>

      </div>
      </div>
    </div>
  );
};


