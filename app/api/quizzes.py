from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any, Optional, Union
import json
import os
from uuid import UUID

from openai import OpenAI  # ✅ OpenAI SDK

from app.core.config import settings
from app.core.db import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.quiz import Quiz
from app.models.quiz_item import QuizItem
from app.models.result import Result
from app.models.result_answer import ResultAnswer
from app.models.attempt import Attempt
from app.models.note import Note
from app.schemas.quiz_gen import (
    GenerateWithNote,
    GenerateWithoutNote,
    QuizOut,
    QuizItemOut,
    GradePayload,
)
from app.schemas.quiz import QuizItems  # Pydantic schema for structured output

from pydantic import BaseModel
from datetime import datetime, timezone
router = APIRouter(prefix="/quizzes", tags=["quizzes"])

# ---------- OpenAI helpers ----------

def _assert_openai():
    if not (getattr(settings, "OPENAI_API_KEY", None) or os.getenv("OPENAI_API_KEY")):
        raise HTTPException(status_code=400, detail="OpenAI API key not configured")

def _build_system():
    return (
        "You are a helpful tutor that writes concise, unambiguous assessment items. "
        "Always return STRICT JSON that matches the provided schema. "
        "Do not include any explanations outside of JSON. "
        "Return ONLY valid JSON. Do NOT include extra text, code fences, or explanations."
    )

def _strictify_schema(schema: dict) -> dict:
    """
    Make a Pydantic JSON schema compatible with OpenAI strict JSON schema:
    - additionalProperties:false on every object
    - required lists ALL keys in properties
    - properties that were optional are allowed to be null
    - ensure root is an object
    """
    import copy
    sc = copy.deepcopy(schema)

    def allow_null(prop_schema: dict) -> dict:
        # If already allows null, keep it; else wrap to allow null
        if not isinstance(prop_schema, dict):
            return prop_schema
        if prop_schema.get("type") == "null":
            return prop_schema
        if prop_schema.get("nullable") is True:
            return {"anyOf": [prop_schema, {"type": "null"}]}
        t = prop_schema.get("type")
        if isinstance(t, list) and "null" in t:
            return prop_schema
        if isinstance(t, str):
            return {"type": [t, "null"], **{k: v for k, v in prop_schema.items() if k != "type"}}
        # Fallback: wrap with anyOf
        if "anyOf" in prop_schema:
            # if anyOf already contains null, keep; else add it
            if not any(isinstance(x, dict) and x.get("type") == "null" for x in prop_schema["anyOf"]):
                return {"anyOf": prop_schema["anyOf"] + [{"type": "null"}]}
            return prop_schema
        return {"anyOf": [prop_schema, {"type": "null"}]}

    def walk(node: dict):
        if not isinstance(node, dict):
            return
        # Close all objects
        if node.get("type") == "object":
            node["additionalProperties"] = False
            props = node.get("properties") or {}
            # Compute full required list = all keys in properties
            if isinstance(props, dict):
                all_keys = list(props.keys())
                # If some were optional, allow null on them
                existing_required = set(node.get("required") or [])
                for k in all_keys:
                    if k not in existing_required:
                        props[k] = allow_null(props[k])
                node["required"] = all_keys

        # Recurse common schema containers
        for key in ("properties", "$defs", "definitions"):
            sub = node.get(key)
            if isinstance(sub, dict):
                for v in sub.values():
                    walk(v)

        for key in ("items", "anyOf", "oneOf", "allOf"):
            sub = node.get(key)
            if isinstance(sub, dict):
                walk(sub)
            elif isinstance(sub, list):
                for v in sub:
                    if isinstance(v, dict):
                        walk(v)

    walk(sc)

    # Ensure root object
    if sc.get("type") != "object":
        sc = {
            "type": "object",
            "additionalProperties": False,
            "properties": {"data": sc},
            "required": ["data"],
        }
    return sc

def _oai_json_call(schema_model: BaseModel.__class__, user_prompt: str) -> dict:
    """
    Call OpenAI Chat Completions with JSON Schema enforcement and return parsed dict.
    """
    model_name = (
        getattr(settings, "OPENAI_MODEL", None)
        or os.getenv("OPENAI_MODEL")
        or "gpt-4o-mini"
    )
    client = OpenAI(api_key=getattr(settings, "OPENAI_API_KEY", None) or os.getenv("OPENAI_API_KEY"))

    raw_schema = schema_model.model_json_schema()
    schema_name = raw_schema.get("title") or schema_model.__name__
    schema = _strictify_schema(raw_schema)
    try:
        resp = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": _build_system()},
                {"role": "user", "content": user_prompt},
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": schema_name,
                    "schema": schema,
                    "strict": True,
                },
            },
            temperature=0.3,
            max_tokens=2048,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"OpenAI error: {e}")

    text = None
    try:
        text = resp.choices[0].message.content
    except Exception:
        pass

    if not text:
        raise HTTPException(status_code=502, detail="OpenAI returned an empty response")

    # Parse JSON; be forgiving about code fences
    try:
        return json.loads(text)
    except Exception:
        s = text.strip().strip("`")
        s = s[s.find("{"): s.rfind("}") + 1]
        try:
            return json.loads(s)
        except Exception:
            raise HTTPException(status_code=502, detail="OpenAI returned non-JSON content")

def _build_user_prompt_general(subject: str, topic: str, grade_level: str, difficulty: str, n: int, item_types: List[str]) -> str:
    type_desc = {
        "mcq": ('{ "type":"mcq", "question":"...", "choices":["A","B","C","D"], "answer_index": 0, "explanation":"..." }'),
        "short_answer": ('{ "type":"short_answer", "question":"...", "answer_text":"concise expected answer", "explanation":"..." }'),
        "fill_blank": ('{ "type":"fill_blank", "question":"Use __ to complete the sentence", "answer_text":"word or phrase", "explanation":"..." }'),
        "true_false": ('{ "type":"true_false", "question":"...", "answer_text":"True" | "False", "explanation":"..." }'),
    }
    allowed_join = ", ".join(type_desc[t] for t in item_types if t in type_desc)
    types_list = ", ".join(item_types)
    schema_hint = (
        "{\n"
        '  "items": [\n'
        "    { \"one_of\": [\n"
        f"      {allowed_join}\n"
        "    ]}\n"
        "  ]\n"
        "}\n"
    )
    return (
        f"You are generating a quiz for grade level: {grade_level}.\n"
        f"SUBJECT: {subject}\n"
        f"TOPIC: {topic}\n"
        f"Create {n} questions in {subject} (topic: {topic}) at {difficulty} level across these item types: {types_list}.\n"
        "Return STRICT JSON matching this schema:\n"
        f"{schema_hint}\n"
        "Rules:\n"
        "- Answer must be correct, precise, and unambiguous.\n"
        f"- Use age-appropriate language and standards for {grade_level}.\n"
        "- MCQ must use exactly 4 distinct choices.\n"
        '- True/False must use exactly \"True\" or \"False\" in answer_text.\n'
        "- Keep explanations brief (1–2 sentences), precise, and tied to the question.\n"
        "\n"
        "INTERNAL CONSISTENCY CHECK (do not output this section—just enforce it):\n"
        "- MCQ: answer_index in [0..3] and choices[answer_index] is the correct one; explanation justifies it.\n"
        "- T/F: answer_text exactly \"True\" or \"False\" and explanation justifies that truth value.\n"
        "- SA/Fill: answer_text directly answers the question; explanation matches.\n"
    )

def _build_user_prompt_from_note(note_text: str, grade_level: str, difficulty: str, n: int, item_types: List[str]) -> str:
    type_desc = {
        "mcq": ('{ "type":"mcq", "question":"...", "choices":["A","B","C","D"], "answer_index": 0, "explanation":"..." }'),
        "short_answer": ('{ "type":"short_answer", "question":"...", "answer_text":"concise expected answer", "explanation":"..." }'),
        "fill_blank": ('{ "type":"fill_blank", "question":"Use __ to complete the sentence", "answer_text":"word or phrase", "explanation":"..." }'),
        "true_false": ('{ "type":"true_false", "question":"...", "answer_text":"True" | "False", "explanation":"..." }'),
    }
    allowed_join = ", ".join(type_desc[t] for t in item_types if t in type_desc)
    types_list = ", ".join(item_types)
    schema_hint = (
        "{\n"
        '  "items": [\n'
        "    { \"one_of\": [\n"
        f"      {allowed_join}\n"
        "    ]}\n"
        "  ]\n"
        "}\n"
    )
    return (
        f"NOTE_CONTENT (the ONLY allowed source of facts):\n{note_text}\n\n"
        f"Create {n} questions at {difficulty} level for grade {grade_level} using ONLY information explicitly contained in NOTE_CONTENT.\n"
        f"Item types: {types_list}.\n"
        "If a detail is not supported by NOTE_CONTENT, do not invent it—discard and regenerate.\n"
        "Return STRICT JSON matching this schema:\n"
        f"{schema_hint}\n"
        "Rules:\n"
        "- All facts must be directly grounded in NOTE_CONTENT (no outside knowledge).\n"
        "- Wording must be clear and age-appropriate for the grade.\n"
        "- MCQ must use exactly 4 distinct choices.\n"
        '- True/False must use exactly \"True\" or \"False\" in answer_text.\n'
        "- Keep explanations brief and tied to NOTE_CONTENT.\n"
        "\n"
        "INTERNAL CONSISTENCY CHECK (do not output this section—just enforce it):\n"
        "- Same checks as general, plus: each explanation must reference a fact present in NOTE_CONTENT.\n"
    )

def _coerce_item(it: dict) -> dict | None:
    t = (it.get("type") or "").lower().replace("-", "_")
    if t in {"multiple_choice", "multiplechoice", "mc"}:
        t = "mcq"
    if t in {"truefalse", "true_or_false", "tf"}:
        t = "true_false"

    q = (it.get("question") or "").strip()
    if not q:
        return None

    exp = (it.get("explanation") or "").strip() or None

    if t == "mcq":
        choices = it.get("choices") or it.get("options") or []
        if isinstance(choices, str):
            choices = [c.strip() for c in choices.split("|") if c.strip()]
        if not isinstance(choices, list) or len(choices) < 2:
            return None
        choices = choices[:4]

        orig_ai = it.get("answer_index")
        ai = None
        if orig_ai is not None:
            try:
                ai = int(orig_ai)
            except Exception:
                ai = None

        if ai is None:
            ans = it.get("answer") or it.get("answer_text")
            if isinstance(ans, str):
                letter_map = {"a": 0, "b": 1, "c": 2, "d": 3}
                if ans.lower() in letter_map:
                    ai = letter_map[ans.lower()]
                elif ans in choices:
                    ai = choices.index(ans)

        if isinstance(orig_ai, int) and 1 <= orig_ai <= len(choices):
            ai = orig_ai - 1

        if ai is None:
            ai = 0
        ai = max(0, min(ai, len(choices) - 1))

        return {
            "type": "mcq",
            "question": q,
            "choices": choices,
            "answer_index": ai,
            "answer_text": None,
            "explanation": exp,
        }

    if t in {"short_answer", "fill_blank", "true_false"}:
        ans = it.get("answer_text")
        if ans is None and "answer" in it:
            ans = it["answer"]
        if t == "true_false":
            if ans is True:
                ans = "True"
            if ans is False:
                ans = "False"
        ans = (str(ans)).strip() if ans is not None else ""
        if not ans:
            return None
        return {
            "type": t,
            "question": q,
            "choices": None,
            "answer_index": None,
            "answer_text": ans,
            "explanation": exp,
        }

    return None

def _oai_generate(subject: str, topic: str, grade_level: str, difficulty: str, n: int, item_types: List[str], note_text: str | None = None):
    _assert_openai()

    if note_text:
        user_prompt = _build_user_prompt_from_note(
            note_text=note_text,
            grade_level=grade_level,
            difficulty=difficulty,
            n=n,
            item_types=item_types,
        )
    else:
        user_prompt = _build_user_prompt_general(
            subject=subject,
            topic=topic,
            grade_level=grade_level,
            difficulty=difficulty,
            n=n,
            item_types=item_types,
        )

    data = _oai_json_call(QuizItems, user_prompt)

    raw_items = data.get("items")
    if raw_items is None and isinstance(data, dict):
        raw_items = data.get("questions")
    if isinstance(raw_items, dict):
        raw_items = raw_items.get("items", [])

    out: List[dict] = []
    for it in (raw_items or [])[:n]:
        norm = _coerce_item(it)
        if norm:
            out.append(norm)

    if not out:
        raise HTTPException(status_code=502, detail="OpenAI returned items, but none were usable after normalization")

    return out

# ---------- Create Quiz + persist items ----------

def _persist_quiz_and_items(
    db: Session,
    *,
    user_id: Union[str, UUID],
    note_id: Optional[UUID],
    subject: str,
    topic: Optional[str],
    difficulty: str,
    mode: str,
    types: List[str],
    items: List[dict],
    source: str,
) -> int:
    q = Quiz(
        user_id=str(user_id),
        note_id=note_id,
        title=f"{(subject or 'General').title()}" + (f" · {topic}" if topic else "") + f" · {mode.title()}",
        topic=(topic or None),
        difficulty=difficulty,
        mode=mode,
        source=source,
        types=",".join(types) if types else None,
    )
    db.add(q)
    db.flush()

    for it in items:
        db.add(
            QuizItem(
                quiz_id=q.id,
                type=it["type"],
                question=it["question"],
                choices=(json.dumps(it["choices"]) if it.get("choices") else None),
                answer_index=it.get("answer_index"),
                answer_text=it.get("answer_text"),
                explanation=it["explanation"],
            )
        )

    db.commit()
    return q.id

# ---------- Endpoints ----------
@router.delete("/delete/{quiz_id}", status_code=204)
def delete_quiz(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = (db.query(Quiz)
        .filter(Quiz.id == quiz_id, Quiz.user_id == current_user.id)
        .first())
    if not q:
        raise HTTPException(status_code=404, detail="Quiz not found")

    db.delete(q); db.commit(); return

@router.post("/generate-ai")
def generate_ai(
    payload: GenerateWithoutNote,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    items = _oai_generate(
        subject=payload.subject,
        topic=payload.topic,
        grade_level=payload.grade_level,
        difficulty=payload.difficulty,
        n=payload.num_items,
        item_types=payload.types,
        note_text=None,
    )
    quiz_id = _persist_quiz_and_items(
        db,
        user_id=user.id,
        note_id=None,
        subject=payload.subject,
        topic=payload.topic,
        difficulty=payload.difficulty,
        mode=payload.mode,
        types=payload.types,
        items=items,
        source="ai_general",
    )
    return {"quiz_id": quiz_id}

@router.post("/generate-ai-from-note")
def generate_ai_from_note(
    payload: GenerateWithNote,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    note: Optional[Note] = (
        db.query(Note)
        .filter(Note.note_id == payload.note_id, Note.user_id == user.id)
        .first()
    )
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    note_text = (note.og_text or "").strip()

    items = _oai_generate(
        subject=payload.subject,
        topic=payload.topic,
        grade_level=payload.grade_level,
        difficulty=payload.difficulty,
        n=payload.num_items,
        item_types=payload.types,
        note_text=note_text or None,
    )

    quiz_id = _persist_quiz_and_items(
        db,
        user_id=user.id,
        note_id=payload.note_id,
        subject=payload.subject,
        topic=payload.topic,
        difficulty=payload.difficulty,
        mode=payload.mode,
        types=payload.types,
        items=items,
        source="ai_note",
    )
    return {"quiz_id": quiz_id}

def _quiz_to_dict(q: Quiz) -> Dict[str, Any]:
    return {
        "id": q.id,
        "title": q.title,
        "difficulty": q.difficulty,
        "mode": q.mode,
        "source": q.source,
        "types": q.types,
        "created_at": str(q.created_at),
    }

@router.get("/mine")
def list_my_quizzes(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    quizzes = (
        db.query(Quiz)
        .filter(Quiz.user_id == user.id)
        .order_by(Quiz.created_at.desc())
        .all()
    )

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

    s_map = {
        qid: {
            "attempts": att,
            "best_score": best,
            "last_taken_at": str(last) if last else None,
        }
        for (qid, att, best, last) in stats
    }

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

    practice, exam = [], []
    for q in quizzes:
        (exam if (q.mode or "").lower() == "exam" else practice).append(pack(q))

    return {"practice": practice, "exam": exam}

@router.get("/{quiz_id}", response_model=QuizOut)
def get_quiz(quiz_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == user.id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Quiz not found")

    return QuizOut(
        id=q.id,
        title=q.title,
        difficulty=q.difficulty,
        mode=q.mode,
        created_at=str(q.created_at),
        items=[
            QuizItemOut(
                id=qi.id,
                question=qi.question,
                type=qi.type,
                choices=(json.loads(qi.choices) if qi.choices else None),
                explanation=qi.explanation,
            )
            for qi in q.items
        ],
    )

@router.post("/{quiz_id}/start")
def start_practice(quiz_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == user.id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Quiz not found")

    existed = db.query(Attempt).filter(Attempt.user_id == user.id, Attempt.quiz_id == quiz_id).first()
    if existed:
        return {
            "ok": True,
            "awarded": False,
            "coins_balance": user.coins_balance,
            "coins_earned_total": user.coins_earned_total,
        }

    att = Attempt(quiz_id=quiz_id, user_id=user.id)
    db.add(att)

    user.coins_balance = (user.coins_balance or 0) + settings.COIN_PER_QUIZ
    user.coins_earned_total = (user.coins_earned_total or 0) + settings.COIN_PER_QUIZ

    db.commit()

    return {
        "ok": True,
        "awarded": True,
            "coins_balance": user.coins_balance,
        "coins_earned_total": user.coins_earned_total,
    }

def _norm_bool(s: str) -> str:
    return str(s).strip().lower()

def _text_norm(s: str) -> str:
    return " ".join(str(s).strip().lower().split())

@router.post("/{quiz_id}/grade")
def grade_quiz(
    quiz_id: int,
    payload: GradePayload,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == user.id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Quiz not found")

    items = db.query(QuizItem).filter(QuizItem.quiz_id == quiz_id).all()
    item_map: Dict[int, QuizItem] = {it.id: it for it in items}

    correct = 0
    total = len(items)
    per_item = []

    for ua in payload.answers:
        it = item_map.get(ua.item_id)
        if not it:
            continue

        ok = False
        your_str = ""

        t = it.type or "mcq"
        if t == "mcq":
            if hasattr(ua, "choice_index"):
                your_str = str(getattr(ua, "choice_index"))
                ok = (it.answer_index is not None) and (ua.choice_index == it.answer_index)
        elif t == "true_false":
            your = _norm_bool(getattr(ua, "text", ""))
            your_str = getattr(ua, "text", "")
            truth = _norm_bool(it.answer_text or "")
            true_set = {"true","t","yes","y","1"}
            false_set = {"false","f","no","n","0"}
            if truth in true_set:
                ok = your in true_set
            elif truth in false_set:
                ok = your in false_set
            else:
                ok = _text_norm(it.answer_text or "") == _text_norm(your_str)
        else:
            your_str = getattr(ua, "text", "")
            ok = _text_norm(it.answer_text or "") == _text_norm(your_str)

        if ok:
            correct += 1
        per_item.append({"item_id": it.id, "your": your_str, "correct": ok})

    r = Result(
        quiz_id=quiz_id,
        user_id=user.id,
        score=float(correct),
        time_spent_sec=payload.time_spent_sec or 0
    )
    db.add(r)
    db.flush()

    for row in per_item:
        db.add(ResultAnswer(
            result_id=r.id,
            item_id=row["item_id"],
            user_answer=row["your"],
            is_correct=row["correct"],
        ))

    user.total_points = (user.total_points or 0) + int(correct)
    db.commit()

    return {
        "ok": True,
        "score": correct,
        "total": total,
        "result_id": r.id,
        "coins_balance": user.coins_balance,
        "coins_earned_total": user.coins_earned_total,
        "total_points": user.total_points,
        "per_item": per_item,
    }
