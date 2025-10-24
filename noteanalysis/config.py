import os
import re
from pathlib import Path
from dotenv import load_dotenv
import spacy
from openai import OpenAI

load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY is not set in environment.")
client = OpenAI(api_key=OPENAI_API_KEY)


nlp = spacy.load("en_core_web_sm")

# ----------------------- cfg -----------------------
PKG_DIR = Path(__file__).resolve().parent

SUBJECT = "computer science"

INPUT_TXT = PKG_DIR / "example_notes" / "example3.txt"

OUTPUT_REPAIRED = PKG_DIR / "ai_results" / "presentation_example3.txt"
OUTPUT_FLAGS_TXT = PKG_DIR / "ai_results" / "presentation_suggestions3.txt"
OUTPUT_FLAGS_JSON = PKG_DIR / "ai_results" / "presentation_suggestions3.json"
OUTPUT_OCR_REPAIRS_JSON = PKG_DIR / "ai_results" / "ocr_repairs3.json"

MODEL_SUMMARY = "gpt-4o-mini"
MODEL_DEFINITION = "gpt-4o-mini"
MODEL_ACCURACY = "gpt-4o"   # 4o for stricter checking
MODEL_OCR_REPAIR = "gpt-4o-mini"

TEMPERATURE_DEFAULT = 0
MAX_TOKENS_SUMMARY = 200
MAX_TOKENS_DEFINITION = 180
MAX_TOKENS_ACCURACY = 800
MAX_TOKENS_MINI_SUMMARY = 80

WINDOW_MAX_CHARS = 2800
WINDOW_OVERLAP_BLOCKS = 1
TARGET_BLOCK_CHARS = 600
HEADING_MAX_TOKENS = 8  # <= this many tokens and no verb = heading-like

#----------------------- ocr repair constants -----------------------
MAX_TOKENS_OCR_REPAIR = 260
BANNED_LOW_VALUE = {"unknown"}
MEANINGFUL_MIN_ALPHAS = 3

# parsing regex
LIST_LINE = re.compile(r"^\s*([-\u2022\u2023\u25E6\*\u2219]|\d+[\.)])\s+")
RULE_HEADING = re.compile(r"^\s*Rule\s*\d+\s*:", re.IGNORECASE)
