// src/pages/StudyGroups.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/Authcontext";

export default function StudyGroups() {
    const navigate = useNavigate();
    const { user } = useAuth();

    // robust fallback in case your auth shape varies
    const clientId = user?.id ?? user?.userId ?? user?.user?.id ?? "";

    const [rooms, setRooms] = useState([]);
    const [selectedRoom, setSelectedRoom] = useState(null);

    useEffect(() => {
        fetch("http://localhost:8000/rooms")
            .then((res) => res.json())
            .then((data) => setRooms(data))
            .catch((err) => console.error("Failed to fetch rooms:", err));
    }, []);

    useEffect(() => {
        if (selectedRoom) {
            // route only needs room; Chat will read clientId from auth
            navigate(`/chat/${selectedRoom}`);
        }
    }, [selectedRoom, navigate]);

    async function verifyAccess(roomId, userId, password) {
        const formData = new FormData();
        formData.append("user_id", userId);
        formData.append("password", password);

        const response = await fetch(`http://127.0.0.1:8000/rooms/${roomId}/verify`, {
            method: "POST",
            body: formData,
        });
        if (response.ok) return true;

        const err = await response.json();
        alert(err.detail || "Access denied");
        return false;
    }

    const handleJoinRoom = async (room) => {
        const accessRes = await fetch(
            `http://127.0.0.1:8000/rooms/${room.room_id}/access?user_id=${encodeURIComponent(clientId)}`
        );
        const accessData = await accessRes.json();

        if (accessData.is_private === "public") {
            setSelectedRoom(room.room_id);
            return;
        }

        if (accessData.is_private === "private" && !accessData.has_access) {
            const password = prompt("Enter room password:");
            const accessGranted = await verifyAccess(room.room_id, clientId, password);
            if (!accessGranted) return;
        }
        setSelectedRoom(room.room_id);
    };

    return (
        <div className="container">
            <h2>👥 Study Groups</h2>
            <Link to={"/createroom"}>
                <button>Create new room</button>
            </Link>

            <div className="rooms">
                {rooms.map((r) => (
                    <div className="room-box" key={r.room_id}>
                        <h2>{r.room_name}</h2>
                        <p>{r.description}</p>
                        <button onClick={() => handleJoinRoom(r)}>Join Room</button>
                    </div>
                ))}
            </div>
        </div>
    );
}
