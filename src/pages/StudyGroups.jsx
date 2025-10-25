import React, { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { listRooms, checkRoomAccess, verifyRoomAccess } from "../lib/api";
import { useAuth } from "../context/Authcontext";

export default function StudyGroups() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [rooms, setRooms] = useState([]);
    const [selectedRoom, setSelectedRoom] = useState(null);

    useEffect(() => {
        (async () => {
            try {
                const data = await listRooms(); // GET /groupchat/rooms
                setRooms(data || []);
            } catch (e) {
                console.error("Failed to fetch rooms:", e);
            }
        })();
    }, []);

    useEffect(() => {
        if (selectedRoom) {
            navigate(`/chat/${selectedRoom}`);
        }
    }, [selectedRoom, navigate]);

    const handleJoinRoom = async (room) => {
        try {
            // Check current access
            if (!user?.id) {
                alert("You must be logged in.");
                return;
            }
            let accessData = await checkRoomAccess(room.room_id);

            // Public room => go
            if (accessData?.is_private === "public" || accessData?.has_access === true) {
                setSelectedRoom(room.room_id);
                return;
            }

            // Private and not allowed yet => prompt + verify
            if (accessData?.is_private === "private" && !accessData?.has_access) {
                const password = prompt("Enter room password:");
                if (!password) return;
                await verifyRoomAccess(room.room_id, { password });
                // Recheck access
                accessData = await checkRoomAccess(room.room_id);
                if (!accessData?.has_access) {
                    alert("You do not have access to this room.");
                    return;
                }
            }

            setSelectedRoom(room.room_id);
        } catch (e) {
            console.error(e);
            alert("Unable to join this room.");
        }
    };

    return (
        <div className="container">
            <h2>👥 Study Groups</h2>
            <Link to="/createroom">
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
