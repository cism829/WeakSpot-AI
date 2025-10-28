// src/pages/StudyGroups.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/Authcontext";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export default function StudyGroups() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const clientId = user?.id ?? user?.userId ?? user?.user?.id ?? "";

    const [rooms, setRooms] = useState([]);       // must stay an array
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [selectedRoom, setSelectedRoom] = useState(null);

    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                const res = await fetch(`${API_URL}/rooms`, {
                    headers: { Accept: "application/json" },
                });

                // Try to parse JSON (may fail if server returns HTML)
                let data = null;
                try { data = await res.json(); } catch { data = null; }

                if (!res.ok) {
                    // If the list route doesn’t exist yet, treat as "no rooms"
                    if (res.status === 404) {
                        if (!ignore) setRooms([]);
                    } else {
                        if (!ignore) {
                            setErr((data && (data.detail || data.error)) || `Failed to load rooms (${res.status})`);
                            setRooms([]); // keep render safe
                        }
                    }
                    return;
                }

                // Normalize: accept either an array or { rooms: [...] }
                const list = Array.isArray(data) ? data : (Array.isArray(data?.rooms) ? data.rooms : []);
                if (!ignore) setRooms(list);
            } catch (e) {
                if (!ignore) {
                    setErr(String(e?.message || e));
                    setRooms([]); // safe fallback so .map never crashes
                }
            } finally {
                if (!ignore) setLoading(false);
            }
        })();
        return () => { ignore = true; };
    }, []);

    useEffect(() => {
        if (selectedRoom) navigate(`/chat/${selectedRoom}`);
    }, [selectedRoom, navigate]);

    async function verifyAccess(roomId, userId, password) {
        const form = new FormData();
        form.append("user_id", userId);
        form.append("password", password);
        const res = await fetch(`${API_URL}/rooms/${roomId}/verify`, { method: "POST", body: form });
        if (res.ok) return true;
        let err;
        try { err = await res.json(); } catch { err = null; }
        alert(err?.detail || "Access denied");
        return false;
    }

    const handleJoinRoom = async (room) => {
        if (!clientId) {
            alert("Please sign in first.");
            return;
        }
        const res = await fetch(
            `${API_URL}/rooms/${room.room_id}/access?user_id=${encodeURIComponent(clientId)}`
        );
        const data = await res.json();

        if (data.is_private === "public") {
            setSelectedRoom(room.room_id);
            return;
        }
        if (data.is_private === "private" && !data.has_access) {
            const password = prompt("Enter room password:");
            if (!password) return;
            const ok = await verifyAccess(room.room_id, clientId, password);
            if (!ok) return;
        }
        setSelectedRoom(room.room_id);
    };

    // Render-safe alias (prevents "rooms.map is not a function")
    const list = Array.isArray(rooms) ? rooms : [];

    return (
        <div className="container" style={{ maxWidth: 900, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
                <h2>👥 Study Groups</h2>
                <Link to="/createroom"><button>Create new room</button></Link>
            </div>

            {loading && <p className="muted">Loading rooms…</p>}
            {err && <p className="error">Error: {err}</p>}

            {!loading && !err && list.length === 0 && (
                <div className="empty">
                    <p>No rooms yet.</p>
                    <Link to="/createroom"><button>Create the first room</button></Link>
                </div>
            )}

            <div className="rooms" style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: 16, marginTop: 16
            }}>
                {list.map(r => (
                    <div className="room-box" key={r.room_id} style={{ border: "1px solid #e6e6e6", borderRadius: 12, padding: 16 }}>
                        <h3 style={{ margin: "0 0 6px" }}>{r.room_name}</h3>
                        <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{r.room_subject}</div>
                        <p style={{ minHeight: 40 }}>{r.description}</p>
                        <span className="badge">{r.is_private === "private" ? "Private" : "Public"}</span>
                        <div style={{ marginTop: 12 }}>
                            <button onClick={() => handleJoinRoom(r)}>Join Room</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
