import React from "react";
import Card from "../components/Card";
import { useLocation, Link } from "react-router-dom";

export default function QuizFeedback() {
    const { state } = useLocation();
    const items = state?.items || [];
    const score = state?.score ?? null;
    const reward = state?.reward ?? 0;

    return (
        <div className="container">
            <h2>Quiz Feedback</h2>

            {score != null && (
                <Card tone="blue">
                    <h3 style={{ marginTop: 0 }}>Your score: {score}%</h3>
                    <p className="muted">You earned <strong>🪙 {reward}</strong> StudyCoins. Great job!</p>
                    <div className="mt">
                        <Link className="btn btn--primary" to="/flashcards">Review with flashcards</Link>
                        <Link className="btn btn--light" to="/progress" style={{ marginLeft: 10 }}>View progress</Link>
                    </div>
                </Card>
            )}

            <Card tone="purple" subtitle="Detailed explanations & recommendations">
                <ul className="list">
                    {items.map((r, i) => (
                        <li key={i} className="list__item" style={{ marginBottom: 10 }}>
                            <div><strong>Q:</strong> {r.q}</div>
                            <div className={`pill ${r.correct ? "pill--ok" : "pill--bad"}`}>
                                {r.correct ? "Correct" : "Incorrect"}
                            </div>
                            {!r.correct && (
                                <div className="mt-sm">
                                    <div><strong>Your answer:</strong> {r.your}</div>
                                    <div><strong>Correct:</strong> {r.correctAns}</div>
                                    <div><strong>Why:</strong> {r.why}</div>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            </Card>
        </div>
    );
}
