import React, { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import { useLocation, Link } from "react-router-dom";
import { req, getBestReview } from "../lib/api";

export default function QuizFeedback() {
    // 1) Support post-submit navigation with state (optional legacy flow)
    const { state } = useLocation() || {};
    const stateItems = Array.isArray(state?.items) ? state.items : null;
    const stateScore = typeof state?.score === "number" ? state.score : null;
    const stateReward = typeof state?.reward === "number" ? state.reward : 0;

    const [loading, setLoading] = useState(!stateItems);
    const [err, setErr] = useState("");
    const [completed, setCompleted] = useState([]);
    const [review, setReview] = useState(
        stateItems ? { items: stateItems, score: stateScore, reward: stateReward, quizId: state?.quizId ?? null, title: state?.title ?? null } : null
    );
    const [busyId, setBusyId] = useState(null);

    // 2) Fetch completed quizzes/exams from your aggregate endpoint
    useEffect(() => {
        if (stateItems) return;
        let alive = true;
        (async () => {
            try {
                setErr(""); setLoading(true);
                const mine = await req("/quizzes/mine");
                if (!alive) return;
                const all = [...(mine.practice || []), ...(mine.exam || [])];
                const done = all
                    .filter((q) => (q.attempts || 0) > 0)
                    .sort((a, b) => new Date(b.last_taken_at || 0) - new Date(a.last_taken_at || 0));
                setCompleted(done);
            } catch (e) {
                if (alive) setErr(e?.message || "Failed to load completed quizzes.");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [stateItems]);

    // 3) Request normalized best attempt from the new endpoint, with graceful fallback
    async function onReviewBest(q) {
        try {
            setBusyId(q.id);
            const r = await getBestReview(q.id);
            if (!r || !Array.isArray(r.items)) throw new Error("No review data.");
            setReview({
                items: r.items,
                score: typeof r.score === "number" ? r.score : null,
                reward: 0,
                quizId: q.id,
                title: r.title || q.title,
            });
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (e) {
            // Fallback path: explanations-only
            try {
                const itemsRes = await req(`/quizzes/${q.id}/items`);
                let items = Array.isArray(itemsRes) ? itemsRes : (itemsRes?.items || []);
                // normalize basic shape
                const norm = items.map(it => ({
                    q: it.question || "",
                    your: "",
                    correctAns: (it.type === "mcq" && Array.isArray(it.choices) && typeof it.answer_index === "number")
                        ? (it.choices[it.answer_index] ?? "")
                        : (it.answer_text ?? ""),
                    why: it.explanation || "",
                    correct: null
                }));
                setReview({ items: norm, score: null, reward: 0, quizId: q.id, title: q.title });
                window.scrollTo({ top: 0, behavior: "smooth" });
            } catch (e2) {
                alert(e?.message || "Unable to load best attempt.");
            }
        } finally {
            setBusyId(null);
        }
    }

    // 4) Render rows robustly (supports both detailed + simple shapes)
    const rows = useMemo(() => {
        const src = review?.items || stateItems || [];
        return src.map((r) => {
            if (typeof r?.q === "string" || typeof r?.your === "string" || typeof r?.correctAns === "string") {
                return {
                    q: r.q || "",
                    correct: r.correct ?? null,
                    your: r.your ?? "",
                    correctAns: r.correctAns ?? "",
                    why: r.why ?? "",
                };
            }
            // fallback for raw quiz items
            return {
                q: r.question || "",
                correct: null,
                your: "",
                correctAns: r.answer_text || "",
                why: r.explanation || "",
            };
        });
    }, [review?.items, stateItems]);

    return (
        <div className="container">
            <h2>Quiz Feedback</h2>

            {(review || stateItems) && (
                <>
                    <Card tone="blue">
                        <h3 style={{ marginTop: 0 }}>
                            {review?.title ? <>Review: <em>{review.title}</em></> : "Review"}
                        </h3>
                        <p className="muted" style={{ marginTop: 4 }}>
                            {review?.score != null || stateScore != null
                                ? <>Best score: <strong>{Math.round(review?.score ?? stateScore)}%</strong></>
                                : "Score not available — showing explanations only."}
                        </p>
                        <div className="mt">
                            <Link className="btn btn--primary" to="/flashcards">Review with flashcards</Link>
                            <Link className="btn btn--light" to="/progress" style={{ marginLeft: 10 }}>View progress</Link>
                        </div>
                    </Card>

                    <Card tone="purple" subtitle="Detailed explanations & recommendations">
                        {rows.length === 0 ? (
                            <p className="muted">No items to show.</p>
                        ) : (
                            <ul className="list">
                                {rows.map((r, i) => (
                                    <li key={i} className="list__item" style={{ marginBottom: 10 }}>
                                        <div><strong>Q:</strong> {r.q || <em>(no question text)</em>}</div>

                                        {r.correct === null ? (
                                            <div className="pill">Reviewed</div>
                                        ) : (
                                            <div className={`pill ${r.correct ? "pill--ok" : "pill--bad"}`}>
                                                {r.correct ? "Correct" : "Incorrect"}
                                            </div>
                                        )}

                                        {(r.your || r.correctAns || r.why) && (
                                            <div className="mt-sm">
                                                {r.your ? <div><strong>Your answer:</strong> {r.your}</div> : null}
                                                {r.correctAns ? <div><strong>Correct:</strong> {r.correctAns}</div> : null}
                                                {r.why ? <div><strong>Why:</strong> {r.why}</div> : null}
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                </>
            )}

            {!stateItems && (
                <Card title="Completed quizzes & exams" tone="green">
                    {loading ? (
                        <div>Loading…</div>
                    ) : err ? (
                        <div className="muted" style={{ color: "crimson" }}>{err}</div>
                    ) : completed.length === 0 ? (
                        <div className="muted">No completed items yet.</div>
                    ) : (
                        <div className="table">
                            <div className="table__head">
                                <div>Title</div>
                                <div>Mode</div>
                                <div>Best score</div>
                                <div>Last taken</div>
                                <div></div>
                            </div>
                            {completed.map((q) => (
                                <div className="table__row" key={q.id}>
                                    <div className="grow">{q.title}</div>
                                    <div className="muted">{q.mode || "practice"}</div>
                                    <div>{q.best_score != null ? Math.round(q.best_score) + "%" : "—"}</div>
                                    <div className="muted">{q.last_taken_at ? new Date(q.last_taken_at).toLocaleString() : "—"}</div>
                                    <button
                                        className="btn"
                                        disabled={busyId === q.id}
                                        onClick={() => onReviewBest(q)}
                                    >
                                        {busyId === q.id ? "Loading…" : "Review best attempt"}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
}
