// src/pages/student/StudentRequests.jsx
import { useEffect, useState } from "react";
import { useAuth } from "../context/Authcontext";
import { listMyConnections } from "../lib/api";

const tone = (s) => (s === "accepted" ? "green" : s === "declined" ? "red" : "blue");

export default function StudentRequests() {
    const { user } = useAuth();
    const token = user?.token;
    const [items, setItems] = useState([]);
    const [err, setErr] = useState("");

    useEffect(() => {
        (async () => {
            try {
                const rows = await listMyConnections(token);
                setItems(rows || []);
            } catch (e) { setErr(e.message || "Failed to load"); }
        })();
    }, [token]);

    return (
        <div className="container">
            <h2>My Requests</h2>
            {err && <div className="error mt">{err}</div>}
            {!items.length ? <div className="muted mt">No requests yet.</div> :
                <ul className="list mt">
                    {items.map(r => (
                        <li key={r.id} className="list__row">
                            <div>
                                <div className="bold">
                                    To {r.target?.type}: {r.target?.first_name} {r.target?.last_name}
                                    <span className={`pill pill--${tone(r.status)}`} style={{ marginLeft: 8 }}>
                                        {r.status}
                                    </span>
                                </div>
                                <div className="muted">Preferred: {r.preferred_time || "—"}</div>
                                <p>{r.message || "—"}</p>
                            </div>
                        </li>
                    ))}
                </ul>}
        </div>
    );
}
