import React from "react";
import Card from "../components/Card";
import Tabs from "../components/Tabs";
import { useState, useRef, ChangeEvent, useEffect } from "react"
import { useNavigate } from "react-router-dom";
import { useParams } from "react-router-dom";
import { Link } from "react-router-dom";
import Chat from "./Chat"
import { useAuth } from "../context/Authcontext";

export default function StudyGroups() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const clientId = user?.userId;
    const [rooms, setRooms] = useState([]);
    const [selectedRoom, setSelectedRoom] = useState(null)

    useEffect(() => {
        fetch("http://localhost:8000/rooms")
            .then(res => res.json())
            .then(data => setRooms(data))
            .catch(err => console.error("Failed to fetch rooms:", err));
    }, []);

    if (selectedRoom) {
        console.log("the selected room is:", selectedRoom)
        // return <Chat room={selectedRoom} clientId ={clientId} />;
        navigate("/chat/" + selectedRoom + "/" + clientId)
    }

    async function verifyAccess(roomId, userId, password) {
        const formData = new FormData();
        formData.append("user_id", userId);
        formData.append("password", password);

        const response = await fetch("http://127.0.0.1:8000/rooms/" + roomId + "/verify", {
            method: "POST",
            body: formData,
        });

        if (response.ok) {
            return true;
        } else {
            const err = await response.json();
            alert(err.detail || "Access denied");
            return false;
        }
    }
    const handleJoinRoom = async (room) => {
        let accessRes = await fetch(`http://127.0.0.1:8000/rooms/${room.room_id}/access?user_id=${clientId}`);
        let accessData = await accessRes.json();

        if (accessData.is_private === "public") {
            setSelectedRoom(room.room_id);
            return;
        }

        if (accessData.is_private === "private" && !accessData.has_access) {
            const password = prompt("Enter room password:");
            const accessGranted = await verifyAccess(room.room_id, clientId, password);
            if (!accessGranted) return;

            accessRes = await fetch(`http://127.0.0.1:8000/rooms/${room.room_id}/access?user_id=${clientId}`);
            accessData = await accessRes.json();
        }
        if (!accessData.has_access) {
            alert("You do not have access to this room.");
            return;
        }

        console.log("Access data:", accessData);
        console.log("room info: ", room.room_id)

        setSelectedRoom(room.room_id);
    };



    return (
        <div className="container">

            <h2>👥 Study Groups</h2>
            <Link to={"/createroom"}>
                <button>Create new room</button>
            </Link>

            {/* <Card tone="green">
                <Tabs
                    tabs={[
                        { label: "My Groups", content: myGroups },
                        { label: "Public", content: publicGroups },
                        { label: "Recommended", content: recommended },
                    ]}
                />
            </Card> */}

            <div className="rooms">
                {rooms.map(r => (
                    <div className="room-box" key={r.room_id}>
                        <h2>{r.room_name}</h2>
                        <p>{r.description}</p>
                        <button onClick={() => handleJoinRoom(r)}>
                            {/* <button onClick={async () => {
                            if (r.privacy === "private") {
                                const password = prompt("Enter room password:");
                                const accessGranted = await verifyAccess(r.room_id, clientId, password);
                                if (!accessGranted) return; // stop if password is wrong
                            }
                            setSelectedRoom(r.room_id);
                        }}> */}
                            Join Room
                        </button>

                    </div>
                ))}
            </div>
        </div>
    );
}
