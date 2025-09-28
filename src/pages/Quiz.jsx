import React, { useMemo, useState } from "react";
import Card from "../components/Card";
import ProgressBar from "../components/ProgressBar";
import { useAuth } from "../context/Authcontext";
import { useNavigate } from "react-router-dom";
import { genQuiz, submitQuiz } from "../lib/api";

export default function Quiz() {
    const { token } = useAuth();
    const [form, setForm] = useState({ subject: "general", difficulty: "medium", mode: "practice", num_items: 5 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [items, setItems] = useState([]);
    const [title, setTitle] = useState("Quiz");
    const [i, setI] = useState(0);
    const [picked, setPicked] = useState(null);
    const [answers, setAnswers] = useState([]);
    const [done, setDone] = useState(false);

    const total = items.length;
    const progress = total ? Math.round(((i) / total) * 100) : 0;

    async function generate(e) {
        e?.preventDefault();
        setLoading(true);
        setError("");
        setItems([]);
        setI(0);
        setPicked(null);
        setAnswers([]);
        setDone(false);
        try {
            const payload = {
                subject: form.subject,
                difficulty: form.difficulty,
                mode: form.mode,
                num_items: Number(form.num_items) || 5
            };
            const data = await genQuiz(payload, token);
            setTitle(data.title || "Quiz");
            setItems(data.items || []);
            window.__lastQuizId = data.id;
        } catch (err) {
            setError(err.message || "Failed to generate quiz");
        } finally {
            setLoading(false);
        }
    }

    function answer(idx) {
        setPicked(idx);
    }

    function next() {

        const newAns = [...answers];
        newAns[i] = picked;
        setAnswers(newAns);
        if (i >= total - 1) {
            setDone(true);
        } else {
            setI(i + 1);
            setPicked(null);
        }
    }

    const score = useMemo(() => {
        if (!done || !total) return 0;
        let s = 0;
        for (let k = 0; k < total; k++) {
            if (typeof answers[k] === "number" && items[k] && answers[k] === items[k].answer) s++;
        }
        return s;
    }, [done, answers, items, total]);

    return (
        <div className="page">
            <div className="row gap">
                <Card title="Generate Quiz" className="flex1">
                    <form onSubmit={generate} className="form grid gap">
                        <label className="field">
                            <span>Subject</span>
                            <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g., math, biology, general" />
                        </label>
                        <label className="field">
                            <span>Difficulty</span>
                            <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                                <option value="easy">Easy</option>
                                <option value="medium">Medium</option>
                                <option value="hard">Hard</option>
                            </select>
                        </label>
                        <label className="field">
                            <span>Mode</span>
                            <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                                <option value="practice">Practice</option>
                                <option value="exam">Exam</option>
                            </select>
                        </label>
                        <label className="field">
                            <span>Number of Questions</span>
                            <input type="number" min="1" max="50" value={form.num_items} onChange={(e) => setForm({ ...form, num_items: e.target.value })} />
                        </label>
                        <button className="btn btn--primary" disabled={loading}>{loading ? "Generating..." : "Generate"}</button>
                    </form>
                    {error && <p className="error mt">{error}</p>}
                </Card>

                <Card title={done ? `Result: ${score}/${total}` : (items[i]?.question ? `Q${i + 1}/${total}` : title)} className="flex2">
                    {items.length === 0 && <p className="muted">No questions yet. Generate a quiz to start.</p>}
                    {items.length > 0 && !done && (
                        <>
                            <ProgressBar value={progress} />
                            <h3 className="mt">{items[i].question}</h3>
                            <div className="grid mt">
                                {items[i].choices.map((c, idx) => (
                                    <button
                                        key={idx}
                                        className={`btn ${picked === idx ? "btn--primary" : ""}`}
                                        onClick={() => answer(idx)}
                                    >
                                        {typeof c === "object" ? JSON.stringify(c) : String(c)}
                                    </button>
                                ))}
                            </div>
                            <div className="mt">
                                <button className="btn btn--primary" disabled={picked == null} onClick={next}>
                                    {i === total - 1 ? "Finish" : "Next"}
                                </button>
                            </div>
                        </>
                    )}
                    {done && (
                        <div className="mt">
                            <h3>Your score: {score} / {total}</h3>
                            <ul className="mt">
                                {items.map((it, idx) => (
                                    <li key={idx} className="mt">
                                        <strong>Q{idx + 1}:</strong> {it.question}
                                        <div>Correct answer: <em>{String(it.choices[it.answer])}</em></div>
                                        {typeof answers[idx] === "number" && answers[idx] !== it.answer && (
                                            <div>Your answer: {String(it.choices[answers[idx]])}</div>
                                        )}
                                        {it.explanation && <div className="muted">Explanation: {it.explanation}</div>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
