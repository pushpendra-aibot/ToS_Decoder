# 🔍 ToS Decoder

<p align="center">
  <a href="[INSERT_YOUTUBE_LINK_HERE]">
    <img src="assets/tos_thumbnail.png" alt="Watch ToS Decoder on YouTube" width="700">
  </a>
</p>

<p align="center">
  📺 <strong><a href="[https://www.youtube.com/watch?v=fS1mu7xIo3E]">Watch the full video breakdown on YouTube!</a></strong>
</p>

**ToS Decoder** is an agentic Chrome Extension that uses AI to instantly read and decode any Terms of Service, Privacy Policy, or End-User License Agreement (EULA) into plain English. 

Never blindly agree to terms again without knowing exactly what data you are giving up, what rights you are waiving, and your genuine risk exposure!

## ✨ Features

* 🚀 **Instant Analysis**: Automatically detects ToS pages and parses dense legal jargon in seconds.
* 🤖 **Agentic Reasoning (LangChain)**: The extension is backed by a local Python agent equipped with specific tools:
  * 🌐 **Web Search (DuckDuckGo)**: Scours the web for recent controversies or data-privacy lawsuits involving the company.
  * 🔗 **Web Scraper (BeautifulSoup)**: Follows linked policies to fetch more context.
* 🛡️ **Risk Profiling**: Provides a strict baseline risk rating (🟢 Low / 🟡 Medium / 🔴 High).
* 🚩 **Red Flag Extraction**: Plainly surfaces aggressive clauses, ridiculous data collection specs, and auto-renewal traps.
* 📝 **Live Action Logging**: The agent transparently logs its step-by-step thoughts and tool executions locally to `agent_logs.txt`.
* 📄 **Native PDF Export**: Saves the entire evaluated legal audit to a neat, high-quality PDF to keep for your records using `html2pdf.js`. 

## 🛠 Installation

Because this utilizes a local Python backend alongside the extension, installation is a two-part process:

### 1. Start the Python Agent (Backend)
1. Navigate into the `tos-agent` directory.
2. Activate your virtual environment and install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Start the FastAPI server:
   ```bash
   uvicorn main:app --port 8000
   ```
   *The server must be running locally for the extension to analyze documents.*

### 2. Load the Chrome Extension (Frontend)
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Toggle on **Developer mode** in the top right corner.
3. Click **Load unpacked** in the top left corner.
4. Select the `tos-decoder` root directory. 
5. Pin the extension to your toolbar!

## ⚙️ Configuration

Before running your first analysis, you must connect your OpenAI API key:

1. Obtain a secret key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
2. Right-click the **ToS Decoder** extension icon in your Chrome toolbar and select **Options** (or hit the `⚙ Settings` button inside the extension).
3. Paste in your key and click **Save Settings**.
*(Note: Your API key is saved locally in Chrome sync storage and securely passed to your local Python backend to authenticate the agent.)*

## 📚 How to Use
1. Ensure your local `uvicorn` server is running.
2. Navigate to any modern Terms of Service or Privacy Policy page (e.g., [Google's Privacy Policy](https://policies.google.com/privacy)).
3. Click the extension icon and select **Decode This Document**.
4. Check your VS Code terminal or the `agent_logs.txt` file to watch the agent actively scrape, search, and reason in real-time!
5. Review the parsed findings directly in the extension and export the audit to PDF!

## 💻 Tech Stack
- **Frontend / Extension Engine**: Manifest V3 (MV3), Vanilla JS, HTML/CSS
- **Backend API**: Python, FastAPI, Uvicorn
- **AI Agent Framework**: LangChain, OpenAI (`gpt-4o-mini`)
- **Tools**: `duckduckgo-search`, `beautifulsoup4`, `requests`
- **Exporting**: `html2pdf.js`

---
*Disclaimer: ToS Decoder uses artificial intelligence to interpret complex legal vernacular and should not be used as official legal counsel.*
