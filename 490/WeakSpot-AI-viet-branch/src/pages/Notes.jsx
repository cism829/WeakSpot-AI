import React, { useEffect, useState } from "react";
import Card from "../components/Card";
import { useAuth } from "../context/Authcontext";
import { listMyNotes, createNote, deleteNote } from "../lib/api";
import { ocrRepairSuggest, ocrZipUpload } from "../lib/api";
import { useNavigate } from "react-router-dom";

function Row({ label, value }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8, marginBottom: 4 }}>
      <div className="muted">{label}</div>
      <div>{value}</div>
    </div>
  );
}

export default function Notes() {
  const { user } = useAuth();
  const token = user?.token;
  const nav = useNavigate();

  const [notes, setNotes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [text, setText] = useState("");

  const [zipFile, setZipFile] = useState(null);
  const [zipBusy, setZipBusy] = useState(false);
  const [zipErr, setZipErr] = useState("");
  const [zipRes, setZipRes] = useState(null);

  async function refresh() {
    try {
      setErr("");
      const data = await listMyNotes(token);
      setNotes(data);
    } catch (e) {
      setErr(e?.detail || e?.message || "Failed to load notes");
    }
  }

  useEffect(() => {
    refresh();
  }, []); 

  async function handleZipUpload() {
    if (!zipFile) {
      setZipErr("Choose a .zip of images first.");
      return;
    }
    setZipBusy(true);
    setZipErr("");
    setZipRes(null);
    try {
      const out = await ocrZipUpload(zipFile, token); 
      setZipRes(out);
      await refresh(); 
    } catch (e) {
      setZipErr(e?.detail || e?.message || "Upload failed.");
    } finally {
      setZipBusy(false);
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

  async function handleRepair(noteId) {
    try {
      const out = await ocrRepairSuggest(noteId, token); 
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
        <Card title="Upload .zip of images (OCR)" tone="blue">
          <input
            type="file"
            accept=".zip"
            onChange={(e) => setZipFile(e.target.files?.[0] || null)}
          />
          <div className="row" style={{ marginTop: 12, gap: 8 }}>
            <button
              className="btn btn--primary"
              onClick={handleZipUpload}
              disabled={zipBusy || !zipFile}
            >
              {zipBusy ? "Processing…" : "Run OCR"}
            </button>
            <div className="muted">
              Each image becomes a new Note; chunks & embeddings are created automatically.
            </div>
          </div>
          {zipErr && <div className="alert alert--error" style={{ marginTop: 12 }}>{zipErr}</div>}
          {zipRes && (
            <Card title="Result" tone="green" style={{ marginTop: 16 }}>
              <Row label="Images processed" value={zipRes.processed} />
              <Row label="Created (records)" value={zipRes.created?.length ?? 0} />
              {Array.isArray(zipRes.created) && zipRes.created.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div className="muted" style={{ marginBottom: 6 }}>New notes:</div>
                  <ul className="list">
                    {zipRes.created.map((c, i) => (
                      <li key={i} className="list__row">
                        <span>
                          note_id: <code>{c.note_id}</code>
                        </span>
                        {c.repair_id ? (
                          <span className="muted">
                            {" "}
                            — repair suggested: <code>{c.repair_id}</code> (open in Repair page)
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {Array.isArray(zipRes.failures) && zipRes.failures.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="alert alert--error">
                    {zipRes.failures.length} file(s) failed:
                    <ul className="list">
                      {zipRes.failures.map((f, i) => (
                        <li key={i}>
                          <strong>{f.file}</strong>: {f.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </Card>
          )}
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
                  {/* Repair OCR */}
                  <button className="btn btn--sm" onClick={() => handleRepair(n.id)}>
                    Repair OCR
                  </button>
                  <button className="btn btn--sm btn--ghost" onClick={() => handleDelete(n.id)}>
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
