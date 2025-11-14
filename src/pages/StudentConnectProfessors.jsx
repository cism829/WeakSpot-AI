import React, { useEffect, useState } from "react";
import { useAuth } from "../context/Authcontext";
import { searchProfessors, requestProfessor, listMyConnections } from "../lib/api";

export default function StudentConnectProfessors() {
  const { user } = useAuth();
  const token = user?.token;

  const [name, setName] = useState("");
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [statusByProfId, setStatusByProfId] = useState({});

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
      const mine = await listMyConnections(token);
      const map = {};
      (mine || []).forEach(r => {
        if (r.target_type === "professor") map[r.target_id] = r.status;
      });
      setStatusByProfId(map);
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
      setStatusByProfId(s => ({ ...s, [profId]: "pending" }));
      await load(); setMsg(profId, "");
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
              {items.map((p) => {
                const status = statusByProfId[p.id];
                const statusClass =
                  status === "accepted"
                    ? "pill pill--ok"
                    : status === "declined"
                      ? "pill pill--bad"
                      : "pill";

                return (
                  <li key={p.id} className="list__row">
                    <div>
                      <div className="bold">
                        {p.first_name} {p.last_name}{" "}
                        <span className="muted">({p.email})</span>
                        {status && (
                          <span
                            className={statusClass}
                            style={{
                              marginLeft: 8,
                              textTransform: "capitalize",
                            }}
                          >
                            {status}
                          </span>
                        )}
                      </div>

                      <div className="muted">
                        Dept: {p.department || "—"} • Courses:{" "}
                        {Array.isArray(p.courses) && p.courses.length
                          ? p.courses.join(", ")
                          : "—"}
                      </div>

                      <div className="muted">
                        Office hours:{" "}
                        {Array.isArray(p.office_hours) && p.office_hours.length
                          ? p.office_hours
                            .map((o) =>
                              [
                                o.day,
                                o.start && o.end
                                  ? `${o.start}-${o.end}`
                                  : o.start || o.end,
                                o.location && `@ ${o.location}`,
                              ]
                                .filter(Boolean)
                                .join(" ")
                            )
                            .join("; ")
                          : "—"}
                      </div>

                      {/* NEW: quick-pick buttons from office hours */}
                      {Array.isArray(p.office_hours) && p.office_hours.length > 0 && (
                        <div style={{ marginTop: 4 }}>
                          <div className="muted" style={{ fontSize: 12 }}>
                            Quick time picks (click to fill the box on the right):
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 4,
                              marginTop: 4,
                            }}
                          >
                            {p.office_hours.map((o, idx) => {
                              const labelParts = [
                                o.day,
                                o.start && o.end
                                  ? `${o.start}-${o.end}`
                                  : o.start || o.end,
                              ].filter(Boolean);

                              const label =
                                labelParts.length > 0 ? labelParts.join(" ") : "Office hours";

                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  className="pill"
                                  style={{
                                    cursor: "pointer",
                                    border: "none",
                                    background: "var(--blue-soft)",
                                  }}
                                  disabled={busy}
                                  onClick={() => setTime(p.id, label)}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {p.bio && <p>{p.bio}</p>}
                    </div>

                    {/* Right-hand side: message + preferred time + request button */}
                    <div className="stack" style={{ minWidth: 260 }}>
                      <label className="stack">
                        <span className="muted" style={{ fontSize: 12 }}>
                          Message to professor (optional)
                        </span>
                        <input
                          className="input"
                          placeholder="Short note about what you need help with…"
                          value={msgById[p.id] || ""}
                          onChange={(e) => setMsg(p.id, e.target.value)}
                        />
                      </label>

                      <label className="stack">
                        <span className="muted" style={{ fontSize: 12 }}>
                          Preferred time
                        </span>
                        <input
                          className="input"
                          placeholder="E.g., Mon 3–4pm or 'anytime during office hours'"
                          value={timeById[p.id] || ""}
                          onChange={(e) => setTime(p.id, e.target.value)}
                        />
                        <span className="muted" style={{ fontSize: 11 }}>
                          You can type your own time or click one of the quick picks above.
                        </span>
                      </label>

                      <button
                        className="btn btn--primary"
                        disabled={
                          busy ||
                          statusByProfId[p.id] === "pending" ||
                          statusByProfId[p.id] === "accepted"
                        }
                        onClick={() => handleRequest(p.id)}
                      >
                        {statusByProfId[p.id] === "pending"
                          ? "Pending…"
                          : statusByProfId[p.id] === "accepted"
                            ? "Accepted"
                            : "Request meeting"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
