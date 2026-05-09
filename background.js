// background.js
importScripts('evaluator.js');

const SYSTEM_PROMPT = `You are a legal expert and consumer rights advocate who specialises in making Terms of Service and Privacy Policies understandable to everyday people. Your job is to analyse legal documents and surface what actually matters to users. Always respond with valid JSON only. No markdown, no explanation outside the JSON.`;

function buildUserPrompt(text, docTitle) {
  return `Analyse this Terms of Service / Privacy Policy document and respond with JSON.

Document: "${docTitle}"
Text: ${text}

Respond with this exact JSON structure:
{
  "riskRating": "low" | "medium" | "high",
  "riskReason": "One sentence explaining the overall risk level",
  "summary": "2-3 sentence plain English summary of what this document is about",
  "dataCollected": [
    { "item": "What data", "detail": "How it is used", "severity": "low|medium|high" }
  ],
  "rightsWaived": [
    { "item": "Right or protection given up", "detail": "What this means for you", "severity": "low|medium|high" }
  ],
  "autoRenewals": [
    { "item": "Auto-renewal or billing clause", "detail": "What triggers it and how to cancel" }
  ],
  "dataSharingThirdParties": [
    { "item": "Who data is shared with", "detail": "For what purpose" }
  ],
  "redFlags": [
    { "flag": "Specific concerning clause in plain English", "severity": "medium|high" }
  ],
  "positives": [
    "One positive thing this document does for users"
  ],
  "tldr": "One sentence. What does agreeing to this actually mean for a regular person?"
}

Rules:
- redFlags must only contain genuinely concerning items (not standard boilerplate)
- riskRating high = at least 2 high-severity red flags
- riskRating medium = at least 2 medium items or 1 high item
- riskRating low = standard terms with no major concerns
- Keep all text concise and jargon-free
- If a section has nothing to report, return an empty array []`;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ANALYZE_TOS') {
    runAnalysisWithEval(message.payload)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true; // Keep channel open for async
  }
});

async function runAnalysisWithEval({ text, title, apiKey }) {
  // Step 1: Run primary analysis
  const primaryAnalysis = await analyzeTos({ text, title, apiKey });

  // Trigger eval in background (don't await)
  runEvalAndNotify(text, primaryAnalysis, apiKey);

  // Return primary analysis immediately
  return {
    type: 'PRIMARY_RESULT',
    analysis: primaryAnalysis
  };
}

async function analyzeTos({ text, title, apiKey }) {
  const response = await fetch('http://localhost:8000/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: text,
      title: title,
      apiKey: apiKey
    })
  });

  if (!response.ok) {
    let errMsg = `API error ${response.status}`;
    try {
        const err = await response.json();
        errMsg = err.detail || err.error?.message || errMsg;
    } catch (e) {}
    throw new Error(errMsg);
  }

  const analysis = await response.json();

  // Attach metadata
  analysis.tokensUsed = analysis.tokensUsed || 0;
  analysis.analyzedAt = new Date().toISOString();

  return analysis;
}

async function runEvalAndNotify(sourceText, analysis, apiKey) {
  try {
    const evalResult = await runEvalPipeline(sourceText, analysis, apiKey);
    
    // Send eval results to popup when ready
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      // Background scripts can just broadcast it out directly
      chrome.runtime.sendMessage({
        type: 'EVAL_RESULT',
        evalResult
      }).catch(err => console.log('Popup closed before eval finished.'));
    });
  } catch (e) {
    console.error('Eval pipeline failed:', e);
  }
}
