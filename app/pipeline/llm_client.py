import json

import httpx

from app import config

GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/"
    f"{config.GEMINI_MODEL}:generateContent?key={config.GEMINI_API_KEY}"
)
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


async def _call_gemini(system: str, user: str) -> str:
    body = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"parts": [{"text": user}]}],
        "generationConfig": {"responseMimeType": "application/json"},
    }
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(GEMINI_URL, json=body)
        resp.raise_for_status()
        data = resp.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]


async def _call_groq(system: str, user: str) -> str:
    headers = {"Authorization": f"Bearer {config.GROQ_API_KEY}"}
    body = {
        "model": config.GROQ_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "response_format": {"type": "json_object"},
    }
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(GROQ_URL, json=body, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


async def call_llm_json(system: str, user: str) -> dict:
    """Provider-agnostic JSON call: Gemini first, Groq on failure/429."""
    try:
        text = await _call_gemini(system, user)
    except (httpx.HTTPStatusError, httpx.RequestError, KeyError, IndexError):
        text = await _call_groq(system, user)
    return json.loads(text)
