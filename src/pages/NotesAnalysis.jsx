
import React, { useEffect, useState } from "react";
import Card from "../components/Card";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { getNote, analyzeNote, getLatestAnalysis } from "../lib/api";
import { useAuth } from "../context/Authcontext";

export default function NotesAnalysis() {
    const { id } = useParams();
    const { user } = useAuth();
    const token = user?.token;
    const nav = useNavigate();
    const [note, setNote] = useState(null);
    const [ana, setAna] = useState(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");

    useEffect(() => {
        async function run() {
            if (!id) return;
            setErr("");
            try {
                const n = await getNote(id, token);
                setNote(n);
                try {
                    const a = await getLatestAnalysis(id, token);
                    setAna(a);
                } catch {
                    setAna(null);
                }
            } catch (e) {
                setErr(e?.detail || e?.message || "Failed to load note");
            }
        }
        run();
    }, [id]);

    async function handleAnalyze() {
        if (!id) return;
        setBusy(true); setErr("");
        try {
            const res = await analyzeNote(id, token);
            setAna(res);
        } catch (e) {
            setErr(e?.detail || e?.message || "Analyze failed");
        } finally {
            setBusy(false);
        }
    }

    if (!id) {
        return (
            <div className="container">
                <h2>🔍 Notes Analysis</h2>
                <div className="muted">Open this page with a note id (e.g., /notes-analysis/NOTE_ID)</div>
            </div>
        );
    }

    return (
        <div className="container">
            <h2>🔍 Notes Analysis</h2>
            {err && <div className="alert alert--error">{String(err)}</div>}
            <div className="grid grid--2">
                <Card title="Note preview" tone="yellow">
                    <div style={{ whiteSpace: "pre-wrap" }}>
                        {note?.content_text || <i>(no text)</i>}
                    </div>
                </Card>
                <Card title="Actions" tone="blue">
                    <button className="btn" onClick={handleAnalyze} disabled={busy}>
                        {busy ? "Analyzing..." : "Analyze now"}
                    </button>
                </Card>
                <Card title="Key Concepts" tone="green">
                    {!ana ? <div className="muted">No analysis yet.</div> : (
                        <ul className="list">
                            {(ana.blocks || []).map((b, idx) => (
                                <li key={idx}>
                                    <strong>{b.heading || b.title || `Block ${idx + 1}`}</strong>
                                    {b.key_points && (
                                        <ul className="list" style={{ marginTop: 6 }}>
                                            {b.key_points.map((t, i) => (<li key={i}>{t}</li>))}
                                        </ul>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
                <Card title="Summary" tone="purple">
                    {!ana ? <div className="muted">No summary yet.</div> : (
                        <div style={{ whiteSpace: "pre-wrap" }}>{ana.summary}</div>
                    )}
                </Card>
            </div>
        </div>
    );
}
