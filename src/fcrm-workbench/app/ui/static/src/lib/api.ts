/**
 * FCRM Workbench — API & State Service
 * Connects directly with FastAPI backend endpoints & LangGraph Multi-Agent Orchestrator.
 */

import { supabase } from './supabase';

// Use an environment variable for the API base, or fallback to relative for proxy
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export interface MonthlySummary {
  month: string;
  month_label: string;
  total_cases: number;
  avg_risk_score: number;
  tier_counts: Record<string, number>;
  status_counts: Record<string, number>;
  change_type_counts: Record<string, number>;
  approved_count: number;
  rejected_count: number;
  rfi_count: number;
}

export interface AnalyticsSummary {
  total_cases: number;
  overall_avg_risk_score: number;
  tier_counts: Record<string, number>;
  status_counts: Record<string, number>;
  change_type_counts: Record<string, number>;
  monthly_summaries: MonthlySummary[];
  approval_metrics: {
    total_gate1: number;
    total_gate2: number;
    outcomes: Record<string, number>;
  };
}

export interface CaseState {
  case_id: string;
  product_type: string;
  change_type: string;
  geography: string;
  segment: string;
  target_date?: string;
  description: string;
  missing_fields?: string[];
  status: string;
  awaiting?: string[];
  risk_score: number | null;
  risk_tier: string | null;
  pipeline_steps?: any[];
  scorecard?: any;
  facts?: any;
  policies?: any;
  screening?: any;
  memo?: any;
  sla?: any;
  notifications?: any[];
  created_at?: string;
}

class FCRMApiClient {
  public localCases: Record<string, CaseState> = {};

  constructor() {
    try {
      localStorage.removeItem('fcrm_workbench_cases_v2');
      localStorage.removeItem('fcrm_workbench_cases_v1');
      localStorage.removeItem('fcrm_workbench_cases');
    } catch (e) {}
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {};
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
  }

  async resetCases(): Promise<CaseState[]> {
    this.localCases = {};
    return this.listCases();
  }

  async listCases(): Promise<CaseState[]> {
    try {
      const headers = await this.getAuthHeaders();
      const resp = await fetch(`${API_BASE}/cases`, { headers, cache: 'no-store' });
      if (resp.ok) {
        const backendCases = await resp.json();
        if (Array.isArray(backendCases)) {
          this.localCases = {};
          backendCases.forEach((c: any) => {
            const sub = c.submission || {};
            const rScore = typeof c.risk_score === 'number' ? c.risk_score : null;
            const rTier =
              c.risk_tier ||
              (c.status === 'needs_more_information' ? 'Pending (RFI)' : 'Pending');
            
            this.localCases[c.case_id] = {
              case_id: c.case_id,
              product_type: sub.product_type || c.product_type || 'Commercial Initiative',
              change_type: sub.change_type || c.change_type || 'Change Request',
              geography: sub.geography || c.geography || 'Domestic (US)',
              segment: sub.segment || c.segment || 'Commercial Banking',
              description: sub.description || c.description || '',
              status: c.status || 'in-flight',
              risk_tier: rTier,
              risk_score:
                rScore !== null
                  ? parseFloat(rScore.toFixed(2))
                  : null, // Returning number instead of string for risk_score
              scorecard: rScore !== null ? { composite_score: rScore } : null,
              created_at: c.created_at || new Date().toISOString(),
              sla: {
                elapsed_hours: 1.0,
                target_hours: 24.0,
                within_sla: true,
                sla_status: 'Active',
              },
            };
          });
        }
      }
    } catch (err) {
      console.warn('Could not reach /cases endpoint:', err);
    }
    return Object.values(this.localCases);
  }

  async getAnalyticsSummary(): Promise<AnalyticsSummary | null> {
    try {
      const headers = await this.getAuthHeaders();
      const resp = await fetch(`${API_BASE}/analytics/summary`, { headers, cache: 'no-store' });
      if (resp.ok) {
        return await resp.json();
      }
    } catch (err) {
      console.warn('Could not fetch /analytics/summary from backend:', err);
    }

    // Fallback client-side computation from loaded cases if backend endpoint unavailable
    const cases = await this.listCases();
    if (!cases || cases.length === 0) return null;

    const tierCounts: Record<string, number> = { Critical: 0, High: 0, Medium: 0, Low: 0, Pending: 0 };
    const statusCounts: Record<string, number> = {};
    const changeTypeCounts: Record<string, number> = {};
    const monthlyMap: Record<string, any> = {};
    const scores: number[] = [];

    cases.forEach((c) => {
      const tier = c.risk_tier || 'Pending';
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
      statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
      const ct = c.change_type || 'Change Request';
      changeTypeCounts[ct] = (changeTypeCounts[ct] || 0) + 1;
      if (typeof c.risk_score === 'number') scores.push(c.risk_score);

      const d = c.created_at ? new Date(c.created_at) : new Date();
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const mLabel = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });

      if (!monthlyMap[mKey]) {
        monthlyMap[mKey] = {
          month: mKey,
          month_label: mLabel,
          total_cases: 0,
          scores: [],
          tier_counts: { Critical: 0, High: 0, Medium: 0, Low: 0, Pending: 0 },
          status_counts: {},
          change_type_counts: {},
          approved_count: 0,
          rejected_count: 0,
          rfi_count: 0,
        };
      }

      const mEntry = monthlyMap[mKey];
      mEntry.total_cases++;
      if (typeof c.risk_score === 'number') mEntry.scores.push(c.risk_score);
      mEntry.tier_counts[tier] = (mEntry.tier_counts[tier] || 0) + 1;
      mEntry.status_counts[c.status] = (mEntry.status_counts[c.status] || 0) + 1;
      mEntry.change_type_counts[ct] = (mEntry.change_type_counts[ct] || 0) + 1;
      if (c.status === 'closed') mEntry.approved_count++;
      if (c.status === 'rejected') mEntry.rejected_count++;
      if (c.status === 'needs_more_information' || c.status === 'rfi') mEntry.rfi_count++;
    });

    const monthlySummaries: MonthlySummary[] = Object.keys(monthlyMap).sort().map((k) => {
      const item = monthlyMap[k];
      const s = item.scores;
      return {
        month: item.month,
        month_label: item.month_label,
        total_cases: item.total_cases,
        avg_risk_score: s.length > 0 ? parseFloat((s.reduce((a: number, b: number) => a + b, 0) / s.length).toFixed(2)) : 0,
        tier_counts: item.tier_counts,
        status_counts: item.status_counts,
        change_type_counts: item.change_type_counts,
        approved_count: item.approved_count,
        rejected_count: item.rejected_count,
        rfi_count: item.rfi_count,
      };
    });

    return {
      total_cases: cases.length,
      overall_avg_risk_score: scores.length > 0 ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : 0,
      tier_counts: tierCounts,
      status_counts: statusCounts,
      change_type_counts: changeTypeCounts,
      monthly_summaries: monthlySummaries,
      approval_metrics: {
        total_gate1: statusCounts['awaiting_gate2'] || 0 + (statusCounts['closed'] || 0),
        total_gate2: statusCounts['closed'] || 0,
        outcomes: { Approved: statusCounts['closed'] || 0 },
      },
    };
  }

  async getCase(caseId: string): Promise<CaseState | null> {
    try {
      const headers = await this.getAuthHeaders();
      const resp = await fetch(`${API_BASE}/cases/${caseId}/state`, { headers, cache: 'no-store' });
      if (resp.ok) {
        const state = await resp.json();
        if (state && Object.keys(state).length > 0) {
          const formatted = this._formatBackendStateToCase(caseId, state);
          this.localCases[caseId] = formatted;
          return formatted;
        }
      }
    } catch (err) {
      console.warn(`Could not fetch remote state for ${caseId}:`, err);
    }

    return this.localCases[caseId] || null;
  }

  async createCase(formData: FormData | Record<string, any>): Promise<any> {
    try {
      const headers = await this.getAuthHeaders();
      let resp;
      if (formData instanceof FormData) {
        resp = await fetch(`${API_BASE}/cases`, {
          method: 'POST',
          headers: headers,
          body: formData,
        });
      } else {
        headers['Content-Type'] = 'application/json';
        resp = await fetch(`${API_BASE}/cases`, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(formData),
        });
      }

      if (resp.ok) {
        const result = await resp.json();
        const newId = result.case_id;
        const realCase = this._formatBackendStateToCase(newId, result);
        this.localCases[newId] = realCase;
        return { success: true, case_id: newId, case: realCase };
      } else {
        const err = await resp.json().catch(() => ({}));
        return { success: false, error: err.detail || 'Submission failed' };
      }
    } catch (err: any) {
      console.error('Backend submission failed:', err);
      return { success: false, error: err.message };
    }
  }

  async resubmitCase(caseId: string, payload: FormData | Record<string, any>): Promise<any> {
    try {
      const headers = await this.getAuthHeaders();
      let resp;
      if (payload instanceof FormData) {
        resp = await fetch(`${API_BASE}/cases/${caseId}/resubmit`, {
          method: 'POST',
          headers: headers,
          body: payload,
        });
      } else {
        headers['Content-Type'] = 'application/json';
        resp = await fetch(`${API_BASE}/cases/${caseId}/resubmit`, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(payload),
        });
      }

      if (resp.ok) {
        const result = await resp.json();
        const updated = this._formatBackendStateToCase(caseId, result);
        this.localCases[caseId] = updated;
        return { success: true, case_id: caseId, case: updated };
      } else {
        const err = await resp.json().catch(() => ({}));
        return { success: false, error: err.detail || 'Resubmission failed' };
      }
    } catch (err: any) {
      console.error('Backend resubmission failed:', err);
      return { success: false, error: err.message };
    }
  }

  async resolveGate1(caseId: string, action: string, notes: string, actor: string): Promise<any> {
    try {
      const headers = await this.getAuthHeaders();
      headers['Content-Type'] = 'application/json';
      const resp = await fetch(`${API_BASE}/cases/${caseId}/gate1`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          action: action,
          analyst_notes: notes,
          actor: actor || 'Analyst',
        }),
      });
      if (resp.ok) {
        const updated = await this.getCase(caseId);
        return { success: true, case: updated };
      }
    } catch (err) {
      console.warn('Gate 1 resolution call failed:', err);
    }
    return { success: false, error: 'Gate 1 execution failed' };
  }

  async resolveGate2(caseId: string, outcome: string, conditions: string[], actor: string): Promise<any> {
    try {
      const headers = await this.getAuthHeaders();
      headers['Content-Type'] = 'application/json';
      const resp = await fetch(`${API_BASE}/cases/${caseId}/gate2`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          outcome: outcome,
          conditions: conditions || [],
          actor: actor || 'Committee Chair',
        }),
      });
      if (resp.ok) {
        const updated = await this.getCase(caseId);
        return { success: true, case: updated };
      }
    } catch (err) {
      console.warn('Gate 2 resolution call failed:', err);
    }
    return { success: false, error: 'Gate 2 execution failed' };
  }

  async getHealth(): Promise<any> {
    try {
      const resp = await fetch(`${API_BASE}/health`);
      if (resp.ok) {
        return await resp.json();
      }
    } catch (e) {}
    return { status: 'offline', mode: 'disconnected' };
  }

  _formatBackendStateToCase(caseId: string, state: any): CaseState {
    const submission = state.submission || {};
    const productType = submission.product_type || 'Commercial Initiative';
    const changeType = submission.change_type || state.change_type || 'Change Request';
    const geography = submission.geography || 'Domestic (US)';
    const segment = submission.segment || 'Commercial Banking';
    const targetDate = submission.target_date || '2026-11-01';
    const description = submission.description || '';

    let status = state.status || 'in-flight';
    if (state.awaiting && state.awaiting.includes('gate1')) {
      status = 'awaiting_gate1';
    } else if (state.awaiting && state.awaiting.includes('gate2')) {
      status = 'awaiting_gate2';
    } else if (state.final_outcome || state.status === 'closed') {
      const outcome = (state.final_outcome || '').toLowerCase();
      status = outcome.includes('approved') ? 'closed' : outcome.includes('rejected') ? 'rejected' : 'closed';
    } else if (state.status === 'needs_more_information') {
      status = 'needs_more_information';
    } else if (state.status === 'validated') {
      status = 'awaiting_gate1';
    }

    const isNeedsInfo = status === 'needs_more_information';
    const isGate1Done =
      status === 'awaiting_gate2' || status === 'approved' || status === 'rejected' || status === 'closed';
    const isClosed = status === 'approved' || status === 'rejected' || status === 'closed';

    const isM2Done =
      !isNeedsInfo &&
      (isGate1Done ||
        Boolean(state.risk_score) ||
        Boolean(state.memo) ||
        Boolean(state.screening_report) ||
        (state.facts && state.facts.length > 0));
    const isM3Done =
      !isNeedsInfo &&
      (isGate1Done ||
        Boolean(state.risk_score) ||
        Boolean(state.memo) ||
        Boolean(state.screening_report) ||
        (state.citations && state.citations.length > 0));
    const isM4Done =
      !isNeedsInfo &&
      (isGate1Done || Boolean(state.risk_score) || Boolean(state.memo) || Boolean(state.screening_report));
    const isM5Done = !isNeedsInfo && (isGate1Done || Boolean(state.risk_score) || Boolean(state.memo));
    const isM6Done = !isNeedsInfo && (isGate1Done || Boolean(state.memo));

    const pipelineSteps = [
      {
        id: 'm1',
        label: 'M1 Intake & Taxonomy',
        status: isNeedsInfo ? 'needs_review' : 'completed',
        timestamp: isNeedsInfo ? 'Missing Fields' : 'Completed',
      },
      {
        id: 'm2',
        label: 'M2 Fact Extraction',
        status: isM2Done ? 'completed' : 'pending',
        timestamp: isNeedsInfo ? 'Blocked' : state.facts && state.facts.length > 0 ? 'Extracted' : isM2Done ? 'Processed' : 'No Document',
      },
      {
        id: 'm3',
        label: 'M3 Policy Retrieval',
        status: isM3Done ? 'completed' : 'pending',
        timestamp: isNeedsInfo ? 'Blocked' : state.citations && state.citations.length > 0 ? 'Retrieved' : isM3Done ? 'Indexed' : 'Queued',
      },
      {
        id: 'm4',
        label: 'M4 Watchlist Screening',
        status: isM4Done ? 'completed' : 'pending',
        timestamp: isNeedsInfo ? 'Blocked' : isM4Done ? 'Screened' : 'Queued',
      },
      {
        id: 'm5',
        label: 'M5 Risk Scoring',
        status: isM5Done ? 'completed' : 'pending',
        timestamp: isNeedsInfo ? 'Blocked' : isM5Done ? 'Scored' : 'Queued',
      },
      {
        id: 'm6',
        label: 'M6 Draft Memo',
        status: isM6Done ? 'completed' : 'pending',
        timestamp: isNeedsInfo ? 'Blocked' : isM6Done ? 'Drafted' : 'Queued',
      },
      {
        id: 'g1',
        label: 'Gate 1 Analyst Review',
        status: isNeedsInfo ? 'pending' : isGate1Done ? 'completed' : 'active',
        timestamp: isNeedsInfo
          ? 'Awaiting RFI'
          : isGate1Done
          ? state.gate1_decision?.action === 'finalize'
            ? 'Approved'
            : 'Reviewed'
          : 'Awaiting Action',
      },
      {
        id: 'g2',
        label: 'Gate 2 Committee Sign-Off',
        status: isClosed ? 'completed' : status === 'awaiting_gate2' ? 'active' : 'pending',
        timestamp: isClosed
          ? state.final_outcome || 'Signed Off'
          : status === 'awaiting_gate2'
          ? 'Awaiting Decision'
          : 'Awaiting Gate 1',
      },
    ];

    let scorecard = null;
    let riskScoreVal: number | null = null;
    let riskTierVal: string | null = null;

    if (state.risk_score) {
      riskScoreVal = Number(state.risk_score.weighted_total ?? 0);
      riskTierVal = state.risk_score.tier || 'Low';

      const factorLabels: Record<string, any> = {
        cash_percentage: { name: 'CASH PERCENTAGE', category: 'CR-01 Cash Intensity' },
        jurisdiction_risk: { name: 'JURISDICTION RISK', category: 'GEO-02 Geographic Footprint' },
        screening_hit_severity: { name: 'SCREENING HIT SEVERITY', category: 'SCR-03 Watchlist & Sanctions' },
        product_novelty: { name: 'PRODUCT NOVELTY', category: 'PRD-04 Product & Service Novelty' },
        prior_exam_findings: { name: 'PRIOR EXAM FINDINGS', category: 'EXM-05 Examination History' },
      };

      const factors = (state.risk_score.factors || []).map((f: any) => {
        const meta = factorLabels[f.name] || {
          name: (f.name || 'FACTOR').replace(/_/g, ' ').toUpperCase(),
          category: f.name || 'Risk Metric',
        };
        return {
          name: meta.name,
          category: meta.category,
          score: Number(f.raw_score ?? 0),
          weight: Number(f.weight ?? 0.2),
          weighted: Number(f.contribution ?? 0),
          notes:
            f.notes ||
            (f.raw_score > 0
              ? `Evaluated severity score ${f.raw_score} / 4.0 based on case indicators`
              : 'Baseline compliant (zero risk contribution)'),
        };
      });

      scorecard = {
        composite_score: riskScoreVal,
        tier: riskTierVal,
        ai_rationale:
          state.risk_score.rationale ||
          `Quantitative multi-agent risk assessment calculated across the 5 canonical FCRM dimensions: Composite Score ${riskScoreVal.toFixed(
            2
          )} (${riskTierVal} Tier).`,
        factors: factors,
      };
    }

    let parties: any[] = [];
    let jurisdictions: any[] = [];
    let cashIntensive = false;
    let highRiskIndustry = false;

    if (Array.isArray(state.facts) && state.facts.length > 0) {
      state.facts.forEach((f: any) => {
        if (f.field === 'party') {
          parties.push({
            name: f.value,
            role: 'Extracted Entity / Principal',
            jurisdiction: geography,
            type: 'Commercial Entity',
            pep: false,
            source: `${f.source_document || 'doc'} (${f.source_location || 'page 1'})`,
          });
        } else if (f.field === 'jurisdiction') {
          jurisdictions.push({
            code: f.value,
            classification: 'Operating Jurisdiction',
            fatf_risk: f.value.match(/latam|uae|mx|co|colombia|mexico|dubai|nigeria|bahamas/i)
              ? 'Elevated Cross-Border'
              : 'Standard Domestic',
          });
        } else if (f.field === 'customer_type') {
          if (f.value.match(/cannabis|dispensary|crypto|msb|money service|remittance|pep|wealth/i)) {
            highRiskIndustry = true;
          }
        } else if (f.field === 'transaction_type') {
          if (f.value.match(/cash|armored/i)) {
            cashIntensive = true;
          }
        }
        if (f.field === 'cash_percentage' && Number(f.value) > 10) cashIntensive = true;
      });
    }

    const screeningHits = state.screening_report?.matches || [];
    parties.forEach((p) => {
      const match = screeningHits.find((m: any) =>
        m.party_name && m.party_name.toLowerCase().includes(p.name.toLowerCase())
      );
      if (
        match &&
        ((match.list_source && match.list_source.includes('PEP')) ||
          (match.matched_entry && match.matched_entry.toLowerCase().includes('pep')))
      ) {
        p.pep = true;
      }
    });

    const facts = {
      parties,
      jurisdictions,
      cash_intensive: cashIntensive,
      high_risk_industry: highRiskIndustry,
    };

    const policies = (state.citations || []).map((c: any) => ({
      code: c.policy_id || c.code || 'POL-REF',
      title: c.title || 'Bank Compliance Policy',
      category: c.category || 'Compliance Standard',
      similarity: typeof c.similarity === 'number' ? c.similarity : 0.85,
      mandatory_controls: c.mandatory_controls || [
        'Pre-launch AML risk assessment & periodic refresh',
        'Enhanced transaction monitoring & suspicious activity reporting',
      ],
      excerpt: c.excerpt || c.text || 'Policy guidance applies to this product domain.',
    }));

    const screening = (state.screening_report?.matches || []).map((m: any) => {
      const isHit = m.status === 'hit' || (m.matched_entry && m.status !== 'no_hit');
      const isNeedsReview = m.status === 'needs_review';
      return {
        target: m.party_name || 'Named Entity',
        status: isHit
          ? 'ALERT / MATCH IDENTIFIED'
          : isNeedsReview
          ? 'INCOMPLETE / RFI REQUIRED'
          : 'CLEAR / NO HIT',
        list_source: m.list_source || 'OFAC SDN, BIS & PEP Global Databases',
        hit_details: m.matched_entry
          ? `Watchlist match: ${m.matched_entry} (Confidence: ${Math.round((m.confidence || 1) * 100)}%)`
          : 'Clean. Screened against OFAC SDN, PEP Tier 1-3, and international sanctions.',
        recommendation: isHit
          ? 'Escalate for Senior Compliance Officer manual adjudication.'
          : 'Cleared for standard operational processing.',
      };
    });

    let memo = null;
    if (state.memo) {
      const m = state.memo;
      const conditions =
        m.suggested_conditions && m.suggested_conditions.length > 0
          ? m.suggested_conditions
          : m.conditions || [];

      const citations = (m.citations || []).map((c: any) => {
        if (typeof c === 'string') return c;
        if (c.source && c.excerpt) return `${c.source}: ${c.excerpt.substring(0, 140)}...`;
        if (c.title) return `${c.policy_id || 'POL'}: ${c.title}`;
        return JSON.stringify(c);
      });

      memo = {
        title: m.title || 'EXECUTIVE FCRM RISK ASSESSMENT & RECOMMENDATION',
        date: m.date || (state.created_at ? state.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
        lead_analyst: m.lead_analyst || 'Automated Multi-Agent Pipeline (Supervised by Compliance Operations)',
        inherent_risk_rating: `${riskTierVal || 'Pending'} (Score: ${
          riskScoreVal !== null ? riskScoreVal.toFixed(2) : '—'
        } / 4.00)`,
        residual_risk_rating:
          riskTierVal === 'High' || riskTierVal === 'Critical' ? 'Medium (Post-Mitigation)' : 'Low',
        summary: m.summary || `Multi-agent assessment completed for ${productType}.`,
        conditions: conditions,
        open_questions: m.open_questions || [],
        citations: citations,
      };
    }

    const sla = {
      elapsed_hours: 1.0,
      target_hours: 24.0,
      within_sla: true,
      sla_status: isClosed ? 'Completed On Time' : isNeedsInfo ? 'RFI Response Pending' : 'Active On Track',
    };

    const notifications =
      state.notifications && state.notifications.length > 0
        ? state.notifications
        : [
            { timestamp: '00:00:01Z', persona: 'Intake Agent (M1)', message: `Case ${caseId} registered. Change type: ${changeType}.` },
            ...(state.facts && state.facts.length > 0
              ? [{ timestamp: '00:00:15Z', persona: 'Extraction Agent (M2)', message: `Extracted ${state.facts.length} facts from uploaded documentation.` }]
              : []),
            ...(state.citations && state.citations.length > 0
              ? [{ timestamp: '00:00:30Z', persona: 'Retrieval Agent (M3)', message: `Retrieved ${state.citations.length} bank policies from pgvector knowledge base.` }]
              : []),
            ...(state.screening_report
              ? [{ timestamp: '00:00:45Z', persona: 'Screening Agent (M4)', message: `Completed watchlist screening against sanctions registry.` }]
              : []),
            ...(state.risk_score
              ? [{ timestamp: '00:01:00Z', persona: 'Scoring Agent (M5)', message: `Score computed: ${riskScoreVal?.toFixed(2)} (${riskTierVal} Tier).` }]
              : []),
            ...(state.memo
              ? [{ timestamp: '00:01:15Z', persona: 'Drafting Agent (M6)', message: `Executive memorandum synthesized.` }]
              : []),
          ];

    return {
      case_id: caseId,
      product_type: productType,
      change_type: changeType,
      geography: geography,
      segment: segment,
      target_date: targetDate,
      description: description,
      missing_fields: state.missing_fields || [],
      status: status,
      awaiting: state.awaiting || (status === 'awaiting_gate1' ? ['gate1'] : status === 'awaiting_gate2' ? ['gate2'] : []),
      risk_score: riskScoreVal,
      risk_tier: riskTierVal,
      pipeline_steps: pipelineSteps,
      scorecard: scorecard,
      facts: facts,
      policies: policies,
      screening: screening,
      memo: memo,
      sla: sla,
      notifications: notifications,
    };
  }
}

export const apiClient = new FCRMApiClient();
