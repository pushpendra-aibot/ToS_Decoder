// evaluator.js
// Evaluation pipeline — runs automatically after every primary analysis.
// All three checks run in parallel via Promise.all for minimum latency.

const EVAL_MODEL = 'gpt-5-nano'; // Ensure we use the requested model

// ── CHECK 1: Hallucination Verifier ─────────────────────────────────────────
async function checkHallucinations(sourceText, analysis, apiKey) {
  if (!analysis.redFlags || analysis.redFlags.length === 0) {
    return { verified: [], unverified: [], score: 10 };
  }

  const flagList = analysis.redFlags
    .map((f, i) => `${i + 1}. "${f.flag}"`)
    .join('\n');

  const prompt = `You are a fact-checker. A legal analysis tool produced the following 
red flags from a Terms of Service document. Your job is to verify whether each 
red flag is genuinely supported by the source text.

SOURCE TEXT (first 8000 chars):
${sourceText.slice(0, 8000)}

RED FLAGS TO VERIFY:
${flagList}

For each red flag, determine:
- VERIFIED: The source text contains a clause that clearly supports this finding
- UNVERIFIED: No clear textual basis found — likely hallucinated or overstated

Respond with JSON only:
{
  "results": [
    {
      "index": 1,
      "flag": "exact flag text",
      "status": "verified" | "unverified",
      "supportingQuote": "verbatim excerpt from source that supports it, or null"
    }
  ],
  "hallucinationRate": 0.0
}`;

  const response = await callOpenAI(prompt, apiKey, 1);
  const result = JSON.parse(response);

  const verified = result.results.filter(r => r.status === 'verified');
  const unverified = result.results.filter(r => r.status === 'unverified');
  const score = Math.round((verified.length / result.results.length) * 10);

  return {
    verified,
    unverified,
    score,                               // 0–10
    hallucinationRate: result.hallucinationRate,
    details: result.results
  };
}

// ── CHECK 2: LLM Judge ───────────────────────────────────────────────────────
async function runLlmJudge(sourceText, analysis, apiKey) {
  const prompt = `You are an expert evaluator grading a Terms of Service analysis tool.

ORIGINAL DOCUMENT (first 6000 chars):
${sourceText.slice(0, 6000)}

ANALYSIS PRODUCED:
Risk Rating: ${analysis.riskRating}
Risk Reason: ${analysis.riskReason}
TL;DR: ${analysis.tldr}
Red Flags Found: ${JSON.stringify(analysis.redFlags)}
Data Collected: ${JSON.stringify(analysis.dataCollected)}
Rights Waived: ${JSON.stringify(analysis.rightsWaived)}

Grade this analysis on these dimensions. Return JSON only:
{
  "riskRatingAccuracy": {
    "score": 0,
    "correct": true,
    "feedback": "brief explanation"
  },
  "plainEnglishClarity": {
    "score": 0,
    "feedback": "brief explanation"
  },
  "completeness": {
    "score": 0,
    "missedFindings": [],
    "feedback": "brief explanation"
  },
  "overallScore": 0,
  "overallFeedback": "one sentence verdict"
}

Scoring guide:
- 9-10: Excellent, production quality
- 7-8: Good, minor gaps
- 5-6: Acceptable, some issues
- 3-4: Poor, significant problems
- 0-2: Unreliable, do not trust`;

  const response = await callOpenAI(prompt, apiKey, 1);
  const result = JSON.parse(response);
  return result;
}

// ── CHECK 3: Self-Consistency ────────────────────────────────────────────────
async function checkConsistency(sourceText, primaryRating, apiKey) {
  const prompt = `Read this Terms of Service excerpt and classify its overall risk level.

TEXT:
${sourceText.slice(0, 5000)}

Classify as one of: low, medium, high

Consider:
- high: multiple serious privacy violations, rights waivers, or predatory clauses
- medium: some concerning items but nothing extreme  
- low: standard fair terms with no major concerns

Respond with JSON only:
{
  "riskRating": "low" | "medium" | "high",
  "confidence": "high" | "medium" | "low",
  "reasoning": "one sentence"
}`;

  const response = await callOpenAI(prompt, apiKey, 1);
  const result = JSON.parse(response);

  return {
    rating: result.riskRating,
    matches: result.riskRating === primaryRating,
    confidence: result.confidence,
    reasoning: result.reasoning,
    score: result.riskRating === primaryRating ? 10 : 3
  };
}

// ── AGGREGATE SCORE ──────────────────────────────────────────────────────────
function computeConfidenceScore(hallucinationResult, judgeResult, consistencyResult) {
  const HALLUCINATION_WEIGHT = 0.40;
  const JUDGE_WEIGHT         = 0.35;
  const CONSISTENCY_WEIGHT   = 0.25;

  const hallucinationScore = hallucinationResult.score * 10;
  const judgeScore         = judgeResult.overallScore * 10;
  const consistencyScore   = consistencyResult.score * 10;

  const weighted = (
    hallucinationScore * HALLUCINATION_WEIGHT +
    judgeScore         * JUDGE_WEIGHT +
    consistencyScore   * CONSISTENCY_WEIGHT
  );

  return {
    score: Math.round(weighted),
    grade: scoreToGrade(Math.round(weighted)),
    breakdown: {
      hallucination: { score: hallucinationScore, weight: '40%' },
      judgeQuality:  { score: judgeScore,         weight: '35%' },
      consistency:   { score: consistencyScore,   weight: '25%' }
    }
  };
}

function scoreToGrade(score) {
  if (score >= 85) return { label: 'High Confidence',   emoji: '✅', color: 'green'  };
  if (score >= 65) return { label: 'Medium Confidence', emoji: '⚠️', color: 'yellow' };
  return               { label: 'Low Confidence',    emoji: '❌', color: 'red'    };
}

// ── MAIN PIPELINE ────────────────────────────────────────────────────────────
async function runEvalPipeline(sourceText, analysis, apiKey) {
  const startTime = Date.now();

  try {
    const [hallucinationResult, judgeResult, consistencyResult] = await Promise.all([
      checkHallucinations(sourceText, analysis, apiKey),
      runLlmJudge(sourceText, analysis, apiKey),
      checkConsistency(sourceText, analysis.riskRating, apiKey)
    ]);

    const confidence = computeConfidenceScore(hallucinationResult, judgeResult, consistencyResult);

    return {
      success: true,
      confidence,
      hallucination: hallucinationResult,
      judge: judgeResult,
      consistency: consistencyResult,
      evalDurationMs: Date.now() - startTime,
      missedFindings: judgeResult.completeness?.missedFindings || []
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      confidence: { score: 0, grade: { label: 'Eval Failed', emoji: '⚠️', color: 'gray' } }
    };
  }
}

// ── SHARED HELPER ────────────────────────────────────────────────────────────
async function callOpenAI(userPrompt, apiKey, temperature = 1) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: EVAL_MODEL,
      response_format: { type: 'json_object' },
      temperature,
      messages: [
        {
          role: 'system',
          content: 'You are a precise evaluator. Always respond with valid JSON only.'
        },
        { role: 'user', content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  return content.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
}
