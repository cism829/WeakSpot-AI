import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Card from "../components/Card";
import ProgressBar from "../components/ProgressBar";
import { useAuth } from "../context/Authcontext";
import { req } from "../lib/api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function Quiz() {
    const { id } = useParams();
    const nav = useNavigate();
    const { addCoins } = useAuth();

    const [meta, setMeta] = useState(null);
    const [items, setItems] = useState([]);
    const [i, setI] = useState(0);
    const [picked, setPicked] = useState(null);
    const [typed, setTyped] = useState("");
    const [answers, setAnswers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    useEffect(() => {
        let alive = true;
        async function load() {
            if (!id) {
                setErr("Missing quiz id in route.");
                setLoading(false);
                return;
            }
            setLoading(true);
            setErr("");

            try {
                // meta
                const qm = await req(`/quizzes/${id}`);
                // items
                const raw = await req(`/quizzes/${id}/items`);

                // Normalize items to a safe shape for rendering
                const norm = (raw || []).map((it) => {
                    const type = it.type || "mcq";
                    let choices = it.choices;
                    if (typeof choices === "string") {
                        try { choices = JSON.parse(choices); } catch { choices = null; }
                    }
                    // Ensure TF has choices
                    if (type === "true_false" && (!choices || !Array.isArray(choices))) {
                        choices = ["True", "False"];
                    }
                    return {
                        id: it.id,
                        type,
                        question: it.question || "",
                        choices: Array.isArray(choices) ? choices : undefined,
                        explanation: it.explanation || "",
                    };
                });

                if (!alive) return;
                setMeta(qm);
                setItems(norm);
            } catch (e) {
                if (!alive) return;
                setErr(
                    (e && e.message) ||
                    "Failed to load quiz. Check VITE_API_URL and backend routes."
                );
            } finally {
                if (alive) setLoading(false);
            }
        }
        load();
        return () => {
            alive = false;
        };
    }, [id]);

    const total = items.length;
    const pct = useMemo(() => (total ? (i / total) * 100 : 0), [i, total]);
    const current = items[i];

    async function next() {
        if (!current) return;

        if ((current.type === "mcq" || current.type === "true_false") && picked == null) return;
        if ((current.type === "short_answer" || current.type === "fill_blank") && !typed.trim()) return;

        setAnswers((a) => [...a, { idx: i, picked, typed }]);
        setPicked(null);
        setTyped("");

        if (i < total - 1) {
            setI(i + 1);
            return;
        }

        // finished
        const score = 100; // placeholder (expose answers to compute real score if desired)
        const reward = Math.max(5, Math.round(score / 10));
        addCoins(reward);

        // fire-and-forget submit
        req(`/quizzes/${id}/submit`, {
            method: "POST",
            body: { user_id: 1, score, time_spent_sec: 0 },
        }).catch(() => { });

        nav("/quiz-feedback", { state: { items, score, reward } });
    }

    // UI states
    if (loading) return <div className="container"><h2>Loading…</h2></div>;
    if (err) return (
        <div className="container">
            <h2>Quiz</h2>
            <Card tone="red">
                <p style={{ margin: 0 }}>{err}</p>
                <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>
                    {`API_URL: ${API_URL}
Route: /quiz/${id}
Check: 
- Backend running?
- CORS enabled?
- Endpoints:
  GET /quizzes/:id
  GET /quizzes/:id/items
`}
                </pre>
            </Card>
        </div>
    );
    if (!current) return <div className="container"><h2>No questions found.</h2></div>;

    const isChoice = current.type === "mcq" || current.type === "true_false";

    return (
        <div className="container">
            <h2>🧪 {meta?.title || "Quiz"}</h2>
            <Card tone="blue" subtitle={`Question ${i + 1} of ${total}`}>
                <div className="mt-sm"><ProgressBar value={pct} /></div>
                <h3 style={{ marginTop: 12 }}>{current.question}</h3>

                {isChoice ? (
                    <div className="grid grid--2" style={{ marginTop: 12 }}>
                        {(current.choices || ["True", "False"]).map((c, idx) => {
                            const isSel = picked === idx;
                            return (
                                <button
                                    key={idx}
                                    onClick={() => setPicked(idx)}
                                    className={`choice${isSel ? " is-selected" : ""}`}
                                    aria-pressed={isSel}
                                >
                                    <span className="choice__bullet">{String.fromCharCode(65 + idx)}</span>
                                    <span>{c}</span>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="mt">
                        <input
                            placeholder={current.type === "fill_blank" ? "Type the missing word/phrase" : "Type your answer"}
                            value={typed}
                            onChange={(e) => setTyped(e.target.value)}
                            style={{ width: "100%" }}
                        />
                    </div>
                )}

                <div className="mt">
                    <button className="btn btn--primary" onClick={next}>
                        {i === total - 1 ? "Finish" : "Next"}
                    </button>
                </div>
            </Card>
        </div>
    );
}
