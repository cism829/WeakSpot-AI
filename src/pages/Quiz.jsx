import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import Card from "../components/Card";
import ProgressBar from "../components/ProgressBar";
import { useAuth } from "../context/Authcontext";
import { req, listMyQuizzes } from "../lib/api"; // <-- import helper
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

/**
 * This component has TWO modes:
 * 1) LIST MODE (no :id): shows "My Quizzes & Exams" with stats and actions.
 * 2) RUNNER MODE (with :id): runs the selected quiz.
 *
 * After finishing, we redirect back to LIST MODE with a flash banner.
 */
export default function Quiz() {
    const { id } = useParams();
    const nav = useNavigate();
    const loc = useLocation();

    // Auth: we need the token to hit protected endpoints
    const { addCoins, token } = useAuth(); // ensure your Authcontext exposes token

    // ------- Shared -------
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    // ------- LIST MODE state -------
    const [mine, setMine] = useState({ practice: [], exam: [] });
    const flash = loc?.state?.flash;

    // ------- RUNNER MODE state -------
    const [meta, setMeta] = useState(null);
    const [items, setItems] = useState([]);
    const [i, setI] = useState(0);
    const [picked, setPicked] = useState(null);
    const [typed, setTyped] = useState("");

    const total = items.length;
    const pct = useMemo(() => (total ? (i / total) * 100 : 0), [i, total]);
    const current = items[i];
    const isRunner = !!id;

    useEffect(() => {
        let alive = true;

        async function loadList() {
            setLoading(true);
            setErr("");
            try {
                // ✅ Use JWT-based helper and pass token
                const data = await listMyQuizzes(token);
                if (!alive) return;
                setMine({
                    practice: Array.isArray(data?.practice) ? data.practice : [],
                    exam: Array.isArray(data?.exam) ? data.exam : [],
                });
            } catch (e) {
                if (!alive) return;
                setErr((e && e.message) || "Failed to load your quizzes.");
            } finally {
                if (alive) setLoading(false);
            }
        }

        async function loadRunner() {
            if (!id) return;
            setLoading(true);
            setErr("");
            try {
                // ✅ Pass token for protected endpoints
                const qm = await req(`/quizzes/${id}`, { token });
                const raw = await req(`/quizzes/${id}/items`, { token });
                const norm = (raw || []).map((it) => {
                    const type = it.type || "mcq";
                    let choices = it.choices;
                    if (typeof choices === "string") {
                        try {
                            choices = JSON.parse(choices);
                        } catch {
                            choices = null;
                        }
                    }
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
                setI(0);
                setPicked(null);
                setTyped("");
            } catch (e) {
                if (!alive) return;
                setErr((e && e.message) || "Failed to load quiz.");
            } finally {
                if (alive) setLoading(false);
            }
        }

        if (isRunner) {
            loadRunner();
        } else {
            loadList();
        }
        return () => {
            alive = false;
        };
    }, [id, isRunner, token]);

    async function next() {
        if (!current) return;
        if ((current.type === "mcq" || current.type === "true_false") && picked == null) return;
        if ((current.type === "short_answer" || current.type === "fill_blank") && !typed.trim()) return;

        // We don't keep full answer history here; compute score server-side if you later expose answers.
        setPicked(null);
        setTyped("");

        if (i < total - 1) {
            setI(i + 1);
            return;
        }

        // finished
        const score = 100; // placeholder
        const reward = Math.max(5, Math.round(score / 10));
        addCoins(reward);

        // ✅ Submit attempt; backend should read user from JWT
        req(`/quizzes/${id}/submit`, {
            method: "POST",
            token,
            body: { score, time_spent_sec: 0 },
        }).catch(() => { });

        // Redirect back to LIST view with a flash banner (no QuizFeedback required)
        nav("/quiz", { state: { flash: { score, reward } } });
    }

    // -------------------- RENDER --------------------
    if (!isRunner) {
        // LIST MODE
        return (
            <div className="container">
                <h2>🧪 My Quizzes & Exams</h2>

                {flash ? (
                    <Card tone="blue">
                        <strong>Finished!</strong> You scored {flash.score}% and earned 🪙 {flash.reward}.
                    </Card>
                ) : null}

                {loading ? (
                    <p>Loading…</p>
                ) : err ? (
                    <Card tone="red"><p style={{ margin: 0 }}>{err}</p></Card>
                ) : (
                    <>
                        <Card tone="purple" subtitle="Practice Quizzes">
                            {mine.practice.length === 0 ? (
                                <p className="muted">No practice quizzes yet.</p>
                            ) : (
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Title</th>
                                            <th>Difficulty</th>
                                            <th>Created</th>
                                            <th>Attempts</th>
                                            <th>Best Score</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {mine.practice.map((q) => (
                                            <tr key={q.id}>
                                                <td>{q.title || "Quiz"}</td>
                                                <td>{q.difficulty || "-"}</td>
                                                <td>{q.created_at?.slice(0, 19).replace("T", " ")}</td>
                                                <td>{q.attempts ?? 0}</td>
                                                <td>{q.best_score != null ? `${Math.round(q.best_score)}%` : "—"}</td>
                                                <td>
                                                    <Link className="btn btn--small btn--primary" to={`/quiz/${q.id}`}>
                                                        Take / Retake
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </Card>

                        <Card tone="yellow" subtitle="Exams">
                            {mine.exam.length === 0 ? (
                                <p className="muted">No exams yet.</p>
                            ) : (
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Title</th>
                                            <th>Difficulty</th>
                                            <th>Created</th>
                                            <th>Attempts</th>
                                            <th>Best Score</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {mine.exam.map((q) => (
                                            <tr key={q.id}>
                                                <td>{q.title || "Exam"}</td>
                                                <td>{q.difficulty || "-"}</td>
                                                <td>{q.created_at?.slice(0, 19).replace("T", " ")}</td>
                                                <td>{q.attempts ?? 0}</td>
                                                <td>{q.best_score != null ? `${Math.round(q.best_score)}%` : "—"}</td>
                                                <td>
                                                    <Link className="btn btn--small btn--primary" to={`/quiz/${q.id}`}>
                                                        Take / Retake
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </Card>
                    </>
                )}
            </div>
        );
    }

    // RUNNER MODE
    if (loading) return <div className="container"><h2>Loading…</h2></div>;
    if (err) return (
        <div className="container">
            <h2>Quiz</h2>
            <Card tone="red">
                <p style={{ margin: 0 }}>{err}</p>
                <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{`API_URL: ${API_URL}\nRoute: /quiz/${id}`}</pre>
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
