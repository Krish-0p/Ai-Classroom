import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# ponytail: key lives under GEMINI_MODEL_API in .env; accept GEMINI_API_KEY too.
GEMINI_API_KEY = os.getenv("GEMINI_MODEL_API") or os.getenv("GEMINI_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GROQ_MODEL = "llama-3.3-70b-versatile"

VOICES = {
    "teacher": "en-IN-NeerjaExpressiveNeural",
    "student_edgy": "en-HK-YanNeural",
    "student_quirky": "en-IN-PrabhatNeural",
}

NAMES = {
    "teacher": "Teacher",
    "student_edgy": "Pooja",
    "student_quirky": "Prabhat",
}

BASE_DIR = Path(__file__).parent
STORAGE_DIR = BASE_DIR / "storage"
TEMPLATES_DIR = BASE_DIR / "templates"
STORAGE_DIR.mkdir(exist_ok=True)
