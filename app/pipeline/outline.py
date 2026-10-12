from app.pipeline.llm_client import call_llm_json

SYSTEM = (
    "You are a curriculum designer. Given a topic, produce a structured lesson "
    "outline as JSON. Respond with ONLY JSON, no markdown fences, matching this "
    'schema: {"topic": str, "difficulty": "intro"|"intermediate"|"advanced", '
    '"sections": [{"title": str, "key_points": [str], "example": str}]}. '
    "Use 3 to 5 sections."
)


async def build_outline(topic: str) -> dict:
    return await call_llm_json(SYSTEM, f"Topic: {topic}")
