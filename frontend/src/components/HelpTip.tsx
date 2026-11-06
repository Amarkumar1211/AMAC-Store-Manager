import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, X, Info } from 'lucide-react';

export interface AcronymDefinition {
  fullForm: string;
  meaning: string;
  category?: string;
}

export const ACRONYM_DICTIONARY: Record<string, AcronymDefinition> = {
  'CAPA': {
    fullForm: 'Corrective And Preventive Action',
    meaning: 'A structured manufacturing & quality process to eliminate the root causes of non-conformities, production shortfalls, or supplier delivery variances to prevent future occurrences.',
    category: 'Quality & Supply Chain'
  },
  'GRN': {
    fullForm: 'Goods Receipt Note',
    meaning: 'Official inward warehouse document acknowledging receipt of materials from a supplier after physical verification, weight checking, and quality inspection.',
    category: 'Store & Inward'
  },
  'PO': {
    fullForm: 'Purchase Order',
    meaning: 'Legally binding commercial document issued by the company to a supplier specifying agreed quantities, item codes, negotiated unit rates, and delivery schedules.',
    category: 'Procurement'
  },
  'PR': {
    fullForm: 'Purchase Requisition (Indent)',
    meaning: 'Internal material request document raised by department supervisors or automatically by the 6:00 PM auto-reorder scheduler requesting procurement.',
    category: 'Procurement'
  },
  'SKU': {
    fullForm: 'Stock Keeping Unit',
    meaning: 'A distinct alphanumeric code assigned to each material, ingot, sand, resin, spare, or consumable to track its inventory balance and movements.',
    category: 'Inventory'
  },
  'UOM': {
    fullForm: 'Unit of Measure',
    meaning: 'The standardized measurement unit (e.g., KG, LTR, NOS, MTR, BAG, SET) used to record quantities for materials, purchases, and issues.',
    category: 'Inventory'
  },
  'HPDC': {
    fullForm: 'High Pressure Die Casting',
    meaning: 'Foundry casting manufacturing process where molten aluminium alloy is injected under high pressure into steel die cavities to produce complex automotive parts.',
    category: 'Foundry Process'
  },
  'LPDC': {
    fullForm: 'Low Pressure Die Casting',
    meaning: 'Foundry process where molten alloy is introduced smoothly from below into a die under low air pressure, reducing turbulence and oxidation.',
    category: 'Foundry Process'
  },
  'RCS': {
    fullForm: 'Resin Coated Sand',
    meaning: 'Specially coated silica sand used in shell core shooting and sand moulding processes to produce intricate internal casting passages.',
    category: 'Foundry Raw Material'
  },
  'L1 Rate': {
    fullForm: 'Lowest 1st Price Supplier Rate',
    meaning: 'The lowest bidding rate among approved suppliers. The auto-requisition engine automatically selects the L1 supplier when multiple vendors supply the same item.',
    category: 'Purchasing'
  },
  'L2 Rate': {
    fullForm: 'Lowest 2nd Price Supplier Rate',
    meaning: 'The secondary backup vendor rate utilized if the primary L1 supplier has capacity constraints, delivery shortfalls, or material rejection issues.',
    category: 'Purchasing'
  },
  'OTIF': {
    fullForm: 'On-Time In-Full',
    meaning: 'A supply chain KPI measuring the percentage of supplier deliveries that arrived exactly on the agreed date with 100% of the ordered quantity.',
    category: 'Supply Chain Metric'
  },
  'RCA': {
    fullForm: 'Root Cause Analysis',
    meaning: 'A systematic problem-solving methodology used to identify the fundamental source cause of delivery shortfalls, machine breakdowns, or casting defects.',
    category: 'Quality Management'
  },
  'FIFO': {
    fullForm: 'First In, First Out',
    meaning: 'Store inventory valuation and dispatch principle ensuring the oldest received material batches are issued first to prevent material degradation or shelf-life expiry.',
    category: 'Store Management'
  },
  'BOM': {
    fullForm: 'Bill of Materials',
    meaning: 'A comprehensive list of raw materials, aluminium ingots, fluxes, degassing tablets, and cores required to produce a finished casting component.',
    category: 'Production'
  },
  'Tx': {
    fullForm: 'Transaction Movement',
    meaning: 'A single recorded stock movement entry in the store ledger (such as Inward GRN receipt, Outward Issue Slip, or Physical Stock Adjustment).',
    category: 'Store Ledger'
  },
  'Crit': {
    fullForm: 'Critical Buffer Stock Alert',
    meaning: 'Stock level has dropped below 25% of the safe reorder buffer. Immediate expedited procurement is required to prevent foundry furnace stoppage.',
    category: 'Stock Health'
  },
  'IS': {
    fullForm: 'Material Issue Slip',
    meaning: 'An official store authorization document tracking material consumption transferred from main warehouse to production shops (HPDC, Core Shop, Moulding).',
    category: 'Store & Dispatch'
  },
  'GST': {
    fullForm: 'Goods and Services Tax',
    meaning: 'Comprehensive indirect tax levied on the manufacture, sale, and consumption of goods and industrial raw materials across India.',
    category: 'Commercial'
  }
};

interface HelpTipProps {
  title?: string;
  fullForm?: string;
  meaning?: string;
  category?: string;
  text?: string;
  term?: string;
  children?: React.ReactNode;
  inline?: boolean;
}

export const HelpTip: React.FC<HelpTipProps> = ({
  title,
  fullForm,
  meaning,
  category,
  text,
  term,
  children,
  inline = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const tipRef = useRef<HTMLDivElement>(null);

  // Look up dictionary if term is provided
  const dictEntry = term ? ACRONYM_DICTIONARY[term] : undefined;
  const displayTitle = title || dictEntry?.fullForm || term || 'Information';
  const displayFullForm = fullForm || dictEntry?.fullForm;
  const displayMeaning = meaning || text || dictEntry?.meaning || '';
  const displayCategory = category || dictEntry?.category;

  // Handle clicking outside to close pinned popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tipRef.current && !tipRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const showPopover = isOpen || isHovered;

  return (
    <span
      ref={tipRef}
      className={`help-tip-wrapper ${inline ? 'inline-flex' : 'flex'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
    >
      {children}
      <button
        type="button"
        className={`help-tip-trigger ${isOpen ? 'active' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        title={`Click or hover for meaning of ${term || displayTitle}`}
        aria-label="Information and Full Form Definition"
      >
        <HelpCircle size={13} className="help-tip-icon" />
      </button>

      {showPopover && (
        <div className="help-tip-popover" onClick={(e) => e.stopPropagation()}>
          <div className="help-tip-popover-header">
            <div className="help-tip-popover-title-row">
              <Info size={14} className="help-tip-info-icon" />
              <div className="help-tip-popover-title">
                {term && <span className="help-tip-term-badge">{term}</span>}
                <strong>{displayFullForm || displayTitle}</strong>
              </div>
            </div>
            <button
              type="button"
              className="help-tip-popover-close"
              onClick={() => {
                setIsOpen(false);
                setIsHovered(false);
              }}
              title="Close"
            >
              <X size={12} />
            </button>
          </div>

          <div className="help-tip-popover-body">
            {displayMeaning}
          </div>

          {displayCategory && (
            <div className="help-tip-popover-footer">
              <span className="help-tip-category-pill">{displayCategory}</span>
              <span className="help-tip-hint">Click outside to close</span>
            </div>
          )}
        </div>
      )}
    </span>
  );
};

export const Acronym: React.FC<{ term: string; label?: string; showTermOnly?: boolean }> = ({
  term,
  label,
  showTermOnly = false
}) => {
  return (
    <HelpTip term={term}>
      <span className="acronym-text" style={{ fontWeight: 700 }}>
        {label || term}
      </span>
    </HelpTip>
  );
};

export default HelpTip;
