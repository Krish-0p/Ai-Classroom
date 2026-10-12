import json

from app.pipeline.llm_client import call_llm_json

SYSTEM = (
    "You are a slide content writer. Given a lesson outline JSON, produce a JSON "
    'object {"slides": [...]} where each slide uses one of these templates and '
    "shapes:\n"
    '- {"template": "title", "heading": str, "subheading": str}\n'
    '- {"template": "concept", "heading": str, "bullets": [str]}\n'
    '- {"template": "example", "heading": str, "body": str}\n'
    '- {"template": "comparison", "heading": str, "left_label": str, '
    '"left_points": [str], "right_label": str, "right_points": [str]}\n'
    '- {"template": "summary", "heading": str, "bullets": [str]}\n'
    "Start with one title slide and end with one summary slide. Use concept and "
    "example slides for each section. Respond with ONLY JSON, no markdown fences."
)


async def build_slides(outline: dict) -> dict:
    return await call_llm_json(SYSTEM, json.dumps(outline))
