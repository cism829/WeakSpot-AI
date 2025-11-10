import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../components/Card";
import { req } from "../lib/api";
import { GRADE_LEVELS } from "../lib/grades";
import { useAuth } from "../context/Authcontext";

const TYPES = [
    { key: "mcq", label: "Multiple Choice" },
    { key: "short_answer", label: "Short Answer" },
    { key: "fill_blank", label: "Fill in the Blank" },
    { key: "true_false", label: "True / False" },
];

const noteLabel = (n) => {
    const base =
        n.filename || n.name || n.title ||
        (n.preview_text ? n.preview_text.slice(0, 60) : `Note ${String(n.id).slice(0, 8)}`);
    const date = n.created_at ? new Date(n.created_at).toLocaleString() : "";
    return date ? `${base} — ${date}` : base;
};

export default function QuizGenerator() {
    const nav = useNavigate();
    const { user } = useAuth();
    const token = user?.token;

    // ----- General (topic) flow state -----
    const [subjectA, setSubjectA] = useState("general");
    const [topicA, setTopicA] = useState("");
    const [difficultyA, setDifficultyA] = useState("medium");
    const [modeA, setModeA] = useState("practice");
    const [numA, setNumA] = useState(10);
    const defaultGrade = user?.grade_level ?? GRADE_LEVELS?.[0] ?? "Other";
    const [gradeA, setGradeA] = useState(defaultGrade);
    const [typesA, setTypesA] = useState(["mcq"]);
    const [submittingA, setSubmittingA] = useState(false);

    useEffect(() => { if (user?.grade_level) setGradeA(user.grade_level); }, [user]);

    // ----- Note flow state (fully independent) -----
    const [notes, setNotes] = useState([]);
    const [selectedNoteId, setSelectedNoteId] = useState("");
    const [difficultyB, setDifficultyB] = useState("medium");
    const [modeB, setModeB] = useState("practice");
    const [numB, setNumB] = useState(10);
    const [gradeB, setGradeB] = useState(defaultGrade);
    const [typesB, setTypesB] = useState(["mcq"]);
    const [submittingB, setSubmittingB] = useState(false);

    useEffect(() => { if (user?.grade_level) setGradeB(user.grade_level); }, [user]);

    // Shared
    const [err, setErr] = useState("");

    // Load notes (once)
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const res = await req("/notes/mine", { token });
                if (!alive) return;
                const arr = Array.isArray(res) ? res : (res?.notes || res?.items || []);
                setNotes(Array.isArray(arr) ? arr : []);
            } catch (e) {
                // optional, don’t block the page
                console.warn("Notes list failed:", e?.message || e);
            }
        })();
        return () => { alive = false; };
    }, [token]);

    const toggleTypeA = (t) =>
        setTypesA((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : prev.concat(t)));
    const toggleTypeB = (t) =>
        setTypesB((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : prev.concat(t)));

    // ----- Actions -----
    async function generateFromTopic() {
        setErr("");
        if (!typesA.length) return setErr("Pick at least one question type for Topic flow.");
        if (!topicA.trim()) return setErr("Please enter a topic for Topic flow.");

        const payload = {
            subject: subjectA,
            topic: topicA,
            difficulty: difficultyA,
            mode: modeA,
            num_items: Number(numA),
            types: typesA,
            grade_level: gradeA,
        };

        try {
            setSubmittingA(true);
            const data = await req("/quizzes/generate-ai", { method: "POST", body: payload, token });
            if (!data?.quiz_id) throw new Error("No quiz_id returned.");
            nav(modeA === "exam" ? "/exam" : `/quiz/${data.quiz_id}`);
        } catch (e) {
            setErr(e?.message || "Generation failed.");
        } finally {
            setSubmittingA(false);
        }
    }

    async function generateFromNote() {
        setErr("");
        if (!typesB.length) return setErr("Pick at least one question type for Note flow.");
        if (!selectedNoteId) return setErr("Please select a note.");

        // subject/topic are intentionally irrelevant to the prompt in note flow; we still send for schema compat.
        const payload = {
            note_id: selectedNoteId,
            subject: "",        // ignored by backend in note-only prompt
            topic: "",          // ignored by backend in note-only prompt
            difficulty: difficultyB,
            mode: modeB,
            num_items: Number(numB),
            types: typesB,
            grade_level: gradeB,
        };

        try {
            setSubmittingB(true);
            const data = await req("/quizzes/generate-ai-from-note", { method: "POST", body: payload, token });
            if (!data?.quiz_id) throw new Error("No quiz_id returned.");
            nav(modeB === "exam" ? "/exam" : `/quiz/${data.quiz_id}`);
        } catch (e) {
            setErr(e?.message || "Generation from note failed.");
        } finally {
            setSubmittingB(false);
        }
    }

    return (
        <div className="container" style={{ maxWidth: 1000 }}>
            <h2>Generate a Quiz</h2>
            {err && <div className="alert alert--error" style={{ marginBottom: 12 }}>{err}</div>}

            <div className="grid grid--2" style={{ gap: 16 }}>
                {/* -------- Left: General (topic) flow -------- */}
                <Card title="From Topic" subtitle="General prompt (no notes)">
                    <div className="grid grid--2" style={{ gap: 14 }}>
                        <label>
                            <div className="muted">Subject</div>
                            <input className="input" value={subjectA} onChange={(e) => setSubjectA(e.target.value)} placeholder="e.g. Biology" />
                        </label>
                        <label>
                            <div className="muted">Topic</div>
                            <input className="input" value={topicA} onChange={(e) => setTopicA(e.target.value)} placeholder="e.g. Photosynthesis" />
                        </label>
                        <label>
                            <div className="muted">Difficulty</div>
                            <select className="input" value={difficultyA} onChange={(e) => setDifficultyA(e.target.value)}>
                                <option value="easy">easy</option><option value="medium">medium</option><option value="hard">hard</option>
                            </select>
                        </label>
                        <label>
                            <div className="muted">Grade level</div>
                            <select className="input" value={gradeA} onChange={(e) => setGradeA(e.target.value)}>
                                {Array.isArray(GRADE_LEVELS) ? GRADE_LEVELS.map(g => <option key={g} value={g}>{g}</option>) : <option>{gradeA}</option>}
                            </select>
                        </label>
                        <label>
                            <div className="muted">Mode</div>
                            <select className="input" value={modeA} onChange={(e) => setModeA(e.target.value)}>
                                <option value="practice">practice</option><option value="exam">exam</option>
                            </select>
                        </label>
                        <label>
                            <div className="muted"># of Items</div>
                            <input className="input" type="number" min="1" max="50" value={numA} onChange={(e) => setNumA(e.target.value)} />
                        </label>
                    </div>

                    <div className="row" style={{ flexWrap: "wrap", gap: 10, marginTop: 10 }}>
                        <div className="muted" style={{ width: "100%" }}>Question Types</div>
                        {TYPES.map((t) => {
                            const active = typesA.includes(t.key);
                            return (
                                <button
                                    key={t.key}
                                    type="button"
                                    onClick={() => toggleTypeA(t.key)}
                                    className={`chip ${active ? "chip--active" : ""}`}
                                    style={{
                                        padding: "8px 12px",
                                        borderRadius: 999,
                                        border: `1px solid ${active ? "var(--accent,#5563ff)" : "var(--border,#e5e7eb)"}`,
                                        background: active ? "rgba(85,99,255,0.08)" : "white",
                                        cursor: "pointer"
                                    }}
                                >
                                    {t.label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="row" style={{ marginTop: 12, gap: 10 }}>
                        <button className="btn btn--primary" onClick={generateFromTopic} disabled={submittingA}>
                            {submittingA ? "Generating…" : "Generate From Topic"}
                        </button>
                    </div>
                </Card>

                {/* -------- Right: Note flow -------- */}
                <Card title="From Note" subtitle="Note-only prompt (ignores outside knowledge)">
                    <div className="grid grid--2" style={{ gap: 14 }}>
                        <label>
                            <div className="muted">My notes</div>
                            <select className="input" value={selectedNoteId} onChange={(e) => setSelectedNoteId(e.target.value)}>
                                <option value="">-- Select a note --</option>
                                {notes.map(n => (
                                    <option key={String(n.id)} value={String(n.id)}>{noteLabel(n)}</option>
                                ))}
                            </select>
                        </label>
                        <label>
                            <div className="muted"># of Items</div>
                            <input className="input" type="number" min="1" max="50" value={numB} onChange={(e) => setNumB(e.target.value)} />
                        </label>
                        <label>
                            <div className="muted">Difficulty</div>
                            <select className="input" value={difficultyB} onChange={(e) => setDifficultyB(e.target.value)}>
                                <option value="easy">easy</option><option value="medium">medium</option><option value="hard">hard</option>
                            </select>
                        </label>
                        <label>
                            <div className="muted">Grade level</div>
                            <select className="input" value={gradeB} onChange={(e) => setGradeB(e.target.value)}>
                                {Array.isArray(GRADE_LEVELS) ? GRADE_LEVELS.map(g => <option key={g} value={g}>{g}</option>) : <option>{gradeB}</option>}
                            </select>
                        </label>
                        <label>
                            <div className="muted">Mode</div>
                            <select className="input" value={modeB} onChange={(e) => setModeB(e.target.value)}>
                                <option value="practice">practice</option><option value="exam">exam</option>
                            </select>
                        </label>
                    </div>

                    <div className="row" style={{ flexWrap: "wrap", gap: 10, marginTop: 10 }}>
                        <div className="muted" style={{ width: "100%" }}>Question Types</div>
                        {TYPES.map((t) => {
                            const active = typesB.includes(t.key);
                            return (
                                <button
                                    key={t.key}
                                    type="button"
                                    onClick={() => toggleTypeB(t.key)}
                                    className={`chip ${active ? "chip--active" : ""}`}
                                    style={{
                                        padding: "8px 12px",
                                        borderRadius: 999,
                                        border: `1px solid ${active ? "var(--accent,#5563ff)" : "var(--border,#e5e7eb)"}`,
                                        background: active ? "rgba(85,99,255,0.08)" : "white",
                                        cursor: "pointer"
                                    }}
                                >
                                    {t.label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="row" style={{ marginTop: 12, gap: 10 }}>
                        <button className="btn btn--primary" onClick={generateFromNote} disabled={submittingB}>
                            {submittingB ? "Generating…" : "Generate From Note"}
                        </button>
                        <span className="muted">Note: subject/topic are ignored in note flow — items must come only from your note.</span>
                    </div>
                </Card>
            </div>

            <style>{`
        .chip { font-size: 14px; }
        .chip--active { font-weight: 600; }
      `}</style>
        </div>
    );
}
