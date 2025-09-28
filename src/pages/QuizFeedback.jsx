import React from "react";
import Card from "../components/Card";
import { useLocation, Link } from "react-router-dom";
import { req } from "../lib/api";

export default function QuizFeedback() {
    const { state } = useLocation() || {};
    const items = Array.isArray(state?.items) ? state.items : [];
    const score = typeof state?.score === "number" ? state.score : null;
    const reward = typeof state?.reward === "number" ? state.reward : 0;

    // normalize rows so UI never explodes
    const rows = items.map((r) => {
        // Case A: detailed review rows (q/your/correctAns/why)
        if (typeof r?.q === "string" || typeof r?.your === "string" || typeof r?.correctAns === "string") {
            return {
                q: r.q || "",
                correct: !!r.correct,                 // boolean or falsy
                your: r.your ?? "",
                correctAns: r.correctAns ?? "",
                why: r.why ?? "",
            };
        }
        // Case B: raw quiz items from /quizzes/:id/items
        return {
            q: r.question || "",
            correct: null,                         // unknown (we didn't ship answers to client)
            your: "",
            correctAns: "",
            why: r.explanation || "",
        };
    });

    return (
        <div className="container">
            <h2>Quiz Feedback</h2>

            {score != null ? (
                <Card tone="blue">
                    <h3 style={{ marginTop: 0 }}>Your score: {score}%</h3>
                    <p className="muted">
                        You earned <strong>🪙 {reward}</strong> StudyCoins. Great job!
                    </p>
                    <div className="mt">
                        <Link className="btn btn--primary" to="/flashcards">Review with flashcards</Link>
                        <Link className="btn btn--light" to="/progress" style={{ marginLeft: 10 }}>View progress</Link>
                    </div>
                </Card>
            ) : (
                <Card tone="yellow">
                    <p style={{ margin: 0 }}>
                        No score data found. You can still review explanations below.
                    </p>
                </Card>
            )}

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
        </div>
    );
}
