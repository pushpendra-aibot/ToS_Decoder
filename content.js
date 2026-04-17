// content.js

const TOS_SIGNALS = {
  urlKeywords: [
    'terms', 'tos', 'privacy', 'legal', 'policy',
    'agreement', 'conditions', 'eula', 'cookie'
  ],
  titleKeywords: [
    'terms of service', 'terms and conditions', 'privacy policy',
    'user agreement', 'end user license', 'cookie policy',
    'terms of use', 'legal notice'
  ],
  headingKeywords: [
    'terms of service', 'privacy policy', 'terms and conditions',
    'user agreement', 'acceptance of terms'
  ]
};

function detectTosPage() {
  const url = window.location.href.toLowerCase();
  const title = document.title.toLowerCase();
  const firstH1 = document.querySelector('h1')?.innerText?.toLowerCase() || '';

  const urlMatch = TOS_SIGNALS.urlKeywords.some(kw => url.includes(kw));
  const titleMatch = TOS_SIGNALS.titleKeywords.some(kw => title.includes(kw));
  const headingMatch = TOS_SIGNALS.headingKeywords.some(kw => firstH1.includes(kw));

  return {
    isTosPage: urlMatch || titleMatch || headingMatch,
    confidence: [urlMatch, titleMatch, headingMatch].filter(Boolean).length, // 0-3
    detectedType: titleMatch ? document.title : (firstH1 || 'Legal Document')
  };
}

function extractLegalText() {
  // Remove noise elements
  const noiseSelectors = [
    'nav', 'header', 'footer', '.cookie-banner', '.nav',
    '.header', '.footer', '.sidebar', 'script', 'style',
    '.announcement', '.banner', '[role="navigation"]'
  ];
  
  // Clone body to avoid mutating the page
  const clone = document.body.cloneNode(true);
  noiseSelectors.forEach(sel => {
    clone.querySelectorAll(sel).forEach(el => el.remove());
  });

  // Try to find the main content container
  const contentSelectors = [
    '[class*="terms"]', '[class*="legal"]', '[class*="policy"]',
    '[id*="terms"]', '[id*="legal"]', '[id*="policy"]',
    'article', 'main', '.content', '#content'
  ];

  let mainText = '';
  for (const sel of contentSelectors) {
    const el = clone.querySelector(sel);
    if (el && el.innerText.length > 500) {
      mainText = el.innerText;
      break;
    }
  }

  // Fallback to full body text
  if (!mainText) mainText = clone.innerText;

  // Clean up whitespace, limit to 12000 chars
  return mainText
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 12000);
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_PAGE_DATA') {
    const detection = detectTosPage();
    const text = extractLegalText();
    sendResponse({
      isTosPage: detection.isTosPage,
      confidence: detection.confidence,
      detectedType: detection.detectedType,
      text: text,
      wordCount: text.split(' ').length,
      url: window.location.href,
      title: document.title
    });
  }
  return true; // Keep channel open for async
});
