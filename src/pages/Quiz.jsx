import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import Card from "../components/Card";
import ProgressBar from "../components/ProgressBar";
import { useAuth } from "../context/Authcontext";
import { listMyQuizzes, getQuiz, startPractice, submitQuiz } from "../lib/api";

export default function Quiz() {
    const { id } = useParams();
    const nav = useNavigate();
    const { user, setUser } = useAuth();

    if (!id) return <ListMode />;
    return <RunnerMode quizId={parseInt(id, 10)} user={user} setUser={setUser} nav={nav} />;
}

function ListMode() {
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [practice, setPractice] = useState([]);
    const [exam, setExam] = useState([]);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const data = await listMyQuizzes();
                if (!alive) return;
                setPractice(data.practice || []);
                setExam(data.exam || []);
            } catch (e) {
                if (alive) setErr(e?.message || "Failed to load quizzes.");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, []);

    if (loading) return <div className="container"><Card>Loading…</Card></div>;
    if (err) return <div className="container"><Card tone="red">{err}</Card></div>;

    const Section = ({ title, rows }) => (
        <Card title={title}>
            {rows.length === 0 && <div className="muted">No items yet.</div>}
            {rows.map(q => (
                <div className="table__row" key={q.id}>
                    <div className="grow"><b>{q.title}</b> <span className="muted">· {q.difficulty}</span></div>
                    <div className="muted">Attempts: {q.attempts || 0}</div>
                    <Link className="btn" to={`/quiz/${q.id}`}>Start</Link>
                </div>
            ))}
        </Card>
    );

    return (
        <div className="container">
            <h2>My Quizzes & Exams</h2>
            <div className="grid grid--2">
                <Section title="Practice" rows={practice} />
                <Section title="Exams" rows={exam} />
            </div>
        </div>
    );
}

function RunnerMode({ quizId, user, setUser, nav }) {
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [meta, setMeta] = useState(null);
    const [items, setItems] = useState([]);
    const [i, setI] = useState(0);
    const [picked, setPicked] = useState(null);
    const [typed, setTyped] = useState("");

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const q = await getQuiz(quizId);
                if (!alive) return;
                setMeta({ id: q.id, title: q.title, difficulty: q.difficulty, mode: q.mode });
                const norm = (q.items || []).map(it => ({
                    id: it.id, type: it.type, question: it.question, choices: it.choices || null, explanation: it.explanation || ""
                }));
                setItems(norm);
                try {
                    const resp = await startPractice(quizId);
                    if (resp?.awarded) {
                        setUser({ ...user, coins_balance: resp.coins_balance, coins_earned_total: resp.coins_earned_total });
                    }
                } catch (_) { }
            } catch (e) {
                if (alive) setErr(e?.message || "Failed to load quiz.");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [quizId]);

    const count = items.length;
    const at = items[i];

    async function onSubmit() {
        try {
            const payload = { score: count, time_spent_sec: 0 };
            const resp = await submitQuiz(quizId, payload);
            if (resp?.total_points != null) {
                setUser({ ...user, total_points: resp.total_points, coins_balance: resp.coins_balance, coins_earned_total: resp.coins_earned_total });
            }
            alert("Submitted! Returning to list.");
            nav("/quiz");
        } catch (e) {
            alert(e?.message || "Submit failed");
        }
    }

    if (loading) return <div className="container"><Card>Loading…</Card></div>;
    if (err) return <div className="container"><Card tone="red">{err}</Card></div>;
    if (!at) return <div className="container"><Card>Empty quiz.</Card></div>;

    return (
        <div className="container">
            <h2>{meta?.title}</h2>
            <ProgressBar value={i + 1} max={count} />
            <Card>
                <div className="q">{at.question}</div>
                {Array.isArray(at.choices) ? (
                    <div className="choices">
                        {at.choices.map((c, idx) => (
                            <label key={idx} className={`choice ${picked === idx ? "is-picked" : ""}`}>
                                <input type="radio" name="pick" checked={picked === idx} onChange={() => setPicked(idx)} />
                                <span>{c}</span>
                            </label>
                        ))}
                    </div>
                ) : (
                    <textarea value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type your answer..." />
                )}
                <div className="actions">
                    <button className="btn btn--light" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>Back</button>
                    {i < count - 1 ? (
                        <button className="btn" onClick={() => setI(Math.min(count - 1, i + 1))}>Next</button>
                    ) : (
                        <button className="btn" onClick={onSubmit}>Submit</button>
                    )}
                </div>
            </Card>
        </div>
    );
}
