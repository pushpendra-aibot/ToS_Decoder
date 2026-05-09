import os
import json
from datetime import datetime
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from langchain_openai import ChatOpenAI
from duckduckgo_search import DDGS
from langchain_core.tools import tool
from langchain_core.prompts import ChatPromptTemplate
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.callbacks import BaseCallbackHandler

import requests
from bs4 import BeautifulSoup

app = FastAPI()

# Allow CORS for Chrome Extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeRequest(BaseModel):
    text: str
    title: str
    apiKey: str

# --- Custom Callback Handler for Logging ---
class FileLoggingCallbackHandler(BaseCallbackHandler):
    def __init__(self, filename="agent_logs.txt"):
        self.filename = filename

    def log(self, message: str):
        with open(self.filename, "a", encoding="utf-8") as f:
            f.write(f"[{datetime.now().isoformat()}] {message}\n")

    def on_llm_start(self, serialized: Dict[str, Any], prompts: List[str], **kwargs: Any):
        # We don't print the huge prompt text anymore
        self.log(f"🧠 LLM Thinking... (Processing {len(prompts[0]) if prompts else 0} characters)")

    def on_llm_end(self, response: Any, **kwargs: Any):
        self.log(f"✅ LLM Finished Thinking.")

    def on_tool_start(self, serialized: Dict[str, Any], input_str: str, **kwargs: Any):
        tool_name = serialized.get("name", "unknown")
        self.log(f"🛠️ Tool '{tool_name}' Started. Input: {input_str}")

    def on_tool_end(self, output: str, **kwargs: Any):
        self.log(f"🏁 Tool Ended. Output snippet: {output[:150]}...")

# --- Tools ---
@tool
def search_tool(query: str) -> str:
    """Searches the web using DuckDuckGo. Use this to find recent news, lawsuits, or controversies about a company."""
    try:
        results = DDGS().text(query, max_results=3)
        if not results:
            return "No results found."
        return "\n".join([f"[{r['title']}]({r['href']}): {r['body']}" for r in results])
    except Exception as e:
        return f"Error searching: {str(e)}"

@tool
def scrape_url(url: str) -> str:
    """Scrapes the main text content from a given URL. Use this to follow links found in the ToS."""
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")
        
        # Remove script and style elements
        for script in soup(["script", "style", "nav", "footer", "header"]):
            script.extract()
            
        text = soup.get_text(separator=' ', strip=True)
        return text[:10000] # Return first 10000 chars to avoid overwhelming context
    except Exception as e:
        return f"Error scraping URL: {str(e)}"

tools = [search_tool, scrape_url]

# --- Prompt ---
SYSTEM_PROMPT = """You are an elite legal analyst and privacy rights advocate.
Your job is to read Terms of Service or Privacy Policies, optionally research the company's recent controversies using DuckDuckGo, and optionally scrape any relevant linked legal policies to form a complete picture.

After your research and analysis, you MUST output valid JSON and nothing else.

Respond with exactly this JSON structure:
{{
  "riskRating": "low" | "medium" | "high",
  "riskReason": "One sentence explaining the overall risk level, referencing your research if applicable.",
  "summary": "2-3 sentence plain English summary of what this document is about.",
  "dataCollected": [
    {{ "item": "What data", "detail": "How it is used", "severity": "low|medium|high" }}
  ],
  "rightsWaived": [
    {{ "item": "Right or protection given up", "detail": "What this means for you", "severity": "low|medium|high" }}
  ],
  "autoRenewals": [
    {{ "item": "Auto-renewal or billing clause", "detail": "What triggers it and how to cancel" }}
  ],
  "dataSharingThirdParties": [
    {{ "item": "Who data is shared with", "detail": "For what purpose" }}
  ],
  "redFlags": [
    {{ "flag": "Specific concerning clause in plain English or from your research", "severity": "medium|high" }}
  ],
  "positives": [
    "One positive thing this document does for users"
  ],
  "tldr": "One sentence. What does agreeing to this actually mean for a regular person?"
}}

Rules:
- If a section has nothing to report, return an empty array []
- No markdown formatting outside the JSON block. Do not wrap with ```json.
"""

prompt = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT),
    ("user", "Document: {title}\\nText: {text}\\n\\nPlease analyze this and use tools if necessary. Output JSON only at the end."),
    ("placeholder", "{agent_scratchpad}"),
])

@app.post("/analyze")
async def analyze_endpoint(request: AnalyzeRequest):
    try:
        # We write a prominent log at the start of the request
        with open("agent_logs.txt", "a", encoding="utf-8") as f:
            f.write(f"\n{'='*50}\n[{datetime.now().isoformat()}] NEW ANALYSIS REQUEST FOR: {request.title}\n{'='*50}\n")
            
        llm = ChatOpenAI(
            model="gpt-4o-mini", # Standard fallback
            temperature=0.2,
            api_key=request.apiKey,
        )
        
        agent = create_tool_calling_agent(llm, tools, prompt)
        agent_executor = AgentExecutor(
            agent=agent, 
            tools=tools, 
            verbose=True,
        )
        
        callbacks = [FileLoggingCallbackHandler("agent_logs.txt")]
        
        result = agent_executor.invoke(
            {
                "title": request.title,
                "text": request.text
            },
            config={"callbacks": callbacks}
        )
        
        output = result['output']
        # Remove any potential markdown json block if LLM ignored instructions
        if output.startswith("```json"):
            output = output.replace("```json", "", 1)
        if output.endswith("```"):
            output = output.rsplit("```", 1)[0]
            
        parsed_json = json.loads(output.strip())
        return parsed_json
        
    except Exception as e:
        with open("agent_logs.txt", "a", encoding="utf-8") as f:
            f.write(f"[ERROR] {str(e)}\n")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
