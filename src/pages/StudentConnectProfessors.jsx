import React, { useEffect, useState } from "react";
import Card from "../components/Card";
import { useAuth } from "../context/Authcontext";
import { searchProfessors, requestProfessor } from "../lib/api";

export default function StudentConnectProfessors() {
  const { user } = useAuth();
  const token = user?.token;
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [message, setMessage] = useState("");
  const [preferredTime, setPreferredTime] = useState("");

  async function load() {
    setBusy(true); setErr("");
    try {
      const data = await searchProfessors({ q, dept }, token);
      setItems(data.items || []);
    } catch (e) { setErr(e.message || "Failed to load"); }
    finally { setBusy(false); }
  }
  useEffect(() => { load(); }, []);

  async function handleRequest(profId) {
    setBusy(true); setErr("");
    try {
      await requestProfessor(profId, { message, preferred_time: preferredTime }, token);
      alert("Request sent!");
      setMessage(""); setPreferredTime("");
    } catch (e) { setErr(e.message || "Failed to request"); }
    finally { setBusy(false); }
  }

  return (
    <div className="container">
      <h2>Connect with Professors</h2>
      <div className="grid grid--3 mt">
        <div className="card">
          <div className="card__head"><h3>Search</h3></div>
          <div className="card__body">
            <label className="stack">
              <span className="muted">Keyword</span>
              <input className="input" value={q} onChange={e=>setQ(e.target.value)} placeholder="name or bio..." />
            </label>
            <label className="stack">
              <span className="muted">Department</span>
              <input className="input" value={dept} onChange={e=>setDept(e.target.value)} placeholder="e.g., CS" />
            </label>
            <button className="btn btn--primary mt" disabled={busy} onClick={load}>Search</button>
            {err && <div className="error mt">{err}</div>}
          </div>
        </div>

        <div className="card col-span-2">
          <div className="card__head"><h3>Results</h3></div>
          <div className="card__body">
            {!items.length && <div className="muted">No professors yet.</div>}
            <ul className="list">
              {items.map(p => (
                <li key={p.id} className="list__row">
                  <div>
                    <div className="bold">{p.name} <span className="muted">({p.email})</span></div>
                    <div className="muted">Dept: {p.department || "—"} • Courses: {p.courses?.join(", ") || "—"}</div>
                    <div className="muted">Office Hours: {Array.isArray(p.office_hours) ? p.office_hours.map(o => `${o.day} ${o.start}-${o.end} @ ${o.location}`).join("; ") : "—"}</div>
                    <div className="muted">Rating: {p.rating ?? 0}</div>
                    <p>{p.bio}</p>
                  </div>
                  <div className="stack" style={{ minWidth: 260 }}>
                    <input className="input" placeholder="Message..." value={message} onChange={e=>setMessage(e.target.value)} />
                    <input className="input" placeholder="Preferred time (e.g., 2025-10-28 14:00)" value={preferredTime} onChange={e=>setPreferredTime(e.target.value)} />
                    <button className="btn btn--primary" disabled={busy} onClick={()=>handleRequest(p.id)}>Request meeting</button>
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
