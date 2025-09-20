import { useState, useRef } from "react"

function Chat() {
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState("")
    const [room, setRoom] = useState(null)
    const [connected, setConnected] = useState(false)
    const clientId = useRef(Math.floor(Math.random() * 15) + 1).current
    const ws = useRef(null)

    const joinRoom = (roomNumber) => {
        if (ws.current) {
            ws.current.close() // close previous room
        }
        setRoom(roomNumber)
        ws.current = new WebSocket(`ws://localhost:8000/ws/${roomNumber}/${clientId}`)

        ws.current.onopen = () => setConnected(true)
        ws.current.onclose = () => setConnected(false)
        ws.current.onmessage = (event) => {
            const text = event.data;
            let type = "other";

            if (text.startsWith("You:")) {
                type = "user";
            } else if (text.includes("entered") || text.includes("left")) {
                type = "notification";
            }

            setMessages(prev => [...prev, { text, type }]);
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

    return (
        <div>
            <h1>WebSocket Chat</h1>

            <div>
                <button onClick={() => joinRoom(1)}>Join Room 1</button>
                <button onClick={() => joinRoom(2)}>Join Room 2</button>
                <button onClick={() => joinRoom(3)}>Join Room 3</button>
            </div>

            {room && (
    <div className="chat-container">
        <h2>Your ID: <span id="ws-id">{clientId}</span></h2>

        <div className="message">
            <div className="message-box">
                <div id="messages">
                    {messages.map((msg, idx) => (
                        <p key={idx} className={msg.type}>
                            {msg.text}
                        </p>
                    ))}
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
            </div>
        </div>
    </div>
)}

        </div>
    )
}

export default Chat
