# 🔍 ToS Decoder

<p align="center">
  <a href="[INSERT_YOUTUBE_LINK_HERE]">
    <img src="assets/tos_thumbnail.png" alt="Watch ToS Decoder on YouTube" width="700">
  </a>
</p>

<p align="center">
  📺 <strong><a href="[INSERT_YOUTUBE_LINK_HERE]">Watch the full video breakdown on YouTube!</a></strong>
</p>

**ToS Decoder** is a Chrome Extension that uses AI to instantly read and decode any Terms of Service, Privacy Policy, or End-User License Agreement (EULA) into plain English. Never blindly agree to terms again without knowing exactly what data you are giving up, what rights you are waiving, and your genuine risk exposure!

## ✨ Features

* 🚀 **Instant Analysis**: Automatically detects ToS pages and parses up to 12,000 characters of dense legal jargon in seconds.
* 🛡️ **Risk Profiling**: Provides a strict baseline risk rating (🟢 Low / 🟡 Medium / 🔴 High).
* 🚩 **Red Flag Extraction**: Plainly surfaces aggressive clauses, ridiculous data collection specs, and auto-renewal traps.
* 🤖 **Automatic Eval Pipeline**: Every result is double-checked by an automated evaluation pipeline running concurrently in the background. It measures Hallucination Rates, Analysis Quality, and Self-Consistency, giving you a 0-100 Confidence Metric.
* 📄 **Native PDF Export**: Saves the entire evaluated legal audit to a neat, high-quality PDF to keep for your records using `html2pdf.js`. 
* 🧠 **Powered by GPT-5**: Pre-configured to utilize the lightning-fast, high-accuracy `gpt-5-nano` model via the OpenAI API.

## 🛠 Installation

Because this is a developer build, you will load it into Chrome locally:

1. Clone or download this repository to your computer.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Toggle on **Developer mode** in the top right corner.
4. Click **Load unpacked** in the top left corner.
5. Select the `tos-decoder` directory. 
6. Pin the extension to your toolbar!

## ⚙️ Configuration

Before running your first analysis, you must connect your OpenAI API key:

1. Obtain a secret key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
2. Right-click the **ToS Decoder** extension icon in your Chrome toolbar and select **Options** (or hit the `⚙ Settings` button inside the extension).
3. Paste in your key and click **Save Settings**.
*(Note: Your API key is saved locally in Chrome sync storage and is securely sent exclusively to OpenAI's completion platform.)*

## 📚 How to Use
1. Navigate to any modern Terms of Service or Privacy Policy page (e.g., [Google's Privacy Policy](https://policies.google.com/privacy) or [Instagram's Terms](https://help.instagram.com/581066165581870)).
2. Click the extension icon. It will detect the legal headers and tell you how many words are on the page.
3. Click **Decode This Document**.
4. Review the parsed findings, check out the Confidence Score at the bottom, and freely export the audit to PDF!

## 💻 Tech Stack
- **Extension Engine**: Manifest V3 (MV3) Architecture
- **Language**: Vanilla JavaScript (ESM Async/Await), HTML5, CSS3
- **Inference**: OpenAI API (`gpt-5-nano` completion targeting)
- **Exporting**: `html2pdf.js`

---
*Disclaimer: ToS Decoder uses artificial intelligence to interpret complex legal vernacular and should not be used as official legal counsel.*
