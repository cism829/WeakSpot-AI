import React, { useEffect, useState } from "react";
import { useAuth } from "../context/Authcontext";
import { searchTutors, requestTutor, listMyConnections } from "../lib/api";

export default function StudentConnectTutors() {
  const { user } = useAuth();
  const token = user?.token;

  const [name, setName] = useState("");
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // per-row message/time
  const [msgById, setMsgById] = useState({});
  const [timeById, setTimeById] = useState({});
  const [statusByTutorId, setStatusByTutorId] = useState({});
  const setMsg = (id, v) => setMsgById((s) => ({ ...s, [id]: v }));
  const setTime = (id, v) => setTimeById((s) => ({ ...s, [id]: v }));

  async function load() {
    setBusy(true);
    setErr("");
    try {
      const q = name.trim() || undefined; // empty => list all
      const data = await searchTutors({ q }, token);
      setItems(data.items || []);
      // fetch my outgoing requests to mark statuses
      const mine = await listMyConnections(token);
      const map = {};
      (mine || []).forEach(r => {
        if (r.target_type === "tutor") map[r.target_id] = r.status; // pending/accepted/declined
      });
      setStatusByTutorId(map);
    } catch (e) {
      setErr(e.message || "Failed to load");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load(); // list all initially
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRequest(tutorId) {
    setBusy(true);
    setErr("");
    try {
      await requestTutor(
        tutorId,
        {
          message: msgById[tutorId] || "",
          preferred_time: (timeById[tutorId] || "").trim(),
        },
        token
      );
      // reflect 'pending' immediately and refresh list
      setStatusByTutorId(s => ({ ...s, [tutorId]: "pending" }));
      await load(); setMsg(tutorId, "");
      setTime(tutorId, "");
    } catch (e) {
      setErr(e.message || "Failed to request");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container">
      <h2>Find a Tutor</h2>

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
                placeholder="e.g., Grace Hopper"
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
            {!items.length && <div className="muted">No tutors found.</div>}
            <ul className="list">
              {items.map((t) => {
                const status = statusByTutorId[t.id];
                const statusClass =
                  status === "accepted"
                    ? "pill pill--ok"
                    : status === "declined"
                      ? "pill pill--bad"
                      : "pill";

                return (
                  <li key={t.id} className="list__row">
                    <div>
                      <div className="bold">
                        {t.first_name} {t.last_name}{" "}
                        <span className="muted">({t.email})</span>
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
                        Subjects:{" "}
                        {Array.isArray(t.subjects) && t.subjects.length
                          ? t.subjects.join(", ")
                          : "—"}
                      </div>

                      <div className="muted">
                        Rate: ${t.hourly_rate ?? 0}/hr • Rating: {t.rating ?? 0}
                      </div>

                      <div className="muted">
                        Availability:{" "}
                        {Array.isArray(t.availability) && t.availability.length
                          ? t.availability.join(", ")
                          : "—"}
                      </div>

                      {/* NEW: quick-pick buttons from availability */}
                      {Array.isArray(t.availability) && t.availability.length > 0 && (
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
                            {t.availability.map((slot, idx) => (
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
                                onClick={() => setTime(t.id, slot)}
                              >
                                {slot}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {t.bio && <p>{t.bio}</p>}
                    </div>

                    {/* Right-hand side: message + preferred time + request button */}
                    <div className="stack" style={{ minWidth: 260 }}>
                      <label className="stack">
                        <span className="muted" style={{ fontSize: 12 }}>
                          Message to tutor (optional)
                        </span>
                        <input
                          className="input"
                          placeholder="Short note about what you need help with…"
                          value={msgById[t.id] || ""}
                          onChange={(e) => setMsg(t.id, e.target.value)}
                        />
                      </label>

                      <label className="stack">
                        <span className="muted" style={{ fontSize: 12 }}>
                          Preferred time
                        </span>
                        <input
                          className="input"
                          placeholder="E.g., Wed 3–4pm or 'this weekend evening'"
                          value={timeById[t.id] || ""}
                          onChange={(e) => setTime(t.id, e.target.value)}
                        />
                        <span className="muted" style={{ fontSize: 11 }}>
                          You can type your own time or click one of the availability chips above.
                        </span>
                      </label>

                      <button
                        className="btn btn--primary"
                        disabled={
                          busy ||
                          statusByTutorId[t.id] === "pending" ||
                          statusByTutorId[t.id] === "accepted"
                        }
                        onClick={() => handleRequest(t.id)}
                      >
                        {statusByTutorId[t.id] === "pending"
                          ? "Pending…"
                          : statusByTutorId[t.id] === "accepted"
                            ? "Accepted"
                            : "Request session"}
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
