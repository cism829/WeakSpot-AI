import React, { useEffect, useState } from "react";
import Card from "../components/Card";
import { useAuth } from "../context/Authcontext";
import { listMyNotes, createNote, deleteNote } from "../lib/api";
import { ocrRepairSuggest, ocrZipUpload } from "../lib/api";
import { useNavigate } from "react-router-dom";
import JSZip from "jszip";

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

  const [selFiles, setSelFiles] = useState([]);
  const [upBusy, setUpBusy] = useState(false);
  const [upErr, setUpErr] = useState("");
  const [upRes, setUpRes] = useState(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // on mount

  async function buildZipFromImages(images) {
    const zip = new JSZip();
    let idx = 1;
    for (const f of images) {
      const arrayBuf = await f.arrayBuffer();
      const name =
        (f.name && f.name.replace(/[\\/:*?"<>|]/g, "_")) || `image_${String(idx).padStart(3, "0")}.png`;
      zip.file(name, arrayBuf);
      idx += 1;
    }
    const blob = await zip.generateAsync({ type: "blob" });
    return new File([blob], "images.zip", { type: "application/zip" });
  }

  async function handleMixedUpload() {
    if (!selFiles || selFiles.length === 0) {
      setUpErr("Choose a .zip and/or image files first.");
      return;
    }
    setUpBusy(true);
    setUpErr("");
    setUpRes(null);

    const created = [];
    const failures = [];
    let processed = 0;

    try {
      const zips = [];
      const images = [];
      for (const f of selFiles) {
        const name = f?.name || "";
        const type = f?.type || "";
        if (type === "application/zip" || /\.zip$/i.test(name)) zips.push(f);
        else if ((type && type.startsWith("image/")) || /\.(png|jpe?g|tiff?)$/i.test(name)) images.push(f);
        else failures.push({ file: name || "(unknown)", error: "Unsupported file type" });
      }

      // send .zip directly
      for (const z of zips) {
        try {
          const out = await ocrZipUpload(z, token);
          processed += out?.processed ?? 0;
          if (Array.isArray(out?.created)) {
            for (const c of out.created) {
              created.push({
                note_id: c.note_id || c.id || c.noteId || null,
                repair_id: c.repair_id || null,
                source: "zip",
              });
            }
          }
          if (Array.isArray(out?.failures)) {
            failures.push(...out.failures.map(x => ({ file: x.file, error: x.error })));
          }
        } catch (e) {
          failures.push({ file: z.name, error: e?.detail || e?.message || "Upload failed" });
        }
      }

      // if images, bundle to zip
      if (images.length > 0) {
        try {
          const zipFile = await buildZipFromImages(images);
          const out = await ocrZipUpload(zipFile, token);
          processed += out?.processed ?? images.length;
          if (Array.isArray(out?.created)) {
            for (const c of out.created) {
              created.push({
                note_id: c.note_id || c.id || c.noteId || null,
                repair_id: c.repair_id || null,
                source: "image upload",
              });
            }
          }
          if (Array.isArray(out?.failures)) {
            failures.push(...out.failures.map(x => ({ file: x.file, error: x.error })));
          }
        } catch (e) {
          failures.push({ file: "(images bundle)", error: e?.detail || e?.message || "OCR zip upload failed" });
        }
      }

      setUpRes({ processed, created, failures });
      await refresh();
    } catch (e) {
      setUpErr(e?.detail || e?.message || "Upload failed.");
    } finally {
      setUpBusy(false);
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
        <Card title="Upload notes (ZIP or images)" tone="blue">
          <input
            type="file"
            accept=".zip,image/*"
            multiple
            onChange={(e) => setSelFiles(Array.from(e.target.files || []))}
          />
          <div className="row" style={{ marginTop: 12, gap: 8 }}>
            <button
              className="btn btn--primary"
              onClick={handleMixedUpload}
              disabled={upBusy || !selFiles.length}
            >
              {upBusy ? "Processing…" : "Upload & Process (OCR)"}
            </button>
            <div className="muted">
              {selFiles.length} file(s) selected
            </div>
          </div>

          {upErr && <div className="alert alert--error" style={{ marginTop: 12 }}>{upErr}</div>}

          {upRes && (
            <Card title="Result" tone="green" style={{ marginTop: 16 }}>
              <Row label="Files processed" value={upRes.processed} />
              <Row label="Created (records)" value={upRes.created?.length ?? 0} />
              {Array.isArray(upRes.created) && upRes.created.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div className="muted" style={{ marginBottom: 6 }}>New notes:</div>
                  <ul className="list">
                    {upRes.created.map((c, i) => (
                      <li key={i} className="list__row">
                        <span>note_id: <code>{c.note_id}</code></span>
                        {c.repair_id ? (
                          <span className="muted"> — repair suggested: <code>{c.repair_id}</code></span>
                        ) : null}
                        <span className="muted"> ({c.source})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {Array.isArray(upRes.failures) && upRes.failures.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="alert alert--error">
                    {upRes.failures.length} file(s) failed:
                    <ul className="list">
                      {upRes.failures.map((f, i) => (
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
                  {Boolean(n.has_ocr_repair) &&(
                  <button className="btn btn--sm" onClick={() => handleRepair(n.id)}>
                    Repair OCR
                  </button>
                  )}
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
