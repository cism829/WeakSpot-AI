import React, { useEffect, useState } from "react";
import { useAuth } from "../context/Authcontext";
import { searchProfessors, requestProfessor } from "../lib/api";

export default function StudentConnectProfessors() {
  const { user } = useAuth();
  const token = user?.token;

  const [name, setName] = useState("");
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // per-row message/time inputs keyed by professor id
  const [msgById, setMsgById] = useState({});
  const [timeById, setTimeById] = useState({});

  const setMsg = (id, v) => setMsgById((s) => ({ ...s, [id]: v }));
  const setTime = (id, v) => setTimeById((s) => ({ ...s, [id]: v }));

  async function load() {
    setBusy(true);
    setErr("");
    try {
      // empty name => list all; name => search by q
      const q = name.trim() || undefined;
      const data = await searchProfessors({ q }, token);
      setItems(data.items || []);
    } catch (e) {
      setErr(e.message || "Failed to load");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load(); // list all on first mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRequest(profId) {
    setBusy(true);
    setErr("");
    try {
      await requestProfessor(
        profId,
        {
          message: msgById[profId] || "",
          preferred_time: timeById[profId] || "",
        },
        token
      );
      alert("Request sent!");
      setMsg(profId, "");
      setTime(profId, "");
    } catch (e) {
      setErr(e.message || "Failed to request");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container">
      <h2>Connect with Professors</h2>

      <div className="grid grid--3 mt">
        <div className="card">
          <div className="card__head"><h3>Search by name</h3></div>
          <div className="card__body">
            <label className="stack">
              <span className="muted">First/Last name</span>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Ada Lovelace"
                onKeyDown={(e) => e.key === "Enter" && load()}
              />
            </label>
            <div className="mt" style={{ display: "flex", gap: 8 }}>
              <button className="btn btn--primary" disabled={busy} onClick={load}>
                {busy ? "Searching…" : "Search"}
              </button>
              <button
                className="btn"
                disabled={busy}
                onClick={() => {
                  setName("");
                  load();
                }}
              >
                Show All
              </button>
            </div>
            {err && <div className="error mt">{err}</div>}
          </div>
        </div>

        <div className="card col-span-2">
          <div className="card__head"><h3>Results</h3></div>
          <div className="card__body">
            {!items.length && <div className="muted">No professors found.</div>}
            <ul className="list">
              {items.map((p) => (
                <li key={p.id} className="list__row">
                  <div>
                    <div className="bold">
                      {p.first_name} {p.last_name}{" "}
                      <span className="muted">({p.email})</span>
                    </div>
                    <div className="muted">
                      Dept: {p.department || "—"} • Courses: {Array.isArray(p.courses) && p.courses.length ? p.courses.join(", ") : "—"}
                    </div>
                    <div className="muted">
                      Office Hours:{" "}
                      {Array.isArray(p.office_hours) && p.office_hours.length
                        ? p.office_hours
                            .map((o) => `${o.day || ""} ${o.start || ""}${o.end ? `-${o.end}` : ""}${o.location ? ` @ ${o.location}` : ""}`.trim())
                            .join("; ")
                        : "—"}
                    </div>
                    <div className="muted">Rating: {p.rating ?? 0}</div>
                    <p>{p.bio}</p>
                  </div>

                  <div className="stack" style={{ minWidth: 260 }}>
                    <input
                      className="input"
                      placeholder="Message…"
                      value={msgById[p.id] || ""}
                      onChange={(e) => setMsg(p.id, e.target.value)}
                    />
                    <input
                      className="input"
                      placeholder="Preferred time (e.g., 2025-10-28 14:00)"
                      value={timeById[p.id] || ""}
                      onChange={(e) => setTime(p.id, e.target.value)}
                    />
                    <button
                      className="btn btn--primary"
                      disabled={busy}
                      onClick={() => handleRequest(p.id)}
                    >
                      Request meeting
                    </button>
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
