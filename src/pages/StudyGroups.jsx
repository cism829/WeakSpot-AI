import React from "react";
import Card from "../components/Card";
import Tabs from "../components/Tabs";
import { useState, useRef, ChangeEvent, useEffect } from "react"
import { Link } from "react-router-dom";
import Chat from "./Chat"

export default function StudyGroups() {
    const [rooms, setRooms] = useState([]);
    const [selectedRoom, setSelectedRoom] = useState(null)

    useEffect(() => {
        fetch("http://localhost:8000/rooms")
            .then(res => res.json())
            .then(data => setRooms(data))
            .catch(err => console.error("Failed to fetch rooms:", err));
    }, []);

    if (selectedRoom) {
        return <Chat room={selectedRoom} />;
    }

    // const myGroups = (
    //     <ul className="list">
    //         <li>AP Chem – Unit 3</li>
    //         <li>Calc II – Friday cram</li>
    //     </ul>
    // );

    // const publicGroups = (
    //     <ul className="list">
    //         <li>World History – open discussion</li>
    //         <li>Physics Problem Solving</li>
    //     </ul>
    // );

    // const recommended = (
    //     <ul className="list">
    //         <li>Biology – Genetics</li>
    //         <li>Statistics – Inference</li>
    //     </ul>
    // );

    return (
        <div className="container">
            
            <h2>👥 Study Groups</h2>
            <Link to='/createroom'>
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
                        <button onClick={() => setSelectedRoom(r.room_id)}>
                            Join Room
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
