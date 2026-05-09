// popup.js

// ── State Management ──────────────────────────────────────────────────────────

const states = ['no-key', 'not-tos', 'ready', 'loading', 'results', 'error'];

function showState(name) {
  states.forEach(s => {
    document.getElementById(`state-${s}`).classList.add('hidden');
  });
  document.getElementById(`state-${name}`).classList.remove('hidden');
}

// ── On Load ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  const { openaiApiKey } = await chrome.storage.sync.get('openaiApiKey');

  if (!openaiApiKey) {
    showState('no-key');
    return;
  }

  // Get page data from content script
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  try {
    const pageData = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_DATA' });
    
    if (!pageData || !pageData.text) {
      showState('error');
      document.getElementById('error-message').textContent =
        'Could not read this page. Try refreshing.';
      return;
    }

    if (!pageData.isTosPage) {
      showState('not-tos');
    } else {
      showReadyState(pageData);
    }

    // Store page data for later use
    window._pageData = pageData;

  } catch (e) {
    showState('error');
    document.getElementById('error-message').textContent =
      'Could not connect to the page. Please refresh and try again. It might be restricted.';
  }
});

// ── Ready State ───────────────────────────────────────────────────────────────

function showReadyState(pageData) {
  showState('ready');
  document.getElementById('ready-type').textContent = pageData.detectedType;
  document.getElementById('ready-title').textContent = pageData.title;
  document.getElementById('ready-wordcount').textContent =
    `~${pageData.wordCount.toLocaleString()} words`;
}

// ── Analyze ───────────────────────────────────────────────────────────────────

async function runAnalysis(pageData) {
  if (!pageData) {
    showState('error');
    document.getElementById('error-message').textContent = 'Page data is missing or restricted. Please navigate to a standard webpage and try again.';
    return;
  }
  showState('loading');

  const { openaiApiKey } = await chrome.storage.sync.get('openaiApiKey');

  const result = await chrome.runtime.sendMessage({
    type: 'ANALYZE_TOS',
    payload: {
      text: pageData.text,
      title: pageData.title,
      apiKey: openaiApiKey
    }
  });

  if (result.error) {
    showState('error');
    document.getElementById('error-message').textContent = result.error;
    return;
  }

  // Handle new final result structure or fallback
  const analysis = result.type === 'FINAL_RESULT' ? result.analysis : (result.type === 'PRIMARY_RESULT' ? result.analysis : result);
  window._latestAnalysis = analysis;
  renderResults(analysis);

  if (result.type === 'FINAL_RESULT' && result.evalResult) {
    renderEvalResults(result.evalResult);
  }
}

// ── Eval Listener & Rendering ─────────────────────────────────────────────────
// (EVAL_RESULT listener removed since evaluation is now synchronous)

function renderEvalResults(evalResult) {
  window._latestEval = evalResult;
  const panel = document.getElementById('eval-panel');
  if (panel) panel.classList.remove('hidden');

  if (!evalResult.success) {
    document.getElementById('confidence-label').textContent = 'Eval Failed';
    return;
  }

  const { confidence, hallucination, judge, consistency, missedFindings } = evalResult;

  document.getElementById('confidence-score').textContent = confidence.score;
  document.getElementById('confidence-label').textContent = confidence.grade.label;
  document.getElementById('confidence-emoji').textContent = confidence.grade.emoji;
  document.getElementById('eval-panel').className = `eval-panel eval-${confidence.grade.color}`;

  renderScoreBar('bar-hallucination', confidence.breakdown.hallucination.score);
  renderScoreBar('bar-judge',         confidence.breakdown.judgeQuality.score);
  renderScoreBar('bar-consistency',   confidence.breakdown.consistency.score);

  if (hallucination.details) {
    hallucination.details.forEach(item => {
      const flagEls = document.querySelectorAll('.item-text');
      flagEls.forEach(el => {
        if (el.textContent.includes(item.flag.slice(0, 30))) {
          const badge = document.createElement('span');
          badge.className = `verify-badge ${item.status}`;
          badge.textContent = item.status === 'verified' ? '✓ Verified' : '⚠ Unverified';
          el.appendChild(badge);
        }
      });
    });
  }

  if (missedFindings && missedFindings.length > 0) {
    const missedEl = document.getElementById('missed-findings');
    missedEl.classList.remove('hidden');
    missedEl.innerHTML = `<strong>⚠ Possibly missed:</strong> ${missedFindings.join(', ')}`;
  }

  const consistencyEl = document.getElementById('consistency-result');
  consistencyEl.textContent = consistency.matches
    ? '✓ Risk rating confirmed by second pass'
    : `⚠ Second pass rated this as "${consistency.rating}" — treat with caution`;
  consistencyEl.className = consistency.matches ? 'check-pass' : 'check-fail';

  document.getElementById('judge-feedback').textContent = judge.overallFeedback;
}

function renderScoreBar(barId, score) {
  const bar = document.getElementById(barId);
  if (!bar) return;
  bar.style.width = `${score}%`;
  bar.className = `score-bar ${score >= 75 ? 'bar-green' : score >= 50 ? 'bar-yellow' : 'bar-red'}`;
}

document.getElementById('eval-toggle')?.addEventListener('click', () => {
  document.getElementById('eval-details')?.classList.toggle('hidden');
});

// ── Render Results ────────────────────────────────────────────────────────────

function renderResults(analysis) {
  showState('results');

  // Risk Badge
  const riskConfig = {
    low:    { icon: '🟢', label: 'Low Risk',    class: 'risk-low' },
    medium: { icon: '🟡', label: 'Medium Risk', class: 'risk-medium' },
    high:   { icon: '🔴', label: 'High Risk',   class: 'risk-high' }
  };
  const risk = riskConfig[analysis.riskRating] || riskConfig.medium;
  const badge = document.getElementById('risk-badge');
  badge.className = `risk-badge ${risk.class}`;
  document.getElementById('risk-icon').textContent = risk.icon;
  document.getElementById('risk-label').textContent = risk.label;
  document.getElementById('risk-reason').textContent = analysis.riskReason;

  // TL;DR
  document.getElementById('tldr-text').textContent = analysis.tldr;

  // Red Flags
  renderList('body-redflags', 'badge-redflags', analysis.redFlags,
    item => `<div class="list-item severity-${item.severity}">
      <span class="item-icon">🚩</span>
      <span class="item-text">${item.flag}</span>
    </div>`
  );

  // Data Collected
  renderList('body-data', 'badge-data', analysis.dataCollected,
    item => `<div class="list-item severity-${item.severity}">
      <strong>${item.item}</strong>
      <span>${item.detail}</span>
    </div>`
  );

  // Rights Waived
  renderList('body-rights', 'badge-rights', analysis.rightsWaived,
    item => `<div class="list-item severity-${item.severity}">
      <strong>${item.item}</strong>
      <span>${item.detail}</span>
    </div>`
  );

  // Auto-renewals
  renderList('body-billing', 'badge-billing', analysis.autoRenewals,
    item => `<div class="list-item">
      <strong>${item.item}</strong>
      <span>${item.detail}</span>
    </div>`
  );

  // Third-party sharing
  renderList('body-sharing', 'badge-sharing', analysis.dataSharingThirdParties,
    item => `<div class="list-item">
      <strong>${item.item}</strong>
      <span>${item.detail}</span>
    </div>`
  );

  // Positives
  renderList('body-positives', 'badge-positives', analysis.positives,
    item => `<div class="list-item positive">
      <span class="item-icon">✅</span>
      <span class="item-text">${item}</span>
    </div>`
  );

  // Footer
  document.getElementById('token-count').textContent =
    `Analyzed at ${new Date(analysis.analyzedAt).toLocaleTimeString()}`;

  // Open red flags by default if high risk
  if (analysis.riskRating === 'high' && analysis.redFlags.length > 0) {
    document.querySelector('#section-redflags .accordion-body')
      .classList.add('open');
  }
}

function renderList(bodyId, badgeId, items, template) {
  const body = document.getElementById(bodyId);
  const badge = document.getElementById(badgeId);

  if (!items || items.length === 0) {
    body.innerHTML = '<p class="empty">None found</p>';
    badge.textContent = '0';
    badge.className = 'badge badge-empty';
    return;
  }

  badge.textContent = items.length;
  badge.className = `badge ${items.length > 2 ? 'badge-warn' : 'badge-ok'}`;
  body.innerHTML = items.map(template).join('');
}

// ── Accordion ─────────────────────────────────────────────────────────────────

document.addEventListener('click', (e) => {
  const header = e.target.closest('.accordion-header');
  if (header) {
    const body = header.nextElementSibling;
    body.classList.toggle('open');
  }
});

// ── Button Listeners ──────────────────────────────────────────────────────────

document.addEventListener('click', async (e) => {
  if (e.target.id === 'btn-analyze' || e.target.id === 'btn-analyze-anyway') {
    // Reset eval panel if it was open
    const panel = document.getElementById('eval-panel');
    if (panel) {
      panel.classList.add('hidden');
      panel.className = 'eval-panel';
    }
    await runAnalysis(window._pageData);
  }
  if (e.target.id === 'btn-reanalyze') {
    const panel = document.getElementById('eval-panel');
    if (panel) {
      panel.classList.add('hidden');
      panel.className = 'eval-panel';
    }
    await runAnalysis(window._pageData);
  }
  if (e.target.id === 'btn-open-settings' || e.target.id === 'link-settings') {
    chrome.runtime.openOptionsPage();
  }
  if (e.target.id === 'btn-retry') {
    window.location.reload();
  }
  if (e.target.id === 'btn-download-pdf') {
    if (!window._latestAnalysis) return;
    const a = window._latestAnalysis;
    const ev = window._latestEval || {};

    const container = document.createElement('div');
    container.style.fontFamily = 'Helvetica, Arial, sans-serif';
    container.style.color = '#333';
    container.style.padding = '20px';
    container.style.lineHeight = '1.5';

    let html = `
      <h1 style="color: #2c3e50; border-bottom: 2px solid #eee; padding-bottom: 10px;">ToS Decoder Audit Report</h1>
      <p><strong>URL/Title:</strong> ${window._pageData?.title || 'Unknown'}</p>
      <p><strong>Risk Rating:</strong> ${a.riskRating.toUpperCase()}</p>
      <div style="background: #f8f9fa; padding: 15px; border-left: 4px solid #007bff; margin-bottom: 20px;">
        <strong>TL;DR:</strong> ${a.tldr}
      </div>
    `;

    const addSection = (title, items) => {
      if (!items || items.length === 0) return;
      html += `<h3 style="color: #34495e; margin-top: 20px;">${title}</h3><ul style="margin: 0; padding-left: 20px;">`;
      items.forEach(item => {
        const text = typeof item === 'string' ? item : (item.flag || `<strong>${item.item}:</strong> ${item.detail}`);
        html += `<li style="margin-bottom: 8px;">${text}</li>`;
      });
      html += `</ul>`;
    };

    addSection('🚩 Red Flags', a.redFlags);
    addSection('📊 Data Collected', a.dataCollected);
    addSection('⚖️ Rights Waived', a.rightsWaived);
    addSection('🔄 Auto-Renewals & Billing', a.autoRenewals);
    addSection('🤝 Third-Party Sharing', a.dataSharingThirdParties);
    addSection('✅ Positives', a.positives);

    if (ev.success) {
      html += `
        <h3 style="color: #34495e; margin-top: 20px; border-top: 1px solid #eee; padding-top: 15px;">AI Evaluation Results</h3>
        <p><strong>Confidence Score:</strong> ${ev.confidence.score}/100 (${ev.confidence.grade.label})</p>
        <p><strong>Feedback:</strong> ${ev.judge.overallFeedback}</p>
      `;
    }

    container.innerHTML = html;

    html2pdf().set({
      margin: 15,
      filename: 'ToS_Decoder_Report.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(container).save();
  }
});
