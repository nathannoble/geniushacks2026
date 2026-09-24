/**
 * FCRM Workbench — Application Controller
 * Handles view switching, dashboard KPIs, intake wizard presets, dossier rendering, and gate modals.
 */

document.addEventListener('DOMContentLoaded', () => {
  window.fcrmApp = new FCRMApp();
});

class FCRMApp {
  constructor() {
    this.currentView = 'queue';
    this.currentCaseId = null;
    this.activeFilterStatus = 'all';
    this.activeFilterRisk = 'all';
    this.searchQuery = '';
    this.currentPersona = 'Compliance Analyst';
    this.uploadedFiles = [];

    this.initElements();
    this.initEventListeners();
    this.loadQueue();
    this.checkHealth();
  }

  initElements() {
    // Nav elements
    this.navQueue = document.getElementById('nav-queue');
    this.navNewCase = document.getElementById('nav-new-case');
    this.navDossier = document.getElementById('nav-dossier');
    this.personaSelect = document.getElementById('persona-select');

    // Views
    this.viewQueue = document.getElementById('view-queue');
    this.viewNewCase = document.getElementById('view-new-case');
    this.viewDossier = document.getElementById('view-dossier');

    // Search and Filters
    this.searchInput = document.getElementById('search-cases-input');
    this.filterChips = document.querySelectorAll('.filter-chip');

    // Form elements
    this.caseForm = document.getElementById('case-intake-form');
    this.dropzone = document.getElementById('file-dropzone');
    this.fileInput = document.getElementById('hidden-file-input');
    this.uploadedList = document.getElementById('uploaded-files-list');

    // Modals
    this.gate1Modal = document.getElementById('gate1-modal');
    this.gate2Modal = document.getElementById('gate2-modal');
    this.toastContainer = document.getElementById('toast-container');
  }

  initEventListeners() {
    // Navigation
    this.navQueue.addEventListener('click', (e) => { e.preventDefault(); this.switchView('queue'); });
    this.navNewCase.addEventListener('click', (e) => { e.preventDefault(); this.switchView('new-case'); });
    this.navDossier.addEventListener('click', (e) => { e.preventDefault(); this.switchView('dossier'); });

    // Persona switch
    this.personaSelect.addEventListener('change', (e) => {
      this.currentPersona = e.target.value;
      this.showToast(`Switched active persona to ${this.currentPersona}`);
      if (this.currentView === 'dossier' && this.currentCaseId) {
        this.renderDossierActions();
      }
    });

    // Search and Filter
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.loadQueue();
      });
    }

    this.filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        this.filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.activeFilterStatus = chip.getAttribute('data-status') || 'all';
        this.loadQueue();
      });
    });

    // Golden Case Presets
    document.querySelectorAll('.preset-card').forEach(card => {
      card.addEventListener('click', () => {
        const presetId = card.getAttribute('data-preset');
        this.loadPresetIntoForm(presetId);
      });
    });

    // File Dropzone
    if (this.dropzone && this.fileInput) {
      this.dropzone.addEventListener('click', () => this.fileInput.click());
      this.dropzone.addEventListener('dragover', (e) => { e.preventDefault(); this.dropzone.classList.add('dragover'); });
      this.dropzone.addEventListener('dragleave', () => this.dropzone.classList.remove('dragover'));
      this.dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        this.dropzone.classList.remove('dragover');
        if (e.dataTransfer.files) {
          this.handleFiles(e.dataTransfer.files);
        }
      });
      this.fileInput.addEventListener('change', (e) => {
        if (e.target.files) {
          this.handleFiles(e.target.files);
        }
      });
    }

    // Intake Form Submission
    if (this.caseForm) {
      this.caseForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
    }

    // Dossier Tab Switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const tabId = btn.getAttribute('data-tab');
        const content = document.getElementById(`tab-${tabId}`);
        if (content) content.classList.add('active');
      });
    });

    // Modal Close buttons
    document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.gate1Modal) this.gate1Modal.classList.remove('active');
        if (this.gate2Modal) this.gate2Modal.classList.remove('active');
      });
    });

    // Gate 1 Submit
    const btnSubmitGate1 = document.getElementById('btn-submit-gate1');
    if (btnSubmitGate1) {
      btnSubmitGate1.addEventListener('click', () => this.handleGate1Submit());
    }

    // Gate 2 Submit
    const btnSubmitGate2 = document.getElementById('btn-submit-gate2');
    if (btnSubmitGate2) {
      btnSubmitGate2.addEventListener('click', () => this.handleGate2Submit());
    }

    // Gate 2 Decision Buttons
    document.querySelectorAll('#gate2-decision-group .decision-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-value');
        this.selectGate2Outcome(val);
      });
    });

    // Gate 2 Condition adder
    const btnAddCondition = document.getElementById('btn-add-condition');
    if (btnAddCondition) {
      btnAddCondition.addEventListener('click', () => {
        const input = document.getElementById('new-condition-input');
        if (input && input.value.trim()) {
          this.addConditionTag(input.value.trim());
          input.value = '';
        }
      });
    }

    // Stepper Replay button
    const btnReplay = document.getElementById('btn-replay-stepper');
    if (btnReplay) {
      btnReplay.addEventListener('click', () => {
        if (this.currentCaseData) {
          this.renderStepper(this.currentCaseData.pipeline_steps || [], true);
        }
      });
    }

    // Reset Queue to presets button
    const btnReset = document.getElementById('btn-reset-cases');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (confirm("Reset case queue back to default demo cases? All local changes will be cleared.")) {
          window.fcrmApi.resetCases();
          this.loadQueue();
          this.showToast("Queue restored to default demo presets");
        }
      });
    }
  }

  async checkHealth() {
    const health = await window.fcrmApi.getHealth();
    const indicator = document.getElementById('health-indicator');
    if (indicator) {
      indicator.innerHTML = `<span class="pulse-dot"></span> System Live: LangGraph Orchestrator (${health.mode || 'Active'})`;
    }
  }

  switchView(viewName) {
    this.currentView = viewName;
    document.querySelectorAll('.page-view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(n => n.classList.remove('active'));

    if (viewName === 'queue') {
      this.viewQueue.classList.add('active');
      this.navQueue.classList.add('active');
      this.loadQueue();
    } else if (viewName === 'new-case') {
      this.viewNewCase.classList.add('active');
      this.navNewCase.classList.add('active');
    } else if (viewName === 'dossier') {
      this.viewDossier.classList.add('active');
      this.navDossier.classList.add('active');
      if (this.currentCaseId) {
        this.openDossier(this.currentCaseId);
      } else {
        window.fcrmApi.listCases().then(cases => {
          if (cases && cases.length > 0) {
            this.openDossier(cases[0].case_id);
          }
        });
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async loadQueue() {
    const cases = await window.fcrmApi.listCases();

    // Compute KPI metrics
    const totalCount = cases.length;
    const gate1Count = cases.filter(c => c.status === 'awaiting_gate1').length;
    const gate2Count = cases.filter(c => c.status === 'awaiting_gate2').length;
    const rfiCount = cases.filter(c => c.status === 'rfi').length;
    const closedCount = cases.filter(c => c.status === 'closed' || c.status === 'rejected').length;

    document.getElementById('kpi-total').textContent = totalCount;
    document.getElementById('kpi-gate1').textContent = gate1Count;
    document.getElementById('kpi-gate2').textContent = gate2Count;
    document.getElementById('kpi-rfi').textContent = rfiCount;
    document.getElementById('kpi-closed').textContent = closedCount;

    // Filter cases
    let filtered = cases;
    if (this.activeFilterStatus !== 'all') {
      if (this.activeFilterStatus === 'closed') {
        filtered = filtered.filter(c => c.status === 'closed' || c.status === 'rejected');
      } else {
        filtered = filtered.filter(c => c.status === this.activeFilterStatus);
      }
    }
    if (this.searchQuery) {
      filtered = filtered.filter(c => 
        c.case_id.toLowerCase().includes(this.searchQuery) ||
        (c.product_type && c.product_type.toLowerCase().includes(this.searchQuery)) ||
        (c.description && c.description.toLowerCase().includes(this.searchQuery))
      );
    }

    const tbody = document.getElementById('cases-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <div class="empty-state-icon">📋</div>
            <p>No risk change cases found matching current filters.</p>
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach(c => {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.addEventListener('click', () => {
        this.openDossier(c.case_id);
      });

      const riskClass = this.getRiskBadgeClass(c.risk_tier);
      const statusClass = this.getStatusBadgeClass(c.status);
      const statusLabel = this.formatStatus(c.status);

      tr.innerHTML = `
        <td class="case-id-cell">${c.case_id}</td>
        <td>
          <div class="product-cell">${c.product_type}</div>
          <div class="product-subtext">${c.change_type} • ${c.geography}</div>
        </td>
        <td><span class="badge ${riskClass}">${c.risk_tier || 'Medium'}</span></td>
        <td><span class="badge badge-status ${statusClass}">${statusLabel}</span></td>
        <td><span class="font-mono text-secondary">${c.scorecard?.composite_score ? c.scorecard.composite_score.toFixed(2) : (c.risk_score || '—')}</span></td>
        <td><span class="text-secondary text-xs">${c.sla?.sla_status || 'On Track'}</span></td>
        <td>
          <button class="btn-secondary" style="padding: 0.35rem 0.75rem; font-size: 0.75rem;" onclick="event.stopPropagation(); window.fcrmApp.openDossier('${c.case_id}')">
            Inspect Dossier →
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  async openDossier(caseId, animate = null) {
    this.currentCaseId = caseId;
    const caseData = await window.fcrmApi.getCase(caseId);
    if (!caseData) {
      this.showToast(`Error: Case ${caseId} could not be loaded`, 'error');
      return;
    }
    this.currentCaseData = caseData;

    // Switch view
    this.currentView = 'dossier';
    document.querySelectorAll('.page-view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(n => n.classList.remove('active'));
    this.viewDossier.classList.add('active');
    this.navDossier.classList.add('active');
    this.navDossier.style.display = 'inline-flex';

    // Header values
    document.getElementById('dossier-id').textContent = caseData.case_id;
    document.getElementById('dossier-product').textContent = caseData.product_type || "Commercial Initiative";
    
    // Risk & Status badges
    const riskBadge = document.getElementById('dossier-risk-badge');
    const scoreVal = (caseData.scorecard?.composite_score ?? caseData.risk_score);
    const scoreStr = (scoreVal !== undefined && scoreVal !== null && !isNaN(scoreVal)) ? Number(scoreVal).toFixed(2) : '—';
    const tierStr = caseData.risk_tier || caseData.scorecard?.tier || 'Medium';
    riskBadge.className = `badge ${this.getRiskBadgeClass(tierStr)}`;
    riskBadge.textContent = `${tierStr} Risk (${scoreStr})`;

    const statusBadge = document.getElementById('dossier-status-badge');
    statusBadge.className = `badge badge-status ${this.getStatusBadgeClass(caseData.status)}`;
    statusBadge.textContent = this.formatStatus(caseData.status);

    // SLA display
    document.getElementById('dossier-sla-text').textContent = 
      caseData.sla ? `Elapsed: ${caseData.sla.elapsed_hours}h / SLA Target: ${caseData.sla.target_hours}h` : 'Within Standard SLA';

    // Render Gate Action Buttons
    this.renderDossierActions(caseData);

    // Check if Gate 1 is completed or case has advanced past Gate 1
    const g1 = (caseData.pipeline_steps || []).find(s => s.id === 'g1');
    const isGate1Completed = (g1 && g1.status === 'completed') || 
                             caseData.status === 'awaiting_gate2' || 
                             caseData.status === 'approved' || 
                             caseData.status === 'rejected' ||
                             caseData.status === 'closed';

    const isNeedsInfo = caseData.status === 'needs_more_information';
    const shouldAnimate = (animate === false || isNeedsInfo) ? false : (animate === true ? true : !isGate1Completed);

    // Render Stepper (no loading aesthetics if Gate 1 is already completed or if case needs info)
    this.renderStepper(caseData.pipeline_steps || [], shouldAnimate);

    // Render 6 Tabs
    this.renderMemoTab(caseData.memo);
    this.renderScorecardTab(caseData.scorecard);
    this.renderFactsTab(caseData.facts);
    this.renderPoliciesTab(caseData.policies);
    this.renderScreeningTab(caseData.screening);
    this.renderAuditTab(caseData.notifications, caseData.sla);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  renderDossierActions(caseData = null) {
    if (!caseData && this.currentCaseId) {
      window.fcrmApi.getCase(this.currentCaseId).then(c => this.renderDossierActions(c));
      return;
    }
    const container = document.getElementById('dossier-action-buttons');
    if (!container || !caseData) return;
    container.innerHTML = '';

    const backBtn = document.createElement('button');
    backBtn.className = 'btn-secondary';
    backBtn.innerHTML = '← Cases Queue';
    backBtn.onclick = () => this.switchView('queue');
    container.appendChild(backBtn);

    // Context-sensitive actions based on status & persona
    const status = (caseData.status || '').toLowerCase();
    const isAwaitingGate1 = status === 'awaiting_gate1' || 
                            status === 'validated' || 
                            (caseData.awaiting && caseData.awaiting.includes('gate1'));

    const isAwaitingGate2 = status === 'awaiting_gate2' || 
                            (caseData.awaiting && caseData.awaiting.includes('gate2'));

    const isRfi = status === 'rfi' || status === 'needs_more_information';

    if (isAwaitingGate1) {
      const g1Btn = document.createElement('button');
      g1Btn.className = 'btn-primary';
      g1Btn.innerHTML = '⚖️ Review Gate 1 (Analyst)';
      g1Btn.onclick = () => this.openGate1Modal(caseData);
      container.appendChild(g1Btn);
    } else if (isAwaitingGate2) {
      const g2Btn = document.createElement('button');
      g2Btn.className = 'btn-emerald';
      g2Btn.innerHTML = '🏛️ Decide Gate 2 (Committee)';
      g2Btn.onclick = () => this.openGate2Modal(caseData);
      container.appendChild(g2Btn);
    }

    if (isRfi) {
      const rfiBtn = document.createElement('button');
      rfiBtn.className = 'btn-secondary';
      rfiBtn.style.borderColor = 'var(--accent-rose)';
      rfiBtn.innerHTML = '📝 Submit RFI Info (PO)';
      rfiBtn.onclick = async () => {
        rfiBtn.disabled = true;
        rfiBtn.innerHTML = '⚡ Submitting Clarifications...';
        if (caseData.status === 'needs_more_information') {
          this.showToast("Product Owner: Providing missing Target Go-Live Date (2026-11-15) to resolve Intake RFI...");
          const res = await window.fcrmApi.resubmitCase(caseData.case_id, {
            target_date: "2026-11-15"
          });
          if (res.success) {
            this.showToast(`Case ${caseData.case_id} re-entered pipeline & validated!`);
            this.openDossier(caseData.case_id, true);
          } else {
            this.showToast("Resubmission failed: " + (res.error || ""), "error");
            rfiBtn.disabled = false;
            rfiBtn.innerHTML = '📝 Submit RFI Info (PO)';
          }
        } else {
          this.showToast("Product Owner: RFI update submitted. Resubmitting case for validation...");
          await window.fcrmApi.resolveGate1(caseData.case_id, 'finalize', 'Product Owner provided clarified licensing certificates.', 'Product Owner');
          this.openDossier(caseData.case_id, false);
        }
      };
      container.appendChild(rfiBtn);

      // If viewing as Compliance Analyst, allow reviewing Gate 1 directly
      if (!isAwaitingGate1) {
        const g1Btn = document.createElement('button');
        g1Btn.className = 'btn-primary';
        g1Btn.innerHTML = '⚖️ Review Gate 1 (Analyst)';
        g1Btn.onclick = () => this.openGate1Modal(caseData);
        container.appendChild(g1Btn);
      }
    }
  }

  renderStepper(steps, animate = false) {
    const container = document.getElementById('stepper-steps-wrapper');
    const progressBar = document.getElementById('stepper-progress-bar');
    if (!container) return;

    if (this.stepperTimeouts) {
      this.stepperTimeouts.forEach(t => clearTimeout(t));
    }
    this.stepperTimeouts = [];

    container.innerHTML = '';

    const spinnerSvg = `
      <svg class="stepper-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6">
        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.2"/>
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor"/>
      </svg>
    `;

    const defaultSteps = [
      { id: "m1", label: "M1 Intake & Taxonomy", status: "completed", timestamp: "Just now" },
      { id: "m2", label: "M2 Fact Extraction", status: "completed", timestamp: "Just now" },
      { id: "m3", label: "M3 Policy Retrieval", status: "completed", timestamp: "Just now" },
      { id: "m4", label: "M4 Watchlist Screening", status: "completed", timestamp: "Just now" },
      { id: "m5", label: "M5 Risk Scoring", status: "completed", timestamp: "Just now" },
      { id: "m6", label: "M6 Draft Memo", status: "completed", timestamp: "Just now" },
      { id: "g1", label: "Gate 1 Analyst Review", status: "active", timestamp: "Awaiting Action" },
      { id: "g2", label: "Gate 2 Committee Sign-Off", status: "pending", timestamp: "Awaiting Gate 1" }
    ];

    const actualSteps = (steps && steps.length >= 8) ? steps : defaultSteps;

    // If Gate 1 is already completed, do NOT replay loading aesthetics
    const isGate1Completed = (actualSteps[6] && actualSteps[6].status === 'completed') ||
                             (actualSteps[7] && actualSteps[7].status === 'active') ||
                             (actualSteps[7] && actualSteps[7].status === 'completed');

    if (isGate1Completed || actualSteps[0].status === 'needs_review') {
      animate = false;
    }

    const btnReplay = document.getElementById('btn-replay-stepper');
    if (btnReplay) {
      btnReplay.style.display = isGate1Completed ? 'none' : 'inline-flex';
    }

    // Create the 8 nodes in the DOM
    const stepElements = actualSteps.map((step, index) => {
      const stepEl = document.createElement('div');
      stepEl.className = `stepper-step ${animate ? 'pending' : step.status}`;

      let icon = index + 1;
      if (!animate) {
        if (step.status === 'completed') icon = '✓';
        else if (step.status === 'needs_review' || step.status === 'error') icon = '!';
      }
      const subtext = animate ? 'Queued' : (step.timestamp || '');

      stepEl.innerHTML = `
        <div class="stepper-step-circle">${icon}</div>
        <div class="stepper-step-label">${step.label}</div>
        <div class="stepper-step-subtext" style="font-size: 0.65rem; color: var(--text-dim); margin-top: -2px;">${subtext}</div>
      `;
      container.appendChild(stepEl);
      return stepEl;
    });

    const updateStep = (index, status, iconContent, subtext = '', justCompleted = false) => {
      const el = stepElements[index];
      if (!el) return;
      el.className = `stepper-step ${status} ${justCompleted ? 'just-completed' : ''}`;
      const circle = el.querySelector('.stepper-step-circle');
      const sub = el.querySelector('.stepper-step-subtext');
      if (circle) circle.innerHTML = iconContent;
      if (sub && subtext) sub.textContent = subtext;
    };

    if (!animate) {
      actualSteps.forEach((step, index) => {
        let icon = index + 1;
        if (step.status === 'completed') icon = '✓';
        else if (step.status === 'needs_review' || step.status === 'error') icon = '!';
        updateStep(index, step.status, icon, step.timestamp || '');
      });
      if (progressBar) {
        if (isGate1Completed) {
          progressBar.style.width = '100%';
        } else if (actualSteps[0].status === 'needs_review') {
          progressBar.style.width = '12%';
        } else {
          progressBar.style.width = '86%';
        }
      }
      return;
    }

    if (progressBar) progressBar.style.width = '0%';

    // If step 0 has needs_review, do not animate subsequent steps
    if (actualSteps[0].status === 'needs_review') {
      updateStep(0, 'needs_review', '!', actualSteps[0].timestamp || 'Needs Info', true);
      if (progressBar) progressBar.style.width = '12%';
      return;
    }

    // Step 0 (M1) starts loading immediately
    updateStep(0, 'loading', spinnerSvg, 'Classifying...');

    // Step 0 finishes -> Step 1 (M2) starts
    this.stepperTimeouts.push(setTimeout(() => {
      updateStep(0, 'completed', '✓', 'Just now', true);
      if (progressBar) progressBar.style.width = '14%';
      if (actualSteps[1].status !== 'completed' && actualSteps[1].status !== 'active') {
        updateStep(1, actualSteps[1].status, actualSteps[1].status === 'needs_review' ? '!' : '2', actualSteps[1].timestamp || '');
        return;
      }
      updateStep(1, 'loading', spinnerSvg, 'Extracting...');
    }, 200));

    // Step 1 finishes -> Step 2 (M3) & Step 3 (M4) BOTH start running concurrently!
    this.stepperTimeouts.push(setTimeout(() => {
      updateStep(1, 'completed', '✓', 'Just now', true);
      if (progressBar) progressBar.style.width = '28%';
      updateStep(2, 'loading', spinnerSvg, 'Searching...');
      updateStep(3, 'loading', spinnerSvg, 'Screening...');
    }, 420));

    // Steps 2 & 3 finish concurrently -> Step 4 (M5) starts
    this.stepperTimeouts.push(setTimeout(() => {
      updateStep(2, 'completed', '✓', 'Just now', true);
      updateStep(3, 'completed', '✓', 'Just now', true);
      if (progressBar) progressBar.style.width = '56%';
      updateStep(4, 'loading', spinnerSvg, 'Scoring...');
    }, 720));

    // Step 4 finishes -> Step 5 (M6) starts
    this.stepperTimeouts.push(setTimeout(() => {
      updateStep(4, 'completed', '✓', 'Just now', true);
      if (progressBar) progressBar.style.width = '70%';
      updateStep(5, 'loading', spinnerSvg, 'Drafting memo...');
    }, 940));

    // Step 5 finishes -> Gate 1 lands on active state
    this.stepperTimeouts.push(setTimeout(() => {
      updateStep(5, 'completed', '✓', 'Just now', true);
      if (progressBar) progressBar.style.width = '86%';

      // Gate 1 (step index 6)
      const g1 = actualSteps[6] || { status: 'active', timestamp: 'Awaiting Action' };
      updateStep(6, g1.status, g1.status === 'completed' ? '✓' : '7', g1.timestamp || 'Awaiting Action');

      // Gate 2 (step index 7)
      const g2 = actualSteps[7] || { status: 'pending', timestamp: 'Awaiting Gate 1' };
      updateStep(7, g2.status, g2.status === 'completed' ? '✓' : '8', g2.timestamp || 'Awaiting Gate 1');
    }, 1160));
  }

  renderMemoTab(memo) {
    const container = document.getElementById('tab-memo-content');
    if (!container) return;
    if (!memo) {
      const isNeedsInfo = (this.currentCaseData?.status === 'needs_more_information');
      container.innerHTML = `
        <div class="empty-state" style="padding: 3rem 1.5rem; text-align: center;">
          <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">📝</div>
          <h3 style="font-size: 1.1rem; color: var(--text-primary); margin-bottom: 0.5rem;">
            ${isNeedsInfo ? 'Executive Memo Blocked by Intake RFI' : 'Executive Memo Pending Generation'}
          </h3>
          <p style="color: var(--text-secondary); max-width: 500px; margin: 0 auto; font-size: 0.88rem; line-height: 1.6;">
            ${isNeedsInfo ? 'Claude Sonnet memo drafting executes automatically after mandatory intake parameters are completed and multi-factor scores are finalized.' : 'Executive risk recommendation memo will appear here once drafted by Claude Sonnet.'}
          </p>
        </div>
      `;
      return;
    }

    const conditions = (memo.conditions && memo.conditions.length > 0)
      ? memo.conditions
      : (memo.suggested_conditions || []);

    let conditionsHtml = '';
    if (conditions.length > 0) {
      conditionsHtml = `
        <h3 style="margin-top: 1.5rem;">Mandatory Approval Conditions</h3>
        ${conditions.map(c => `<div class="condition-box"><strong>Condition:</strong> ${c}</div>`).join('')}
      `;
    }

    let questionsHtml = '';
    if (memo.open_questions && memo.open_questions.length > 0) {
      questionsHtml = `
        <h3 style="margin-top: 1.5rem;">Open Items & Analyst Inquiries</h3>
        ${memo.open_questions.map(q => `<div class="open-question-box"><strong>Question:</strong> ${q}</div>`).join('')}
      `;
    }

    let citationsHtml = '';
    if (memo.citations && memo.citations.length > 0) {
      citationsHtml = `
        <h3 style="margin-top: 1.5rem;">Legal & Policy Citations</h3>
        <ul>${memo.citations.map(c => {
          const text = typeof c === 'string' ? c : (c.source ? `${c.source}${c.excerpt ? ': ' + c.excerpt.substring(0, 140) + '...' : ''}` : (c.title || JSON.stringify(c)));
          return `<li><span class="font-mono text-cyan">${text}</span></li>`;
        }).join('')}</ul>
      `;
    }

    container.innerHTML = `
      <div class="memo-container">
        <h2>${memo.title || 'EXECUTIVE FCRM RISK ASSESSMENT & RECOMMENDATION'}</h2>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1.5rem; display: flex; gap: 2rem;">
          <span><strong>Date:</strong> ${memo.date || '2026-09-24'}</span>
          <span><strong>Author:</strong> ${memo.lead_analyst || 'Compliance Operations'}</span>
          <span><strong>Inherent Risk:</strong> <span class="text-crimson">${memo.inherent_risk_rating || 'Medium'}</span></span>
          <span><strong>Residual Risk:</strong> <span class="text-emerald">${memo.residual_risk_rating || 'Low'}</span></span>
        </div>

        <h3>Executive Summary</h3>
        <p>${memo.summary || 'Summary not provided.'}</p>

        ${conditionsHtml}
        ${questionsHtml}
        ${citationsHtml}
      </div>
    `;
  }

  renderScorecardTab(scorecard) {
    const container = document.getElementById('tab-scorecard-content');
    if (!container) return;
    if (!scorecard || !scorecard.factors || scorecard.factors.length === 0) {
      const isNeedsInfo = (this.currentCaseData?.status === 'needs_more_information');
      const missingFields = (this.currentCaseData?.missing_fields && this.currentCaseData.missing_fields.length > 0)
        ? this.currentCaseData.missing_fields.join(', ')
        : 'Target Go-Live Date (target_date)';
      if (isNeedsInfo) {
        container.innerHTML = `
          <div class="empty-state" style="padding: 3rem 1.5rem; text-align: center;">
            <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">⚠️</div>
            <h3 style="font-size: 1.15rem; color: var(--accent-rose); font-weight: 700; margin-bottom: 0.5rem;">Intake Request for Information (RFI) Required</h3>
            <p style="color: var(--text-secondary); max-width: 540px; margin: 0 auto 1.5rem; font-size: 0.9rem; line-height: 1.6;">
              This change request is missing mandatory compliance parameter(s): <strong style="color: var(--text-primary);">${missingFields}</strong>.<br>
              Bank FCRM procedure M1 pauses quantitative scoring and extraction until all required parameters are supplied.
            </p>
            <button class="btn-primary" onclick="document.querySelector('#dossier-action-buttons button.btn-secondary')?.click()">
              📝 Provide Missing Info as Product Owner →
            </button>
          </div>
        `;
        return;
      }
      container.innerHTML = '<div class="empty-state"><p>Risk scorecard calculation in progress.</p></div>';
      return;
    }

    const rows = scorecard.factors.map(f => {
      const score = Number(f.score ?? 0);
      const weight = Number(f.weight ?? 0.2);
      const weighted = Number(f.weighted ?? 0);
      const pct = Math.min(100, Math.max(0, (score / 4.0) * 100));
      return `
        <tr>
          <td>
            <strong>${f.name}</strong>
            <div style="font-size: 0.7rem; color: var(--text-muted);">${f.category || 'Risk Dimension'}</div>
          </td>
          <td><span class="font-mono font-bold">${score.toFixed(1)}</span> <span class="text-dim text-xs">/ 4.0</span></td>
          <td><span class="font-mono text-secondary">${(weight * 100).toFixed(0)}%</span></td>
          <td>
            <span class="font-mono text-cyan font-bold">${weighted.toFixed(2)}</span>
            <div class="score-bar-track">
              <div class="score-bar-fill" style="width: ${pct}%;"></div>
            </div>
          </td>
          <td style="font-size: 0.8rem; color: var(--text-secondary); max-width: 320px;">${f.notes || ''}</td>
        </tr>
      `;
    }).join('');

    const composite = Number(scorecard.composite_score ?? 2.5);
    const tier = scorecard.tier || 'Medium';
    const rationale = scorecard.ai_rationale || scorecard.rationale || 'Quantitative assessment calculated across canonical FCRM risk dimensions.';

    container.innerHTML = `
      <div class="score-overview">
        <div class="score-gauge-card">
          <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700; margin-bottom: 0.5rem;">
            Composite Inherent Risk
          </div>
          <div class="score-gauge-number text-cyan">
            ${composite.toFixed(2)}
            <span class="score-gauge-max">/ 4.00</span>
          </div>
          <span class="badge ${this.getRiskBadgeClass(tier)}">${tier} Tier</span>
        </div>

        <div>
          <h3 style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;">
            Claude Haiku Risk Rationale Synthesis
          </h3>
          <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.6; background: rgba(0,0,0,0.25); padding: 1rem; border-radius: var(--radius-md); border-left: 3px solid var(--accent-cyan);">
            ${rationale}
          </p>
        </div>
      </div>

      <h3 style="font-size: 0.9rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 0.75rem;">
        Multi-Factor Scoring Matrix (Deterministic Math Engine)
      </h3>
      <table class="factors-table">
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
          ${rows}
        </tbody>
      </table>
    `;
  }

  renderFactsTab(facts) {
    const container = document.getElementById('tab-facts-content');
    if (!container) return;
    if (!facts || (Array.isArray(facts) && facts.length === 0) || (!Array.isArray(facts) && (!facts.parties || facts.parties.length === 0))) {
      const isNeedsInfo = (this.currentCaseData?.status === 'needs_more_information');
      container.innerHTML = `
        <div class="empty-state" style="padding: 3rem 1.5rem; text-align: center;">
          <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">📄</div>
          <h3 style="font-size: 1.1rem; color: var(--text-primary); margin-bottom: 0.5rem;">
            ${isNeedsInfo ? 'Document Fact Extraction Held at Intake' : 'Fact Extraction Pending'}
          </h3>
          <p style="color: var(--text-secondary); max-width: 500px; margin: 0 auto; font-size: 0.88rem; line-height: 1.6;">
            ${isNeedsInfo ? 'Claude Sonnet document extraction will run automatically once the intake RFI requirements are fulfilled.' : 'Extracted named entities, ownership hierarchies, and operational scope will appear here.'}
          </p>
        </div>
      `;
      return;
    }

    let parties = [];
    let jurisdictions = [];
    let cashIntensive = false;
    let highRiskIndustry = false;

    if (Array.isArray(facts)) {
      facts.forEach(f => {
        if (f.field === 'party') {
          parties.push({ name: f.value, role: 'Extracted Entity', jurisdiction: 'Operational', type: 'Commercial Entity', pep: false });
        } else if (f.field === 'jurisdiction') {
          jurisdictions.push({ code: f.value, classification: 'Operating Territory', fatf_risk: f.value.match(/latam|uae|mx|co|colombia|mexico|dubai/i) ? 'Elevated Cross-Border' : 'Standard Domestic' });
        }
        if (f.field === 'cash_percentage' && Number(f.value) > 10) cashIntensive = true;
      });
    } else {
      parties = facts.parties || [];
      jurisdictions = facts.jurisdictions || [];
      cashIntensive = !!facts.cash_intensive;
      highRiskIndustry = !!facts.high_risk_industry;
    }

    const partiesRows = parties.map(p => `
      <tr>
        <td class="font-bold text-primary">${p.name || 'Unnamed Party'}</td>
        <td>${p.role || 'Principal'}</td>
        <td><span class="font-mono">${p.jurisdiction || 'Domestic'}</span></td>
        <td>${p.type || 'Commercial Entity'}</td>
        <td>
          ${p.pep 
            ? '<span class="badge badge-risk-critical">PEP Tier-2</span>' 
            : '<span class="badge badge-risk-low">Non-PEP</span>'}
        </td>
      </tr>
    `).join('');

    const jurisdictionsRows = jurisdictions.map(j => `
      <tr>
        <td class="font-mono font-bold text-cyan">${j.code || 'DOM'}</td>
        <td>${j.classification || 'Operational Scope'}</td>
        <td>${j.fatf_risk || 'Standard'}</td>
      </tr>
    `).join('');

    container.innerHTML = `
      <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
        <div style="background: var(--bg-secondary); padding: 0.75rem 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
          <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Cash Intensive Industry:</span>
          <span class="badge ${cashIntensive ? 'badge-risk-critical' : 'badge-risk-low'}" style="margin-left: 0.5rem;">
            ${cashIntensive ? 'YES (High Inherent Risk)' : 'NO'}
          </span>
        </div>
        <div style="background: var(--bg-secondary); padding: 0.75rem 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
          <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">High-Risk Industry Classification:</span>
          <span class="badge ${highRiskIndustry ? 'badge-risk-critical' : 'badge-risk-low'}" style="margin-left: 0.5rem;">
            ${highRiskIndustry ? 'YES (Enhanced Controls Required)' : 'NO'}
          </span>
        </div>
      </div>

      <h3 style="font-size: 0.9rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 0.75rem;">
        Extracted Named Entities & Beneficial Ownership (Claude Sonnet Extraction Agent)
      </h3>
      <table class="factors-table" style="margin-bottom: 2rem;">
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
          ${partiesRows || '<tr><td colspan="5">No parties extracted.</td></tr>'}
        </tbody>
      </table>

      <h3 style="font-size: 0.9rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 0.75rem;">
        Identified Operational Jurisdictions & FATF Classifications
      </h3>
      <table class="factors-table">
        <thead>
          <tr>
            <th>Jurisdiction Code</th>
            <th>Operational Scope</th>
            <th>FATF Classification & Risk Profile</th>
          </tr>
        </thead>
        <tbody>
          ${jurisdictionsRows || '<tr><td colspan="3">No jurisdictions extracted.</td></tr>'}
        </tbody>
      </table>
    `;
  }

  renderPoliciesTab(policies) {
    const container = document.getElementById('tab-policies-content');
    if (!container) return;
    if (!policies || policies.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No bank policy matches retrieved.</p></div>';
      return;
    }

    container.innerHTML = policies.map(p => {
      const code = p.code || p.policy_id || 'POL-REF';
      const title = p.title || 'Bank Compliance Policy';
      const category = p.category || 'Compliance Standard';
      const simVal = typeof p.similarity === 'number'
        ? (p.similarity > 1 ? Math.round(p.similarity) : Math.round(Math.abs(p.similarity) * 100))
        : 92;
      const excerpt = p.excerpt || p.text || 'Policy guidance applies to this product domain.';
      const controls = p.mandatory_controls || [
        'Pre-launch AML risk assessment & periodic refresh',
        'Enhanced transaction monitoring & suspicious activity reporting'
      ];

      return `
        <div class="policy-card">
          <div class="policy-header">
            <div>
              <span class="policy-code">${code}</span> • <strong style="color: var(--text-primary);">${title}</strong>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${category}</div>
            </div>
            <div style="text-align: right;">
              <span class="badge badge-risk-low">${simVal}% Semantic Match</span>
            </div>
          </div>

          <div style="margin-top: 0.75rem;">
            <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700; margin-bottom: 0.25rem;">
              Mandatory Controls & Conditions:
            </div>
            <ul style="margin-left: 1.25rem; font-size: 0.85rem; color: var(--text-secondary);">
              ${controls.map(c => `<li>${c}</li>`).join('')}
            </ul>
          </div>

          <div class="policy-excerpt">
            ${excerpt}
          </div>
        </div>
      `;
    }).join('');
  }

  renderScreeningTab(screening) {
    const container = document.getElementById('tab-screening-content');
    if (!container) return;
    if (!screening || screening.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Screening results unavailable.</p></div>';
      return;
    }

    container.innerHTML = screening.map(s => {
      const target = s.target || s.party_name || 'Named Entity';
      const listSource = s.list_source || 'OFAC SDN, BIS & PEP Global Databases';
      const rawStatus = String(s.status || s.screening_status || 'CLEAR').toUpperCase();
      const isAlert = rawStatus.includes('ALERT') || rawStatus.includes('HIT') || rawStatus.includes('INCOMPLETE') || rawStatus.includes('REVIEW') || rawStatus.includes('FLAGGED');
      const badgeClass = isAlert ? (rawStatus.includes('ALERT') || rawStatus.includes('HIT') ? 'badge-risk-critical' : 'badge-risk-medium') : 'badge-risk-low';
      const hitDetails = s.hit_details || s.list_match || 'Clean. No adverse matches found.';
      const rec = s.recommendation || s.disposition_notes || 'Cleared for standard processing.';

      return `
        <div class="screening-card">
          <div class="screening-header">
            <div>
              <strong style="color: var(--text-primary); font-size: 1rem;">${target}</strong>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Database: ${listSource}</div>
            </div>
            <div>
              <span class="badge ${badgeClass}">${rawStatus}</span>
            </div>
          </div>
          <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
            <strong>Hit Analysis:</strong> ${hitDetails}
          </div>
          <div style="font-size: 0.8rem; background: rgba(0,0,0,0.2); padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); border-left: 3px solid ${isAlert ? 'var(--accent-crimson)' : 'var(--accent-emerald)'};">
            <strong>Analyst Triage Guidance:</strong> ${rec}
          </div>
        </div>
      `;
    }).join('');
  }

  renderAuditTab(notifications, sla) {
    const container = document.getElementById('tab-audit-content');
    if (!container) return;

    let slaHtml = '';
    if (sla) {
      slaHtml = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
          <div style="background: var(--bg-secondary); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Elapsed Turnaround</div>
            <div style="font-size: 1.5rem; font-weight: 700; font-family: var(--font-mono); color: var(--text-primary);">${sla.elapsed_hours} hrs</div>
          </div>
          <div style="background: var(--bg-secondary); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">SLA Target Ceiling</div>
            <div style="font-size: 1.5rem; font-weight: 700; font-family: var(--font-mono); color: var(--accent-cyan);">${sla.target_hours} hrs</div>
          </div>
          <div style="background: var(--bg-secondary); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">SLA Status</div>
            <div style="font-size: 1.15rem; font-weight: 700; color: var(--accent-emerald); margin-top: 0.35rem;">${sla.sla_status}</div>
          </div>
        </div>
      `;
    }

    const notifs = (notifications || []).map(n => `
      <div style="display: flex; gap: 1.5rem; padding: 0.85rem 0; border-bottom: 1px solid var(--border-subtle); font-size: 0.85rem;">
        <span class="font-mono text-cyan" style="min-width: 90px;">${n.timestamp}</span>
        <span style="min-width: 140px; font-weight: 600; color: var(--text-primary);">${n.persona}</span>
        <span style="color: var(--text-secondary);">${n.message}</span>
      </div>
    `).join('');

    container.innerHTML = `
      ${slaHtml}
      <h3 style="font-size: 0.9rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 0.75rem;">
        Immutable Audit & Notification Log (M9 Service)
      </h3>
      <div style="background: var(--bg-secondary); border-radius: var(--radius-md); border: 1px solid var(--border-subtle); padding: 1rem 1.5rem;">
        ${notifs || '<p class="text-muted">No audit notifications recorded.</p>'}
      </div>
    `;
  }

  // Preset loader
  async loadPresetIntoForm(presetId) {
    let filename = "";
    let toastName = "";

    if (presetId === 'cannabis') {
      document.getElementById('input-product-type').value = "Commercial High-Yield Cannabis Dispensary Account";
      document.getElementById('select-change-type').value = "New Product Launch";
      document.getElementById('input-geography').value = "US-CO, US-MI";
      document.getElementById('input-segment').value = "Commercial Banking / Cash Intensive";
      document.getElementById('input-target-date').value = "2026-10-15";
      document.getElementById('textarea-description').value = "Open accounts for licensed cannabis dispensaries in Colorado and Michigan with 80% armored car cash deposits.";
      filename = "sample_change_request.pdf";
      toastName = "Cannabis Dispensary Banking (Critical Risk)";
    } else if (presetId === 'remittance') {
      document.getElementById('input-product-type').value = "Cross-Border Commercial Remittance Corridor";
      document.getElementById('select-change-type').value = "Geographic Expansion";
      document.getElementById('input-geography').value = "United States, Mexico, Colombia, UAE";
      document.getElementById('input-segment').value = "Money Services Business / Cross-Border Remittance";
      document.getElementById('input-target-date').value = "2026-11-15";
      document.getElementById('textarea-description').value = "Open multi-currency clearing accounts for cross-border MSBs supporting high-velocity wire remittances across the US, Mexico, Colombia, and UAE free zones.";
      filename = "003_cross_border_remittance_high_risk.pdf";
      toastName = "Cross-Border MSB (Sanctions Hit - Critical Risk)";
    } else if (presetId === 'crypto') {
      document.getElementById('input-product-type').value = "Institutional Digital Asset Custody & Staking";
      document.getElementById('select-change-type').value = "New Product Launch";
      document.getElementById('input-geography').value = "New York, Delaware, California";
      document.getElementById('input-segment').value = "Institutional Wealth & Registered Investment Funds";
      document.getElementById('input-target-date').value = "2026-10-30";
      document.getElementById('textarea-description').value = "Segregated digital asset custodial service with validator staking yield for institutional funds and RIAs in NY and DE.";
      filename = "004_crypto_asset_custody_medium_risk.pdf";
      toastName = "Crypto Custody & Staking (Medium Risk)";
    } else if (presetId === 'fleet') {
      document.getElementById('input-product-type').value = "Commercial Fleet Fuel & Maintenance Credit Card";
      document.getElementById('select-change-type').value = "Parameter Change";
      document.getElementById('input-geography').value = "Texas, Illinois, Ohio, Indiana";
      document.getElementById('input-segment').value = "Commercial Transportation & Logistics";
      document.getElementById('input-target-date').value = "2026-10-01";
      document.getElementById('textarea-description').value = "Increase revolving corporate credit ceiling from $250k to $750k for verified domestic freight logistics company with hard MCC fuel controls.";
      filename = "005_commercial_fleet_card_low_risk.pdf";
      toastName = "Corporate Fleet Card (Low Risk)";
    } else if (presetId === 'pep') {
      document.getElementById('input-product-type').value = "International Private Wealth Trust Depository";
      document.getElementById('select-change-type').value = "Customer Segment Expansion";
      document.getElementById('input-geography').value = "Florida, United Kingdom, Nigeria, Bahamas";
      document.getElementById('input-segment').value = "Non-Resident Ultra-High-Net-Worth Private Banking";
      document.getElementById('input-target-date').value = "2026-11-01";
      document.getElementById('textarea-description').value = "Establish wealth depository and investment custodial accounts for non-resident UHNW trust holding vehicle owned by Amara Chukwuemeka Obi.";
      filename = "006_pep_private_wealth_onboarding_high_risk.pdf";
      toastName = "Private Wealth PEP Depository (High Risk Floor)";
    } else if (presetId === 'vendor_rfi') {
      document.getElementById('input-product-type').value = "Instant Payment Clearing & Vendor Gateway";
      document.getElementById('select-change-type').value = "Channel Modification";
      document.getElementById('input-geography').value = "United States";
      document.getElementById('input-segment').value = "Third-Party Payment Service Provider";
      document.getElementById('input-target-date').value = "";
      document.getElementById('textarea-description').value = "API integration with third-party gateway for real-time retail credit push disbursements through RTP and FedNow (missing go-live date).";
      filename = "007_incomplete_vendor_payment_portal_rfi.pdf";
      toastName = "Instant Payments Gateway (RFI Loop)";
    }

    if (filename) {
      try {
        const resp = await fetch(`/sample-files/${filename}`);
        if (resp.ok) {
          const blob = await resp.blob();
          const fileObj = new File([blob], filename, { type: 'application/pdf' });
          this.uploadedFiles = [{
            name: filename,
            size: (blob.size / 1024).toFixed(1) + ' KB',
            file: fileObj
          }];
          this.renderUploadedFiles();
          this.showToast(`Loaded Preset: ${toastName} (PDF document attached)`);
          return;
        }
      } catch (err) {
        console.warn("Could not fetch sample preset PDF:", err);
      }
      this.uploadedFiles = [{ name: filename, size: "PDF Document" }];
      this.renderUploadedFiles();
      this.showToast(`Loaded Preset: ${toastName}`);
    }
  }

  handleFiles(files) {
    const fileList = Array.from(files);
    if (!fileList.length) return;

    fileList.forEach(f => {
      if (!this.uploadedFiles.some(existing => existing.name === f.name)) {
        this.uploadedFiles.push({
          name: f.name,
          size: (f.size / 1024).toFixed(1) + ' KB',
          file: f
        });
      }
    });
    this.renderUploadedFiles();

    // Auto-populate form fields from the primary uploaded document
    const primaryFile = fileList[0];
    this.autoPopulateFromDocument(primaryFile);
  }

  autoPopulateFromDocument(file) {
    if (!file || !file.name) return;
    const filename = file.name.toLowerCase();
    let meta = null;

    // 1. Direct and keyword-based profile matching against sample and golden cases
    if (filename.includes('006') || filename.includes('pep') || filename.includes('private_wealth') || filename.includes('obi')) {
      meta = {
        productType: "International Private Wealth Trust Depository",
        changeType: "Customer Segment Expansion",
        geography: "Florida, United Kingdom, Nigeria, Bahamas",
        segment: "Non-Resident Ultra-High-Net-Worth Private Banking",
        targetDate: "2026-11-01",
        description: "Establish wealth depository and investment custodial accounts for non-resident UHNW trust holding vehicle owned by Amara Chukwuemeka Obi (100% beneficiary of Obi Heritage Capital Trust). Initial $12M wire from Barclays London.",
        toast: "Auto-populated: International Private Wealth (PEP Alert: Amara Obi)"
      };
    } else if (filename.includes('003') || filename.includes('remittance') || filename.includes('cross_border') || filename.includes('meridian')) {
      meta = {
        productType: "Cross-Border Commercial Remittance Corridor",
        changeType: "Geographic Expansion",
        geography: "United States, Mexico, Colombia, UAE",
        segment: "Money Services Business / Cross-Border Remittance",
        targetDate: "2026-11-15",
        description: "Open multi-currency clearing accounts for cross-border MSBs supporting high-velocity wire remittances across the US, Mexico, Colombia, and UAE free zones. Features nested correspondent routing via Meridian Overseas Holdings Ltd.",
        toast: "Auto-populated: Cross-Border MSB Corridor (Sanctions Hit)"
      };
    } else if (filename.includes('004') || filename.includes('crypto') || filename.includes('custody') || filename.includes('staking') || filename.includes('aegis')) {
      meta = {
        productType: "Institutional Digital Asset Custody & Staking",
        changeType: "New Product Launch",
        geography: "New York, Delaware, California",
        segment: "Institutional Wealth & Registered Investment Funds",
        targetDate: "2026-10-30",
        description: "Segregated digital asset custodial service with validator staking yield for institutional funds and RIAs in NY and DE. Bankruptcy-remote qualified custody with Anchorage Trust and MPC cold storage.",
        toast: "Auto-populated: Crypto Custody & Staking (Medium Risk)"
      };
    } else if (filename.includes('005') || filename.includes('fleet') || filename.includes('card') || filename.includes('callahan')) {
      meta = {
        productType: "Commercial Fleet Fuel & Maintenance Credit Card",
        changeType: "Parameter Change",
        geography: "Texas, Illinois, Ohio, Indiana",
        segment: "Commercial Transportation & Logistics",
        targetDate: "2026-10-01",
        description: "Increase revolving corporate credit ceiling from $250k to $750k for verified domestic freight logistics company (Midwest Express Logistics Inc). Hard MCC fuel and maintenance controls, 0% cash advance.",
        toast: "Auto-populated: Corporate Fleet Card (Low Risk)"
      };
    } else if (filename.includes('007') || filename.includes('vendor') || filename.includes('payment_portal') || filename.includes('rtp') || filename.includes('fednow')) {
      meta = {
        productType: "Instant Payment Clearing & Vendor Gateway",
        changeType: "Vendor Relationship",
        geography: "United States",
        segment: "Third-Party Payment Service Provider",
        targetDate: "", // Intentionally left empty to test the Gate 1 RFI loop
        description: "API integration with third-party gateway (Summit Peak Vendor Services) for real-time retail credit push disbursements through RTP and FedNow networks (missing go-live date).",
        toast: "Auto-populated: Instant Payments Gateway (RFI Loop)"
      };
    } else if (filename.includes('cannabis') || filename.includes('dispensary') || filename.includes('sample_change_request')) {
      meta = {
        productType: "Commercial High-Yield Cannabis Dispensary Account",
        changeType: "New Product Launch",
        geography: "US-CO, US-MI",
        segment: "Commercial Banking / Cash Intensive",
        targetDate: "2026-10-15",
        description: "Open accounts for licensed cannabis dispensaries in Colorado and Michigan with 80% armored car cash deposits.",
        toast: "Auto-populated: Cannabis Dispensary Banking (Critical Risk)"
      };
    } else if (filename.includes('atm') || filename.includes('withdrawal')) {
      meta = {
        productType: "Consumer ATM Daily Cash Withdrawal Limit Adjustment",
        changeType: "Parameter Change",
        geography: "Domestic (US-Wide)",
        segment: "Retail Consumer Banking",
        targetDate: "2026-10-01",
        description: "Proposed increase of standard debit card daily ATM cash withdrawal limit from $800 to $1,200 for prime tier consumer checking accounts with >= 12 months tenure.",
        toast: "Auto-populated: ATM Limit Increase (Low Risk)"
      };
    } else {
      // Heuristic parsing for unknown / user-uploaded custom files
      const baseClean = file.name.replace(/\.[^/.]+$/, '').replace(/^[0-9]+[_-]*/, '').replace(/[_-]+/g, ' ').trim();
      const titleClean = baseClean.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1));

      let changeType = "New Product Launch";
      if (filename.includes('mod') || filename.includes('limit') || filename.includes('adjust') || filename.includes('increase')) {
        changeType = "Parameter Change";
      } else if (filename.includes('geo') || filename.includes('cross') || filename.includes('corridor') || filename.includes('expand')) {
        changeType = "Geographic Expansion";
      } else if (filename.includes('wealth') || filename.includes('pep') || filename.includes('segment') || filename.includes('client')) {
        changeType = "Customer Segment Expansion";
      } else if (filename.includes('vendor') || filename.includes('third_party') || filename.includes('supplier')) {
        changeType = "Vendor Relationship";
      } else if (filename.includes('channel') || filename.includes('api') || filename.includes('portal')) {
        changeType = "Channel Modification";
      }

      const today = new Date();
      today.setDate(today.getDate() + 30);
      const defaultDate = today.toISOString().split('T')[0];

      meta = {
        productType: titleClean || "Commercial Banking Initiative",
        changeType: changeType,
        geography: "Domestic (US-Wide)",
        segment: "Commercial Banking & Corporate Clients",
        targetDate: defaultDate,
        description: `Operational risk assessment and change evaluation for ${titleClean}. Submitted with supporting technical and compliance documentation (${file.name}).`,
        toast: `Auto-populated specifications from ${file.name}`
      };
    }

    if (!meta) return;

    // Populate inputs
    const elProduct = document.getElementById('input-product-type');
    const elChange = document.getElementById('select-change-type');
    const elGeo = document.getElementById('input-geography');
    const elSegment = document.getElementById('input-segment');
    const elDate = document.getElementById('input-target-date');
    const elDesc = document.getElementById('textarea-description');

    if (elProduct) elProduct.value = meta.productType;
    if (elChange) elChange.value = meta.changeType;
    if (elGeo) elGeo.value = meta.geography;
    if (elSegment) elSegment.value = meta.segment;
    if (elDate) elDate.value = meta.targetDate;
    if (elDesc) elDesc.value = meta.description;

    // Apply visual pulse effect to indicate auto-populated fields
    const fieldsToPulse = [elProduct, elChange, elGeo, elSegment, elDate, elDesc].filter(Boolean);
    fieldsToPulse.forEach(field => {
      field.classList.remove('field-auto-populated');
      void field.offsetWidth; // Trigger reflow to restart CSS animation
      field.classList.add('field-auto-populated');
    });

    // Show indicator badge & reset button
    const badgeContainer = document.getElementById('form-auto-badge');
    const clearBtn = document.getElementById('btn-clear-intake-form');
    if (badgeContainer) {
      badgeContainer.innerHTML = `<span class="auto-populated-badge">⚡ Auto-Filled from Document</span>`;
    }
    if (clearBtn) {
      clearBtn.style.display = 'inline-block';
    }

    this.showToast(`✨ ${meta.toast}`);
  }

  startNewCase() {
    this.clearIntakeForm(false);
    this.switchView('new-case');
  }

  clearIntakeForm(showToast = true) {
    const elProduct = document.getElementById('input-product-type');
    const elChange = document.getElementById('select-change-type');
    const elGeo = document.getElementById('input-geography');
    const elSegment = document.getElementById('input-segment');
    const elDate = document.getElementById('input-target-date');
    const elDesc = document.getElementById('textarea-description');
    const badgeContainer = document.getElementById('form-auto-badge');
    const clearBtn = document.getElementById('btn-clear-intake-form');
    const hiddenFileInput = document.getElementById('hidden-file-input');

    if (elProduct) {
      elProduct.value = '';
      elProduct.classList.remove('field-auto-populated');
    }
    if (elChange) {
      elChange.selectedIndex = 0;
      elChange.classList.remove('field-auto-populated');
    }
    if (elGeo) {
      elGeo.value = '';
      elGeo.classList.remove('field-auto-populated');
    }
    if (elSegment) {
      elSegment.value = '';
      elSegment.classList.remove('field-auto-populated');
    }
    if (elDate) {
      elDate.value = '';
      elDate.classList.remove('field-auto-populated');
    }
    if (elDesc) {
      elDesc.value = '';
      elDesc.classList.remove('field-auto-populated');
    }

    this.uploadedFiles = [];
    this.renderUploadedFiles();

    if (hiddenFileInput) {
      hiddenFileInput.value = '';
    }

    if (badgeContainer) badgeContainer.innerHTML = '';
    if (clearBtn) clearBtn.style.display = 'none';

    document.querySelectorAll('.field-auto-populated').forEach(el => {
      el.classList.remove('field-auto-populated');
    });

    document.querySelectorAll('.preset-card').forEach(card => card.classList.remove('active'));

    if (showToast) {
      this.showToast("Form cleared");
    }
  }

  renderUploadedFiles() {
    if (!this.uploadedList) return;
    this.uploadedList.innerHTML = this.uploadedFiles.map((f, i) => `
      <div class="uploaded-file-item">
        <span class="font-mono text-cyan">📄 ${f.name}</span>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span class="text-dim text-xs">${f.size}</span>
          <button type="button" style="background: none; border: none; color: var(--text-muted); cursor: pointer;" onclick="window.fcrmApp.removeFile(${i})">✕</button>
        </div>
      </div>
    `).join('');
  }

  removeFile(index) {
    this.uploadedFiles.splice(index, 1);
    this.renderUploadedFiles();
    if (this.uploadedFiles.length === 0) {
      const badgeContainer = document.getElementById('form-auto-badge');
      const clearBtn = document.getElementById('btn-clear-intake-form');
      if (badgeContainer) badgeContainer.innerHTML = '';
      if (clearBtn) clearBtn.style.display = 'none';
      const hiddenFileInput = document.getElementById('hidden-file-input');
      if (hiddenFileInput) hiddenFileInput.value = '';
    }
  }

  async handleFormSubmit(e) {
    e.preventDefault();
    const btnSubmit = document.getElementById('btn-submit-case');
    btnSubmit.disabled = true;

    const stages = [
      "⚡ Initializing LangGraph Workflow...",
      "📄 Extracting Entities & Facts (Claude Sonnet)...",
      "🔍 Screening Watchlists & Retrieving Policies...",
      "⚖️ Calculating POL-045 Scorecard & Rationale...",
      "📝 Drafting Executive Governance Memo...",
      "🔒 Checkpointing State at Gate 1 Review..."
    ];
    let stageIdx = 0;
    btnSubmit.innerHTML = `<span style="display:inline-block; width:12px; height:12px; border:2px solid #fff; border-top-color:transparent; border-radius:50%; animation:spin 0.8s linear infinite; margin-right:8px; vertical-align:middle;"></span>${stages[0]}`;

    const progressInterval = setInterval(() => {
      stageIdx = (stageIdx + 1) % stages.length;
      btnSubmit.innerHTML = `<span style="display:inline-block; width:12px; height:12px; border:2px solid #fff; border-top-color:transparent; border-radius:50%; animation:spin 0.8s linear infinite; margin-right:8px; vertical-align:middle;"></span>${stages[stageIdx]}`;
    }, 3000);

    try {
      const formData = new FormData();
      formData.append('product_type', document.getElementById('input-product-type').value);
      formData.append('change_type', document.getElementById('select-change-type').value);
      formData.append('geography', document.getElementById('input-geography').value);
      formData.append('segment', document.getElementById('input-segment').value);
      formData.append('target_date', document.getElementById('input-target-date').value);
      formData.append('description', document.getElementById('textarea-description').value);

      let attachedCount = 0;
      for (const item of this.uploadedFiles) {
        if (item.file) {
          formData.append('files', item.file, item.name);
          attachedCount++;
        }
      }

      const res = await window.fcrmApi.createCase(formData);

      if (res && res.success) {
        this.showToast(`Case ${res.case_id} submitted & processed with ${attachedCount} document(s)!`);
        this.clearIntakeForm(false);
        this.openDossier(res.case_id);
      } else {
        this.showToast(res?.error || "Submission encountered an issue", "error");
      }
    } catch (err) {
      console.error("Form submission error:", err);
      this.showToast("Submission failed: " + (err.message || "Unknown error"), "error");
    } finally {
      clearInterval(progressInterval);
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = 'Submit Change for Risk Assessment →';
    }
  }

  // Gate 1 Modal
  openGate1Modal(caseData) {
    document.getElementById('gate1-case-id').textContent = caseData.case_id;
    document.getElementById('gate1-actor').value = this.currentPersona;
    document.getElementById('gate1-notes').value = '';
    this.gate1Modal.classList.add('active');
  }

  async handleGate1Submit() {
    const action = document.querySelector('input[name="gate1_action"]:checked')?.value || 'finalize';
    const notes = document.getElementById('gate1-notes').value;
    const actor = document.getElementById('gate1-actor').value || this.currentPersona;

    const res = await window.fcrmApi.resolveGate1(this.currentCaseId, action, notes, actor);
    this.gate1Modal.classList.remove('active');
    if (res.success) {
      this.showToast(action === 'finalize' ? 'Gate 1 Finalized: Advanced to Committee' : 'Gate 1 RFI Issued: Returned to Product Owner');
      this.openDossier(this.currentCaseId, false);
    }
  }

  // Gate 2 Modal
  openGate2Modal(caseData) {
    document.getElementById('gate2-case-id').textContent = caseData.case_id;
    document.getElementById('gate2-actor').value = this.currentPersona;
    document.getElementById('gate2-conditions-list').innerHTML = '';
    
    // Select default decision button (Approved with Conditions)
    this.selectGate2Outcome('Approved with Conditions');

    // Populate default conditions from memo
    if (caseData.memo && caseData.memo.conditions) {
      caseData.memo.conditions.forEach(c => this.addConditionTag(c));
    }
    this.gate2Modal.classList.add('active');
  }

  selectGate2Outcome(outcome) {
    const hiddenInput = document.getElementById('select-gate2-outcome');
    if (hiddenInput) hiddenInput.value = outcome;

    document.querySelectorAll('#gate2-decision-group .decision-btn').forEach(btn => {
      const isMatch = btn.getAttribute('data-value') === outcome;
      btn.classList.toggle('active', isMatch);
    });

    // Update submit button text and styling based on outcome
    const submitBtn = document.getElementById('btn-submit-gate2');
    if (submitBtn) {
      if (outcome === 'Rejected') {
        submitBtn.className = 'btn-rose';
      } else if (outcome === 'Deferred') {
        submitBtn.className = 'btn-amber';
      } else {
        submitBtn.className = 'btn-emerald';
      }
      submitBtn.textContent = `Record Official Determination (${outcome})`;
    }

    // Toggle conditions list visual prominence
    const condList = document.getElementById('gate2-conditions-list');
    const condInput = document.getElementById('new-condition-input');
    const addCondBtn = document.getElementById('btn-add-condition');
    const isConditions = (outcome === 'Approved with Conditions');
    if (condList) condList.style.opacity = isConditions ? '1' : '0.5';
    if (condInput) condInput.disabled = !isConditions;
    if (addCondBtn) addCondBtn.disabled = !isConditions;
  }

  addConditionTag(text) {
    const container = document.getElementById('gate2-conditions-list');
    const tag = document.createElement('div');
    tag.className = 'condition-tag-item';
    tag.style = 'background: rgba(16, 185, 129, 0.1); border: 1px solid var(--accent-emerald); border-radius: var(--radius-sm); padding: 0.35rem 0.65rem; font-size: 0.8rem; display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;';
    tag.innerHTML = `
      <span class="condition-tag-text">${text}</span>
      <button type="button" style="background: none; border: none; color: var(--accent-crimson); cursor: pointer; margin-left: 0.5rem;" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(tag);
  }

  async handleGate2Submit() {
    const outcome = document.getElementById('select-gate2-outcome').value;
    const actor = document.getElementById('gate2-actor').value || this.currentPersona;
    const conditionElements = document.querySelectorAll('.condition-tag-text');
    const conditions = Array.from(conditionElements).map(el => el.textContent);

    const res = await window.fcrmApi.resolveGate2(this.currentCaseId, outcome, conditions, actor);
    this.gate2Modal.classList.remove('active');
    if (res.success) {
      this.showToast(`Gate 2 Decision Recorded: ${outcome}`);
      this.openDossier(this.currentCaseId, false);
    }
  }

  // Utility helpers
  getRiskBadgeClass(tier) {
    switch (tier) {
      case 'Critical': return 'badge-risk-critical';
      case 'High': return 'badge-risk-high';
      case 'Medium': return 'badge-risk-medium';
      case 'Low': return 'badge-risk-low';
      default: return 'badge-risk-medium';
    }
  }

  getStatusBadgeClass(status) {
    switch (status) {
      case 'awaiting_gate1': return 'awaiting-gate1';
      case 'awaiting_gate2': return 'awaiting-gate2';
      case 'rfi': return 'rfi';
      case 'closed': return 'closed';
      case 'in-flight': return 'in-flight';
      default: return '';
    }
  }

  formatStatus(status) {
    switch (status) {
      case 'awaiting_gate1': return 'Awaiting Gate 1';
      case 'awaiting_gate2': return 'Awaiting Gate 2';
      case 'rfi': return 'Needs Info (RFI)';
      case 'closed': return 'Approved / Closed';
      case 'in-flight': return 'In Flight';
      case 'rejected': return 'Rejected';
      default: return status || 'Active';
    }
  }

  showToast(message, type = 'info') {
    if (!this.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    const icon = type === 'error' ? '⚠️' : '✓';
    toast.innerHTML = `<span style="color: ${type === 'error' ? 'var(--accent-crimson)' : 'var(--accent-emerald)'}; font-weight: bold;">${icon}</span> <span>${message}</span>`;
    this.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
}
