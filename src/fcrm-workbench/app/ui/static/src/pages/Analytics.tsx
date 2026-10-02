import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient, type CaseState, type AnalyticsSummary } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { exportAnalyticsToPowerPoint } from '../lib/exportPptx';

export default function Analytics() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();
  const currentPersona = user?.role || 'Compliance Officer';

  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshSuccess, setRefreshSuccess] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  // Fetch summary from backend / database
  const {
    data: summary,
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
  } = useQuery<AnalyticsSummary | null>({
    queryKey: ['analyticsSummary'],
    queryFn: () => apiClient.getAnalyticsSummary(),
  });

  // Fetch all cases from database for granular filtering
  const {
    data: rawCases = [],
    isLoading: isCasesLoading,
    refetch: refetchCases,
  } = useQuery<CaseState[]>({
    queryKey: ['cases'],
    queryFn: () => apiClient.listCases(),
  });

  // Available months extracted from actual database data
  const availableMonths = useMemo(() => {
    if (!summary?.monthly_summaries || summary.monthly_summaries.length === 0) {
      // Fallback from raw cases
      const set = new Map<string, string>();
      rawCases.forEach(c => {
        const d = c.created_at ? new Date(c.created_at) : new Date();
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        set.set(key, label);
      });
      return Array.from(set.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([k, label]) => ({ key: k, label }));
    }

    return [...summary.monthly_summaries]
      .sort((a, b) => b.month.localeCompare(a.month))
      .map(m => ({ key: m.month, label: m.month_label }));
  }, [summary, rawCases]);

  // Selected month label
  const selectedMonthLabel = useMemo(() => {
    if (selectedMonth === 'all') return 'All Time (Portfolio Overview)';
    const found = availableMonths.find(m => m.key === selectedMonth);
    return found ? found.label : selectedMonth;
  }, [selectedMonth, availableMonths]);

  // Filtered cases based on selected month
  const filteredCases = useMemo(() => {
    if (selectedMonth === 'all') return rawCases;
    return rawCases.filter(c => {
      const d = c.created_at ? new Date(c.created_at) : new Date();
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return k === selectedMonth;
    });
  }, [rawCases, selectedMonth]);

  // Calculated Metrics for the current filter
  const metrics = useMemo(() => {
    const total = filteredCases.length;
    if (total === 0) {
      return {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        pending: 0,
        highCritPct: 0,
        avgScore: 0,
        approved: 0,
        approvalRate: 0,
        awaitingGate1: 0,
        awaitingGate2: 0,
        rfi: 0,
        rfiRate: 0,
        changeTypes: {} as Record<string, number>,
      };
    }

    let crit = 0;
    let high = 0;
    let med = 0;
    let low = 0;
    let pend = 0;
    let approved = 0;
    let gate1 = 0;
    let gate2 = 0;
    let rfi = 0;
    const scores: number[] = [];
    const changeTypes: Record<string, number> = {};

    filteredCases.forEach(c => {
      const tier = c.risk_tier || 'Pending';
      if (tier === 'Critical') crit++;
      else if (tier === 'High') high++;
      else if (tier === 'Medium') med++;
      else if (tier === 'Low') low++;
      else pend++;

      if (typeof c.risk_score === 'number') {
        scores.push(c.risk_score);
      }

      const st = c.status || '';
      if (st === 'closed' || st.toLowerCase().includes('approved')) approved++;
      if (st === 'awaiting_gate1') gate1++;
      if (st === 'awaiting_gate2') gate2++;
      if (st === 'needs_more_information' || st === 'rfi') rfi++;

      const ct = c.change_type || 'Change Request';
      changeTypes[ct] = (changeTypes[ct] || 0) + 1;
    });

    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const highCritPct = Math.round(((crit + high) / total) * 100);
    const approvalRate = Math.round((approved / total) * 100);
    const rfiRate = Math.round((rfi / total) * 100);

    return {
      total,
      critical: crit,
      high,
      medium: med,
      low,
      pending: pend,
      highCritPct,
      avgScore: parseFloat(avgScore.toFixed(2)),
      approved,
      approvalRate,
      awaitingGate1: gate1,
      awaitingGate2: gate2,
      rfi,
      rfiRate,
      changeTypes,
    };
  }, [filteredCases]);

  // Handle Manual Data Refresh
  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshSuccess(false);

    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['analyticsSummary'] }),
        queryClient.invalidateQueries({ queryKey: ['cases'] }),
        refetchSummary(),
        refetchCases(),
      ]);
      setLastRefreshedAt(new Date());
      setRefreshSuccess(true);
      setTimeout(() => {
        setRefreshSuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to refresh analytics data:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle PowerPoint Export
  const handleExportPPTX = async () => {
    if (!summary && rawCases.length === 0) return;
    setIsExporting(true);
    setExportSuccess(false);

    try {
      const activeSummary: AnalyticsSummary = summary || {
        total_cases: rawCases.length,
        overall_avg_risk_score: metrics.avgScore,
        tier_counts: {
          Critical: metrics.critical,
          High: metrics.high,
          Medium: metrics.medium,
          Low: metrics.low,
          Pending: metrics.pending,
        },
        status_counts: {},
        change_type_counts: metrics.changeTypes,
        monthly_summaries: [],
        approval_metrics: {
          total_gate1: metrics.awaitingGate2 + metrics.approved,
          total_gate2: metrics.approved,
          outcomes: { Approved: metrics.approved },
        },
      };

      await exportAnalyticsToPowerPoint({
        summary: activeSummary,
        cases: rawCases,
        selectedMonth,
        selectedMonthLabel,
        userName: `${user?.firstName || 'Compliance'} ${user?.lastName || 'Officer'}`,
        userRole: currentPersona,
      });

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 4000);
    } catch (err: any) {
      console.error('Failed to export PowerPoint:', err);
      alert('Error generating PowerPoint file: ' + (err.message || 'Unknown error'));
    } finally {
      setIsExporting(false);
    }
  };

  const isLoading = isSummaryLoading || isCasesLoading;

  return (
    <div id="main-app" className="app-container">
      {/* Top Navigation Bar - strictly matching Dashboard layout */}
      <header className="navbar">
        <div className="brand-section">
          <div className="brand-logo">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
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
          <button className="nav-btn" onClick={() => navigate('/dashboard')}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 6h13" />
              <path d="M8 12h13" />
              <path d="M8 18h13" />
              <path d="M3 6h.01" />
              <path d="M3 12h.01" />
              <path d="M3 18h.01" />
            </svg>
            Cases Queue
          </button>
          <button className="nav-btn" onClick={() => navigate('/dashboard')}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v8" />
              <path d="M8 12h8" />
            </svg>
            + Submit Change Request
          </button>
          <button className="nav-btn active">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            Analytics & Reports
          </button>
        </nav>

        {/* Header Controls */}
        <div className="header-controls">
          <div className="user-profile-container" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {user?.firstName} {user?.lastName}
              </div>
              <div
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--accent-cyan)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {currentPersona}
              </div>
            </div>
            <button
              id="btn-logout"
              className="btn-secondary"
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
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

      {/* Main Analytics Content */}
      <main className="main-content" style={{ padding: '2rem 2.5rem' }}>
        {/* Analytics Top Control Header */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '2rem',
            gap: '1rem',
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '1.5rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Compliance & Risk Analytics
              </h1>
              <span
                style={{
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid var(--border-accent)',
                  color: 'var(--accent-cyan)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                Database Grounded
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.35rem' }}>
              Real-time multi-agent compliance metrics, risk scorecards, and committee governance trends
            </p>
          </div>

          {/* Action Toolbar: Month Selector & PPTX Export */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            {/* Month Filter Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                Period:
              </label>
              <select
                className="filter-select"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                style={{
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.5rem 0.85rem',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="all">All Months (Portfolio Scope)</option>
                {availableMonths.map(m => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Refresh Button */}
            <button
              className="btn-secondary"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              title={
                lastRefreshedAt
                  ? `Last refreshed at ${lastRefreshedAt.toLocaleTimeString()}. Click to reload latest database metrics.`
                  : 'Refresh Analytics from Database'
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.5rem 0.85rem',
                fontSize: '0.85rem',
                fontWeight: 500,
                cursor: isRefreshing || isLoading ? 'not-allowed' : 'pointer',
                opacity: isRefreshing ? 0.75 : 1,
                borderColor: refreshSuccess ? 'var(--accent-emerald)' : undefined,
                color: refreshSuccess ? 'var(--accent-emerald)' : undefined,
                transition: 'all 0.2s ease',
              }}
            >
              {refreshSuccess ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ animation: 'checkPop 0.3s ease-out' }}
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none',
                    transformOrigin: 'center',
                  }}
                >
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
              )}
              {isRefreshing ? 'Refreshing...' : refreshSuccess ? 'Refreshed!' : 'Refresh'}
            </button>

            {/* PowerPoint Export Button */}
            <button
              onClick={handleExportPPTX}
              disabled={isExporting || isLoading}
              className="btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.55rem 1.15rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                background: exportSuccess
                  ? 'var(--accent-emerald)'
                  : 'linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-indigo) 100%)',
                boxShadow: 'var(--shadow-glow)',
                border: 'none',
                cursor: isExporting ? 'not-allowed' : 'pointer',
                opacity: isExporting ? 0.7 : 1,
                transition: 'all 0.2s ease',
              }}
            >
              {isExporting ? (
                <>
                  <svg
                    style={{ animation: 'spin 1s linear infinite' }}
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                  </svg>
                  Generating Slides...
                </>
              ) : exportSuccess ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Exported (.pptx)!
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                  Export Executive Deck (.pptx)
                </>
              )}
            </button>
          </div>
        </div>

        {/* Selected Scope Banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 1.25rem',
            marginBottom: '1.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--accent-cyan)',
                boxShadow: '0 0 8px var(--accent-cyan)',
              }}
            ></span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Active Reporting Window:
            </span>
            <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              {selectedMonthLabel}
            </strong>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Showing <strong>{metrics.total}</strong> banking change initiatives loaded from database
          </div>
        </div>

        {/* Top Executive KPI Cards */}
        <div className="kpi-grid" style={{ marginBottom: '2rem' }}>
          <div className="kpi-card" style={{ '--card-accent': 'var(--accent-cyan)' } as any}>
            <div className="kpi-title">Evaluated Initiatives</div>
            <div className="kpi-value text-cyan">{metrics.total}</div>
            <div className="kpi-subtext">Active & processed compliance cases</div>
          </div>

          <div className="kpi-card" style={{ '--card-accent': 'var(--accent-crimson)' } as any}>
            <div className="kpi-title">High & Critical Exposure</div>
            <div className="kpi-value text-crimson">
              {metrics.critical + metrics.high}{' '}
              <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                ({metrics.highCritPct}%)
              </span>
            </div>
            <div className="kpi-subtext">
              {metrics.critical} Critical • {metrics.high} High tier cases
            </div>
          </div>

          <div className="kpi-card" style={{ '--card-accent': 'var(--accent-amber)' } as any}>
            <div className="kpi-title">Average Risk Score</div>
            <div className="kpi-value text-amber">
              {metrics.avgScore}{' '}
              <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                / 4.00
              </span>
            </div>
            <div className="kpi-subtext">POL-045 Weighted Scorecard</div>
          </div>

          <div className="kpi-card" style={{ '--card-accent': 'var(--accent-emerald)' } as any}>
            <div className="kpi-title">Committee Clearance</div>
            <div className="kpi-value text-emerald">
              {metrics.approved}{' '}
              <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                ({metrics.approvalRate}%)
              </span>
            </div>
            <div className="kpi-subtext">Approved or Approved with Conditions</div>
          </div>
        </div>

        {/* Analytics Charts Grid: 2 Columns */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem',
          }}
        >
          {/* CHART 1: Monthly Intake Volume & Trend */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.25rem',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Monthly Submission Velocity & Average Score
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Case intake volume and risk trajectory across quarters
                </p>
              </div>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--accent-cyan)',
                  background: 'var(--bg-secondary)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                PostgreSQL Aggregation
              </span>
            </div>

            {/* SVG Interactive Monthly Chart */}
            <div style={{ width: '100%', height: '240px', position: 'relative' }}>
              <MonthlyBarChart
                monthlyData={summary?.monthly_summaries || []}
                activeMonth={selectedMonth}
                onSelectMonth={setSelectedMonth}
              />
            </div>
          </div>

          {/* CHART 2: Risk Tier Distribution */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.25rem',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Risk Tier Composition (POL-045)
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Portfolio risk exposure categorized by mandatory policy thresholds
                </p>
              </div>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--accent-amber)',
                  background: 'var(--bg-secondary)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                Floor Rules Active
              </span>
            </div>

            <RiskTierDistributionChart
              critical={metrics.critical}
              high={metrics.high}
              medium={metrics.medium}
              low={metrics.low}
              pending={metrics.pending}
              total={metrics.total}
            />
          </div>

          {/* CHART 3: Change Type Breakdown */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.25rem',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Change Type Portfolio Breakdown
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  M1 Claude Haiku intake taxonomy classifications
                </p>
              </div>
            </div>

            <ChangeTypeHorizontalBars changeTypes={metrics.changeTypes} total={metrics.total} />
          </div>

          {/* CHART 4: Governance Pipeline & Gate Funnel */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.25rem',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Governance Pipeline & Review Funnel
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Throughput from Intake through Gate 1 (Analyst) and Gate 2 (Committee)
                </p>
              </div>
            </div>

            <GovernanceFunnel
              total={metrics.total}
              awaitingGate1={metrics.awaitingGate1}
              awaitingGate2={metrics.awaitingGate2}
              approved={metrics.approved}
              rfi={metrics.rfi}
            />
          </div>
        </div>

        {/* SECTION: Monthly Executive Summaries Table */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.75rem',
            marginBottom: '2rem',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.25rem',
            }}
          >
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Monthly Historical Ledger & Multi-Month Summaries
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Complete monthly breakdown stored and computed directly from the PostgreSQL case repository
              </p>
            </div>
            <button
              onClick={() => setSelectedMonth('all')}
              className="btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
            >
              Reset to All Months
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="queue-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Month</th>
                  <th style={{ textAlign: 'center' }}>Total Intake</th>
                  <th style={{ textAlign: 'center' }}>Avg Risk Score</th>
                  <th style={{ textAlign: 'center' }}>Critical / High</th>
                  <th style={{ textAlign: 'center' }}>Medium / Low</th>
                  <th style={{ textAlign: 'center' }}>Committee Approved</th>
                  <th style={{ textAlign: 'center' }}>RFI Inquiries</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(!summary?.monthly_summaries || summary.monthly_summaries.length === 0) ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No monthly records found in database.
                    </td>
                  </tr>
                ) : (
                  summary.monthly_summaries.map(m => {
                    const critHigh = (m.tier_counts['Critical'] || 0) + (m.tier_counts['High'] || 0);
                    const medLow = (m.tier_counts['Medium'] || 0) + (m.tier_counts['Low'] || 0);
                    const isRowSelected = selectedMonth === m.month;

                    return (
                      <tr
                        key={m.month}
                        style={{
                          background: isRowSelected ? 'rgba(56, 189, 248, 0.08)' : undefined,
                          borderLeft: isRowSelected ? '3px solid var(--accent-cyan)' : undefined,
                        }}
                      >
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {m.month_label}
                          </div>
                          <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                            {m.month}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--accent-cyan)' }}>
                          {m.total_cases}
                        </td>
                        <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          <span
                            style={{
                              color:
                                m.avg_risk_score >= 2.0
                                  ? 'var(--accent-rose)'
                                  : m.avg_risk_score >= 1.0
                                  ? 'var(--accent-amber)'
                                  : 'var(--accent-emerald)',
                            }}
                          >
                            {m.avg_risk_score.toFixed(2)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={critHigh > 0 ? 'badge-risk-high' : ''}>
                            {critHigh}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={medLow > 0 ? 'badge-risk-low' : ''}>
                            {medLow}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--accent-emerald)', fontWeight: 600 }}>
                          {m.approved_count}
                        </td>
                        <td style={{ textAlign: 'center', color: m.rfi_count > 0 ? 'var(--accent-amber)' : 'var(--text-muted)' }}>
                          {m.rfi_count}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn-secondary"
                            onClick={() => setSelectedMonth(m.month)}
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.3rem 0.65rem',
                              background: isRowSelected ? 'var(--accent-cyan)' : undefined,
                              color: isRowSelected ? '#070B14' : undefined,
                              fontWeight: isRowSelected ? 700 : 500,
                            }}
                          >
                            {isRowSelected ? 'Active Filter' : 'Filter View'}
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

        {/* SECTION: Filtered Case Registry */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.75rem',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.25rem',
            }}
          >
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Case Registry: {selectedMonthLabel}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Individual initiatives matching the selected monthly filter
              </p>
            </div>
            <span
              style={{
                fontSize: '0.8rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-secondary)',
              }}
            >
              {filteredCases.length} records
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="queue-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Case ID</th>
                  <th>Product / Initiative</th>
                  <th>Change Type</th>
                  <th>Risk Tier</th>
                  <th style={{ textAlign: 'center' }}>Score</th>
                  <th>Status</th>
                  <th>Created Date</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCases.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No cases found for this period.
                    </td>
                  </tr>
                ) : (
                  filteredCases.map(c => {
                    const tierClass =
                      c.risk_tier === 'Critical'
                        ? 'badge-risk-critical'
                        : c.risk_tier === 'High'
                        ? 'badge-risk-high'
                        : c.risk_tier === 'Medium'
                        ? 'badge-risk-medium'
                        : 'badge-risk-low';

                    const dateStr = c.created_at
                      ? new Date(c.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : '—';

                    return (
                      <tr key={c.case_id}>
                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-cyan)' }}>
                            {c.case_id}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {c.product_type}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.description}
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {c.change_type}
                          </span>
                        </td>
                        <td>
                          <span className={tierClass}>{c.risk_tier || 'Pending'}</span>
                        </td>
                        <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          {typeof c.risk_score === 'number' ? c.risk_score.toFixed(2) : '—'}
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              background:
                                c.status === 'closed'
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : c.status === 'awaiting_gate2'
                                  ? 'rgba(168, 85, 247, 0.15)'
                                  : c.status === 'awaiting_gate1'
                                  ? 'rgba(245, 158, 11, 0.15)'
                                  : 'rgba(56, 189, 248, 0.15)',
                              color:
                                c.status === 'closed'
                                  ? 'var(--accent-emerald)'
                                  : c.status === 'awaiting_gate2'
                                  ? 'var(--accent-purple)'
                                  : c.status === 'awaiting_gate1'
                                  ? 'var(--accent-amber)'
                                  : 'var(--accent-cyan)',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                            }}
                          >
                            {c.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {dateStr}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn-secondary"
                            onClick={() => navigate('/dashboard')}
                            style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
                          >
                            View in Queue
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
      </main>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS: PURE SVG CHARTS MATCHING FCRM DESIGN TOKENS
// ============================================================================

/**
 * 1. Monthly Bar & Trajectory Chart
 */
function MonthlyBarChart({
  monthlyData,
  activeMonth,
  onSelectMonth,
}: {
  monthlyData: any[];
  activeMonth: string;
  onSelectMonth: (m: string) => void;
}) {
  if (!monthlyData || monthlyData.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
        No historical monthly data recorded.
      </div>
    );
  }

  const maxCases = Math.max(...monthlyData.map(m => m.total_cases), 10);
  const chartHeight = 180;
  const chartWidth = 520;
  const barWidth = 44;
  const spacing = (chartWidth - 60) / monthlyData.length;

  return (
    <svg viewBox={`0 0 ${chartWidth} 230`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
      <defs>
        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#2563EB" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id="activeBarGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="1" />
          <stop offset="100%" stopColor="#A855F7" stopOpacity="0.9" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
        const y = chartHeight - pct * (chartHeight - 30);
        return (
          <g key={i}>
            <line x1="40" y1={y} x2={chartWidth - 10} y2={y} stroke="#1E293B" strokeDasharray="3 3" />
            <text x="32" y={y + 3} fill="#64748B" fontSize="9" textAnchor="end" fontFamily="var(--font-mono)">
              {Math.round(pct * maxCases)}
            </text>
          </g>
        );
      })}

      {/* Monthly Bars */}
      {monthlyData.map((m, idx) => {
        const x = 55 + idx * spacing;
        const bHeight = ((m.total_cases / maxCases) * (chartHeight - 30));
        const y = chartHeight - bHeight;
        const isSelected = activeMonth === m.month;

        return (
          <g
            key={m.month}
            style={{ cursor: 'pointer' }}
            onClick={() => onSelectMonth(m.month)}
          >
            {/* Background Hover / Click Target */}
            <rect
              x={x - 6}
              y={20}
              width={barWidth + 12}
              height={chartHeight}
              fill={isSelected ? 'rgba(56, 189, 248, 0.08)' : 'transparent'}
              rx="6"
            />

            {/* Bar */}
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(bHeight, 4)}
              rx="5"
              fill={isSelected ? 'url(#activeBarGradient)' : 'url(#barGradient)'}
              stroke={isSelected ? '#38BDF8' : 'none'}
              strokeWidth={isSelected ? 1.5 : 0}
            />

            {/* Value on top of bar */}
            <text
              x={x + barWidth / 2}
              y={y - 6}
              fill={isSelected ? '#38BDF8' : '#F8FAFC'}
              fontSize="11"
              fontWeight="600"
              fontFamily="var(--font-mono)"
              textAnchor="middle"
            >
              {m.total_cases}
            </text>

            {/* Month Label below bar */}
            <text
              x={x + barWidth / 2}
              y={chartHeight + 18}
              fill={isSelected ? '#38BDF8' : '#94A3B8'}
              fontSize="10"
              fontWeight={isSelected ? '700' : '500'}
              fontFamily="var(--font-sans)"
              textAnchor="middle"
            >
              {m.month_label.split(' ')[0]}
            </text>

            <text
              x={x + barWidth / 2}
              y={chartHeight + 30}
              fill="#64748B"
              fontSize="8"
              fontFamily="var(--font-mono)"
              textAnchor="middle"
            >
              Avg: {m.avg_risk_score.toFixed(1)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * 2. Risk Tier Segmented Progress & Donut Chart
 */
function RiskTierDistributionChart({
  critical,
  high,
  medium,
  low,
  pending: _pending,
  total,
}: {
  critical: number;
  high: number;
  medium: number;
  low: number;
  pending?: number;
  total: number;
}) {
  const tiers = [
    { name: 'Critical Risk', count: critical, color: 'var(--accent-crimson)', desc: 'Corridors, high sanctions flags' },
    { name: 'High Risk', count: high, color: 'var(--accent-orange)', desc: 'Cash-intensive, PEP hits, floor overrides' },
    { name: 'Medium Risk', count: medium, color: 'var(--accent-amber)', desc: 'Novel crypto, fintech APIs' },
    { name: 'Low Risk', count: low, color: 'var(--accent-emerald)', desc: 'Standard fleet cards, domestic limits' },
  ];

  return (
    <div>
      {/* Visual Stacked Bar */}
      <div
        style={{
          display: 'flex',
          height: '24px',
          width: '100%',
          borderRadius: '8px',
          overflow: 'hidden',
          marginBottom: '1.5rem',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-medium)',
        }}
      >
        {tiers.map((t, i) => {
          const pct = total > 0 ? (t.count / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div
              key={i}
              title={`${t.name}: ${t.count} (${Math.round(pct)}%)`}
              style={{
                width: `${pct}%`,
                background: t.color,
                transition: 'width 0.4s ease',
              }}
            />
          );
        })}
      </div>

      {/* Tier Details Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
        {tiers.map((t, idx) => {
          const pct = total > 0 ? Math.round((t.count / total) * 100) : 0;
          return (
            <div
              key={idx}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem 1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: t.color,
                    }}
                  />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {t.name}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    color: t.color,
                  }}
                >
                  {t.count}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span>{t.desc}</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 3. Change Type Horizontal Bar Distribution
 */
function ChangeTypeHorizontalBars({
  changeTypes,
  total,
}: {
  changeTypes: Record<string, number>;
  total: number;
}) {
  const sorted = Object.entries(changeTypes).sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) {
    return <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No classification data available.</div>;
  }

  const maxVal = Math.max(...sorted.map(s => s[1]), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {sorted.slice(0, 5).map(([name, count], i) => {
        const pct = Math.round((count / maxVal) * 100);
        const portfolioPct = total > 0 ? Math.round((count / total) * 100) : 0;

        return (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{name}</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                {count} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({portfolioPct}%)</span>
              </span>
            </div>
            <div
              style={{
                height: '8px',
                width: '100%',
                background: 'var(--bg-secondary)',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: 'linear-gradient(90deg, var(--accent-indigo), var(--accent-cyan))',
                  borderRadius: '4px',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 4. Governance Pipeline Funnel
 */
function GovernanceFunnel({
  total,
  awaitingGate1,
  awaitingGate2,
  approved,
  rfi,
}: {
  total: number;
  awaitingGate1: number;
  awaitingGate2: number;
  approved: number;
  rfi: number;
}) {
  const stages = [
    {
      title: 'M1 Intake Validated',
      count: total,
      color: 'var(--accent-cyan)',
      desc: 'Extracted facts & screening done',
    },
    {
      title: 'Gate 1 Analyst Triage',
      count: awaitingGate1 + awaitingGate2 + approved,
      color: 'var(--accent-amber)',
      desc: `${awaitingGate1} currently in analyst queue`,
    },
    {
      title: 'Gate 2 Committee Decision',
      count: awaitingGate2 + approved,
      color: 'var(--accent-purple)',
      desc: `${awaitingGate2} awaiting committee quorum`,
    },
    {
      title: 'Clearance & Archival',
      count: approved,
      color: 'var(--accent-emerald)',
      desc: 'Formally approved and archived',
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {stages.map((st, idx) => {
          const pct = total > 0 ? Math.round((st.count / total) * 100) : 0;
          return (
            <div
              key={idx}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem 1rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {st.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {st.desc}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: st.color }}>
                    {st.count}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.35rem' }}>
                    ({pct}%)
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {rfi > 0 && (
        <div
          style={{
            marginTop: '1rem',
            padding: '0.6rem 0.85rem',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.8rem',
            color: 'var(--accent-amber)',
          }}
        >
          <span>Active RFI Inquiries (Returned to Product Owner):</span>
          <strong style={{ fontFamily: 'var(--font-mono)' }}>{rfi} cases</strong>
        </div>
      )}
    </div>
  );
}
