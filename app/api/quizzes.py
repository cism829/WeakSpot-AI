from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Any, Dict, List
from sqlalchemy import func
import json

from app.core.config import settings
from app.core.db import get_db  # or app.db.session.get_db if that's your project
from app.models.quiz import Quiz
from app.models.quiz_item import QuizItem
from app.models.result import Result
from openai import OpenAI

from app.schemas.quiz_gen import (
    GenerateWithoutNote, GenerateWithNote, QuizOut, QuizItemOut, SubmitPayload
)

router = APIRouter(prefix="/quizzes", tags=["quizzes"])

# ---------- OpenAI helpers ----------
def _assert_openai():
    if not settings.OPENAI_API_KEY:
        raise HTTPException(status_code=400, detail="OpenAI API key not configured")

def _build_system():
    return (
        "You are a helpful tutor that writes concise, unambiguous assessment items. "
        "Always return STRICT JSON that matches the provided schema."
    )

def _build_user_prompt(subject: str, difficulty: str, n: int, types: List[str], note_text: str | None = None) -> str:
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

    allowed_join = ", ".join(type_desc[t] for t in types)
    note_clause = f"\nContext (from student notes):\n{note_text}\n" if note_text else ""
    types_list = ", ".join(types)

    # Build the schema with doubled braces for literals; only {allowed_join} is an f-expression
    schema = (
        "{{\n"
        '  "items": [\n'
        "    {{ \"one_of\": [\n"
        f"      {allowed_join}\n"
        "    ]}}\n"
        "}}\n"
    )

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
def _build_user_prompt(subject: str, difficulty: str, n: int, types: List[str], note_text: str | None = None) -> str:
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

    allowed_join = ", ".join(type_desc[t] for t in types)
    note_clause = f"\nContext (from student notes):\n{note_text}\n" if note_text else ""
    types_list = ", ".join(types)

    # Build the schema with doubled braces for literals; only {allowed_join} is an f-expression
    schema = (
        "{{\n"
        '  "items": [\n'
        "    {{ \"one_of\": [\n"
        f"      {allowed_join}\n"
        "    ]}}\n"
        "}}\n"
    )

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
    _assert_openai()
    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    
    try:
        resp = client.chat.completions.create(
            model=settings.OPENAI_MODEL or "gpt-4o-mini",
            temperature=0.4,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": _build_system()},
                {"role": "user", "content": _build_user_prompt(subject, difficulty, n, types, note_text)},
            ],
            timeout=60,
)
        content = resp.choices[0].message.content or "{}"
        data = json.loads(content)
        items = data.get("items", [])
        
        if not isinstance(items, list) or not items:
            raise ValueError("No items produced")
        # basic normalization
        out = []
        
        for it in items[:n]:
            t = it.get("type", "mcq")
            q = (it.get("question") or "").strip()
            exp = (it.get("explanation") or "").strip()
            if not q:
                continue
            if t == "mcq":
                ch = it.get("choices") or []
                if not isinstance(ch, list) or len(ch) < 2:
                    continue
                ai = it.get("answer_index", 0)
                try:
                    ai = int(ai)
                except Exception:
                    ai = 0
                ai = max(0, min(ai, len(ch)-1))
                out.append({
                    "type": "mcq", "question": q, "choices": ch[:4],
                    "answer_index": ai, "answer_text": None, "explanation": exp
                })
            elif t in ("short_answer", "fill_blank", "true_false"):
                ans = (it.get("answer_text") or "").strip()
                if not ans:
                    continue
                out.append({
                    "type": t, "question": q, "choices": None,
                    "answer_index": None, "answer_text": ans, "explanation": exp
                })
                
        print(f"Normalized items: {out}")
        if not out:
            raise ValueError("All items invalid after normalization")
        return out
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"OpenAI error: {e}")

# ---------- Create Quiz + persist items ----------
def _persist_quiz_and_items(
    db: Session, *, user_id: int, note_id: int | None, subject: str,
    difficulty: str, mode: str, types: List[str], items: List[dict], source: str
) -> int:
    q = Quiz(
        owner_id=user_id,
        note_id=note_id,
        title=f"{subject.title()} Quiz",
        difficulty=difficulty,
        mode=mode,
        source=source,
        types=",".join(types) if types else None
    )
    db.add(q)
    db.flush()  # to get q.id

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
    db.commit()
    return q.id

# ---------- Endpoints ----------
@router.post("/generate-ai")
def generate_ai(payload: GenerateWithoutNote, db: Session = Depends(get_db)) -> Dict[str, Any]:
    items = _openai_generate(
        subject=payload.subject,
        difficulty=payload.difficulty,
        n=payload.num_items,
        types=payload.types,
        note_text=None
    )
    print(1)
    quiz_id = _persist_quiz_and_items(
        db,
        user_id=payload.user_id, note_id=None, subject=payload.subject,
        difficulty=payload.difficulty, mode=payload.mode, types=payload.types,
        items=items, source="ai_general"
    )
    print(2)
    return {"quiz_id": quiz_id}

@router.post("/generate-ai-from-note")
def generate_ai_from_note(payload: GenerateWithNote, db: Session = Depends(get_db)) -> Dict[str, Any]:
    # You may fetch and pass note content here. For now, assume a Note model with .content
    note = db.execute("SELECT content FROM notes WHERE id=:nid", {"nid": payload.note_id}).fetchone()
    note_text = note[0] if note else ""
    items = _openai_generate(
        subject=payload.subject,
        difficulty=payload.difficulty,
        n=payload.num_items,
        types=payload.types,
        note_text=note_text or None
    )
    quiz_id = _persist_quiz_and_items(
        db,
        user_id=payload.user_id, note_id=payload.note_id, subject=payload.subject,
        difficulty=payload.difficulty, mode=payload.mode, types=payload.types,
        items=items, source="ai_note"
    )
    return {"quiz_id": quiz_id}

def _quiz_to_dict(q: Quiz) -> Dict[str, Any]:
    return {
        "id": q.id, "title": q.title, "difficulty": q.difficulty, "mode": q.mode,
        "source": q.source, "types": q.types, "created_at": str(q.created_at)
    }

@router.get("/{quiz_id}")
def get_quiz(quiz_id: int, db: Session = Depends(get_db)) -> QuizOut:
    q = db.get(Quiz, quiz_id)
    if not q:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return _quiz_to_dict(q)

@router.get("/{quiz_id}/items")
def get_quiz_items(quiz_id: int, db: Session = Depends(get_db)) -> List[QuizItemOut]:
    items = db.query(QuizItem).filter(QuizItem.quiz_id == quiz_id).all()
    out: List[dict] = []
    for it in items:
        entry = {
            "id": it.id,
            "question": it.question,
            "type": it.type,
            "explanation": it.explanation,
        }
        if it.choices:
            try:
                entry["choices"] = json.loads(it.choices)
            except Exception:
                entry["choices"] = None
        out.append(entry)
    return out

@router.post("/{quiz_id}/submit")
def submit_quiz(quiz_id: int, payload: SubmitPayload, db: Session = Depends(get_db)) -> Dict[str, Any]:
    q = db.get(Quiz, quiz_id)
    if not q:
        raise HTTPException(status_code=404, detail="Quiz not found")
    db.add(Result(
        quiz_id=quiz_id,
        user_id=payload.user_id,
        score=float(payload.score),
        time_spent_sec=int(payload.time_spent_sec)
    ))
    db.commit()
    return {"message": "Result recorded"}


@router.get("/mine")
def list_mine(user_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Return quizzes for the given user, with simple aggregate stats.
    Response structure:
    {
    "practice": [ {id, title, mode, difficulty, created_at, attempts, best_score, last_taken_at} ],
    "exam":     [ ... ]
    }
    """
    # Fetch all quizzes created by this user
    quizzes = db.query(Quiz).filter(Quiz.user_id == user_id).order_by(Quiz.created_at.desc()).all()

    # Aggregate results per quiz for this user
    agg = (
        db.query(
            Result.quiz_id.label("qid"),
            func.count(Result.id).label("attempts"),
            func.max(Result.score).label("best_score"),
            func.max(Result.taken_at).label("last_taken_at"),
        )
        .filter(Result.user_id == user_id)
        .group_by(Result.quiz_id)
        .all()
    )
    print(1)
    stats = {row.qid: {"attempts": int(row.attempts or 0),
                    "best_score": float(row.best_score) if row.best_score is not None else None,
                    "last_taken_at": (str(row.last_taken_at) if row.last_taken_at else None)}
            for row in agg}
        
    print(2)

    def pack(q: Quiz) -> Dict[str, Any]:
        s = stats.get(q.id, {})
        return {
            "id": q.id,
            "title": q.title,
            "mode": q.mode,
            "difficulty": q.difficulty,
            "created_at": str(q.created_at),
            "attempts": s.get("attempts", 0),
            "best_score": s.get("best_score"),
            "last_taken_at": s.get("last_taken_at"),
        }
    print(3)
    practice = []
    exam = []
    for q in quizzes:
        (exam if (q.mode or '').lower() == 'exam' else practice).append(pack(q))
    print(4)
    return {"practice": practice, "exam": exam}
