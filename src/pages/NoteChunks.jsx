import React, { useEffect, useState } from "react";
import Card from "../components/Card";
import { useAuth } from "../context/Authcontext";
import { listMyNotes } from "../lib/api";
import { chunkBackfill, chunkOne } from "../lib/api";

const noteLabel = (n) => {
    const base =
        n.filename || n.name || n.title ||
        (n.preview_text ? n.preview_text.slice(0, 60) : `Note ${String(n.id).slice(0, 8)}`);
    const date = n.created_at ? new Date(n.created_at).toLocaleString() : "";
    return date ? `${base} — ${date}` : base;
};

export default function NoteChunks() {
    const { user } = useAuth();
    const token = user?.token;

    const [notes, setNotes] = useState([]);
    const [selectedId, setSelectedId] = useState("");
    const [maxChars, setMaxChars] = useState(800);
    const [overlap, setOverlap] = useState(80);
    const [embedModel, setEmbedModel] = useState("text-embedding-3-small");
    const [onlyMissing, setOnlyMissing] = useState(true);

    const [busyAll, setBusyAll] = useState(false);
    const [busyOne, setBusyOne] = useState(false);
    const [err, setErr] = useState("");
    const [log, setLog] = useState("");

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const res = await listMyNotes(token);
                if (alive && Array.isArray(res)) setNotes(res);
            } catch (e) { /* ignore */ }
        })();
        return () => { alive = false; };
    }, [token]);

    const runAll = async () => {
        setErr(""); setLog(""); setBusyAll(true);
        try {
            const out = await chunkBackfill({
                only_missing: onlyMissing, max_chars: maxChars, overlap, embed_model: embedModel
            }, token);
            setLog(JSON.stringify(out, null, 2));
        } catch (e) {
            setErr(e?.message || "Backfill failed.");
        } finally {
            setBusyAll(false);
        }
    };

    const runOne = async () => {
        if (!selectedId) return setErr("Pick a note.");
        setErr(""); setLog(""); setBusyOne(true);
        try {
            const out = await chunkOne(selectedId, { max_chars: maxChars, overlap, embed_model: embedModel }, token);
            setLog(JSON.stringify(out, null, 2));
        } catch (e) {
            setErr(e?.message || "Chunking failed.");
        } finally {
            setBusyOne(false);
        }
    };

    return (
        <div className="container" style={{ maxWidth: 1000 }}>
            <h2>Note Chunking & Embeddings</h2>
            {err && <div className="alert alert--error" style={{ marginBottom: 12 }}>{err}</div>}

            <div className="grid grid--2" style={{ gap: 16 }}>
                <Card title="Backfill (all notes)" subtitle="Write missing chunks/embeddings">
                    <div className="grid grid--2" style={{ gap: 12 }}>
                        <label><div className="muted">Max chars</div>
                            <input className="input" type="number" value={maxChars} onChange={(e) => setMaxChars(+e.target.value)} />
                        </label>
                        <label><div className="muted">Overlap</div>
                            <input className="input" type="number" value={overlap} onChange={(e) => setOverlap(+e.target.value)} />
                        </label>
                        <label><div className="muted">Embed model</div>
                            <input className="input" value={embedModel} onChange={(e) => setEmbedModel(e.target.value)} />
                        </label>
                        <label className="row" style={{ alignItems: "center", gap: 8, marginTop: 6 }}>
                            <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
                            <span>Only notes with no chunks</span>
                        </label>
                    </div>
                    <button className="btn btn--primary" onClick={runAll} disabled={busyAll}>
                        {busyAll ? "Running…" : "Backfill Chunks"}
                    </button>
                </Card>

                <Card title="Single note" subtitle="Chunk one selected note">
                    <label>
                        <div className="muted">Note</div>
                        <select className="input" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                            <option value="">-- Select a note --</option>
                            {notes.map(n => <option key={String(n.id)} value={String(n.id)}>{noteLabel(n)}</option>)}
                        </select>
                    </label>
                    <div className="row" style={{ gap: 8, marginTop: 8 }}>
                        <button className="btn btn--primary" onClick={runOne} disabled={busyOne || !selectedId}>
                            {busyOne ? "Chunking…" : "Chunk This Note"}
                        </button>
                    </div>
                </Card>

                <Card title="Output log" tone="yellow" full>
                    <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{log || "No output yet."}</pre>
                </Card>
            </div>
        </div>
    );
}
