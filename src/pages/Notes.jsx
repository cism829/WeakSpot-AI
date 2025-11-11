import React, { useEffect, useState } from "react";
import Card from "../components/Card";
import FileUploader from "../components/FileUploader";
import { useAuth } from "../context/Authcontext";
import { listMyNotes, uploadNoteFile, createNote, deleteNote } from "../lib/api";
import { ocrRepairSuggest } from "../lib/api";
import { useNavigate } from "react-router-dom";

export default function Notes() {
    const { user } = useAuth();
    const token = user?.token;
    const nav = useNavigate();

    const [notes, setNotes] = useState([]);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const [text, setText] = useState("");

    async function refresh() {
        try {
            setErr("");
            const data = await listMyNotes(token);
            setNotes(data);
        } catch (e) {
            setErr(e?.detail || e?.message || "Failed to load notes");
        }
    }

    useEffect(() => { refresh(); }, []); // on mount

    async function handleUpload(files) {
        if (!files?.length) return;
        setBusy(true);
        setErr("");
        try {
            for (const f of files) {
                await uploadNoteFile(f, token);
            }
            await refresh();
        } catch (e) {
            setErr(e?.detail || e?.message || "Upload failed");
        } finally {
            setBusy(false);
        }
    }

    async function handleCreateText() {
        if (!text.trim()) return;
        setBusy(true);
        setErr("");
        try {
            await createNote(text, token);
            setText("");
            await refresh();
        } catch (e) {
            setErr(e?.detail || e?.message || "Create failed");
        } finally {
            setBusy(false);
        }
    }

    async function handleDelete(id) {
        if (!window.confirm("Delete this note?")) return;
        try {
            await deleteNote(id, token);
            await refresh();
        } catch (e) {
            alert(e?.detail || e?.message || "Delete failed");
        }
    }

    // NEW: suggest a repair and jump to repair page
    async function handleRepair(noteId) {
        try {
            const out = await ocrRepairSuggest(noteId, token); // { repair_id, ... }
            if (out?.repair_id) {
                nav(`/notes/repair/${out.repair_id}`);
            } else {
                alert("No repair suggestion created.");
            }
        } catch (e) {
            alert(e?.detail || e?.message || "Failed to create repair suggestion");
        }
    }

    return (
        <div className="container">
            <h2>📝 My Notes</h2>
            {err && <div className="alert alert--error">{String(err)}</div>}
            <div className="grid grid--2">
                <Card title="Upload notes" tone="blue">
                    <FileUploader onFiles={handleUpload} />
                    <div className="muted" style={{ marginTop: 8 }}>
                        PDF/DOC images will be ingested; plain text files are read immediately.
                    </div>
                </Card>
                <Card title="Or paste text" tone="green">
                    <textarea
                        className="input"
                        rows={6}
                        placeholder="Paste raw notes text here..."
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                    />
                    <div className="row" style={{ marginTop: 8, gap: 8 }}>
                        <button className="btn" disabled={busy || !text.trim()} onClick={handleCreateText}>
                            Save note
                        </button>
                    </div>
                </Card>
                <Card title="Your uploads" full>
                    <ul className="list">
                        {notes.map((n) => (
                            <li key={n.id} className="list__row">
                                <div className="col">
                                    <div className="muted" style={{ fontSize: 12 }}>
                                        {n.created_at?.slice(0, 19).replace("T", " ")}
                                    </div>
                                    <div className="ellipsis">{n.preview_text || <i>(no text yet)</i>}</div>
                                </div>
                                <span className={`badge ${n.status === "processed" ? "badge--success" : ""}`}>
                                    {n.status}
                                </span>
                                <div className="row" style={{ gap: 8 }}>
                                    <button className="btn btn--sm" onClick={() => nav(`/notes-analysis/${n.id}`)}>
                                        Analyze
                                    </button>
                                    {/* NEW: Repair OCR */}
                                    <button className="btn btn--sm" onClick={() => handleRepair(n.id)}>
                                        Repair OCR
                                    </button>
                                    <button className="btn btn--sm" onClick={() => handleDelete(n.id)}>
                                        Delete
                                    </button>
                                </div>
                            </li>
                        ))}
                        {!notes.length && <li className="muted">No notes yet.</li>}
                    </ul>
                </Card>
            </div>
        </div>
    );
}
