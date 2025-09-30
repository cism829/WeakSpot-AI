from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any
import json
from app.core.config import settings
from app.core.db import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.quiz import Quiz
from app.models.quiz_item import QuizItem
from app.models.result import Result
from app.models.attempt import Attempt
from app.schemas.quiz_gen import GenerateWithNote, GenerateWithoutNote, QuizOut, QuizItemOut, SubmitPayload
from openai import OpenAI

router = APIRouter(prefix="/quizzes", tags=["quizzes"])


# ---------- OpenAI helpers ----------

def _assert_openai():
    """
    Guard to ensure an API key is configured before calling OpenAI.
    Raises a 400 (client) error if missing to avoid 500s and clarify misconfig.
    """
    if not settings.OPENAI_API_KEY:
        raise HTTPException(status_code=400, detail="OpenAI API key not configured")


def _build_system():
    """
    System message for the model to enforce concise, unambiguous items
    and JSON-only output (the user message further constrains structure).
    """
    return (
        "You are a helpful tutor that writes concise, unambiguous assessment items. "
        "Always return STRICT JSON that matches the provided schema."
    )


def _build_user_prompt(subject: str, difficulty: str, n: int, types: List[str], note_text: str | None = None) -> str:
    """
    Build a detailed user message instructing the model to produce a strict JSON object:
    {
        "items": [ ... n items ... ]
    }
    - Each item is one of the allowed type templates below.
    - If note_text is provided, it is included as contextual content.
    - We use doubled-braces {{ }} so f-string formatting doesn't treat braces as placeholders.
    """
    # Canonical JSON templates describing each item "shape"
    type_desc = {
        "mcq": (
            '{ "type":"mcq", "question":"...", "choices":["A","B","C","D"], '
            '"answer_index": 0, "explanation":"..." }'
        ),
        "short_answer": (
            '{ "type":"short_answer", "question":"...", '
            '"answer_text":"concise expected answer", "explanation":"..." }'
        ),
        "fill_blank": (
            '{ "type":"fill_blank", "question":"Use __ to complete the sentence", '
            '"answer_text":"word or phrase", "explanation":"..." }'
        ),
        "true_false": (
            '{ "type":"true_false", "question":"...", '
            '"answer_text":"True" | "False", "explanation":"..." }'
        ),
    }

    # Restrict the "one_of" list to the requested types only
    allowed_join = ", ".join(type_desc[t] for t in types)

    # Optional notes context block—only appended if provided
    note_clause = f"\nContext (from student notes):\n{note_text}\n" if note_text else ""
    types_list = ", ".join(types)

    # JSON "schema-like" hint for the LLM. Doubled braces render literal braces.
    # Only {allowed_join} is interpolated by the f-string.
    schema = (
        "{{\n"
        '  "items": [\n'
        "    {{ \"one_of\": [\n"
        f"      {allowed_join}\n"
        "    ]}}\n"
        "  ]\n"
        "}}\n"
    )

    # Final composed instruction
    return (
        f"Create {n} {difficulty} {subject} questions across these item types: {types_list}.\n"
        f"{note_clause}"
        "Return STRICT JSON with this schema:\n"
        f"{schema}\n"
        "Rules:\n"
        f"- Questions must be solvable without external info beyond common {subject} knowledge and any provided context.\n"
        "- MCQ uses exactly 4 choices.\n"
        '- True/False uses the words "True" or "False" in answer_text.\n'
        "- Keep explanations brief, 1–2 sentences max.\n"
    )


def _openai_generate(subject: str, difficulty: str, n: int, types: List[str], note_text: str | None = None):
    """
    Call OpenAI Chat Completions to generate items; then parse and normalize them
    into a consistent internal structure suitable for persistence.

    Returns: List[dict] items with keys:
        - type: "mcq" | "short_answer" | "fill_blank" | "true_false"
        - question: str
        - choices: Optional[List[str]] (MCQ only; trimmed to 4)
        - answer_index: Optional[int] (MCQ only)
        - answer_text: Optional[str] (non-MCQ)
        - explanation: Optional[str]
    """
    _assert_openai()
    client = OpenAI(api_key=settings.OPENAI_API_KEY)

    try:
        # Ask for strict JSON with response_format={"type": "json_object"} to reduce parsing issues
        resp = client.chat.completions.create(
            model=settings.OPENAI_MODEL or "gpt-4o-mini",
            temperature=0.4,  # mild creativity; keeps answers deterministic enough
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": _build_system()},
                {"role": "user", "content": _build_user_prompt(subject, difficulty, n, types, note_text)},
            ],
            timeout=60,  # seconds
        )

        # Extract and JSON-parse the content
        content = resp.choices[0].message.content or "{}"
        data = json.loads(content)

        # Expect an object with an "items" array
        items = data.get("items", [])
        if not isinstance(items, list) or not items:
            raise ValueError("No items produced")

        # Normalize into our internal structure
        out = []
        for it in items[:n]:
            t = it.get("type", "mcq")
            q = (it.get("question") or "").strip()
            exp = (it.get("explanation") or "").strip()
            if not q:
                # Skip empty questions
                continue

            if t == "mcq":
                # For MCQ, ensure we have at least 2 choices (preferably 4)
                ch = it.get("choices") or []
                if not isinstance(ch, list) or len(ch) < 2:
                    continue
                # Clamp answer_index safely within range
                ai = it.get("answer_index", 0)
                try:
                    ai = int(ai)
                except Exception:
                    ai = 0
                ai = max(0, min(ai, len(ch) - 1))

                out.append({
                    "type": "mcq",
                    "question": q,
                    "choices": ch[:4],  # enforce max 4 choices
                    "answer_index": ai,
                    "answer_text": None,
                    "explanation": exp
                })

            elif t in ("short_answer", "fill_blank", "true_false"):
                # Non-MCQ types must provide an answer_text
                ans = (it.get("answer_text") or "").strip()
                if not ans:
                    continue
                out.append({
                    "type": t,
                    "question": q,
                    "choices": None,
                    "answer_index": None,
                    "answer_text": ans,
                    "explanation": exp
                })

        # Debug log for server console
        print(f"Normalized items: {out}")

        if not out:
            raise ValueError("All items invalid after normalization")
        return out

    except Exception as e:
        # Wrap any error as a 502 to indicate upstream (OpenAI) issue to the client
        raise HTTPException(status_code=502, detail=f"OpenAI error: {e}")


# ---------- Create Quiz + persist items ----------

def _persist_quiz_and_items(
    db: Session, *, user_id: int, note_id: int | None, subject: str,
    difficulty: str, mode: str, types: List[str], items: List[dict], source: str
) -> int:
    """
    Create a Quiz row and its associated QuizItem rows in a single transaction.

    Returns: newly created quiz ID.
    """
    q = Quiz(
        owner_id=user_id,  # NOTE: uses owner_id here
        note_id=note_id,
        title=f"{subject.title()} Quiz",
        difficulty=difficulty,
        mode=mode,
        source=source,
        types=",".join(types) if types else None
    )
    db.add(q)
    db.flush()  # obtains q.id without committing yet

    # Persist each generated item
    for it in items:
        db.add(QuizItem(
            quiz_id=q.id,
            type=it["type"],
            question=it["question"],
            choices=(json.dumps(it["choices"]) if it.get("choices") else None),
            answer_index=it.get("answer_index"),
            answer_text=it.get("answer_text"),
            explanation=it.get("explanation"),
        ))

    # Commit both quiz and items atomically
    db.commit()
    return q.id


# ---------- Endpoints ----------

@router.post("/generate-ai")
def generate_ai(payload: GenerateWithoutNote, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Generate a quiz using AI *without* note context, then persist it.
    Body: GenerateWithoutNote (subject, difficulty, num_items, types, mode, user_id).
    Response: {"quiz_id": int}
    """
    items = _openai_generate(
        subject=payload.subject,
        difficulty=payload.difficulty,
        n=payload.num_items,
        types=payload.types,
        note_text=None
    )
    print(1)  # debug marker

    quiz_id = _persist_quiz_and_items(
        db,
        user_id=payload.user_id, note_id=None, subject=payload.subject,
        difficulty=payload.difficulty, mode=payload.mode, types=payload.types,
        items=items, source="ai_general"
    )
    print(2)  # debug marker

    return {"quiz_id": quiz_id}


@router.post("/generate-ai-from-note")
def generate_ai_from_note(payload: GenerateWithNote, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Generate a quiz using AI *with* note context (from a notes table).
    - Reads note content via a parameterized raw SQL SELECT.
    - Consider replacing with ORM if a Note model exists.
    """
    # Fetch note content (parameterized to avoid SQL injection)
    note = db.execute("SELECT content FROM notes WHERE id=:nid", {"nid": payload.note_id}).fetchone()
    note_text = note[0] if note else ""

    # Generate with note context
    items = _openai_generate(
        subject=payload.subject,
        difficulty=payload.difficulty,
        n=payload.num_items,
        types=payload.types,
        note_text=note_text or None
    )

    # Persist and return quiz id
    quiz_id = _persist_quiz_and_items(
        db,
        user_id=payload.user_id, note_id=payload.note_id, subject=payload.subject,
        difficulty=payload.difficulty, mode=payload.mode, types=payload.types,
        items=items, source="ai_note"
    )
    return {"quiz_id": quiz_id}


def _quiz_to_dict(q: Quiz) -> Dict[str, Any]:
    """
    Utility to convert a Quiz ORM object into a simple dict.
    NOTE: Not used by the endpoints below (kept for convenience/future use).
    """
    return {
        "id": q.id, "title": q.title, "difficulty": q.difficulty, "mode": q.mode,
        "source": q.source, "types": q.types, "created_at": str(q.created_at)
    }


@router.get("/mine")
def list_my_quizzes(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """
    List the current user's quizzes split into "practice" and "exam",
    plus attach simple stats (attempt count, best score, last taken).

    IMPORTANT:
    - TODO: This filter uses Quiz.user_id, but creation uses owner_id.
        Align to your model field names (use Quiz.owner_id == user.id if that's the column).
    """
    # TODO (likely fix): change Quiz.user_id -> Quiz.owner_id if your model uses owner_id
    quizzes = db.query(Quiz).filter(Quiz.user_id == user.id).order_by(Quiz.created_at.desc()).all()

    # Aggregate results to compute attempts/best/last_taken
    stats = (
        db.query(
            Result.quiz_id,
            func.count(Result.id).label("attempts"),
            func.max(Result.score).label("best_score"),
            func.max(Result.taken_at).label("last_taken_at"),
        )
        .filter(Result.user_id == user.id)
        .group_by(Result.quiz_id)
        .all()
    )

    # Map quiz_id -> stats dict for quick lookup
    s_map = {
        qid: {
            "attempts": att,
            "best_score": best,
            "last_taken_at": str(last) if last else None
        }
        for (qid, att, best, last) in stats
    }

    # Pack a quiz row into response-friendly dict with attached stats
    def pack(q: Quiz) -> Dict[str, Any]:
        st = s_map.get(q.id, {})
        return {
            "id": q.id,
            "title": q.title,
            "mode": q.mode,
            "difficulty": q.difficulty,
            "created_at": str(q.created_at),
            "attempts": st.get("attempts", 0),
            "best_score": st.get("best_score"),
            "last_taken_at": st.get("last_taken_at"),
        }

    # Split by mode, default to practice when mode is missing or not "exam"
    practice, exam = [], []
    for q in quizzes:
        (exam if (q.mode or "").lower() == "exam" else practice).append(pack(q))

    return {"practice": practice, "exam": exam}


@router.get("/{quiz_id}", response_model=QuizOut)
def get_quiz(quiz_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """
    Fetch a single quiz (owned by current user) with its items.
    Returns a QuizOut Pydantic model (items include parsed choices).
    """
    # IMPORTANT / same note as above about owner_id vs user_id
    q = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == user.id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Quiz not found")

    return QuizOut(
        id=q.id, title=q.title, difficulty=q.difficulty, mode=q.mode, created_at=str(q.created_at),
        items=[
            QuizItemOut(
                id=qi.id, question=qi.question, type=qi.type,
                choices=(json.loads(qi.choices) if qi.choices else None),
                explanation=qi.explanation
            )
            for qi in q.items
        ]
    )


@router.post("/{quiz_id}/start")
def start_practice(quiz_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """
    Start a practice attempt. First attempt awards coins; subsequent calls do not.
    Uses settings.COIN_PER_QUIZ to increment both coins_balance and coins_earned_total.
    """
    # IMPORTANT / same note as above about owner_id vs user_id
    q = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == user.id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Quiz not found")

    # If an attempt already exists for this user/quiz, don't award coins again
    existed = db.query(Attempt).filter(Attempt.user_id == user.id, Attempt.quiz_id == quiz_id).first()
    if existed:
        return {
            "ok": True, "awarded": False,
            "coins_balance": user.coins_balance,
            "coins_earned_total": user.coins_earned_total
        }

    # Create first attempt and award coins
    att = Attempt(quiz_id=quiz_id, user_id=user.id)
    db.add(att)
    user.coins_earned_total = (user.coins_earned_total or 0) + settings.COIN_PER_QUIZ
    user.coins_balance = (user.coins_balance or 0) + settings.COIN_PER_QUIZ
    db.commit()

    return {
        "ok": True, "awarded": True,
        "coins_balance": user.coins_balance,
        "coins_earned_total": user.coins_earned_total
    }


@router.post("/{quiz_id}/submit")
def submit_quiz(quiz_id: int, payload: SubmitPayload, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """
    Submit a finished quiz:
        - Persist a Result (score + time spent)
        - Increment user's total_points by rounded score
        - Return updated totals (coins are unchanged here)
    """
    # IMPORTANT / same note as above about owner_id vs user_id
    q = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == user.id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Quiz not found")

    # Save result
    r = Result(quiz_id=quiz_id, user_id=user.id, score=payload.score, time_spent_sec=payload.time_spent_sec)
    db.add(r)

    # Add score to total points (rounded to int)
    user.total_points = (user.total_points or 0) + int(round(payload.score or 0))

    db.commit()

    return {
        "ok": True,
        "coins_earned_total": user.coins_earned_total,
        "coins_balance": user.coins_balance,
        "total_points": user.total_points
    }
