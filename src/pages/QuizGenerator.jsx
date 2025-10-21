import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../components/Card";
import { req } from "../lib/api";

const TYPES = [
    { key: "mcq", label: "Multiple Choice" },
    { key: "short_answer", label: "Short Answer" },
    { key: "fill_blank", label: "Fill in the Blank" },
    { key: "true_false", label: "True / False" },
];

export default function QuizGenerator() {
    const nav = useNavigate();

    const [subject, setSubject] = useState("general");
    const [difficulty, setDifficulty] = useState("medium");
    const [mode, setMode] = useState("practice");
    const [num, setNum] = useState(10);
    const [types, setTypes] = useState(["mcq"]);

    // notes
    const [useNote, setUseNote] = useState(false);
    const [notes, setNotes] = useState([]);     // [{id, name, filename}]
    const [noteName, setNoteName] = useState("");     // user selects by file name

    const [submitting, setSubmitting] = useState(false);
    const [err, setErr] = useState("");

    // Fetch user's notes once (or when useNote toggles on)
    useEffect(() => {
        let alive = true;
        (async () => {
            if (!useNote) return;
            try {
                const res = await req("/notes/mine");
                if (!alive) return;
                const arr = Array.isArray(res) ? res : (res?.notes || res?.items || []);
                const norm = (arr || []).map((n) => ({
                    id: Number(n.id),
                    // prefer filename; fallback to name/title
                    name: String(n.filename || n.name || n.title || `Note ${n.id}`),
                    filename: String(n.filename || n.name || n.title || `Note ${n.id}`),
                }));
                setNotes(norm);
            } catch (e) {
                if (alive) setErr(e?.message || "Unable to load notes.");
            }
        })();
        return () => { alive = false; };
    }, [useNote]);

    const toggleType = (t) =>
        setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : prev.concat(t)));

    const selectedNote = useMemo(
        () => notes.find(n => n.filename === noteName || n.name === noteName),
        [notes, noteName]
    );

    async function generate() {
        setErr("");

        if (!types.length) {
            setErr("Pick at least one question type.");
            return;
        }

        if (useNote) {
            if (!noteName.trim()) {
                setErr("Please pick a note by file name.");
                return;
            }
            if (!selectedNote?.id) {
                setErr("Selected note not found. Choose a file name from the list.");
                return;
            }
        }

        const payload = {
            subject,
            difficulty,
            mode,
            num_items: Number(num),
            types,
        };

        try {
            setSubmitting(true);
            const path = useNote ? "/quizzes/generate-ai-from-note" : "/quizzes/generate-ai";
            const body = useNote ? { ...payload, note_id: selectedNote.id } : payload;
            const data = await req(path, { method: "POST", body });

            if (!data?.quiz_id) throw new Error("Generation succeeded but no quiz_id returned.");

            if (mode === "exam") {
                // for exams, go to the list (you move into started there)
                nav("/exam");
            } else {
                nav(`/quiz/${data.quiz_id}`);
            }
        } catch (e) {
            setErr(e?.message || "Generation failed.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="container" style={{ maxWidth: 900 }}>
            <div className="row" style={{ alignItems: "baseline", marginBottom: 12 }}>
                <h2 style={{ margin: 0 }}>Generate a Quiz</h2>
                <span className="muted" style={{ marginLeft: 10 }}>AI-powered</span>
            </div>

            {err && (
                <div className="alert alert--error" style={{ marginBottom: 12 }}>
                    {err}
                </div>
            )}

            {/* Basics */}
            <Card title="Basics" subtitle="Subject, difficulty, mode, and length">
                <div className="grid grid--2" style={{ gap: 14 }}>
                    <label>
                        <div className="muted">Subject</div>
                        <input
                            className="input"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="e.g. Biology"
                        />
                    </label>

                    <label>
                        <div className="muted">Difficulty</div>
                        <select
                            className="input"
                            value={difficulty}
                            onChange={(e) => setDifficulty(e.target.value)}
                        >
                            <option value="easy">easy</option>
                            <option value="medium">medium</option>
                            <option value="hard">hard</option>
                        </select>
                    </label>

                    <label>
                        <div className="muted">Mode</div>
                        <select
                            className="input"
                            value={mode}
                            onChange={(e) => setMode(e.target.value)}
                        >
                            <option value="practice">practice</option>
                            <option value="exam">exam</option>
                        </select>
                    </label>

                    <label>
                        <div className="muted"># of Items</div>
                        <input
                            className="input"
                            type="number"
                            min="1"
                            max="50"
                            value={num}
                            onChange={(e) => setNum(e.target.value)}
                        />
                    </label>
                </div>
            </Card>

            {/* Types */}
            <Card title="Question Types" subtitle="Pick one or more" tone="purple">
                <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
                    {TYPES.map((t) => {
                        const active = types.includes(t.key);
                        return (
                            <button
                                key={t.key}
                                type="button"
                                onClick={() => toggleType(t.key)}
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
            </Card>

            {/* Notes */}
            <Card title="Notes0" subtitle="Generate from one of your uploaded notes">
                <label className="row" style={{ alignItems: "center", gap: 10 }}>
                    <input
                        type="checkbox"
                        checked={useNote}
                        onChange={(e) => setUseNote(e.target.checked)}
                    />
                    <span>Generate from a note</span>
                </label>

                {useNote && (
                    <div className="grid grid--2" style={{ marginTop: 10, gap: 12 }}>
                        <label>
                            <div className="muted">File name</div>
                            <select
                                className="input"
                                value={noteName}
                                onChange={(e) => setNoteName(e.target.value)}
                            >
                                <option value="">-- Select a note --</option>
                                {notes.map(n => {
                                    // display filename; if duplicates exist, add (#id) to disambiguate
                                    const dupCount = notes.filter(x => (x.filename || x.name) === (n.filename || n.name)).length;
                                    const display = dupCount > 1
                                        ? `${n.filename || n.name} (#${n.id})`
                                        : (n.filename || n.name);
                                    return (
                                        <option key={n.id} value={n.filename || n.name}>
                                            {display}
                                        </option>
                                    );
                                })}
                            </select>
                            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                                We’ll use the file <i>name</i> you pick and send its ID under the hood.
                            </div>
                        </label>

                        <label>
                            <div className="muted">Preview</div>
                            <input
                                className="input"
                                value={selectedNote ? `#${selectedNote.id}` : ""}
                                readOnly
                                placeholder="Note ID will appear after picking a file name"
                            />
                        </label>
                    </div>
                )}
                
            </Card>

            {/* Actions */}
            <div className="row" style={{ marginTop: 14, gap: 10 }}>
                <button
                    className="btn btn--primary"
                    onClick={generate}
                    disabled={submitting}
                >
                    {submitting ? "Generating..." : "Generate"}
                </button>
                <span className="muted">
                    {mode === "exam" ? "Exam will cost 5 coins when you start it." : "Practice awards a coin on first start."}
                </span>
            </div>

            {/* tiny styles */}
            <style>{`
        .chip { font-size: 14px; }
        .chip--active { font-weight: 600; }
      `}</style>
        </div>
    );
}
