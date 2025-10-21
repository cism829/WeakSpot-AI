import React, { useEffect, useState } from "react";
import Card from "../components/Card";
import { useAuth } from "../context/Authcontext";
import {
    flashcardsGenerateAI,
    flashcardsGenerateAIFromNote,
    listMyFlashcards,
    getFlashcard,
    listMyNotes, // make sure this exists in ../lib/api (see section 2)
} from "../lib/api";

function errorDetail(e) {
    // handle FastAPI HTTPException: { detail: "..." }
    if (!e) return "Unknown error";
    if (typeof e === "string") return e;
    if (e.detail) return e.detail;
    if (e.message) return e.message;
    try { return JSON.stringify(e).slice(0, 200); } catch { return "Request failed"; }
}

export default function Flashcards() {
    const { user } = useAuth();
    const token = user?.token;

    // topic
    const [topic, setTopic] = useState("");
    const [count, setCount] = useState(10);
    const [busyTopic, setBusyTopic] = useState(false);

    // notes
    const [notes, setNotes] = useState([]);
    const [noteQuery, setNoteQuery] = useState("");
    const [noteTopic, setNoteTopic] = useState("");
    const [noteCount, setNoteCount] = useState(10);
    const [busyNote, setBusyNote] = useState(false);

    // sets
    const [sets, setSets] = useState([]);
    const [loadingSets, setLoadingSets] = useState(false);

    // active set
    const [activeId, setActiveId] = useState(null);
    const [active, setActive] = useState(null);
    const [loadingActive, setLoadingActive] = useState(false);

    // study
    const [idx, setIdx] = useState(0);
    const [flipped, setFlipped] = useState(false);

    // UX
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
                console.error(e);
            } finally {
                if (!cancel) setLoadingSets(false);
            }
        })();
        return () => { cancel = true; };
    }, [token]);

    // load notes
    useEffect(() => {
        let cancel = false;
        (async () => {
            try {
                const res = await listMyNotes(token); // expects [{id, filename, ...}]
                if (!cancel && Array.isArray(res)) setNotes(res);
            } catch (e) {
                // optional—don't error the page if notes API is missing
                console.warn("Notes list failed (optional):", e);
            }
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
                    setIdx(0);
                    setFlipped(false);
                }
            } catch (e) {
                if (!cancel) setErr(`Failed to load selected set: ${errorDetail(e)}`);
                console.error(e);
            } finally {
                if (!cancel) setLoadingActive(false);
            }
        })();
        return () => { cancel = true; };
    }, [activeId, token]);

    // generate from topic
    const onGenerateTopic = async () => {
        if (!topic.trim()) return setErr("Please enter a topic.");
        if (count < 5 || count > 50) return setErr("Number of cards must be between 5 and 50.");
        setBusyTopic(true);
        setErr("");
        try {
            const created = await flashcardsGenerateAI(
                { subject: topic.trim(), num_items: count, title: `${topic.trim()} — flashcards` },
                token
            );
            // add to top and open
            setSets((prev) => [{
                id: created.id, title: created.title, subject: created.subject, source: created.source,
                created_at: new Date().toISOString(),
            }, ...prev]);
            setActiveId(created.id);
        } catch (e) {
            console.error(e);
            setErr(`Generation failed: ${errorDetail(e)}`);
        } finally {
            setBusyTopic(false);
        }
    };

    // generate from note
    const onGenerateFromNote = async () => {
        if (!noteQuery.trim()) return setErr("Pick a note filename.");
        if (noteCount < 5 || noteCount > 50) return setErr("Number of cards must be between 5 and 50.");

        const match = notes.find(
            (n) => String(n.filename || "").toLowerCase() === noteQuery.trim().toLowerCase()
        );
        if (!match) return setErr("No note matches that filename.");

        setBusyNote(true);
        setErr("");
        try {
            const payload = {
                note_id: match.id,
                subject: noteTopic.trim() || match.filename,
                num_items: noteCount,
                title: `Flashcards from ${match.filename}`,
            };
            const created = await flashcardsGenerateAIFromNote(payload, token);
            setSets((prev) => [{
                id: created.id, title: created.title, subject: created.subject, source: created.source,
                created_at: new Date().toISOString(),
            }, ...prev]);
            setActiveId(created.id);
        } catch (e) {
            console.error(e);
            setErr(`Generation from note failed: ${errorDetail(e)}`);
        } finally {
            setBusyNote(false);
        }
    };

    // keyboard shortcuts
    useEffect(() => {
        const onKey = (e) => {
            if (!active?.items?.length) return;
            if (e.code === "Space") { e.preventDefault(); setFlipped((f) => !f); }
            else if (e.code === "ArrowRight") { e.preventDefault(); setFlipped(false); setIdx((i) => Math.min(i + 1, active.items.length - 1)); }
            else if (e.code === "ArrowLeft") { e.preventDefault(); setFlipped(false); setIdx((i) => Math.max(i - 1, 0)); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [active]);

    const total = active?.items?.length || 0;
    const current = total ? active.items[idx] : null;
    const notesAvailable = Array.isArray(notes) && notes.length > 0;

    return (
        <div className="container">
            <h2>🧠 Flashcards & Topic Quizzes</h2>

            {err && <div className="alert alert--error" style={{ marginBottom: 12 }}>{err}</div>}

            <div className="grid grid--2">
                {/* Topic-based */}
                <Card title="Generate flashcards" tone="blue">
                    <label className="field">
                        <span>Topic</span>
                        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g., Photosynthesis" />
                    </label>
                    <label className="field">
                        <span>Number of cards</span>
                        <input type="number" min="5" max="50" value={count} onChange={(e) => setCount(+e.target.value)} />
                    </label>
                    <button className="btn btn--primary" onClick={onGenerateTopic} disabled={busyTopic}>
                        {busyTopic ? "Generating…" : "Generate Flashcards"}
                    </button>
                    <p className="muted" style={{ marginTop: 8 }}>
                        Tip: Keep topics concise. Examples: “Cell organelles”, “Newton’s 3 Laws”.
                    </p>
                </Card>

                {/* Note-based */}
                <Card title="Generate from my note" tone="green" subtitle={notesAvailable ? "Pick a note by filename" : "Notes not found"}>
                    {notesAvailable ? (
                        <>
                            <label className="field">
                                <span>Note filename</span>
                                <input
                                    list="note-filenames"
                                    placeholder="Start typing to search…"
                                    value={noteQuery}
                                    onChange={(e) => setNoteQuery(e.target.value)}
                                />
                                <datalist id="note-filenames">
                                    {notes.map((n) => <option key={n.id} value={n.filename} />)}
                                </datalist>
                                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                                    We’ll use the filename you select and send its ID under the hood.
                                </div>
                            </label>
                            <label className="field">
                                <span>Label/Subject (optional)</span>
                                <input value={noteTopic} onChange={(e) => setNoteTopic(e.target.value)} placeholder="e.g., Unit 2 — Forces" />
                            </label>
                            <label className="field">
                                <span>Number of cards</span>
                                <input type="number" min="5" max="50" value={noteCount} onChange={(e) => setNoteCount(+e.target.value)} />
                            </label>
                            <button className="btn btn--primary" onClick={onGenerateFromNote} disabled={busyNote}>
                                {busyNote ? "Generating…" : "Generate From Note"}
                            </button>
                        </>
                    ) : (
                        <div className="muted">Add notes first, then come back.</div>
                    )}
                </Card>
            </div>

            {/* Sets list */}
            <div style={{ marginTop: 16 }}>
                <Card title="My flashcard sets" tone="purple" subtitle={loadingSets ? "Loading…" : "Click a set to study"}>
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

            {/* Study viewer */}
            {activeId && (
                <div style={{ marginTop: 16 }}>
                    <Card
                        title={active?.title || "Flashcards"}
                        tone="teal"
                        subtitle={loadingActive ? "Loading…" : total ? `Card ${idx + 1} of ${total}` : "No cards"}
                    >
                        {loadingActive ? (
                            <div className="muted">Loading cards…</div>
                        ) : total === 0 ? (
                            <div className="muted">This set has no cards.</div>
                        ) : (
                            <>
                                <div
                                    className={`flashcard ${flipped ? "is-flipped" : ""}`}
                                    onClick={() => setFlipped((f) => !f)}
                                    style={{
                                        cursor: "pointer",
                                        minHeight: 160,
                                        border: "1px solid var(--border)",
                                        borderRadius: 12,
                                        padding: 16,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        textAlign: "center",
                                        transition: "transform 0.2s ease",
                                    }}
                                >
                                    <div>
                                        {!flipped ? (
                                            <>
                                                <div className="muted" style={{ marginBottom: 6 }}>Front</div>
                                                <div>{current.front}</div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="muted" style={{ marginBottom: 6 }}>Back</div>
                                                <div style={{ whiteSpace: "pre-wrap" }}>{current.back}</div>
                                                {current.hint && <div className="muted" style={{ marginTop: 8 }}>Hint: {current.hint}</div>}
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                                    <div className="muted">Click card or press Space to flip</div>
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <button className="btn" onClick={() => { setFlipped(false); setIdx((i) => Math.max(i - 1, 0)); }} disabled={idx === 0}>◀ Prev</button>
                                        <button className="btn" onClick={() => { setFlipped(false); setIdx((i) => Math.min(i + 1, total - 1)); }} disabled={idx >= total - 1}>Next ▶</button>
                                    </div>
                                </div>
                            </>
                        )}
                    </Card>
                </div>
            )}
        </div>
    );
}
