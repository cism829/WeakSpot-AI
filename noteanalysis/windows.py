from typing import List, Dict, Any

# packs blocks into windows with overlap for context carry-over
def sliding_windows(blocks: List[str], max_chars: int, overlap_blocks: int) -> List[str]:
    windows: List[str] = []
    cur: List[str] = []
    cur_len = 0
    for b in blocks:
        b_len = len(b) + 2
        if cur and cur_len + b_len > max_chars:
            windows.append("\n\n".join(cur))
            cur = cur[-overlap_blocks:] if overlap_blocks > 0 else []
            cur_len = sum(len(x) for x in cur) + 2 * len(cur)
        cur.append(b)
        cur_len += b_len
    if cur:
        windows.append("\n\n".join(cur))
    return windows

# each window produces a list of flags; merge and remove duplicates
def merge_flags(all_flags: List[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    seen = set()
    merged: List[Dict[str, Any]] = []
    for arr in all_flags:
        for item in arr:
            key = (item.get("quote", ""), item.get("issue", ""), item.get("suggested_fix", ""))
            if key not in seen:
                merged.append(item)
                seen.add(key)
    return merged
