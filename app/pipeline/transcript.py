import json

from app.pipeline.llm_client import call_llm_json

SYSTEM = (
    "You are writing a 3-person classroom discussion transcript from a lesson "
    "outline JSON and a list of generated slides. Speakers:\n"
    "- teacher: calm, explains clearly, drives the lesson forward.\n"
    "- student_edgy (named Pooja, a sharp girl): skeptical, pushes back and asks "
    "clever follow-up or 'but why does that actually matter' questions.\n"
    "- student_quirky (named Prabhat, a naive boy): asks the obvious/basic "
    "questions, occasionally makes a lighthearted joke or odd analogy.\n"
    "The teacher and students should address each other by name (Pooja, Prabhat) "
    "at least a few times, like a real classroom conversation.\n"
    "CRITICAL:\n"
    "1. Whenever a student turn asks a question, the very next turn must "
    "be the teacher directly answering that specific question before the "
    "discussion moves on — never let a question go unanswered or get skipped "
    "past.\n"
    "2. For each turn, output a `slide_ref` which is the 1-based index of the slide "
    "from the provided `slides` list that this turn explains or is associated with. "
    "Do NOT use outline sections; map directly to the 1-based index of the slides "
    "provided (i.e. 1, 2, 3, etc.). Ensure the conversation moves sequentially through "
    "all the slides, ending on the final summary slide.\n"
    "Cover every slide in order, with all three speakers participating throughout.\n"
    "Respond with ONLY JSON, no markdown fences, matching:\n"
    '{"turns": [{"speaker": "teacher"|"student_edgy"|"student_quirky", "text": str, "slide_ref": int}]}'
)


async def build_transcript(outline: dict, slides: dict) -> dict:
    combined = {
        "outline": outline,
        "slides": slides.get("slides", [])
    }
    return await call_llm_json(SYSTEM, json.dumps(combined))
