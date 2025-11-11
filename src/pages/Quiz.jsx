import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Card from "../components/Card";
import { useAuth } from "../context/Authcontext";
import {
    listMyQuizzes,
    getQuiz,
    gradeQuiz,
    startPractice,
    deleteQuiz,        // ⬅️ NEW
} from "../lib/api";

export default function Quiz() {
    const { id } = useParams();
    const nav = useNavigate();
    const { user, setUser } = useAuth();

    if (!id) return <ListMode />;
    return (
        <RunnerMode quizId={parseInt(id, 10)} user={user} setUser={setUser} nav={nav} />
    );
}

function ListMode() {
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [practice, setPractice] = useState([]);
    const [deletingId, setDeletingId] = useState(0); 

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const data = await listMyQuizzes();
                if (!alive) return;
                setPractice(data.practice || []);
            } catch (e) {
                if (alive) setErr(e?.message || "Failed to load quizzes.");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, []);

    async function onDelete(id) {
        if (!confirm("Delete this quiz? This cannot be undone.")) return;
        try {
            setDeletingId(id);
            await deleteQuiz(id); // cookie-auth works; token optional
            setPractice((prev) => prev.filter((q) => q.id !== id));
        } catch (e) {
            alert(e?.message || "Delete failed");
        } finally {
            setDeletingId(0);
        }
    }

    if (loading) return <div className="container"><Card>Loading…</Card></div>;
    if (err) return <div className="container"><Card tone="red">{err}</Card></div>;

    return (
        <div className="container">
            <div className="row" style={{ alignItems: "baseline", marginBottom: 8 }}>
                <h2 style={{ margin: 0 }}>My Practice Quizzes</h2>
                <span className="muted" style={{ marginLeft: 10 }}>
                    {practice.length} {practice.length === 1 ? "quiz" : "quizzes"}
                </span>
            </div>
            <Card>
                {practice.length === 0 && (
                    <div className="muted">No practice quizzes yet.</div>
                )}
                {practice.map((q) => (
                    <div className="table__row" key={q.id} style={{ alignItems: "center", gap: 8 }}>
                        <div className="grow">
                            <b>{q.title}</b> <span className="muted">· {q.difficulty}</span>
                        </div>
                        <div className="muted">Attempts: {q.attempts || 0}</div>
                        <Link className="btn" to={`/quiz/${q.id}`}>Start</Link>
                        <button
                            className="btn btn--danger"
                            onClick={() => onDelete(q.id)}
                            disabled={deletingId === q.id}
                            aria-label={`Delete quiz ${q.title}`}
                            title="Delete quiz"
                        >
                            {deletingId === q.id ? "Deleting…" : "Delete"}
                        </button>
                    </div>
                ))}
            </Card>

            {/* simple inline style for danger button */}
            <style>
                {`
          .btn--danger { background:#ef4444; color:#fff; }
          .btn--danger[disabled]{ opacity:.7; cursor:not-allowed; }
        `}
            </style>
        </div>
    );
}

function RunnerMode({ quizId, user, setUser, nav }) {
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [meta, setMeta] = useState(null);
    const [items, setItems] = useState([]);
    const [i, setI] = useState(0);
    const [deleting, setDeleting] = useState(false); 

    // answers map: { [itemId]: { type, choice_index?, text? } }
    const [answers, setAnswers] = useState({});

    // prevent double run in React 18 StrictMode
    const startedRef = useRef(false);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const q = await getQuiz(quizId);
                if (!alive) return;
                setMeta({ title: q.title, difficulty: q.difficulty, mode: q.mode });

                if (!startedRef.current) {
                    startedRef.current = true;
                    try {
                        const resp = await startPractice(quizId);
                        if (resp && (resp.coins_balance != null || resp.coins_earned_total != null)) {
                            setUser((prev) =>
                                prev
                                    ? {
                                        ...prev,
                                        coins_balance: resp.coins_balance ?? prev.coins_balance ?? 0,
                                        coins_earned_total:
                                            resp.coins_earned_total ?? prev.coins_earned_total ?? 0,
                                    }
                                    : prev
                            );
                        }
                    } catch (_) {
                        /* ignore start errors here */
                    }
                }

                setItems(q.items || []);
            } catch (e) {
                if (alive) setErr(e?.message || "Failed to load quiz.");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, [quizId, setUser]);

    const count = items.length;
    const at = items[i];

    // helpers
    const setAnswerForCurrent = (val) => {
        // Always key by item id so answers never bleed to other items
        setAnswers((prev) => ({
            ...prev,
            [at.id]: { ...(prev[at.id] || {}), ...val, type: at.type },
        }));
    };

    const handleClear = () => {
        setAnswers((prev) => {
            const next = { ...prev };
            // remove the item entry entirely
            delete next[at.id];
            return next;
        });
    };

    const go = (nextIndex) => {
        setI(nextIndex);
        // scroll to top to keep UX tidy
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleNext = () => go(Math.min(count - 1, i + 1));
    const handleBack = () => go(Math.max(0, i - 1));

    // arrow keys for navigation
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "ArrowRight") handleNext();
            if (e.key === "ArrowLeft") handleBack();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [i, count]);

    async function onSubmit() {
        try {
            const built = items.map((it) => {
                const a = answers[it.id] || {};
                if (it.type === "mcq") {
                    return {
                        item_id: it.id,
                        type: "mcq",
                        choice_index: Number(a.choice_index ?? -1),
                    };
                } else if (it.type === "true_false") {
                    return { item_id: it.id, type: "true_false", text: String(a.text ?? "") };
                } else {
                    return {
                        item_id: it.id,
                        type: it.type === "fill_blank" ? "fill_blank" : "short_answer",
                        text: String(a.text ?? ""),
                    };
                }
            });

            const resp = await gradeQuiz(quizId, { answers: built, time_spent_sec: 0 });

            if (resp?.total_points != null) {
                setUser((prev) =>
                    prev
                        ? {
                            ...prev,
                            total_points: resp.total_points,
                            coins_balance: resp.coins_balance ?? prev.coins_balance,
                            coins_earned_total:
                                resp.coins_earned_total ?? prev.coins_earned_total,
                        }
                        : prev
                );
            }

            nav("/quiz-feedback", {
                state: { quizId, score: resp.score, total: resp.total },
            });
        } catch (e) {
            alert(e?.message || "Submit failed");
        }
    }

    async function onDeleteQuiz() {
        if (!confirm("Delete this quiz? This cannot be undone.")) return;
        try {
            setDeleting(true);
            await deleteQuiz(quizId); // ⬅️ NEW
            nav("/quiz"); // back to list
        } catch (e) {
            alert(e?.message || "Delete failed");
        } finally {
            setDeleting(false);
        }
    }

    if (loading) return <div className="container"><Card>Loading…</Card></div>;
    if (err) return <div className="container"><Card tone="red">{err}</Card></div>;
    if (!at) return <div className="container"><Card>No questions.</Card></div>;

    const header = `Question ${i + 1} of ${count}`;
    const pct = count ? Math.round(((i + 1) / count) * 100) : 0;
    const currentAns = answers[at.id];

    return (
        <div className="container" style={{ maxWidth: 860 }}>
            {/* Top header block */}
            <div className="row" style={{ alignItems: "center", marginBottom: 8 }}>
                <h2 style={{ margin: 0, flex: 1 }}>{meta?.title}</h2>
                <span className="pill">{meta?.difficulty || "—"}</span>
                <button
                    className="btn btn--danger"
                    onClick={onDeleteQuiz}
                    disabled={deleting}
                    style={{ marginLeft: 8 }}
                >
                    {deleting ? "Deleting…" : "Delete"}
                </button>
            </div>

            {/* Slim progress line and counter */}
            <div className="row" style={{ alignItems: "center", marginBottom: 14 }}>
                <div
                    style={{
                        flex: 1,
                        height: 6,
                        background: "var(--border, #eee)",
                        borderRadius: 999,
                    }}
                >
                    <div
                        style={{
                            width: `${pct}%`,
                            height: 6,
                            borderRadius: 999,
                            background: "var(--accent, #5563ff)",
                        }}
                    />
                </div>
                <div className="muted" style={{ marginLeft: 12 }}>
                    {header}
                </div>
            </div>

            {/* Navigation up top for easy access */}
            <div className="row" style={{ gap: 8, marginBottom: 8 }}>
                <button className="btn" disabled={i === 0} onClick={handleBack}>
                    ← Back
                </button>
                <button className="btn" onClick={handleNext} disabled={i >= count - 1}>
                    Next →
                </button>
                <div className="grow" />
                <button className="btn " onClick={handleClear}>
                    Clear answer
                </button>
            </div>

            <Card>
                <div className="muted" style={{ marginBottom: 6 }}>
                    <span className="pill">
                        {(at.type || "").replace("_", " ").toUpperCase()}
                    </span>
                </div>

                <h3 style={{ marginTop: 0 }}>{at.question}</h3>

                {/* MCQ as selectable cards */}
                {at.type === "mcq" && (
                    <div
                        className="grid"
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 10,
                        }}
                    >
                        {(at.choices || []).map((c, idx) => {
                            const picked = currentAns?.choice_index === idx;
                            return (
                                <button
                                    key={idx}
                                    onClick={() => setAnswerForCurrent({ choice_index: idx })}
                                    className={`card-btn ${picked ? "card-btn--picked" : ""}`}
                                    style={{
                                        textAlign: "left",
                                        padding: "12px 14px",
                                        borderRadius: 12,
                                        border: `2px solid ${picked
                                                ? "var(--accent, #5563ff)"
                                                : "var(--border, #e5e7eb)"
                                            }`,
                                        background: picked ? "rgba(85,99,255,0.07)" : "white",
                                        cursor: "pointer",
                                    }}
                                >
                                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                                        {String.fromCharCode(65 + idx)}.
                                    </div>
                                    <div>{c}</div>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* True / False buttons */}
                {at.type === "true_false" && (
                    <div className="row" style={{ gap: 10 }}>
                        <button
                            className={`btn ${currentAns?.text === "True" ? "btn--primary" : ""}`}
                            onClick={() => setAnswerForCurrent({ text: "True" })}
                        >
                            True
                        </button>
                        <button
                            className={`btn ${currentAns?.text === "False" ? "btn--primary" : ""}`}
                            onClick={() => setAnswerForCurrent({ text: "False" })}
                        >
                            False
                        </button>
                    </div>
                )}

                {/* Short answer / Fill blank (NO carryover) */}
                {(at.type === "short_answer" || at.type === "fill_blank") && (
                    <input
                        key={at.id} // ⬅️ forces re-mount when question changes
                        className="input"
                        autoComplete="off"
                        placeholder="Type your answer…"
                        value={currentAns?.text || ""} // per-item state; no bleed to next
                        onChange={(e) => setAnswerForCurrent({ text: e.target.value })}
                        style={{ fontSize: 16, padding: "10px 12px" }}
                    />
                )}

                {/* Bottom actions */}
                <div className="row mt-3" style={{ gap: 8 }}>
                    <button className="btn" disabled={i === 0} onClick={handleBack}>
                        ← Back
                    </button>
                    {i < count - 1 ? (
                        <button className="btn" onClick={handleNext}>
                            Next →
                        </button>
                    ) : (
                        <button className="btn" onClick={onSubmit}>
                            Submit
                        </button>
                    )}
                    <div className="grow" />
                    <button className="btn" onClick={handleClear}>
                        Clear answer
                    </button>
                </div>
            </Card>

            {/* Tiny style helpers */}
            <style>
                {`
          .pill {
            display:inline-block;padding:4px 8px;border-radius:999px;
            background:var(--bg-soft,#f3f4f6);color:var(--muted,#6b7280);font-size:12px
          }
          .btn--primary { background: var(--accent,#5563ff); color: white; }
          .btn--danger { background:#ef4444; color:#fff; }
          .btn--danger[disabled]{ opacity:.7; cursor:not-allowed; }
        `}
            </style>
        </div>
    );
}
