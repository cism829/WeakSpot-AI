from pathlib import Path
from typing import List, Dict, Any

def read_text_file(path: Path) -> str:
    with path.open("r", encoding="utf-8") as f:
        return f.read()

def render_flags_text(flags: List[Dict[str, Any]]) -> str:
    if not flags:
        return "Inaccuracy Flags:\nNone found."
    lines = ["Inaccuracy Flags:"]
    for i, f in enumerate(flags, 1):
        quote = f.get("quote", "").strip()
        issue = f.get("issue", "").strip()
        why = f.get("why", "").strip()
        fix = f.get("suggested_fix", "").strip()
        loc = f.get("location", "").strip()
        lines.append(f"{i}. Quote: {quote!r}")
        lines.append(f"   Issue: {issue}")
        lines.append(f"   Why: {why}")
        lines.append(f"   Suggested fix: {fix}")
        if loc:
            lines.append(f"   Location: {loc}")
        lines.append("")
    return "\n".join(lines)
