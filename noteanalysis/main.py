import json
from .config import (
    SUBJECT, INPUT_TXT, OUTPUT_OCR_REPAIRS_JSON, OUTPUT_REPAIRED,
    OUTPUT_FLAGS_TXT, OUTPUT_FLAGS_JSON, WINDOW_MAX_CHARS, WINDOW_OVERLAP_BLOCKS
)
from .io_utils import read_text_file, render_flags_text
from .ocr_repair import repair_ocr_gaps
from .parsing import split_by_rule_headings, merge_soft_wraps_keep_paragraphs, parse_blocks_spacy
from .llm_calls import summarize_notes, parse_main_subject, mini_summary, accuracy_check_with_context, whole_def, contextual_summarize_block
from .windows import sliding_windows, merge_flags

def enrich_blocks(blocks):
    from .parsing import classify_block
    from .llm_calls import whole_def, contextual_summarize_block
    enriched = []
    for b in blocks:
        b_type = classify_block(b)
        if b_type == "definition":
            enriched.append(b + " " + whole_def(b, SUBJECT))
        elif b_type in ("enumeration", "concept"):
            summary = contextual_summarize_block(b, SUBJECT)
            enriched.append(b + "\n\nContextual summary:\n" + summary)
        else:
            enriched.append(b)
    return enriched

def main():
    original_text = read_text_file(INPUT_TXT)

    # 1) OCR gap repair
    repaired_text, ocr_log = repair_ocr_gaps(original_text, SUBJECT)
    if ocr_log:
        OUTPUT_OCR_REPAIRS_JSON.parent.mkdir(parents=True, exist_ok=True)
        with OUTPUT_OCR_REPAIRS_JSON.open("w", encoding="utf-8") as jf:
            json.dump(ocr_log, jf, ensure_ascii=False, indent=2)
    original_text = repaired_text

    # 2) spaCy-driven parsing into blocks
    rule_blocks = split_by_rule_headings(original_text)
    if len(rule_blocks) > 1:
        blocks = [merge_soft_wraps_keep_paragraphs(b) for b in rule_blocks]
    else:
        blocks = parse_blocks_spacy(original_text)

    # 3) Repair/Enrich blocks
    repaired_blocks = enrich_blocks(blocks)

    # 4) Sliding windows for accuracy checking
    windows = sliding_windows(repaired_blocks, max_chars=WINDOW_MAX_CHARS, overlap_blocks=WINDOW_OVERLAP_BLOCKS)

    # 5) Global summary & title
    global_summary = summarize_notes("\n\n".join(repaired_blocks))
    main_subject = parse_main_subject(global_summary) or SUBJECT

    # 6) Accuracy checks with context carry-over
    all_windows_flags = []
    prev_context_summary = None

    for w in windows:
        flags = accuracy_check_with_context(
            text=w,
            subject=SUBJECT,
            global_title=main_subject,
            prior_summary=prev_context_summary
        )
        all_windows_flags.append(flags)
        prev_context_summary = mini_summary(w)

    # 7) Merge & dedup flags
    merged_flags = merge_flags(all_windows_flags)

    # 8) Write outputs
    OUTPUT_REPAIRED.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_REPAIRED.open("w", encoding="utf-8") as f:
        for blk in repaired_blocks:
            f.write(blk + "\n\n")
        f.write("Summary\n")
        f.write(global_summary.strip() + "\n")

    OUTPUT_FLAGS_TXT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_FLAGS_TXT.open("w", encoding="utf-8") as f:
        f.write(render_flags_text(merged_flags))

    with OUTPUT_FLAGS_JSON.open("w", encoding="utf-8") as jf:
        json.dump(merged_flags, jf, ensure_ascii=False, indent=2)

    print("Done.")
    print(f"- Repaired notes: {OUTPUT_REPAIRED}")
    print(f"- Suggestions (txt): {OUTPUT_FLAGS_TXT}")
    print(f"- Suggestions (json): {OUTPUT_FLAGS_JSON}")
    if ocr_log:
        print(f"- OCR repair log: {OUTPUT_OCR_REPAIRS_JSON}")

if __name__ == "__main__":
    main()
