import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { req } from "../lib/api";

const TYPES = [
    { key: "mcq", label: "Multiple Choice" },
    { key: "short_answer", label: "Short Answer" },
    { key: "fill_blank", label: "Fill in the Blank" },
    { key: "true_false", label: "True/False" },
];

export default function QuizGenerator() {
    const nav = useNavigate();
    const [subject, setSubject] = useState("general");
    const [difficulty, setDifficulty] = useState("medium");
    const [mode, setMode] = useState("practice");
    const [num, setNum] = useState(10);
    const [types, setTypes] = useState(["mcq"]);
    const [useNote, setUseNote] = useState(false);
    const [noteId, setNoteId] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [err, setErr] = useState("");

    const toggleType = (t) =>
        setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : prev.concat(t)));

    async function generate() {
        setErr("");

        if (useNote && (!noteId || Number.isNaN(Number(noteId)))) {
            setErr("Please enter a valid Note ID.");
            return;
        }
        if (!types.length) {
            setErr("Pick at least one question type.");
            return;
        }

        const payload = {
            user_id: 1,
            subject,
            difficulty,
            mode,
            num_items: Number(num),
            types,
        };

        try {
            setSubmitting(true);
            const path = useNote ? "/quizzes/generate-ai-from-note" : "/quizzes/generate-ai";
            const body = useNote ? { ...payload, note_id: Number(noteId) } : payload;

            const data = await req(path, { method: "POST", body });
            if (!data?.quiz_id) {
                throw new Error("Generation succeeded but no quiz_id returned.");
            }
            nav(`/quiz/${data.quiz_id}`);
        } catch (e) {
            setErr(e?.message || "Generation failed.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="container">
            <h2>Generate a Quiz</h2>

            {err && (
                <div className="alert alert--error" style={{ marginBottom: 12 }}>
                    {err}
                </div>
            )}

            <div className="grid grid--2">
                <label>Subject
                    <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Biology" />
                </label>
                <label>Difficulty
                    <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                        <option>easy</option><option>medium</option><option>hard</option>
                    </select>
                </label>
                <label>Mode
                    <select value={mode} onChange={(e) => setMode(e.target.value)}>
                        <option>practice</option><option>exam</option>
                    </select>
                </label>
                <label># Items
                    <input type="number" min="1" max="50" value={num} onChange={(e) => setNum(e.target.value)} />
                </label>
            </div>

            <h3 style={{ marginTop: 16 }}>Question Types</h3>
            <div className="grid grid--2">
                {TYPES.map((t) => (
                    <label key={t.key} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                            type="checkbox"
                            checked={types.includes(t.key)}
                            onChange={() => toggleType(t.key)}
                        />
                        {t.label}
                    </label>
                ))}
            </div>

            <div style={{ marginTop: 16 }}>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="checkbox" checked={useNote} onChange={(e) => setUseNote(e.target.checked)} />
                    Generate from a Note
                </label>
                {useNote && (
                    <div style={{ marginTop: 8 }}>
                        <input
                            type="number"
                            placeholder="Note ID"
                            value={noteId}
                            onChange={(e) => setNoteId(e.target.value)}
                        />
                    </div>
                )}
            </div>

            <div className="mt">
                <button
                    className="btn btn--primary"
                    onClick={generate}
                    disabled={submitting}
                >
                    {submitting ? "Generatingâ€¦" : "Generate"}
                </button>
            </div>
        </div>
    );
}


