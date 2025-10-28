import React, { useEffect, useState, useMemo } from "react";
import Card from "../components/Card";
import { useAuth } from "../context/Authcontext";
import {
    flashcardsGenerateAI,
    flashcardsGenerateAIFromNote,
    listMyFlashcards,
    getFlashcard,
    listMyNotes,
} from "../lib/api";

function errorDetail(e) {
    if (!e) return "Unknown error";
    if (typeof e === "string") return e;
    if (e.detail) return e.detail;
    if (e.message) return e.message;
    try { return JSON.stringify(e).slice(0, 200); } catch { return "Request failed"; }
}

const noteLabel = (n) => {
    const base =
        n.filename || n.name || n.title ||
        (n.preview_text ? n.preview_text.slice(0, 60) : `Note ${String(n.id).slice(0, 8)}`);
    const date = n.created_at ? new Date(n.created_at).toLocaleString() : "";
    return date ? `${base} — ${date}` : base;
};

export default function Flashcards() {
    const { user } = useAuth();
    const token = user?.token;

    // ---- General flow state ----
    const [subjectA, setSubjectA] = useState("general");
    const [topicA, setTopicA] = useState("");
    const [countA, setCountA] = useState(10);
    const [busyA, setBusyA] = useState(false);

    // ---- Note flow state (independent) ----
    const [notes, setNotes] = useState([]);
    const [selectedNoteId, setSelectedNoteId] = useState("");
    const [countB, setCountB] = useState(10);
    const [busyB, setBusyB] = useState(false);

    // sets
    const [sets, setSets] = useState([]);
    const [loadingSets, setLoadingSets] = useState(false);
    const [activeId, setActiveId] = useState(null);
    const [active, setActive] = useState(null);
    const [loadingActive, setLoadingActive] = useState(false);

    const [err, setErr] = useState("");

    // load sets
    useEffect(() => {
        let cancel = false;
        (async () => {
            setLoadingSets(true);
            setErr("");
            try {
                const rows = await listMyFlashcards(token);
                if (!cancel) setSets(rows || []);
            } catch (e) {
                if (!cancel) setErr(`Failed to load flashcards: ${errorDetail(e)}`);
            } finally {
                if (!cancel) setLoadingSets(false);
            }
        })();
        return () => { cancel = true; };
    }, [token]);

    // load notes (once)
    useEffect(() => {
        let cancel = false;
        (async () => {
            try {
                const res = await listMyNotes(token);
                if (!cancel && Array.isArray(res)) setNotes(res);
            } catch (e) { /* optional */ }
        })();
        return () => { cancel = true; };
    }, [token]);

    // load active set
    useEffect(() => {
        if (!activeId) return;
        let cancel = false;
        (async () => {
            setLoadingActive(true);
            setErr("");
            try {
                const fc = await getFlashcard(activeId, token);
                if (!cancel) {
                    setActive(fc);
                    setBusyA(false); setBusyB(false);
                }
            } catch (e) {
                if (!cancel) setErr(`Failed to load selected set: ${errorDetail(e)}`);
            } finally {
                if (!cancel) setLoadingActive(false);
            }
        })();
        return () => { cancel = true; };
    }, [activeId, token]);

    // generate (general)
    const onGenerateGeneral = async () => {
        if (!topicA.trim()) return setErr("Enter a topic for general flashcards.");
        if (!subjectA.trim()) return setErr("Enter a subject for general flashcards.");
        if (countA < 5 || countA > 50) return setErr("Number of cards must be 5–50.");
        setBusyA(true); setErr("");
        try {
            const created = await flashcardsGenerateAI(
                { subject: subjectA.trim(), topic: topicA.trim(), num_items: countA, title: `${topicA.trim()} — flashcards` },
                token
            );
            setSets((prev) => [{ id: created.id, title: created.title, subject: created.subject, source: created.source, created_at: new Date().toISOString() }, ...prev]);
            setActiveId(created.id);
        } catch (e) {
            setErr(`Generation failed: ${errorDetail(e)}`);
        } finally {
            setBusyA(false);
        }
    };

    // generate (note-only)
    const onGenerateFromNote = async () => {
        if (!selectedNoteId) return setErr("Select a note first.");
        if (countB < 5 || countB > 50) return setErr("Number of cards must be 5–50.");
        setBusyB(true); setErr("");
        try {
            const sel = notes.find(n => String(n.id) === String(selectedNoteId));
            const display = sel?.filename || sel?.name || sel?.title || (sel?.preview_text ? sel.preview_text.slice(0, 40) : `Note ${String(sel?.id).slice(0, 8)}`);
            // subject/topic are ignored by backend for note flow; we still send for schema compat.
            const payload = {
                note_id: sel.id,
                subject: "",              // ignored
                topic: "",                // ignored
                num_items: countB,
                title: `Flashcards from ${display}`,
            };
            const created = await flashcardsGenerateAIFromNote(payload, token);
            setSets((prev) => [{ id: created.id, title: created.title, subject: created.subject, source: created.source, created_at: new Date().toISOString() }, ...prev]);
            setActiveId(created.id);
        } catch (e) {
            setErr(`Generation from note failed: ${errorDetail(e)}`);
        } finally {
            setBusyB(false);
        }
    };

    const total = active?.items?.length || 0;
    const current = total ? active.items[0] : null; // simple viewer below

    return (
        <div className="container">
            <h2>🧠 Flashcards</h2>
            {err && <div className="alert alert--error" style={{ marginBottom: 12 }}>{err}</div>}

            <div className="grid grid--2" style={{ gap: 16 }}>
                <Card title="From Topic" subtitle="General prompt (no notes)" tone="blue">
                    <label className="field">
                        <span>Subject</span>
                        <input value={subjectA} onChange={(e) => setSubjectA(e.target.value)} placeholder="e.g., Biology, ELA, Math" />
                    </label>
                    <label className="field">
                        <span>Topic</span>
                        <input value={topicA} onChange={(e) => setTopicA(e.target.value)} placeholder="e.g., Photosynthesis" />
                    </label>
                    <label className="field">
                        <span># of Cards</span>
                        <input type="number" min="1" max="50" value={countA} onChange={(e) => setCountA(+e.target.value)} />
                    </label>
                    <button className="btn btn--primary" onClick={onGenerateGeneral} disabled={busyA}>
                        {busyA ? "Generating…" : "Generate (General)"}
                    </button>
                </Card>

                <Card title="From Note" subtitle="Note-only prompt (ignores outside knowledge)" tone="green">
                    <label className="field">
                        <span>My notes</span>
                        <select className="input" value={selectedNoteId} onChange={(e) => setSelectedNoteId(e.target.value)}>
                            <option value="">-- Select a note --</option>
                            {notes.map((n) => <option key={String(n.id)} value={String(n.id)}>{noteLabel(n)}</option>)}
                        </select>
                    </label>
                    <label className="field">
                        <span># of Cards</span>
                        <input type="number" min="1" max="50" value={countB} onChange={(e) => setCountB(+e.target.value)} />
                    </label>
                    <button className="btn btn--primary" onClick={onGenerateFromNote} disabled={busyB}>
                        {busyB ? "Generating…" : "Generate (From Note)"}
                    </button>
                </Card>
            </div>

            <div style={{ marginTop: 16 }}>
                <Card title="My flashcard sets" tone="purple" subtitle={loadingSets ? "Loading…" : "Click a set to view first card"}>
                    {loadingSets ? (
                        <div className="muted">Loading your sets…</div>
                    ) : sets.length === 0 ? (
                        <div className="muted">No flashcards yet. Generate your first set!</div>
                    ) : (
                        <ul className="list">
                            {sets.map((s) => (
                                <li key={s.id} className={`list__item ${activeId === s.id ? "is-active" : ""}`}>
                                    <button className="link" onClick={() => setActiveId(s.id)} title={s.subject}>
                                        {s.title || s.subject || `Set #${s.id}`}
                                    </button>
                                    <span className="muted" style={{ marginLeft: 8 }}>
                                        {s.source === "ai_note" ? "from note" : "topic"}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            </div>

            {activeId && (
                <div style={{ marginTop: 16 }}>
                    <Card title={active?.title || "Flashcards"} tone="teal" subtitle={total ? `First of ${total} cards` : "No cards"}>
                        {loadingActive ? (
                            <div className="muted">Loading…</div>
                        ) : total ? (
                            <div>
                                <div className="muted" style={{ marginBottom: 6 }}>Front</div>
                                <div style={{ marginBottom: 10 }}>{current.front}</div>
                                <div className="muted" style={{ marginBottom: 6 }}>Back</div>
                                <div style={{ whiteSpace: "pre-wrap" }}>{current.back}</div>
                                {current.hint && <div className="muted" style={{ marginTop: 8 }}>Hint: {current.hint}</div>}
                            </div>
                        ) : <div className="muted">This set has no cards.</div>}
                    </Card>
                </div>
            )}
        </div>
    );
}
