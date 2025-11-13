import { useEffect, useState } from "react";
import { useAuth } from "../../context/Authcontext";
import { listIncomingConnections, acceptConnection, declineConnection } from "../../lib/api";

const tone = (s) => (s === "accepted" ? "green" : s === "declined" ? "red" : "blue");

export default function TutorRequests() {
    const { user } = useAuth();
    const token = user?.token;
    const [items, setItems] = useState([]);
    const [err, setErr] = useState("");
    const [busyId, setBusyId] = useState("");

    async function load() {
        setErr("");
        try {
            const rows = await listIncomingConnections(token);
            // show only tutor-targeted requests on this page
            setItems((rows || []).filter(r => r.target?.type === "tutor"));
        } catch (e) {
            setErr(e.message || "Failed to load");
        }
    }

    useEffect(() => { load(); }, []);

    async function act(id, fn) {
        setBusyId(id);
        try {
            await fn(id, token);
            await load();
        } catch (e) {
            setErr(e.message || "Action failed");
        } finally {
            setBusyId("");
        }
    }

    return (
        <div className="container">
            <h2>Incoming Requests (Tutor)</h2>
            {err && <div className="error mt">{err}</div>}
            {!items.length ? (
                <div className="muted mt">No requests.</div>
            ) : (
                <ul className="list mt">
                    {items.map(r => (
                        <li key={r.id} className="list__row">
                            <div>
                                <div className="bold">
                                    {r.from_user?.first_name} {r.from_user?.last_name}
                                    <span className={`pill pill--${tone(r.status)}`} style={{ marginLeft: 8 }}>{r.status}</span>
                                </div>
                                <div className="muted">{r.from_user?.email}</div>
                                <div className="muted">Preferred: {r.preferred_time || "—"}</div>
                                <p>{r.message || "—"}</p>
                            </div>
                            <div className="stack" style={{ minWidth: 220 }}>
                                <button className="btn btn--primary" disabled={busyId === r.id} onClick={() => act(r.id, acceptConnection)}>
                                    {busyId === r.id ? "Working…" : "Accept"}
                                </button>
                                <button className="btn" disabled={busyId === r.id} onClick={() => act(r.id, declineConnection)}>
                                    Decline
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
