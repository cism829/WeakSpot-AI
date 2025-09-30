import { useState, useRef, ChangeEvent, useEffect } from "react"


function Chat() {
    const [rooms, setRooms] = useState([])
    const [roomsMessages, setRoomsMessages] = useState({})
    const [input, setInput] = useState("")
    const [room, setRoom] = useState(null)
    const [connected, setConnected] = useState(false)
    const [file, setFile] = useState(null);
    const clientId = useRef(Math.floor(Math.random() * 10) + 1).current
    const ws = useRef(null)


    useEffect(()=> {
        fetch("http://localhost:8000/rooms")
            .then(res => res.json())
            .then(data => setRooms(data))
            .catch(err => console.error("Failed to fetch rooms:", err));
    }, [])
   
    let messages = []
    if (room && roomsMessages[room]){
        messages = roomsMessages[room]
    }

    const joinRoom = (roomNumber) => {
        if (ws.current) {
            ws.current.close() // close previous room
        }
        setRoom(roomNumber)
        
        if (!roomsMessages[roomNumber]){
            setRoomsMessages(prev => {
                const newMessages = {...prev}
                newMessages[roomNumber] = []
                return newMessages
            })
        }

        ws.current = new WebSocket(`ws://localhost:8000/ws/${roomNumber}/${clientId}`)

        ws.current.onopen = () => setConnected(true)
        ws.current.onclose = () => setConnected(false)
        ws.current.onmessage = (event) => {
            const text = event.data;
            let type = "other";
            let fileObj = null;

            // if (text.startsWith("You:")) {
            //     type = "user";
            // } else if (text.includes("entered") || text.includes("left")) {
            //     type = "notification";
            // } else if (text.includes("/file:")) {
            //     type = "file";
            //     const parts = text.split(":"); // "/file:file_id:filename"
            //     myFile = { id: parts[1], name: parts[2] };
            // }
            if (text.includes("/file:")) {
                console.log(text)
                type = "file";
                const parts = text.split(":"); // "/file:file_id:filename"
                console.log(parts)
                fileObj = { id: parts[2], name: parts[3] };
            } 
            else if (text.startsWith("You:")) {
                type = "user";
            } 
            else if (text.includes("entered") || text.includes("left")) {
                type = "notification";
            }

            setRoomsMessages(prev => {
                const newMessages = {...prev}
                newMessages[roomNumber] = [...newMessages[roomNumber], {text, type, file: fileObj }]
                return newMessages
            })
        };

        ws.current.onerror = (err) => console.error("WebSocket error", err)
    }

    const sendMessage = (e) => {
        e.preventDefault()
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(input)
            setInput("")
        } else {
            alert("WebSocket not ready. Join a room first!")
        }
    }

    function handleFile(e){
        if (e.target.files){
            setFile(e.target.files[0]);
        }
    }

    const uploadFile = async () => {
        if(!file || !room) return;

        const formData = new FormData();
        formData.append("upload", file);

        try{
            const route_url = "http://localhost:8000/upload/"+room+"/"+clientId;
            const response = await fetch(route_url, {
                method: "POST",
                body: formData
            });
            const data = await response.json();
            console.log("File has been uploaded:", data);

            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                ws.current.send("/file:" + data.file_id + ":" + data.filename);
            }

        }
            catch (err) {
                console.error("Upload failed:", err);
    }
    }

    return (
        <div>
            <h1>Study Group Hubs</h1>

            <div className="rooms">
                {rooms.map(r =>(
                    <div className="room-box" key={r.room_id} >
                        <h2>{r.room_name}</h2>
                        <p>{r.description}</p>
                        <button onClick={() => joinRoom(r.room_id)}>
                            Join Room
                        </button>
                    </div>
                ))}
            </div>

            {room && (
    <div className="chat-container">
        <h2>Your ID: <span id="ws-id">{clientId}</span></h2>
        <h2>Current Room: {rooms.find(r => r.room_id === room)?.room_name}</h2>

        <div className="message">
            <div className="message-box">
                <div id="messages">
                    {messages.map((msg, idx) => {
                        if (msg.type === "file"){
                            return (
                                <p key={idx} className={msg.type}>
                                    <a href={"http://localhost:8000/download/" + msg.file.id} download={msg.file.name}>
                                        {msg.file.name}
                                    </a>
                                </p>
                            )
                        } else {
                            return (
                                <p key={idx} className={msg.type}>
                                {msg.text}
                                </p>
                            )
                            
                        }
                    })}
                </div>
            </div>

            <div className="user-text">
                <form onSubmit={sendMessage}>
                    <input className="user-chat"
                        type="text"
                        id="messageText"
                        autoComplete="off"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        disabled={!connected}
                    />
                    <button type="submit" disabled={!connected}>Send</button>
                </form>
                <input type="file" onChange={handleFile}/>

            </div>
        </div>
        {file && (
                    <div>
                        <p>file name: {file.name}</p>
                        <p>size: {(file.size / 1024).toFixed(2)} KB</p>
                        <p>type: {file.type}</p>
                        <button onClick={uploadFile}>
                            Upload File
                        </button>
                    </div>
                )}
    </div>
)}

        </div>
    )
}

export default Chat
