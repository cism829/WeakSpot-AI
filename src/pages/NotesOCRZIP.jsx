import React, { useState } from "react";
import Card from "../components/Card";
import { useAuth } from "../context/Authcontext";
import { ocrZipUpload } from "../lib/api";

function Row({ label, value }) {
    return (
        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8, marginBottom: 4 }}>
            <div className="muted">{label}</div>
            <div>{value}</div>
        </div>
    );
}

export default function NotesOCRZip() {
    const { user } = useAuth();
    const token = user?.token;
    const [file, setFile] = useState(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const [res, setRes] = useState(null);

    const onUpload = async () => {
        if (!file) return setErr("Choose a .zip of images first.");
        setBusy(true); setErr(""); setRes(null);
        try {
            const out = await ocrZipUpload(file, token);
            setRes(out);
        } catch (e) {
            setErr(e?.message || "Upload failed.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="container" style={{ maxWidth: 900 }}>
            <h2>OCR from ZIP (images → notes)</h2>
            {err && <div className="alert alert--error" style={{ marginBottom: 12 }}>{err}</div>}

            <Card title="Upload .zip of images" subtitle="PNG/JPG/TIFF within a .zip">
                <input
                    type="file"
                    accept=".zip"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <div className="row" style={{ marginTop: 12, gap: 8 }}>
                    <button className="btn btn--primary" onClick={onUpload} disabled={busy || !file}>
                        {busy ? "Processing…" : "Run OCR"}
                    </button>
                    <div className="muted">Each image becomes a new Note; chunks & embeddings are created automatically.</div>
                </div>
            </Card>

            {res && (
                <Card title="Result" tone="green" style={{ marginTop: 16 }}>
                    <Row label="Images processed" value={res.processed} />
                    <Row label="Created (records)" value={res.created?.length ?? 0} />
                    {Array.isArray(res.created) && res.created.length > 0 && (
                        <div style={{ marginTop: 10 }}>
                            <div className="muted" style={{ marginBottom: 6 }}>New notes:</div>
                            <ul className="list">
                                {res.created.map((c, i) => (
                                    <li key={i} className="list__row">
                                        <span>note_id: <code>{c.note_id}</code></span>
                                        {c.repair_id ? (
                                            <span className="muted"> — repair suggested: <code>{c.repair_id}</code> (open in Repair page)</span>
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {Array.isArray(res.failures) && res.failures.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                            <div className="alert alert--error">
                                {res.failures.length} file(s) failed:
                                <ul className="list">
                                    {res.failures.map((f, i) => (
                                        <li key={i}><strong>{f.file}</strong>: {f.error}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
}
