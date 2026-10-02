/**
 * FCRM Workbench — Executive PowerPoint Presentation (.pptx) Generator
 * Built with pptxgenjs, styled to match FCRM dark enterprise design tokens.
 * Calibrated specifically for PowerPoint 16:9 widescreen layout (10.0" x 5.625").
 */
import type { AnalyticsSummary, CaseState } from './api';

interface PptxExportOptions {
  summary: AnalyticsSummary;
  cases: CaseState[];
  selectedMonth: string;
  selectedMonthLabel: string;
  userName?: string;
  userRole?: string;
}

// Ensure pptxgenjs is loaded either from window or CDN
async function ensurePptxLibrary(): Promise<any> {
  if (typeof window !== 'undefined' && (window as any).PptxGenJS) {
    return (window as any).PptxGenJS;
  }

  // Dynamically load if script was not yet loaded
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="pptxgen"]');
    if (existing) {
      existing.addEventListener('load', () => resolve((window as any).PptxGenJS));
      existing.addEventListener('error', () => reject(new Error('Failed to load PPTX library')));
      if ((window as any).PptxGenJS) resolve((window as any).PptxGenJS);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';
    script.onload = () => resolve((window as any).PptxGenJS);
    script.onerror = () => reject(new Error('Could not load PowerPoint generator library.'));
    document.head.appendChild(script);
  });
}

export async function exportAnalyticsToPowerPoint(options: PptxExportOptions): Promise<void> {
  const {
    summary,
    cases,
    selectedMonth,
    selectedMonthLabel,
    userName = 'Compliance Officer',
    userRole = 'FCRM Intelligence',
  } = options;

  const PptxGen = await ensurePptxLibrary();
  const pres = new PptxGen();

  // Explicit 16:9 widescreen layout: 10.0 inches width x 5.625 inches height
  pres.layout = 'LAYOUT_16x9';
  pres.author = 'FCRM Workbench Intelligence Engine';
  pres.company = 'GeniusHacks Bank Risk Compliance';
  pres.title = `FCRM Compliance Risk Analytics — ${selectedMonthLabel}`;
  pres.subject = 'Executive Compliance Risk Management Presentation';

  // FCRM Design Tokens
  const THEME = {
    bgDark: '070B14',
    bgCard: '0F172A',
    bgSurface: '131F37',
    border: '1E293B',
    borderBright: '334155',
    textWhite: 'F8FAFC',
    textMuted: '94A3B8',
    textDim: '64748B',
    cyan: '38BDF8',
    blue: '2563EB',
    purple: 'A855F7',
    emerald: '10B981',
    amber: 'F59E0B',
    orange: 'F97316',
    crimson: 'EF4444',
  };

  const filteredCases =
    selectedMonth === 'all'
      ? cases
      : cases.filter(c => {
          const d = c.created_at ? new Date(c.created_at) : new Date();
          const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          return mKey === selectedMonth;
        });

  const totalFiltered = filteredCases.length;
  const criticalCount = filteredCases.filter(c => c.risk_tier === 'Critical').length;
  const highCount = filteredCases.filter(c => c.risk_tier === 'High').length;
  const mediumCount = filteredCases.filter(c => c.risk_tier === 'Medium').length;
  const lowCount = filteredCases.filter(c => c.risk_tier === 'Low').length;
  const approvedCount = filteredCases.filter(
    c => c.status === 'closed' || (c.status && c.status.toLowerCase().includes('approved'))
  ).length;
  const gate1Count = filteredCases.filter(c => c.status === 'awaiting_gate1').length;
  const gate2Count = filteredCases.filter(c => c.status === 'awaiting_gate2').length;
  const rfiCount = filteredCases.filter(
    c => c.status === 'needs_more_information' || c.status === 'rfi'
  ).length;

  const scores = filteredCases
    .map(c => c.risk_score)
    .filter((s): s is number => typeof s === 'number');
  const avgRisk =
    scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : '0.00';
  const highCritPct =
    totalFiltered > 0 ? Math.round(((criticalCount + highCount) / totalFiltered) * 100) : 0;
  const approvalPct = totalFiltered > 0 ? Math.round((approvedCount / totalFiltered) * 100) : 0;

  // Safe Slide Dimension Constants (10.0" x 5.625")
  const SLIDE_X = 0.6;
  const SLIDE_W = 8.8; // 0.6 left + 8.8 width + 0.6 right = 10.0 inches

  // ==========================================
  // SLIDE 1: COVER / TITLE SLIDE
  // ==========================================
  const slide1 = pres.addSlide();
  slide1.background = { color: THEME.bgDark };

  // Top Accent Bar across full width
  slide1.addShape(pres.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 10.0,
    h: 0.1,
    fill: { color: THEME.cyan },
  });

  // Badge pill
  slide1.addShape(pres.ShapeType.roundRect, {
    x: SLIDE_X,
    y: 0.65,
    w: 3.2,
    h: 0.32,
    rectRadius: 0.16,
    fill: { color: THEME.bgSurface },
    line: { color: THEME.cyan, width: 1 },
  });
  slide1.addText('FCRM WORKBENCH • INTELLIGENCE ENGINE', {
    x: SLIDE_X,
    y: 0.65,
    w: 3.2,
    h: 0.32,
    fontSize: 8.5,
    fontFace: 'Plus Jakarta Sans',
    bold: true,
    color: THEME.cyan,
    align: 'center',
    valign: 'middle',
  });

  // Main Title
  slide1.addText('FINANCIAL CRIMES RISK MANAGEMENT', {
    x: SLIDE_X,
    y: 1.15,
    w: SLIDE_W,
    h: 0.7,
    fontSize: 24,
    fontFace: 'Plus Jakarta Sans',
    bold: true,
    color: THEME.textWhite,
  });

  // Subtitle
  slide1.addText('Executive Portfolio Analytics, Risk Scoring & Committee Governance', {
    x: SLIDE_X,
    y: 1.85,
    w: SLIDE_W,
    h: 0.35,
    fontSize: 12.5,
    fontFace: 'Plus Jakarta Sans',
    color: THEME.textMuted,
  });

  // Scope Card (Fits completely in safe bounds)
  slide1.addShape(pres.ShapeType.roundRect, {
    x: SLIDE_X,
    y: 2.35,
    w: SLIDE_W,
    h: 1.85,
    rectRadius: 0.1,
    fill: { color: THEME.bgCard },
    line: { color: THEME.borderBright, width: 1 },
  });

  slide1.addText(
    [
      { text: 'REPORTING SCOPE: ', options: { bold: true, color: THEME.cyan, fontSize: 11 } },
      {
        text: `${selectedMonthLabel.toUpperCase()}\n\n`,
        options: { bold: true, color: THEME.textWhite, fontSize: 13 },
      },
      { text: 'Total Evaluated Cases: ', options: { color: THEME.textMuted, fontSize: 10 } },
      {
        text: `${totalFiltered} initiatives    |    `,
        options: { bold: true, color: THEME.textWhite, fontSize: 10 },
      },
      { text: 'High & Critical Exposure: ', options: { color: THEME.textMuted, fontSize: 10 } },
      {
        text: `${highCritPct}%    |    `,
        options: { bold: true, color: THEME.orange, fontSize: 10 },
      },
      { text: 'Average Risk Index: ', options: { color: THEME.textMuted, fontSize: 10 } },
      { text: `${avgRisk} / 4.00\n\n`, options: { bold: true, color: THEME.cyan, fontSize: 10 } },
      {
        text: 'Institutional compliance portfolio tracking AML/CTF, Sanctions, PEP triage, and committee governance.',
        options: { color: THEME.textDim, fontSize: 8.5 },
      },
    ],
    {
      x: SLIDE_X + 0.3,
      y: 2.5,
      w: SLIDE_W - 0.6,
      h: 1.55,
      fontFace: 'Plus Jakarta Sans',
    }
  );

  // Footer Metadata (Safely above slide bottom 5.625")
  slide1.addText(
    `CONFIDENTIAL • BANK REGULATORY COMPLIANCE REVIEW\nPrepared by: ${userName} (${userRole})  •  Generated on ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
    {
      x: SLIDE_X,
      y: 4.65,
      w: SLIDE_W,
      h: 0.5,
      fontSize: 8.5,
      fontFace: 'JetBrains Mono',
      color: THEME.textDim,
    }
  );

  // ==========================================
  // SLIDE 2: EXECUTIVE SUMMARY & KEY KPIS
  // ==========================================
  const slide2 = pres.addSlide();
  slide2.background = { color: THEME.bgDark };

  // Slide Header
  slide2.addText('Executive Summary & Risk Indicators', {
    x: SLIDE_X,
    y: 0.35,
    w: SLIDE_W,
    h: 0.35,
    fontSize: 17,
    fontFace: 'Plus Jakarta Sans',
    bold: true,
    color: THEME.textWhite,
  });
  slide2.addText(`Portfolio metrics for ${selectedMonthLabel}`, {
    x: SLIDE_X,
    y: 0.7,
    w: SLIDE_W,
    h: 0.25,
    fontSize: 9.5,
    fontFace: 'Plus Jakarta Sans',
    color: THEME.textMuted,
  });

  // 4 KPI Cards: (8.8 width: 4 cards of 2.05 width with 0.20 spacing)
  const kpis = [
    {
      title: 'TOTAL INITIATIVES',
      val: `${totalFiltered}`,
      sub: 'Evaluated compliance cases',
      color: THEME.cyan,
    },
    {
      title: 'HIGH / CRITICAL RISK',
      val: `${criticalCount + highCount}`,
      sub: `${highCritPct}% of active portfolio`,
      color: THEME.crimson,
    },
    {
      title: 'GOVERNANCE VELOCITY',
      val: `${approvedCount}`,
      sub: `${approvalPct}% committee clearance`,
      color: THEME.emerald,
    },
    {
      title: 'PORTFOLIO RISK INDEX',
      val: `${avgRisk}`,
      sub: 'Scale 0.0 - 4.00 (POL-045)',
      color: THEME.amber,
    },
  ];

  kpis.forEach((kpi, idx) => {
    const xPos = SLIDE_X + idx * 2.25;
    slide2.addShape(pres.ShapeType.roundRect, {
      x: xPos,
      y: 1.05,
      w: 2.05,
      h: 1.3,
      rectRadius: 0.08,
      fill: { color: THEME.bgCard },
      line: { color: THEME.borderBright, width: 1 },
    });
    slide2.addText(kpi.title, {
      x: xPos + 0.15,
      y: 1.15,
      w: 1.75,
      h: 0.25,
      fontSize: 7.5,
      fontFace: 'Plus Jakarta Sans',
      bold: true,
      color: THEME.textDim,
    });
    slide2.addText(kpi.val, {
      x: xPos + 0.15,
      y: 1.4,
      w: 1.75,
      h: 0.55,
      fontSize: 20,
      fontFace: 'JetBrains Mono',
      bold: true,
      color: kpi.color,
    });
    slide2.addText(kpi.sub, {
      x: xPos + 0.15,
      y: 1.95,
      w: 1.75,
      h: 0.25,
      fontSize: 7.5,
      fontFace: 'Plus Jakarta Sans',
      color: THEME.textMuted,
    });
  });

  // Governance Pipeline Breakdown Box
  slide2.addShape(pres.ShapeType.roundRect, {
    x: SLIDE_X,
    y: 2.55,
    w: SLIDE_W,
    h: 2.65,
    rectRadius: 0.1,
    fill: { color: THEME.bgCard },
    line: { color: THEME.border, width: 1 },
  });

  slide2.addText('Governance Status & Strategic Compliance Takeaways', {
    x: SLIDE_X + 0.25,
    y: 2.7,
    w: SLIDE_W - 0.5,
    h: 0.3,
    fontSize: 11.5,
    fontFace: 'Plus Jakarta Sans',
    bold: true,
    color: THEME.cyan,
  });

  slide2.addText(
    [
      { text: '• Pipeline Status Distribution:\n', options: { bold: true, color: THEME.textWhite } },
      {
        text: `   - Closed / Approved: ${approvedCount} cases completed committee ratification\n`,
        options: { color: THEME.textMuted },
      },
      {
        text: `   - Awaiting Gate 1 (Analyst Triage): ${gate1Count} cases pending document & fact verification\n`,
        options: { color: THEME.textMuted },
      },
      {
        text: `   - Awaiting Gate 2 (Committee Review): ${gate2Count} cases pending executive vote\n`,
        options: { color: THEME.textMuted },
      },
      {
        text: `   - Request for Information (RFI): ${rfiCount} cases returned to product owners for supplementary details\n\n`,
        options: { color: THEME.textMuted },
      },
      {
        text: '• Supervisory Policy Highlights:\n',
        options: { bold: true, color: THEME.textWhite },
      },
      {
        text: '   - All cases evaluated against POL-010 (Product Review), POL-045 (Cash Risk), and POL-100 (Cannabis Banking).\n',
        options: { color: THEME.textMuted },
      },
      {
        text: '   - Sanctions & PEP screening hit floor rules enforced deterministically across all multi-jurisdiction corridors.',
        options: { color: THEME.textMuted },
      },
    ],
    {
      x: SLIDE_X + 0.25,
      y: 3.05,
      w: SLIDE_W - 0.5,
      h: 2.05,
      fontSize: 8.5,
      fontFace: 'Plus Jakarta Sans',
    }
  );

  // ==========================================
  // SLIDE 3: MONTHLY INFLOW & COMPARATIVE TABLE
  // ==========================================
  const slide3 = pres.addSlide();
  slide3.background = { color: THEME.bgDark };

  slide3.addText('Monthly Intake & Inflow Analysis', {
    x: SLIDE_X,
    y: 0.35,
    w: SLIDE_W,
    h: 0.35,
    fontSize: 17,
    fontFace: 'Plus Jakarta Sans',
    bold: true,
    color: THEME.textWhite,
  });
  slide3.addText('Historical case velocity, risk distribution, and approval trends by month', {
    x: SLIDE_X,
    y: 0.7,
    w: SLIDE_W,
    h: 0.25,
    fontSize: 9.5,
    fontFace: 'Plus Jakarta Sans',
    color: THEME.textMuted,
  });

  // Table Data (col widths sum to exactly 8.8")
  const monthlyRows = summary.monthly_summaries.map(m => {
    const critHigh = (m.tier_counts['Critical'] || 0) + (m.tier_counts['High'] || 0);
    const medLow = (m.tier_counts['Medium'] || 0) + (m.tier_counts['Low'] || 0);
    return [
      { text: m.month_label, options: { bold: true, color: THEME.textWhite } },
      {
        text: `${m.total_cases}`,
        options: { align: 'center', color: THEME.cyan, fontFace: 'JetBrains Mono' },
      },
      {
        text: `${m.avg_risk_score.toFixed(2)}`,
        options: {
          align: 'center',
          color: m.avg_risk_score >= 2.0 ? THEME.orange : THEME.textWhite,
          fontFace: 'JetBrains Mono',
        },
      },
      {
        text: `${critHigh}`,
        options: {
          align: 'center',
          color: critHigh > 0 ? THEME.crimson : THEME.textMuted,
          fontFace: 'JetBrains Mono',
        },
      },
      {
        text: `${medLow}`,
        options: { align: 'center', color: THEME.emerald, fontFace: 'JetBrains Mono' },
      },
      {
        text: `${m.approved_count}`,
        options: { align: 'center', color: THEME.emerald, fontFace: 'JetBrains Mono' },
      },
      {
        text: `${m.rfi_count}`,
        options: {
          align: 'center',
          color: m.rfi_count > 0 ? THEME.amber : THEME.textMuted,
          fontFace: 'JetBrains Mono',
        },
      },
    ];
  });

  const tableHeaders = [
    [
      {
        text: 'Month',
        options: { bold: true, color: THEME.textWhite, fill: { color: THEME.blue } },
      },
      {
        text: 'Total Cases',
        options: {
          bold: true,
          color: THEME.textWhite,
          fill: { color: THEME.blue },
          align: 'center',
        },
      },
      {
        text: 'Avg Score',
        options: {
          bold: true,
          color: THEME.textWhite,
          fill: { color: THEME.blue },
          align: 'center',
        },
      },
      {
        text: 'Critical / High',
        options: {
          bold: true,
          color: THEME.textWhite,
          fill: { color: THEME.blue },
          align: 'center',
        },
      },
      {
        text: 'Medium / Low',
        options: {
          bold: true,
          color: THEME.textWhite,
          fill: { color: THEME.blue },
          align: 'center',
        },
      },
      {
        text: 'Approved',
        options: {
          bold: true,
          color: THEME.textWhite,
          fill: { color: THEME.blue },
          align: 'center',
        },
      },
      {
        text: 'RFI Pending',
        options: {
          bold: true,
          color: THEME.textWhite,
          fill: { color: THEME.blue },
          align: 'center',
        },
      },
    ],
    ...monthlyRows,
  ];

  slide3.addTable(tableHeaders, {
    x: SLIDE_X,
    y: 1.1,
    w: SLIDE_W,
    colW: [1.8, 1.1, 1.1, 1.3, 1.3, 1.1, 1.1],
    rowH: 0.32,
    fontFace: 'Plus Jakarta Sans',
    fontSize: 9,
    fill: { color: THEME.bgCard },
    border: { pt: 1, color: THEME.border },
  });

  slide3.addText(
    'Note: Historical records are derived from the PostgreSQL production case repository and include live committee approvals.',
    {
      x: SLIDE_X,
      y: 4.95,
      w: SLIDE_W,
      h: 0.3,
      fontSize: 8,
      fontFace: 'Plus Jakarta Sans',
      color: THEME.textDim,
      italic: true,
    }
  );

  // ==========================================
  // SLIDE 4: RISK TIER DISTRIBUTION & POLICY POL-045
  // ==========================================
  const slide4 = pres.addSlide();
  slide4.background = { color: THEME.bgDark };

  slide4.addText('Risk Tier Distribution & Policy Standards', {
    x: SLIDE_X,
    y: 0.35,
    w: SLIDE_W,
    h: 0.35,
    fontSize: 17,
    fontFace: 'Plus Jakarta Sans',
    bold: true,
    color: THEME.textWhite,
  });
  slide4.addText(
    'Deterministic scorecard calculations based on policy POL-045 weighting factors',
    {
      x: SLIDE_X,
      y: 0.7,
      w: SLIDE_W,
      h: 0.25,
      fontSize: 9.5,
      fontFace: 'Plus Jakarta Sans',
      color: THEME.textMuted,
    }
  );

  const tierDetails = [
    {
      name: 'Critical Risk',
      threshold: 'Score > 3.00',
      count: criticalCount,
      pct: totalFiltered > 0 ? Math.round((criticalCount / totalFiltered) * 100) : 0,
      color: THEME.crimson,
      desc: 'Corridor expansion with high-risk jurisdictions, nested correspondent banking, or major sanctions flags.',
    },
    {
      name: 'High Risk',
      threshold: 'Score 2.01 - 3.00',
      count: highCount,
      pct: totalFiltered > 0 ? Math.round((highCount / totalFiltered) * 100) : 0,
      color: THEME.orange,
      desc: 'Cash intensity > 60%, licensed cannabis banking, PEP relationships, or screening hit floor overrides.',
    },
    {
      name: 'Medium Risk',
      threshold: 'Score 1.01 - 2.00',
      count: mediumCount,
      pct: totalFiltered > 0 ? Math.round((mediumCount / totalFiltered) * 100) : 0,
      color: THEME.amber,
      desc: 'Novel digital asset custody, non-standard customer segments, third-party fintech API routing.',
    },
    {
      name: 'Low Risk',
      threshold: 'Score 0.00 - 1.00',
      count: lowCount,
      pct: totalFiltered > 0 ? Math.round((lowCount / totalFiltered) * 100) : 0,
      color: THEME.emerald,
      desc: 'Standard commercial fleet programs, domestic ATM parameter changes, clean entity screening.',
    },
  ];

  tierDetails.forEach((td, i) => {
    const yPos = 1.05 + i * 0.82;
    slide4.addShape(pres.ShapeType.roundRect, {
      x: SLIDE_X,
      y: yPos,
      w: SLIDE_W,
      h: 0.72,
      rectRadius: 0.08,
      fill: { color: THEME.bgCard },
      line: { color: THEME.border, width: 1 },
    });

    slide4.addShape(pres.ShapeType.rect, {
      x: SLIDE_X,
      y: yPos,
      w: 0.12,
      h: 0.72,
      fill: { color: td.color },
    });

    slide4.addText(td.name.toUpperCase(), {
      x: SLIDE_X + 0.25,
      y: yPos + 0.1,
      w: 1.8,
      h: 0.25,
      fontSize: 10,
      fontFace: 'Plus Jakarta Sans',
      bold: true,
      color: td.color,
    });

    slide4.addText(td.threshold, {
      x: SLIDE_X + 0.25,
      y: yPos + 0.35,
      w: 1.8,
      h: 0.25,
      fontSize: 8,
      fontFace: 'JetBrains Mono',
      color: THEME.textDim,
    });

    slide4.addText(`${td.count} cases (${td.pct}%)`, {
      x: SLIDE_X + 2.2,
      y: yPos + 0.15,
      w: 1.6,
      h: 0.4,
      fontSize: 11,
      fontFace: 'JetBrains Mono',
      bold: true,
      color: THEME.textWhite,
    });

    slide4.addText(td.desc, {
      x: SLIDE_X + 4.0,
      y: yPos + 0.1,
      w: 4.6,
      h: 0.5,
      fontSize: 8,
      fontFace: 'Plus Jakarta Sans',
      color: THEME.textMuted,
    });
  });

  // Floor rule note banner (fits cleanly above bottom edge)
  slide4.addShape(pres.ShapeType.roundRect, {
    x: SLIDE_X,
    y: 4.5,
    w: SLIDE_W,
    h: 0.55,
    rectRadius: 0.08,
    fill: { color: THEME.bgSurface },
    line: { color: THEME.cyan, width: 1 },
  });

  slide4.addText(
    'MANDATORY POLICY FLOOR RULE: Any unresolved Watchlist / Sanctions / PEP hit automatically floors case risk to High tier minimum regardless of quantitative total.',
    {
      x: SLIDE_X + 0.2,
      y: 4.55,
      w: SLIDE_W - 0.4,
      h: 0.45,
      fontSize: 8.5,
      fontFace: 'Plus Jakarta Sans',
      color: THEME.cyan,
      bold: true,
    }
  );

  // ==========================================
  // SLIDE 5: CHANGE TYPE COMPOSITION & TAXONOMY
  // ==========================================
  const slide5 = pres.addSlide();
  slide5.background = { color: THEME.bgDark };

  slide5.addText('Change Taxonomy & Portfolio Distribution', {
    x: SLIDE_X,
    y: 0.35,
    w: SLIDE_W,
    h: 0.35,
    fontSize: 17,
    fontFace: 'Plus Jakarta Sans',
    bold: true,
    color: THEME.textWhite,
  });
  slide5.addText('Breakdown of business change types categorized during M1 intake triage', {
    x: SLIDE_X,
    y: 0.7,
    w: SLIDE_W,
    h: 0.25,
    fontSize: 9.5,
    fontFace: 'Plus Jakarta Sans',
    color: THEME.textMuted,
  });

  const changeTypeMap: Record<string, number> = {};
  filteredCases.forEach(c => {
    const ct = c.change_type || 'Other';
    changeTypeMap[ct] = (changeTypeMap[ct] || 0) + 1;
  });

  const ctRows = Object.entries(changeTypeMap).map(([k, v]) => {
    const pct = totalFiltered > 0 ? Math.round((v / totalFiltered) * 100) : 0;
    return [
      { text: k, options: { bold: true, color: THEME.textWhite } },
      {
        text: `${v} initiatives`,
        options: { align: 'center', color: THEME.cyan, fontFace: 'JetBrains Mono' },
      },
      {
        text: `${pct}%`,
        options: { align: 'center', color: THEME.textWhite, fontFace: 'JetBrains Mono' },
      },
      {
        text: v >= 3 ? 'High Activity' : 'Moderate Activity',
        options: { color: v >= 3 ? THEME.orange : THEME.textMuted },
      },
    ];
  });

  const ctHeaders = [
    [
      {
        text: 'Change Category',
        options: { bold: true, color: THEME.textWhite, fill: { color: THEME.purple } },
      },
      {
        text: 'Case Count',
        options: {
          bold: true,
          color: THEME.textWhite,
          fill: { color: THEME.purple },
          align: 'center',
        },
      },
      {
        text: 'Portfolio Share',
        options: {
          bold: true,
          color: THEME.textWhite,
          fill: { color: THEME.purple },
          align: 'center',
        },
      },
      {
        text: 'Volume Significance',
        options: { bold: true, color: THEME.textWhite, fill: { color: THEME.purple } },
      },
    ],
    ...ctRows,
  ];

  slide5.addTable(ctHeaders, {
    x: SLIDE_X,
    y: 1.1,
    w: SLIDE_W,
    colW: [3.4, 1.8, 1.8, 1.8],
    rowH: 0.34,
    fontFace: 'Plus Jakarta Sans',
    fontSize: 9,
    fill: { color: THEME.bgCard },
    border: { pt: 1, color: THEME.border },
  });

  slide5.addText(
    'Classifications performed by Claude Haiku intake agent mapped to standard bank compliance taxonomy.',
    {
      x: SLIDE_X,
      y: 4.95,
      w: SLIDE_W,
      h: 0.3,
      fontSize: 8,
      fontFace: 'Plus Jakarta Sans',
      color: THEME.textDim,
      italic: true,
    }
  );

  // ==========================================
  // SLIDE 6: CASE INVENTORY (KEY HIGHLIGHTS)
  // ==========================================
  const slide6 = pres.addSlide();
  slide6.background = { color: THEME.bgDark };

  slide6.addText('Key Compliance Initiatives Registry', {
    x: SLIDE_X,
    y: 0.35,
    w: SLIDE_W,
    h: 0.35,
    fontSize: 17,
    fontFace: 'Plus Jakarta Sans',
    bold: true,
    color: THEME.textWhite,
  });
  slide6.addText(`Sample active & decided cases in ${selectedMonthLabel}`, {
    x: SLIDE_X,
    y: 0.7,
    w: SLIDE_W,
    h: 0.25,
    fontSize: 9.5,
    fontFace: 'Plus Jakarta Sans',
    color: THEME.textMuted,
  });

  const caseRows = filteredCases.slice(0, 7).map(c => [
    { text: c.case_id, options: { bold: true, color: THEME.cyan, fontFace: 'JetBrains Mono' } },
    { text: c.product_type || 'Commercial Initiative', options: { color: THEME.textWhite } },
    { text: c.change_type || 'New Product', options: { color: THEME.textMuted } },
    {
      text: c.risk_tier || 'Pending',
      options: {
        color:
          c.risk_tier === 'Critical'
            ? THEME.crimson
            : c.risk_tier === 'High'
            ? THEME.orange
            : c.risk_tier === 'Medium'
            ? THEME.amber
            : THEME.emerald,
        bold: true,
      },
    },
    {
      text: typeof c.risk_score === 'number' ? c.risk_score.toFixed(2) : '—',
      options: { align: 'center', fontFace: 'JetBrains Mono', color: THEME.textWhite },
    },
    {
      text: (c.status || '').replace('_', ' ').toUpperCase(),
      options: { align: 'center', color: c.status === 'closed' ? THEME.emerald : THEME.amber },
    },
  ]);

  const caseHeaders = [
    [
      {
        text: 'Case ID',
        options: { bold: true, color: THEME.textWhite, fill: { color: THEME.bgSurface } },
      },
      {
        text: 'Product / Initiative',
        options: { bold: true, color: THEME.textWhite, fill: { color: THEME.bgSurface } },
      },
      {
        text: 'Change Type',
        options: { bold: true, color: THEME.textWhite, fill: { color: THEME.bgSurface } },
      },
      {
        text: 'Risk Tier',
        options: { bold: true, color: THEME.textWhite, fill: { color: THEME.bgSurface } },
      },
      {
        text: 'Score',
        options: {
          bold: true,
          color: THEME.textWhite,
          fill: { color: THEME.bgSurface },
          align: 'center',
        },
      },
      {
        text: 'Governance Status',
        options: {
          bold: true,
          color: THEME.textWhite,
          fill: { color: THEME.bgSurface },
          align: 'center',
        },
      },
    ],
    ...caseRows,
  ];

  slide6.addTable(caseHeaders, {
    x: SLIDE_X,
    y: 1.1,
    w: SLIDE_W,
    colW: [1.3, 2.5, 1.8, 1.0, 0.8, 1.4],
    rowH: 0.33,
    fontFace: 'Plus Jakarta Sans',
    fontSize: 8.5,
    fill: { color: THEME.bgCard },
    border: { pt: 1, color: THEME.border },
  });

  slide6.addText(
    'Full case history, extracted facts, and policy citations available in FCRM Workbench dossier.',
    {
      x: SLIDE_X,
      y: 4.95,
      w: SLIDE_W,
      h: 0.3,
      fontSize: 8,
      fontFace: 'Plus Jakarta Sans',
      color: THEME.textDim,
      italic: true,
    }
  );

  // Generate timestamped filename: YYYY-MM-DD_HHmmss
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timestamp = `${year}-${month}-${day}_${hours}${minutes}${seconds}`;
  const scopeSlug = selectedMonthLabel.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');

  const fileName = `FCRM_Compliance_Analytics_${scopeSlug}_${timestamp}.pptx`;
  await pres.writeFile({ fileName });
}

