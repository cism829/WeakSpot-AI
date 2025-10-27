import React, { useEffect, useState } from "react";
import Card from "../components/Card";
import { useAuth } from "../context/Authcontext";
import { searchTutors, requestTutor } from "../lib/api";

export default function StudentConnectTutors() {
  const { user } = useAuth();
  const token = user?.token;
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("");
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [message, setMessage] = useState("");
  const [preferredTime, setPreferredTime] = useState("");

  async function load() {
    setBusy(true); setErr("");
    try {
      const data = await searchTutors({ q, subject }, token);
      setItems(data.items || []);
    } catch (e) { setErr(e.message || "Failed to load"); }
    finally { setBusy(false); }
  }
  useEffect(() => { load(); }, []);

  async function handleRequest(tutorId) {
    setBusy(true); setErr("");
    try {
      await requestTutor(tutorId, { message, preferred_time: preferredTime }, token);
      alert("Request sent!");
      setMessage(""); setPreferredTime("");
    } catch (e) { setErr(e.message || "Failed to request"); }
    finally { setBusy(false); }
  }

  return (
    <div className="container">
      <h2>Find a Tutor</h2>
      <div className="grid grid--3 mt">
        <div className="card">
          <div className="card__head"><h3>Search</h3></div>
          <div className="card__body">
            <label className="stack">
              <span className="muted">Keyword</span>
              <input className="input" value={q} onChange={e=>setQ(e.target.value)} placeholder="name or bio..." />
            </label>
            <label className="stack">
              <span className="muted">Subject</span>
              <input className="input" value={subject} onChange={e=>setSubject(e.target.value)} placeholder="e.g., Algebra" />
            </label>
            <button className="btn btn--primary mt" disabled={busy} onClick={load}>Search</button>
            {err && <div className="error mt">{err}</div>}
          </div>
        </div>

        <div className="card col-span-2">
          <div className="card__head"><h3>Results</h3></div>
          <div className="card__body">
            {!items.length && <div className="muted">No tutors yet.</div>}
            <ul className="list">
              {items.map(t => (
                <li key={t.id} className="list__row">
                  <div>
                    <div className="bold">{t.name} <span className="muted">({t.email})</span></div>
                    <div className="muted">Subjects: {t.subjects?.join(", ") || "—"}</div>
                    <div className="muted">Rate: ${t.hourly_rate ?? 0}/hr • Rating: {t.rating ?? 0}</div>
                    <div className="muted">Availability: {t.availability?.join(", ") || "—"}</div>
                    <p>{t.bio}</p>
                  </div>
                  <div className="stack" style={{ minWidth: 260 }}>
                    <input className="input" placeholder="Message to tutor..." value={message} onChange={e=>setMessage(e.target.value)} />
                    <input className="input" placeholder="Preferred time (e.g., 2025-10-28 14:00)" value={preferredTime} onChange={e=>setPreferredTime(e.target.value)} />
                    <button className="btn btn--primary" disabled={busy} onClick={()=>handleRequest(t.id)}>Request session</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
