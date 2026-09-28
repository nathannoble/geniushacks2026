import { useEffect, useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient, type CaseState } from '../lib/api';
import { useAuth } from '../context/AuthContext';

type ParsedCitation = {
  module: string;
  source: string;
  category: string;
  value: string;
};

function parseCitation(raw: string): ParsedCitation {
  const parts = raw.split(':').map(s => s.trim());
  if (parts.length >= 4) {
    return {
      module: parts[0],
      source: parts[1],
      category: parts[2],
      value: parts.slice(3).join(': ').trim(),
    };
  } else if (parts.length === 3) {
    return {
      module: parts[0],
      source: parts[1],
      category: 'general',
      value: parts[2],
    };
  }
  return {
    module: 'Log',
    source: 'Raw Extraction',
    category: 'general',
    value: raw,
  };
}

function CitationGroup({ category, citations }: { category: string; citations: ParsedCitation[] }) {
  const formatHeader = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'party': return 'Extracted Parties';
      case 'jurisdiction': return 'Identified Jurisdictions';
      case 'transaction_type': return 'Transaction Types';
      case 'customer_type': return 'Customer Types';
      default: return cat.charAt(0).toUpperCase() + cat.slice(1);
    }
  };

  return (
    <div className="mb-6">
      <h4 className="text-md font-semibold text-slate-200 mt-6 mb-3">{formatHeader(category)}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {citations.map((c, i) => (
          <div key={i} className="p-3 bg-slate-800/50 border border-slate-700 rounded-md relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-slate-700 text-slate-300 text-[0.6rem] px-2 py-0.5 rounded-bl-md font-medium uppercase tracking-wider">
              {c.module}
            </div>
            <p className="text-sm font-medium text-blue-100 pr-16">{c.value}</p>
            <p className="text-xs text-slate-400 truncate mt-1" title={c.source}>
              Source: {c.source}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LegalPolicyCitations({ citations }: { citations: string[] }) {
  if (!citations || citations.length === 0) {
    return (
      <div className="mt-6 p-4 bg-slate-800/30 border border-slate-700 rounded-md text-slate-400 text-sm">
        No legal or policy citations available for this case.
      </div>
    );
  }

  try {
    const parsed = citations.map(parseCitation);
    const grouped = parsed.reduce((acc, curr) => {
      if (!acc[curr.category]) acc[curr.category] = [];
      acc[curr.category].push(curr);
      return acc;
    }, {} as Record<string, ParsedCitation[]>);

    return (
      <div className="mt-6">
        <h3 style={{marginTop: '1.5rem', marginBottom: '0.5rem'}}>Legal & Policy Citations</h3>
        {Object.entries(grouped).map(([category, items]) => (
          <CitationGroup key={category} category={category} citations={items} />
        ))}
      </div>
    );
  } catch (err) {
    // Fallback error state
    return (
      <div className="mt-6 p-4 bg-red-900/20 border border-red-800 rounded-md text-red-200 text-sm">
        Summary unavailable — citations could not be parsed correctly.
      </div>
    );
  }
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const currentPersona = user?.role || 'Product Owner';

  const { data: casesData } = useQuery({ queryKey: ['cases'], queryFn: () => apiClient.listCases() });
  const cases = casesData || [];
  const [activeTab, setActiveTab] = useState('queue'); // 'queue', 'new-case', 'dossier'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgressMessage, setSubmitProgressMessage] = useState('Submit Change for Risk Assessment →');

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isSubmitting) {
      const messages = [
        "Initializing Multi-Agent Orchestrator...",
        "Running Document Extraction (M2)...",
        "Executing Policy Retrieval (M3)...",
        "Calculating Risk Score (M5)...",
        "Drafting Executive Memo (M6)...",
        "Finalizing Case Dossier..."
      ];
      let i = 0;
      setSubmitProgressMessage(messages[0]);
      interval = setInterval(() => {
        i++;
        if (i < messages.length) {
          setSubmitProgressMessage(messages[i]);
        }
      }, 1500);
    } else {
      setSubmitProgressMessage('Submit Change for Risk Assessment →');
    }
    return () => clearInterval(interval);
  }, [isSubmitting]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [dossierTab, setDossierTab] = useState('memo');
  
  const { data: dossierData } = useQuery({
    queryKey: ['case', activeCaseId],
    queryFn: () => apiClient.getCase(activeCaseId!),
    enabled: !!activeCaseId && activeTab === 'dossier',
  });
  
  const currentCaseId = activeCaseId;

  // Gate Modals State
  const [isGate1ModalOpen, setIsGate1ModalOpen] = useState(false);
  const [isGate1Submitting, setIsGate1Submitting] = useState(false);
  const [isGate2ModalOpen, setIsGate2ModalOpen] = useState(false);
  const [isGate2Submitting, setIsGate2Submitting] = useState(false);
  const [gate1Action, setGate1Action] = useState('finalize');
  const [gate1Notes, setGate1Notes] = useState('');
  
  const [gate2Outcome, setGate2Outcome] = useState('Approved with Conditions');
  const [gate2Conditions, setGate2Conditions] = useState<string[]>([]);
  const [newCondition, setNewCondition] = useState('');

  // Stepper State
  const [stepperAnimated, setStepperAnimated] = useState(false);

  // KPI Filters
  const [activeFilterStatus, setActiveFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [productType, setProductType] = useState('');
  const [changeType, setChangeType] = useState('New Product Launch');
  const [geography, setGeography] = useState('');
  const [segment, setSegment] = useState('');
  const [targetDate, setTargetDate] = useState('2026-10-15');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [autoFilled, setAutoFilled] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGate1Submit = async () => {
    if (!currentCaseId) return;
    setIsGate1Submitting(true);
    const res = await apiClient.resolveGate1(currentCaseId, gate1Action, gate1Notes, currentPersona);
    setIsGate1Submitting(false);
    setIsGate1ModalOpen(false);
    if (res.success) {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['case', currentCaseId] });
      openDossier(currentCaseId);
    }
  };

  const handleGate2Submit = async () => {
    if (!currentCaseId) return;
    setIsGate2Submitting(true);
    const res = await apiClient.resolveGate2(currentCaseId, gate2Outcome, gate2Conditions, currentPersona);
    setIsGate2Submitting(false);
    setIsGate2ModalOpen(false);
    if (res.success) {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['case', currentCaseId] });
      openDossier(currentCaseId);
    }
  };

  const addConditionTag = () => {
    if (newCondition.trim()) {
      setGate2Conditions([...gate2Conditions, newCondition.trim()]);
      setNewCondition('');
    }
  };

  const removeConditionTag = (idx: number) => {
    setGate2Conditions(gate2Conditions.filter((_, i) => i !== idx));
  };



  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    if (files.length <= 1) {
      setAutoFilled(false);
    }
  };

  const loadPresetIntoForm = (presetId: string) => {
    let meta: any = null;
    if (presetId === 'cannabis') {
      meta = {
        productType: "Commercial High-Yield Cannabis Dispensary Account",
        changeType: "New Product Launch",
        geography: "US-CO, US-MI",
        segment: "Commercial Banking / Cash Intensive",
        targetDate: "2026-10-15",
        description: "Open accounts for licensed cannabis dispensaries in Colorado and Michigan with 80% armored car cash deposits.",
        filename: "sample_change_request.pdf"
      };
    } else if (presetId === 'remittance') {
      meta = {
        productType: "Cross-Border Commercial Remittance Corridor",
        changeType: "Geographic Expansion",
        geography: "United States, Mexico, Colombia, UAE",
        segment: "Money Services Business / Cross-Border Remittance",
        targetDate: "2026-11-15",
        description: "Open multi-currency clearing accounts for cross-border MSBs supporting high-velocity wire remittances across the US, Mexico, Colombia, and UAE free zones. Features nested correspondent routing via Meridian Overseas Holdings Ltd.",
        filename: "003_cross_border_remittance_high_risk.pdf"
      };
    } else if (presetId === 'crypto') {
      meta = {
        productType: "Institutional Digital Asset Custody & Staking",
        changeType: "New Product Launch",
        geography: "New York, Delaware, California",
        segment: "Institutional Wealth & Registered Investment Funds",
        targetDate: "2026-10-30",
        description: "Segregated digital asset custodial service with validator staking yield for institutional funds and RIAs in NY and DE. Bankruptcy-remote qualified custody with Anchorage Trust and MPC cold storage.",
        filename: "004_crypto_asset_custody_medium_risk.pdf"
      };
    } else if (presetId === 'fleet') {
      meta = {
        productType: "Commercial Fleet Fuel & Maintenance Credit Card",
        changeType: "Parameter Change",
        geography: "Texas, Illinois, Ohio, Indiana",
        segment: "Commercial Transportation & Logistics",
        targetDate: "2026-10-01",
        description: "Increase revolving corporate credit ceiling from $250k to $750k for verified domestic freight logistics company with hard MCC fuel controls.",
        filename: "005_commercial_fleet_card_low_risk.pdf"
      };
    } else if (presetId === 'pep') {
      meta = {
        productType: "International Private Wealth Trust Depository",
        changeType: "Customer Segment Expansion",
        geography: "Florida, United Kingdom, Nigeria, Bahamas",
        segment: "Non-Resident Ultra-High-Net-Worth Private Banking",
        targetDate: "2026-11-01",
        description: "Establish wealth depository and investment custodial accounts for non-resident UHNW trust holding vehicle owned by Amara Chukwuemeka Obi.",
        filename: "006_pep_private_wealth_onboarding_high_risk.pdf"
      };
    } else if (presetId === 'vendor_rfi') {
      meta = {
        productType: "Instant Payment Clearing & Vendor Gateway",
        changeType: "Channel Modification",
        geography: "United States",
        segment: "Third-Party Payment Service Provider",
        targetDate: "",
        description: "API integration with third-party gateway for real-time retail credit push disbursements through RTP and FedNow (missing go-live date).",
        filename: "007_incomplete_vendor_payment_portal_rfi.pdf"
      };
    }

    if (meta) {
      setProductType(meta.productType);
      setChangeType(meta.changeType);
      setGeography(meta.geography);
      setSegment(meta.segment);
      setTargetDate(meta.targetDate);
      setDescription(meta.description);
      setAutoFilled(false); // only auto-filled for document drop
    }
  };

  const handleFiles = (fileList: File[]) => {
    setFiles(prev => [...prev, ...fileList]);
    if (fileList.length > 0) {
      autoPopulateFromDocument(fileList[0]);
    }
  };

  const autoPopulateFromDocument = (file: File) => {
    if (!file || !file.name) return;
    const filename = file.name.toLowerCase();
    let meta: any = null;

    if (filename.includes('006') || filename.includes('pep') || filename.includes('private_wealth') || filename.includes('obi')) {
      meta = {
        productType: "International Private Wealth Trust Depository",
        changeType: "Customer Segment Expansion",
        geography: "Florida, United Kingdom, Nigeria, Bahamas",
        segment: "Non-Resident Ultra-High-Net-Worth Private Banking",
        targetDate: "2026-11-01",
        description: "Establish wealth depository and investment custodial accounts for non-resident UHNW trust holding vehicle owned by Amara Chukwuemeka Obi (100% beneficiary of Obi Heritage Capital Trust). Initial $12M wire from Barclays London.",
      };
    } else if (filename.includes('003') || filename.includes('remittance') || filename.includes('cross_border') || filename.includes('meridian')) {
      meta = {
        productType: "Cross-Border Commercial Remittance Corridor",
        changeType: "Geographic Expansion",
        geography: "United States, Mexico, Colombia, UAE",
        segment: "Money Services Business / Cross-Border Remittance",
        targetDate: "2026-11-15",
        description: "Open multi-currency clearing accounts for cross-border MSBs supporting high-velocity wire remittances across the US, Mexico, Colombia, and UAE free zones. Features nested correspondent routing via Meridian Overseas Holdings Ltd.",
      };
    } else if (filename.includes('004') || filename.includes('crypto') || filename.includes('custody') || filename.includes('staking') || filename.includes('aegis')) {
      meta = {
        productType: "Institutional Digital Asset Custody & Staking",
        changeType: "New Product Launch",
        geography: "New York, Delaware, California",
        segment: "Institutional Wealth & Registered Investment Funds",
        targetDate: "2026-10-30",
        description: "Segregated digital asset custodial service with validator staking yield for institutional funds and RIAs in NY and DE. Bankruptcy-remote qualified custody with Anchorage Trust and MPC cold storage.",
      };
    } else if (filename.includes('005') || filename.includes('fleet') || filename.includes('card') || filename.includes('callahan')) {
      meta = {
        productType: "Commercial Fleet Fuel & Maintenance Credit Card",
        changeType: "Parameter Change",
        geography: "Texas, Illinois, Ohio, Indiana",
        segment: "Commercial Transportation & Logistics",
        targetDate: "2026-10-01",
        description: "Increase revolving corporate credit ceiling from $250k to $750k for verified domestic freight logistics company (Midwest Express Logistics Inc). Hard MCC fuel and maintenance controls, 0% cash advance.",
      };
    } else if (filename.includes('007') || filename.includes('vendor') || filename.includes('payment_portal') || filename.includes('rtp') || filename.includes('fednow')) {
      meta = {
        productType: "Instant Payment Clearing & Vendor Gateway",
        changeType: "Vendor Relationship",
        geography: "United States",
        segment: "Third-Party Payment Service Provider",
        targetDate: "", 
        description: "API integration with third-party gateway (Summit Peak Vendor Services) for real-time retail credit push disbursements through RTP and FedNow networks (missing go-live date).",
      };
    } else if (filename.includes('cannabis') || filename.includes('dispensary') || filename.includes('sample_change_request')) {
      meta = {
        productType: "Commercial High-Yield Cannabis Dispensary Account",
        changeType: "New Product Launch",
        geography: "US-CO, US-MI",
        segment: "Commercial Banking / Cash Intensive",
        targetDate: "2026-10-15",
        description: "Open accounts for licensed cannabis dispensaries in Colorado and Michigan with 80% armored car cash deposits.",
      };
    } else {
      const baseClean = file.name.replace(/\.[^/.]+$/, '').replace(/^[0-9]+[_-]*/, '').replace(/[_-]+/g, ' ').trim();
      const titleClean = baseClean.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1));
      let cType = "New Product Launch";
      if (filename.includes('mod') || filename.includes('limit') || filename.includes('adjust') || filename.includes('increase')) {
        cType = "Parameter Change";
      } else if (filename.includes('geo') || filename.includes('cross') || filename.includes('corridor') || filename.includes('expand')) {
        cType = "Geographic Expansion";
      } else if (filename.includes('wealth') || filename.includes('pep') || filename.includes('segment') || filename.includes('client')) {
        cType = "Customer Segment Expansion";
      } else if (filename.includes('vendor') || filename.includes('third_party') || filename.includes('supplier')) {
        cType = "Vendor Relationship";
      } else if (filename.includes('channel') || filename.includes('api') || filename.includes('portal')) {
        cType = "Channel Modification";
      }
      meta = {
        productType: titleClean || "Commercial Banking Initiative",
        changeType: cType,
        geography: "Domestic (US-Wide)",
        segment: "Commercial Banking & Corporate Clients",
        targetDate: "2026-10-30",
        description: `Operational risk assessment and change evaluation for ${titleClean}. Submitted with supporting technical and compliance documentation (${file.name}).`,
      };
    }

    if (meta) {
      setProductType(meta.productType);
      setChangeType(meta.changeType);
      setGeography(meta.geography);
      setSegment(meta.segment);
      setTargetDate(meta.targetDate);
      setDescription(meta.description);
      setAutoFilled(true);
    }
  };

  const clearIntakeForm = () => {
    setProductType('');
    setChangeType('New Product Launch');
    setGeography('');
    setSegment('');
    setTargetDate('');
    setDescription('');
    setFiles([]);
    setAutoFilled(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('product_type', productType);
      formData.append('change_type', changeType);
      formData.append('geography', geography);
      formData.append('segment', segment);
      formData.append('target_date', targetDate);
      formData.append('description', description);
      
      files.forEach(f => {
        formData.append('files', f);
      });

      const res = await apiClient.createCase(formData);
      if (res.success) {
        clearIntakeForm();
        queryClient.invalidateQueries({ queryKey: ['cases'] });
        openDossier(res.case_id);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDossier = (caseId: string) => {
    setActiveCaseId(caseId);
    setActiveTab('dossier');
    setDossierTab('memo');
  };


  // KPI calculations
  const totalCount = cases.length;
  const gate1Count = cases.filter(c => c.status === 'awaiting_gate1').length;
  const gate2Count = cases.filter(c => c.status === 'awaiting_gate2').length;
  const rfiCount = cases.filter(c => c.status === 'rfi' || c.status === 'needs_more_information').length;
  const closedCount = cases.filter(c => c.status === 'closed' || c.status === 'rejected').length;

  let filtered = cases;
  if (activeFilterStatus !== 'all') {
    if (activeFilterStatus === 'closed') {
      filtered = filtered.filter(c => c.status === 'closed' || c.status === 'rejected');
    } else if (activeFilterStatus === 'rfi') {
      filtered = filtered.filter(c => c.status === 'rfi' || c.status === 'needs_more_information');
    } else {
      filtered = filtered.filter(c => c.status === activeFilterStatus);
    }
  }
  if (searchQuery) {
    filtered = filtered.filter(c => 
      c.case_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.product_type && c.product_type.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }

  const getRiskBadgeClass = (tier: string) => {
    switch (tier) {
      case 'Critical': return 'badge-risk-critical';
      case 'High': return 'badge-risk-high';
      case 'Medium': return 'badge-risk-medium';
      case 'Low': return 'badge-risk-low';
      default: return 'badge-risk-medium';
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'awaiting_gate1': return 'awaiting-gate1';
      case 'awaiting_gate2': return 'awaiting-gate2';
      case 'rfi': 
      case 'needs_more_information': return 'rfi';
      case 'closed': return 'closed';
      case 'in-flight': return 'in-flight';
      default: return '';
    }
  };

  const formatStatus = (status: string) => {
    switch (status) {
      case 'awaiting_gate1': return 'Awaiting Gate 1';
      case 'awaiting_gate2': return 'Awaiting Gate 2';
      case 'rfi': 
      case 'needs_more_information': return 'Needs Info (RFI)';
      case 'closed': return 'Approved / Closed';
      case 'in-flight': return 'In Flight';
      case 'rejected': return 'Rejected';
      default: return status || 'Active';
    }
  };

  return (
    <div id="main-app" className="app-container">
      {/* Top Navigation Bar */}
      <header className="navbar">
        <div className="brand-section">
          <div className="brand-logo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
          </div>
          <div>
            <div className="brand-title">
              FCRM Workbench
              <span className="brand-badge">Intelligence Engine</span>
            </div>
          </div>
        </div>

        {/* Navigation links */}
        <nav className="nav-links">
          <button className={`nav-btn ${activeTab === 'queue' ? 'active' : ''}`} onClick={() => setActiveTab('queue')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>
            Cases Queue
          </button>
          <button className={`nav-btn ${activeTab === 'new-case' ? 'active' : ''}`} onClick={() => setActiveTab('new-case')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>
            + Submit Change Request
          </button>
        </nav>

        {/* Header Controls */}
        <div className="header-controls">
          <div className="user-profile-container" style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
            <div style={{textAlign: 'right', lineHeight: 1.2}}>
              <div style={{fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)'}}>
                {user?.firstName} {user?.lastName}
              </div>
              <div style={{fontSize: '0.7rem', color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.05em'}}>
                {currentPersona}
              </div>
            </div>
            <button 
              id="btn-logout" 
              className="btn-secondary" 
              style={{padding: '0.4rem 0.75rem', fontSize: '0.75rem'}} 
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              Sign Out
            </button>
          </div>

          <div id="health-indicator" className="health-status">
            <span className="pulse-dot"></span> System Live: LangGraph Orchestrator
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="main-content">
        
        {/* VIEW 1: CASES QUEUE / DASHBOARD */}
        {activeTab === 'queue' && (
          <section id="view-queue" className="page-view active">
            {/* KPI Stats Grid */}
            <div className="kpi-grid">
              <div className="kpi-card" style={{'--card-accent': 'var(--accent-cyan)'} as any}>
                <div className="kpi-title">Total Active Cases</div>
                <div className="kpi-value">{totalCount}</div>
                <div className="kpi-subtext">Across all business units</div>
              </div>
              <div className="kpi-card" style={{'--card-accent': 'var(--accent-amber)'} as any}>
                <div className="kpi-title">Awaiting Gate 1 (Analyst)</div>
                <div className="kpi-value text-amber">{gate1Count}</div>
                <div className="kpi-subtext">Under preliminary triage</div>
              </div>
              <div className="kpi-card" style={{'--card-accent': 'var(--accent-purple)'} as any}>
                <div className="kpi-title">Awaiting Gate 2 (Committee)</div>
                <div className="kpi-value text-cyan">{gate2Count}</div>
                <div className="kpi-subtext">Certified memos pending sign-off</div>
              </div>
              <div className="kpi-card" style={{'--card-accent': 'var(--accent-rose)'} as any}>
                <div className="kpi-title">Information Needed (RFI)</div>
                <div className="kpi-value text-crimson">{rfiCount}</div>
                <div className="kpi-subtext">Returned to Product Owner</div>
              </div>
              <div className="kpi-card" style={{'--card-accent': 'var(--accent-emerald)'} as any}>
                <div className="kpi-title">Approved / Closed</div>
                <div className="kpi-value text-emerald">{closedCount}</div>
                <div className="kpi-subtext">Final committee determinations</div>
              </div>
            </div>

            {/* Controls: Search & Status Filters */}
            <div className="queue-controls">
              <div className="search-box">
                <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="search-input" placeholder="Search by Case ID, Product, or Description..." />
              </div>

              <div className="filter-chips">
                <button className={`filter-chip ${activeFilterStatus === 'all' ? 'active' : ''}`} onClick={() => setActiveFilterStatus('all')}>All Cases</button>
                <button className={`filter-chip ${activeFilterStatus === 'awaiting_gate1' ? 'active' : ''}`} onClick={() => setActiveFilterStatus('awaiting_gate1')}>Awaiting Gate 1</button>
                <button className={`filter-chip ${activeFilterStatus === 'awaiting_gate2' ? 'active' : ''}`} onClick={() => setActiveFilterStatus('awaiting_gate2')}>Awaiting Gate 2</button>
                <button className={`filter-chip ${activeFilterStatus === 'rfi' ? 'active' : ''}`} onClick={() => setActiveFilterStatus('rfi')}>Needs Info (RFI)</button>
                <button className={`filter-chip ${activeFilterStatus === 'closed' ? 'active' : ''}`} onClick={() => setActiveFilterStatus('closed')}>Approved / Closed</button>
              </div>

              <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
                <button type="button" className="btn-secondary" style={{fontSize: '0.75rem', padding: '0.55rem 0.85rem'}} title="Reset all demo cases back to default presets">
                  ↻ Reset Queue
                </button>
                <button className="btn-primary" onClick={() => setActiveTab('new-case')}>
                  + New Change Request
                </button>
              </div>
            </div>

            {/* Cases Data Table */}
            <div className="table-card">
              <table className="cases-table">
                <thead>
                  <tr>
                    <th>Case ID</th>
                    <th>Initiative & Product Context</th>
                    <th>Inherent Risk Tier</th>
                    <th>Workflow Status</th>
                    <th>Score (/4.0)</th>
                    <th>SLA Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="empty-state">
                        <div className="empty-state-icon">📋</div>
                        <p>No risk change cases found matching current filters.</p>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((c) => {
                      const tier = c.risk_tier || c.scorecard?.tier || 'Medium';
                      const riskClass = getRiskBadgeClass(tier);
                      const statusClass = getStatusBadgeClass(c.status);
                      const statusLabel = formatStatus(c.status);
                      return (
                        <tr key={c.case_id} style={{cursor: 'pointer'}}>
                          <td className="case-id-cell">{c.case_id}</td>
                          <td>
                            <div className="product-cell">{c.product_type}</div>
                            <div className="product-subtext">{c.change_type} • {c.geography}</div>
                          </td>
                          <td><span className={`badge ${riskClass}`}>{tier}</span></td>
                          <td><span className={`badge badge-status ${statusClass}`}>{statusLabel}</span></td>
                          <td><span className="font-mono text-secondary">{c.scorecard?.composite_score ? c.scorecard.composite_score.toFixed(2) : (c.risk_score || '—')}</span></td>
                          <td><span className="text-secondary text-xs">{c.sla?.sla_status || 'On Track'}</span></td>
                          <td>
                            <button className="btn-secondary" style={{padding: '0.35rem 0.75rem', fontSize: '0.75rem'}} onClick={() => openDossier(c.case_id)}>
                              Inspect Dossier →
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* VIEW 2: SUBMISSION WIZARD (PRODUCT OWNER) */}
        {activeTab === 'new-case' && (
          <section id="view-new-case" className="page-view active">
            <div className="wizard-container">
              
              {/* 1-Click Golden Demo Loaders */}
              <div className="presets-banner">
                <div className="presets-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  1-Click Golden Case Presets (Zero Setup Demoing)
                </div>
                <div className="preset-cards">
                  <div className="preset-card" onClick={() => loadPresetIntoForm('cannabis')}>
                    <div className="preset-name">
                      🌿 Cannabis Banking
                      <span className="badge badge-risk-critical" style={{fontSize: '0.65rem'}}>Critical Risk</span>
                    </div>
                    <div className="preset-desc">Commercial dispensary depository with 80% armored cash and sanctions hit on beneficial owner.</div>
                  </div>

                  <div className="preset-card" onClick={() => loadPresetIntoForm('remittance')}>
                    <div className="preset-name">
                      🌐 Cross-Border MSB
                      <span className="badge badge-risk-critical" style={{fontSize: '0.65rem'}}>Critical Risk</span>
                    </div>
                    <div className="preset-desc">High-velocity US/MX/UAE remittance corridor with active sanctions match on offshore affiliate.</div>
                  </div>

                  <div className="preset-card" onClick={() => loadPresetIntoForm('crypto')}>
                    <div className="preset-name">
                      ⚡ Crypto Custody & Staking
                      <span className="badge badge-risk-medium" style={{fontSize: '0.65rem'}}>Medium Risk</span>
                    </div>
                    <div className="preset-desc">Institutional qualified custody & proof-of-stake validation for registered funds (0% cash).</div>
                  </div>

                  <div className="preset-card" onClick={() => loadPresetIntoForm('fleet')}>
                    <div className="preset-name">
                      🚚 Corporate Fleet Card
                      <span className="badge badge-risk-low" style={{fontSize: '0.65rem'}}>Low Risk</span>
                    </div>
                    <div className="preset-desc">Commercial fleet fuel line adjustment ($750k) with closed-loop MCC restrictions and 0% cash.</div>
                  </div>

                  <div className="preset-card" onClick={() => loadPresetIntoForm('pep')}>
                    <div className="preset-name">
                      🏛️ Private Wealth PEP
                      <span className="badge badge-risk-high" style={{fontSize: '0.65rem'}}>High (PEP Floor)</span>
                    </div>
                    <div className="preset-desc">Offshore trust depository onboarding for Politically Exposed Person (Amara Obi) requiring Gate 2.</div>
                  </div>

                  <div className="preset-card" onClick={() => loadPresetIntoForm('vendor_rfi')}>
                    <div className="preset-name">
                      ⚠️ Instant Payments Gateway
                      <span className="badge badge-risk-high" style={{fontSize: '0.65rem'}}>RFI Loop</span>
                    </div>
                    <div className="preset-desc">RTP/FedNow gateway onboarding with vendor-risk alert and missing target date / operational metrics.</div>
                  </div>
                </div>
              </div>

              {/* Intake Form */}
              <div className="wizard-form-card">
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem'}}>
                  <h2 style={{fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'inline-flex', alignItems: 'center'}}>
                    Submit New Product / Change Request
                    <span id="form-auto-badge">
                      {autoFilled && <span className="auto-populated-badge">⚡ Auto-Filled from Document</span>}
                    </span>
                  </h2>
                  {autoFilled && (
                    <button type="button" className="btn-text" style={{fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none'}} onClick={clearIntakeForm}>✕ Reset Form</button>
                  )}
                </div>
                <p style={{fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem'}}>
                  Provide core business specifications. The LangGraph multi-agent pipeline will validate taxonomy, extract entities, retrieve bank policies, screen watchlists, calculate scorecard risk, and draft an executive memorandum.
                </p>

                <form id="case-intake-form" onSubmit={handleSubmit}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">Product / Service Name <span className="required">*</span></label>
                      <input type="text" className={`form-input ${autoFilled ? 'field-auto-populated' : ''}`} required placeholder="e.g. Commercial High-Yield Cannabis Account" value={productType} onChange={e => setProductType(e.target.value)} />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Change Type <span className="required">*</span></label>
                      <select className={`form-select ${autoFilled ? 'field-auto-populated' : ''}`} required value={changeType} onChange={e => setChangeType(e.target.value)}>
                        <option value="New Product Launch">New Product Launch</option>
                        <option value="Parameter Change">Parameter Change</option>
                        <option value="Geographic Expansion">Geographic Expansion</option>
                        <option value="Customer Segment Expansion">Customer Segment Expansion</option>
                        <option value="Channel Modification">Channel Modification</option>
                        <option value="Vendor Relationship">Vendor Relationship</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Operational Geography / Jurisdictions <span className="required">*</span></label>
                      <input type="text" className={`form-input ${autoFilled ? 'field-auto-populated' : ''}`} required placeholder="e.g. US-CA, US-DE" value={geography} onChange={e => setGeography(e.target.value)} />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Target Customer Segment <span className="required">*</span></label>
                      <input type="text" className={`form-input ${autoFilled ? 'field-auto-populated' : ''}`} required placeholder="e.g. Commercial Banking / Cash Intensive" value={segment} onChange={e => setSegment(e.target.value)} />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Target Go-Live Date</label>
                      <input type="date" className={`form-input ${autoFilled ? 'field-auto-populated' : ''}`} value={targetDate} onChange={e => setTargetDate(e.target.value)} />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Supporting Documents (.pdf, .docx)</label>
                      <div 
                        className="dropzone-container"
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                        onDrop={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (e.dataTransfer.files) {
                            handleFiles(Array.from(e.dataTransfer.files));
                          }
                        }}
                      >
                        <div className="dropzone-icon">📁</div>
                        <div className="dropzone-text">Click to upload or drag & drop files here</div>
                        <div className="dropzone-subtext">Product specs, licenses, or compliance memos</div>
                        <input type="file" ref={fileInputRef} style={{display: 'none'}} multiple accept=".pdf,.doc,.docx,.txt" onChange={handleFileChange} />
                      </div>
                      
                      {files.length > 0 && (
                        <div className="uploaded-files-list">
                          {files.map((f, i) => (
                            <div key={i} className="uploaded-file-item">
                              <span className="font-mono text-cyan">📄 {f.name}</span>
                              <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
                                <span className="text-dim text-xs">{(f.size / 1024).toFixed(1)} KB</span>
                                <button type="button" style={{background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer'}} onClick={(e) => { e.stopPropagation(); removeFile(i); }}>✕</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="form-group full-width">
                      <label className="form-label">Business Description & Operational Context <span className="required">*</span></label>
                      <textarea className={`form-textarea ${autoFilled ? 'field-auto-populated' : ''}`} required placeholder="Describe the operational workflow, anticipated deposit volumes, partner entities, and distribution channels..." value={description} onChange={e => setDescription(e.target.value)}></textarea>
                    </div>
                  </div>

                  <div style={{display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem'}}>
                    <button type="button" className="btn-secondary" onClick={() => setActiveTab('queue')}>Cancel</button>
                    <button type="submit" disabled={isSubmitting} className="btn-primary" style={{minWidth: '280px'}}>
                      {isSubmitting ? (
                        <span style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'}}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{animation: 'spin 1.5s linear infinite'}}>
                            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                          </svg>
                          <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                          {submitProgressMessage}
                        </span>
                      ) : 'Submit Change for Risk Assessment →'}
                    </button>
                  </div>
                </form>
              </div>

            </div>
          </section>
        )}

                {/* VIEW 3: CASE DOSSIER */}
        {activeTab === 'dossier' && (
          <section id="view-dossier" className="page-view active">
            <div className="dossier-header-bar">
              <div className="dossier-title-area">
                <span className="dossier-case-id">{activeCaseId}</span>
                <div>
                  <h1 className="dossier-product-name">{dossierData ? dossierData.product_type : 'Loading Dossier...'}</h1>
                  {dossierData && (
                    <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.35rem'}}>
                      <span className={`badge ${getRiskBadgeClass(dossierData.risk_tier || '')}`}>{dossierData.risk_tier}</span>
                      <span className={`badge badge-status ${getStatusBadgeClass(dossierData.status)}`}>{formatStatus(dossierData.status)}</span>
                      <span className="text-secondary text-xs font-mono">
                        {dossierData.sla ? `Elapsed: ${dossierData.sla.elapsed_hours}h / SLA Target: ${dossierData.sla.target_hours}h` : 'Within Standard SLA'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="dossier-actions">
                <button className="btn-secondary" onClick={() => setActiveTab('queue')}>← Cases Queue</button>
                {dossierData && (dossierData.status === 'awaiting_gate1' || dossierData.status === 'validated' || (dossierData.awaiting && dossierData.awaiting.includes('gate1'))) && (
                  currentPersona === 'Compliance Analyst' ? (
                    <button className="btn-primary" onClick={() => setIsGate1ModalOpen(true)}>⚖️ Review Gate 1 (Analyst)</button>
                  ) : (
                    <span style={{fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', marginLeft: '1rem'}}>
                      (Switch Persona to Compliance Analyst to review Gate 1)
                    </span>
                  )
                )}
                {dossierData && (dossierData.status === 'awaiting_gate2' || (dossierData.awaiting && dossierData.awaiting.includes('gate2'))) && (
                  currentPersona === 'Risk Committee Chair' ? (
                    <button className="btn-emerald" onClick={() => {
                      if (dossierData.memo?.conditions) {
                        setGate2Conditions(dossierData.memo.conditions);
                      }
                      setIsGate2ModalOpen(true);
                    }}>🏛️ Decide Gate 2 (Committee)</button>
                  ) : (
                    <span style={{fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', marginLeft: '1rem'}}>
                      (Switch Persona to Risk Committee Chair to decide Gate 2)
                    </span>
                  )
                )}
                {dossierData && (dossierData.status === 'needs_more_information' || dossierData.status === 'rfi') && currentPersona === 'Product Owner' && (
                  <button className="btn-secondary" style={{borderColor: 'var(--accent-rose)'}} onClick={async () => {
                    const res = await apiClient.resubmitCase(dossierData.case_id, { target_date: "2026-11-15" });
                    if (res.success) {
                      queryClient.invalidateQueries({ queryKey: ['cases'] });
                      openDossier(dossierData.case_id);
                    }
                  }}>📝 Submit RFI Info (PO)</button>
                )}
              </div>
            </div>

            {dossierData && (
              <>
                {/* Visual Multi-Agent Pipeline Stepper */}
                <div className="stepper-container">
                  <div className="stepper-title">
                    <span>End-to-End Orchestrator Pipeline</span>
                    <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
                      <button type="button" className="btn-stepper-replay" title="Re-run agent pipeline execution flow" onClick={() => setStepperAnimated(!stepperAnimated)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                        <span>Replay Agents</span>
                      </button>
                      <span className="text-xs font-mono text-cyan">LangGraph Execution Flow</span>
                    </div>
                  </div>
                  <div className="stepper-step-line">
                    <div className="stepper-progress-bar" style={{width: dossierData.status === 'needs_more_information' ? '12%' : '100%'}}></div>
                  </div>
                  <div className="stepper-steps">
                    {(dossierData.pipeline_steps || []).map((step, index) => {
                      let icon: any = index + 1;
                      if (step.status === 'completed') icon = '✓';
                      else if (step.status === 'needs_review' || step.status === 'error') icon = '!';
                      
                      return (
                        <div key={step.id} className={`stepper-step ${step.status}`}>
                          <div className="stepper-step-circle">{icon}</div>
                          <div className="stepper-step-label">{step.label}</div>
                          <div className="stepper-step-subtext" style={{fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '-2px'}}>{step.timestamp || ''}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="dossier-tabs">
                  <button className={`tab-btn ${dossierTab === 'memo' ? 'active' : ''}`} onClick={() => setDossierTab('memo')}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Executive Memo (M6)
                  </button>
                  <button className={`tab-btn ${dossierTab === 'scorecard' ? 'active' : ''}`} onClick={() => setDossierTab('scorecard')}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="2"/></svg> Risk Scorecard (M5)
                  </button>
                  <button className={`tab-btn ${dossierTab === 'facts' ? 'active' : ''}`} onClick={() => setDossierTab('facts')}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg> Extracted Facts (M2)
                  </button>
                  <button className={`tab-btn ${dossierTab === 'policies' ? 'active' : ''}`} onClick={() => setDossierTab('policies')}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg> Policy Retrieval (M3)
                  </button>
                  <button className={`tab-btn ${dossierTab === 'screening' ? 'active' : ''}`} onClick={() => setDossierTab('screening')}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Watchlist Screening (M4)
                  </button>
                  <button className={`tab-btn ${dossierTab === 'audit' ? 'active' : ''}`} onClick={() => setDossierTab('audit')}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Audit & SLA (M9)
                  </button>
                </div>

                {/* Tab Contents */}
                {dossierTab === 'memo' && (
                  <div className="tab-content active">
                    <div className="dossier-card">
                      {!dossierData.memo ? (
                        <div className="empty-state" style={{padding: '3rem 1.5rem', textAlign: 'center'}}>
                          <div style={{fontSize: '2.2rem', marginBottom: '0.5rem'}}>📝</div>
                          <h3 style={{fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '0.5rem'}}>
                            {dossierData.status === 'needs_more_information' ? 'Executive Memo Blocked by Intake RFI' : 'Executive Memo Pending Generation'}
                          </h3>
                          <p style={{color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto', fontSize: '0.88rem', lineHeight: '1.6'}}>
                            {dossierData.status === 'needs_more_information' ? 'Claude Sonnet memo drafting executes automatically after mandatory intake parameters are completed and multi-factor scores are finalized.' : 'Executive risk recommendation memo will appear here once drafted by Claude Sonnet.'}
                          </p>
                        </div>
                      ) : (
                        <div className="memo-container">
                          <h2>{dossierData.memo.title || 'EXECUTIVE FCRM RISK ASSESSMENT & RECOMMENDATION'}</h2>
                          <div style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem', display: 'flex', gap: '2rem'}}>
                            <span><strong>Date:</strong> {dossierData.memo.date || '2026-09-24'}</span>
                            <span><strong>Author:</strong> {dossierData.memo.lead_analyst || 'Compliance Operations'}</span>
                            <span><strong>Inherent Risk:</strong> <span className="text-crimson">{dossierData.memo.inherent_risk_rating || 'Medium'}</span></span>
                            <span><strong>Residual Risk:</strong> <span className="text-emerald">{dossierData.memo.residual_risk_rating || 'Low'}</span></span>
                          </div>

                          <h3>Executive Summary</h3>
                          <p>{dossierData.memo.summary || 'Summary not provided.'}</p>

                          {dossierData.memo.conditions && dossierData.memo.conditions.length > 0 && (
                            <>
                              <h3 style={{marginTop: '1.5rem'}}>Mandatory Approval Conditions</h3>
                              {dossierData.memo.conditions.map((c: string, i: number) => <div key={i} className="condition-box"><strong>Condition:</strong> {c}</div>)}
                            </>
                          )}

                          {dossierData.memo.open_questions && dossierData.memo.open_questions.length > 0 && (
                            <>
                              <h3 style={{marginTop: '1.5rem'}}>Open Items & Analyst Inquiries</h3>
                              {dossierData.memo.open_questions.map((q: string, i: number) => <div key={i} className="open-question-box"><strong>Question:</strong> {q}</div>)}
                            </>
                          )}

                          {dossierData.memo.citations && dossierData.memo.citations.length > 0 && (
                            <LegalPolicyCitations citations={dossierData.memo.citations} />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {dossierTab === 'scorecard' && (
                  <div className="tab-content active">
                    <div className="dossier-card">
                      {(!dossierData.scorecard || !dossierData.scorecard.factors || dossierData.scorecard.factors.length === 0) ? (
                        dossierData.status === 'needs_more_information' ? (
                          <div className="empty-state" style={{padding: '3rem 1.5rem', textAlign: 'center'}}>
                            <div style={{fontSize: '2.5rem', marginBottom: '0.75rem'}}>⚠️</div>
                            <h3 style={{fontSize: '1.15rem', color: 'var(--accent-rose)', fontWeight: 700, marginBottom: '0.5rem'}}>Intake Request for Information (RFI) Required</h3>
                            <p style={{color: 'var(--text-secondary)', maxWidth: '540px', margin: '0 auto 1.5rem', fontSize: '0.9rem', lineHeight: '1.6'}}>
                              This change request is missing mandatory compliance parameter(s): <strong style={{color: 'var(--text-primary)'}}>{dossierData.missing_fields?.join(', ') || 'Target Go-Live Date (target_date)'}</strong>.<br/>
                              Bank FCRM procedure M1 pauses quantitative scoring and extraction until all required parameters are supplied.
                            </p>
                          </div>
                        ) : (
                          <div className="empty-state"><p>Risk scorecard calculation in progress.</p></div>
                        )
                      ) : (
                        <>
                          <div className="score-overview">
                            <div className="score-gauge-card">
                              <div style={{fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.5rem'}}>Composite Inherent Risk</div>
                              <div className="score-gauge-number text-cyan">
                                {Number(dossierData.scorecard.composite_score || 2.5).toFixed(2)}
                                <span className="score-gauge-max">/ 4.00</span>
                              </div>
                              <span className={`badge ${getRiskBadgeClass(dossierData.scorecard.tier || 'Medium')}`}>{dossierData.scorecard.tier || 'Medium'} Tier</span>
                            </div>

                            <div>
                              <h3 style={{fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem'}}>Claude Haiku Risk Rationale Synthesis</h3>
                              <p style={{fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6', background: 'rgba(0,0,0,0.25)', padding: '1rem', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--accent-cyan)'}}>
                                {dossierData.scorecard.ai_rationale || dossierData.scorecard.rationale || 'Quantitative assessment calculated across canonical FCRM risk dimensions.'}
                              </p>
                            </div>
                          </div>

                          <h3 style={{fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.75rem'}}>
                            Multi-Factor Scoring Matrix (Deterministic Math Engine)
                          </h3>
                          <table className="factors-table">
                            <thead>
                              <tr>
                                <th>Risk Dimension</th>
                                <th>Raw Score</th>
                                <th>Weight</th>
                                <th>Weighted Contribution</th>
                                <th>Factor Details & Findings</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dossierData.scorecard.factors.map((f: any, i: number) => {
                                const score = Number(f.score ?? 0);
                                const weight = Number(f.weight ?? 0.2);
                                const weighted = Number(f.weighted ?? 0);
                                const pct = Math.min(100, Math.max(0, (score / 4.0) * 100));
                                return (
                                  <tr key={i}>
                                    <td>
                                      <strong>{f.name}</strong>
                                      <div style={{fontSize: '0.7rem', color: 'var(--text-muted)'}}>{f.category || 'Risk Dimension'}</div>
                                    </td>
                                    <td><span className="font-mono font-bold">{score.toFixed(1)}</span> <span className="text-dim text-xs">/ 4.0</span></td>
                                    <td><span className="font-mono text-secondary">{(weight * 100).toFixed(0)}%</span></td>
                                    <td>
                                      <span className="font-mono text-cyan font-bold">{weighted.toFixed(2)}</span>
                                      <div className="score-bar-track">
                                        <div className="score-bar-fill" style={{width: `${pct}%`}}></div>
                                      </div>
                                    </td>
                                    <td style={{fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '320px'}}>{f.notes || ''}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {dossierTab === 'facts' && (
                  <div className="tab-content active">
                    <div className="dossier-card">
                      {(!dossierData.facts || (!dossierData.facts.parties && !Array.isArray(dossierData.facts))) ? (
                        <div className="empty-state" style={{padding: '3rem 1.5rem', textAlign: 'center'}}>
                          <div style={{fontSize: '2.2rem', marginBottom: '0.5rem'}}>📄</div>
                          <h3 style={{fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '0.5rem'}}>
                            {dossierData.status === 'needs_more_information' ? 'Document Fact Extraction Held at Intake' : 'Fact Extraction Pending'}
                          </h3>
                          <p style={{color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto', fontSize: '0.88rem', lineHeight: '1.6'}}>
                            {dossierData.status === 'needs_more_information' ? 'Claude Sonnet document extraction will run automatically once the intake RFI requirements are fulfilled.' : 'Extracted named entities, ownership hierarchies, and operational scope will appear here.'}
                          </p>
                        </div>
                      ) : (
                        <>
                          <div style={{display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap'}}>
                            <div style={{background: 'var(--bg-secondary)', padding: '0.75rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)'}}>
                              <span style={{fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase'}}>Cash Intensive Industry:</span>
                              <span className={`badge ${dossierData.facts.cash_intensive ? 'badge-risk-critical' : 'badge-risk-low'}`} style={{marginLeft: '0.5rem'}}>
                                {dossierData.facts.cash_intensive ? 'YES (High Inherent Risk)' : 'NO'}
                              </span>
                            </div>
                            <div style={{background: 'var(--bg-secondary)', padding: '0.75rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)'}}>
                              <span style={{fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase'}}>High-Risk Industry Classification:</span>
                              <span className={`badge ${dossierData.facts.high_risk_industry ? 'badge-risk-critical' : 'badge-risk-low'}`} style={{marginLeft: '0.5rem'}}>
                                {dossierData.facts.high_risk_industry ? 'YES (Enhanced Controls Required)' : 'NO'}
                              </span>
                            </div>
                          </div>

                          <h3 style={{fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.75rem'}}>
                            Extracted Named Entities & Beneficial Ownership (Claude Sonnet Extraction Agent)
                          </h3>
                          <table className="factors-table" style={{marginBottom: '2rem'}}>
                            <thead>
                              <tr>
                                <th>Entity / Individual</th>
                                <th>Identified Role</th>
                                <th>Jurisdiction</th>
                                <th>Entity Type</th>
                                <th>PEP Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(dossierData.facts.parties || []).length > 0 ? dossierData.facts.parties.map((p: any, i: number) => (
                                <tr key={i}>
                                  <td className="font-bold text-primary">{p.name || 'Unnamed Party'}</td>
                                  <td>{p.role || 'Principal'}</td>
                                  <td><span className="font-mono">{p.jurisdiction || 'Domestic'}</span></td>
                                  <td>{p.type || 'Commercial Entity'}</td>
                                  <td>
                                    {p.pep 
                                      ? <span className="badge badge-risk-critical">PEP Tier-2</span> 
                                      : <span className="badge badge-risk-low">Non-PEP</span>}
                                  </td>
                                </tr>
                              )) : <tr><td colSpan={5}>No parties extracted.</td></tr>}
                            </tbody>
                          </table>

                          <h3 style={{fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.75rem'}}>
                            Identified Operational Jurisdictions & FATF Classifications
                          </h3>
                          <table className="factors-table">
                            <thead>
                              <tr>
                                <th>Jurisdiction Code</th>
                                <th>Operational Scope</th>
                                <th>FATF Classification & Risk Profile</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(dossierData.facts.jurisdictions || []).length > 0 ? dossierData.facts.jurisdictions.map((j: any, i: number) => (
                                <tr key={i}>
                                  <td className="font-mono font-bold text-cyan">{j.code || 'DOM'}</td>
                                  <td>{j.classification || 'Operational Scope'}</td>
                                  <td>{j.fatf_risk || 'Standard'}</td>
                                </tr>
                              )) : <tr><td colSpan={3}>No jurisdictions extracted.</td></tr>}
                            </tbody>
                          </table>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {dossierTab === 'policies' && (
                  <div className="tab-content active">
                    <div className="dossier-card">
                      {(!dossierData.policies || dossierData.policies.length === 0) ? (
                        <div className="empty-state"><p>No bank policy matches retrieved.</p></div>
                      ) : (
                        dossierData.policies.map((p: any, i: number) => (
                          <div key={i} className="policy-card">
                            <div className="policy-header">
                              <div>
                                <span className="policy-code">{p.code || 'POL-REF'}</span> • <strong style={{color: 'var(--text-primary)'}}>{p.title}</strong>
                                <div style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>{p.category}</div>
                              </div>
                              <div style={{textAlign: 'right'}}>
                                <span className="badge badge-risk-low">{p.similarity}% Semantic Match</span>
                              </div>
                            </div>
                            <div style={{marginTop: '0.75rem'}}>
                              <div style={{fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.25rem'}}>
                                Mandatory Controls & Conditions:
                              </div>
                              <ul style={{marginLeft: '1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)'}}>
                                {(p.mandatory_controls || []).map((c: string, ci: number) => <li key={ci}>{c}</li>)}
                              </ul>
                            </div>
                            <div className="policy-excerpt">
                              {p.excerpt}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {dossierTab === 'screening' && (
                  <div className="tab-content active">
                    <div className="dossier-card">
                      {(!dossierData.screening || dossierData.screening.length === 0) ? (
                        <div className="empty-state"><p>Screening results unavailable.</p></div>
                      ) : (
                        dossierData.screening.map((s: any, i: number) => {
                          const isAlert = s.status.includes('ALERT') || s.status.includes('HIT') || s.status.includes('INCOMPLETE') || s.status.includes('REVIEW');
                          const badgeClass = isAlert ? (s.status.includes('ALERT') || s.status.includes('HIT') ? 'badge-risk-critical' : 'badge-risk-medium') : 'badge-risk-low';
                          return (
                            <div key={i} className="screening-card">
                              <div className="screening-header">
                                <div>
                                  <strong style={{color: 'var(--text-primary)', fontSize: '1rem'}}>{s.target}</strong>
                                  <div style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>Database: {s.list_source}</div>
                                </div>
                                <div>
                                  <span className={`badge ${badgeClass}`}>{s.status}</span>
                                </div>
                              </div>
                              <div style={{fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem'}}>
                                <strong>Hit Analysis:</strong> {s.hit_details}
                              </div>
                              <div style={{fontSize: '0.8rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', borderLeft: `3px solid ${isAlert ? 'var(--accent-crimson)' : 'var(--accent-emerald)'}`}}>
                                <strong>Analyst Triage Guidance:</strong> {s.recommendation}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {dossierTab === 'audit' && (
                  <div className="tab-content active">
                    <div className="dossier-card">
                      {dossierData.sla && (
                        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem'}}>
                          <div style={{background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)'}}>
                            <div style={{fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase'}}>Elapsed Turnaround</div>
                            <div style={{fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)'}}>{dossierData.sla.elapsed_hours} hrs</div>
                          </div>
                          <div style={{background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)'}}>
                            <div style={{fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase'}}>SLA Target Ceiling</div>
                            <div style={{fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)'}}>{dossierData.sla.target_hours} hrs</div>
                          </div>
                          <div style={{background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)'}}>
                            <div style={{fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase'}}>SLA Status</div>
                            <div style={{fontSize: '1.15rem', fontWeight: 700, color: 'var(--accent-emerald)', marginTop: '0.35rem'}}>{dossierData.sla.sla_status}</div>
                          </div>
                        </div>
                      )}
                      
                      <h3 style={{fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.75rem'}}>
                        Immutable Audit & Notification Log (M9 Service)
                      </h3>
                      <div style={{background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', padding: '1rem 1.5rem'}}>
                        {(!dossierData.notifications || dossierData.notifications.length === 0) ? (
                          <p className="text-muted">No audit notifications recorded.</p>
                        ) : (
                          dossierData.notifications.map((n: any, i: number) => (
                            <div key={i} style={{display: 'flex', gap: '1.5rem', padding: '0.85rem 0', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.85rem'}}>
                              <span className="font-mono text-cyan" style={{minWidth: '90px'}}>{n.timestamp}</span>
                              <span style={{minWidth: '140px', fontWeight: 600, color: 'var(--text-primary)'}}>{n.persona}</span>
                              <span style={{color: 'var(--text-secondary)'}}>{n.message}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}

      {/* GATE 1 MODAL (ANALYST REVIEW) */}
      {isGate1ModalOpen && (
        <div className="modal-overlay active">
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-title">Gate 1: Compliance Analyst Review (<span className="font-mono text-cyan">{activeCaseId}</span>)</div>
              <button className="modal-close" onClick={() => setIsGate1ModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}>
                As a Compliance Analyst, review the automated assessment findings and choose whether to finalize the memo for committee review or issue a Request For Information (RFI) back to the Product Owner.
              </p>
              
              <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem'}}>
                <label style={{display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)'}}>
                  <input type="radio" name="gate1_action" value="finalize" checked={gate1Action === 'finalize'} onChange={() => setGate1Action('finalize')} style={{marginTop: '0.2rem'}} />
                  <div>
                    <strong style={{color: 'var(--text-primary)', fontSize: '0.9rem'}}>Finalize Memo & Advance to Committee</strong>
                    <p style={{fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '0.2rem'}}>Certify that extraction, screening, and policy evaluations are accurate and forward the case to Gate 2.</p>
                  </div>
                </label>

                <label style={{display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)'}}>
                  <input type="radio" name="gate1_action" value="rfi" checked={gate1Action === 'rfi'} onChange={() => setGate1Action('rfi')} style={{marginTop: '0.2rem'}} />
                  <div>
                    <strong style={{color: 'var(--accent-rose)', fontSize: '0.9rem'}}>Request For Information (RFI)</strong>
                    <p style={{fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '0.2rem'}}>Pause processing and return the case to the Product Owner with specific inquiries or missing documentation.</p>
                  </div>
                </label>
              </div>

              <div className="form-group" style={{marginTop: '1rem'}}>
                <label className="form-label">Analyst Justification & Observations</label>
                <textarea className="form-textarea" placeholder="Add specific rationale, noted risk controls, or missing item instructions for the Product Owner..." value={gate1Notes} onChange={e => setGate1Notes(e.target.value)}></textarea>
              </div>

              <div className="form-group">
                <label className="form-label">Analyst Sign-off ID</label>
                <input type="text" className="form-input" value={currentPersona} readOnly />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setIsGate1ModalOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleGate1Submit} disabled={isGate1Submitting}>
                {isGate1Submitting ? 'Processing Decision...' : 'Confirm Gate 1 Decision'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GATE 2 MODAL (COMMITTEE SIGN-OFF) */}
      {isGate2ModalOpen && (
        <div className="modal-overlay active">
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-title">Gate 2: Risk Committee Decision (<span className="font-mono text-cyan">{activeCaseId}</span>)</div>
              <button className="modal-close" onClick={() => setIsGate2ModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}>
                Record the formal determination of the Financial Crimes Risk Committee. Specify applicable conditions precedent and approval covenants.
              </p>

              <div className="form-group" style={{marginTop: '1rem'}}>
                <label className="form-label">Committee Determination</label>
                <div className="decision-button-group">
                  <button type="button" className={`decision-btn variant-approved-conditions ${gate2Outcome === 'Approved with Conditions' ? 'active' : ''}`} onClick={() => setGate2Outcome('Approved with Conditions')}>
                    <div className="decision-btn-header">
                      <span className="decision-btn-icon">✓</span>
                      <span className="decision-btn-title">Approved with Conditions</span>
                    </div>
                    <span className="decision-btn-desc">Approve subject to mandatory covenants & monitoring</span>
                  </button>

                  <button type="button" className={`decision-btn variant-approved ${gate2Outcome === 'Approved' ? 'active' : ''}`} onClick={() => setGate2Outcome('Approved')}>
                    <div className="decision-btn-header">
                      <span className="decision-btn-icon">✓✓</span>
                      <span className="decision-btn-title">Approved Unconditionally</span>
                    </div>
                    <span className="decision-btn-desc">Full sign-off with standard operational controls</span>
                  </button>

                  <button type="button" className={`decision-btn variant-deferred ${gate2Outcome === 'Deferred' ? 'active' : ''}`} onClick={() => setGate2Outcome('Deferred')}>
                    <div className="decision-btn-header">
                      <span className="decision-btn-icon">⏱</span>
                      <span className="decision-btn-title">Deferred for Review</span>
                    </div>
                    <span className="decision-btn-desc">Postpone decision pending additional evidence</span>
                  </button>

                  <button type="button" className={`decision-btn variant-rejected ${gate2Outcome === 'Rejected' ? 'active' : ''}`} onClick={() => setGate2Outcome('Rejected')}>
                    <div className="decision-btn-header">
                      <span className="decision-btn-icon">✕</span>
                      <span className="decision-btn-title">Rejected</span>
                    </div>
                    <span className="decision-btn-desc">Decline request due to unacceptable inherent risk</span>
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Mandatory Covenants & Conditions</label>
                <div>
                  {gate2Conditions.map((cond, idx) => (
                    <div key={idx} className="condition-tag-item" style={{background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--accent-emerald)', borderRadius: 'var(--radius-sm)', padding: '0.35rem 0.65rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem'}}>
                      <span className="condition-tag-text">{cond}</span>
                      <button type="button" style={{background: 'none', border: 'none', color: 'var(--accent-crimson)', cursor: 'pointer', marginLeft: '0.5rem'}} onClick={() => removeConditionTag(idx)}>✕</button>
                    </div>
                  ))}
                </div>
                <div style={{display: 'flex', gap: '0.5rem', marginTop: '0.5rem'}}>
                  <input type="text" className="form-input" placeholder="Type new covenant/condition and press Add..." value={newCondition} onChange={e => setNewCondition(e.target.value)} onKeyDown={e => e.key === 'Enter' && addConditionTag()} />
                  <button type="button" className="btn-secondary" style={{whiteSpace: 'nowrap'}} onClick={addConditionTag}>+ Add Condition</button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Committee Chair / Secretary Signature</label>
                <input type="text" className="form-input" value={currentPersona} readOnly />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setIsGate2ModalOpen(false)}>Cancel</button>
              <button className={gate2Outcome === 'Rejected' ? 'btn-rose' : gate2Outcome === 'Deferred' ? 'btn-amber' : 'btn-emerald'} onClick={handleGate2Submit} disabled={isGate2Submitting}>
                {isGate2Submitting ? 'Processing Decision...' : `Record Official Determination (${gate2Outcome})`}
              </button>
            </div>
          </div>
        </div>
      )}

      </main>
    </div>
  );
}
