from jinja2 import Environment, FileSystemLoader

from app import config

_env = Environment(loader=FileSystemLoader(str(config.TEMPLATES_DIR)))

_DOC = """<!doctype html>
<html><head><meta charset="utf-8"><style>{style}</style></head>
<body><div class="deck">{slides}</div></body></html>"""

_STYLE = (config.BASE_DIR / "templates" / "deck.css").read_text(encoding="utf-8")


def render_slides(slides: dict) -> str:
    """Render each slide's JSON into its fixed template, concatenated into one deck."""
    parts = []
    for slide in slides["slides"]:
        template = _env.get_template(f"slide_{slide['template']}.html")
        parts.append(template.render(**slide))
    return _DOC.format(style=_STYLE, slides="\n".join(parts))
