import React, { useEffect, useState } from "react";
import Card from "../components/Card";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/Authcontext";
import { ocrGetRepair, ocrApply, ocrReject } from "../lib/api";

export default function NoteRepair() {
  const { user } = useAuth();
  const token = user?.token;
  const { repairId } = useParams();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rep, setRep] = useState(null);
  const [edited, setEdited] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setErr("");
      try {
        const r = await ocrGetRepair(repairId, token); 
        if (!alive) return;
        setRep(r);
        setEdited(r?.suggested_text || "");
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Failed to load repair.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [repairId, token]);

  const doApply = async () => {
    setErr("");
    try {
      const r = await ocrApply(repairId, edited, token);
      setRep(r);
      alert("Applied to note. You can re-run analysis or chunking if needed.");
    } catch (e) {
      setErr(e?.message || "Apply failed.");
    }
  };

  const doReject = async () => {
    setErr("");
    try {
      const r = await ocrReject(repairId, token);
      setRep(r);
      alert("Suggestion rejected.");
    } catch (e) {
      setErr(e?.message || "Reject failed.");
    }
  };

  return (
    <div className="container" style={{ maxWidth: 1000 }}>
      <h2>OCR Repair</h2>
      {err && <div className="alert alert--error" style={{ marginBottom: 10 }}>{err}</div>}

      {loading ? (
        <div className="muted">Loading…</div>
      ) : !rep ? (
        <div className="muted">Not found.</div>
      ) : (
        <div className="grid grid--2" style={{ gap: 16 }}>
          <Card title="Original text">
            <pre style={{ whiteSpace: "pre-wrap" }}>{rep.original_text || "(empty)"}</pre>
          </Card>
          <Card title="Suggested (edit before applying)">
            <textarea
              className="input"
              rows={18}
              value={edited}
              onChange={(e) => setEdited(e.target.value)}
            />
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              <button className="btn btn--primary" onClick={doApply}>Apply to Note</button>
              <button className="btn btn--primary" onClick={doReject}>Reject</button>
            </div>
          </Card>
          <Card title="Suggestion log" tone="yellow" full>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>
              {JSON.stringify(rep.suggestion_log || [], null, 2)}
            </pre>
          </Card>
        </div>
      )}
    </div>
  );
}
