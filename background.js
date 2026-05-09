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
  let bestAnalysis = null;
  let bestEval = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`Running analysis attempt ${attempt}/3...`);
    // Step 1: Run primary analysis
    const primaryAnalysis = await analyzeTos({ text, title, apiKey });

    // Step 2: Await eval pipeline
    const evalResult = await runEvalPipeline(text, primaryAnalysis, apiKey);
    
    bestAnalysis = primaryAnalysis;
    bestEval = evalResult;

    // Check if score is good enough
    if (evalResult.success && evalResult.confidence.score >= 75) {
      console.log(`Success! Confidence ${evalResult.confidence.score} is >= 75.`);
      break;
    } else {
      console.log(`Confidence was ${evalResult.confidence?.score}. Retrying if possible...`);
    }
  }

  // Return final bundled result
  return {
    type: 'FINAL_RESULT',
    analysis: bestAnalysis,
    evalResult: bestEval
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

// (runEvalAndNotify removed since evaluation is now synchronous)
