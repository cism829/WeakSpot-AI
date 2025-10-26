// src/pages/Chat.jsx
import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/Authcontext";

function Chat() {
  const { room } = useParams();             // route: /chat/:room
  const { user } = useAuth();
  const clientId = user?.id ?? user?.userId ?? user?.user?.id ?? "";

  const [roomsMessages, setRoomsMessages] = useState({});
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [file, setFile] = useState(null);
  const ws = useRef(null);

  const messages = room && roomsMessages[room] ? roomsMessages[room] : [];

  useEffect(() => {
    if (!room || !clientId) return;

    if (ws.current) ws.current.close();

    // init message list for this room
    setRoomsMessages((prev) => (prev[room] ? prev : { ...prev, [room]: [] }));

    const url = `ws://localhost:8000/ws/${room}/${encodeURIComponent(clientId)}`;
    ws.current = new WebSocket(url);

    ws.current.onopen = () => setConnected(true);
    ws.current.onclose = () => setConnected(false);

    ws.current.onmessage = (event) => {
      const text = event.data;
      let type = "other";
      let fileObj = null;

      if (text.startsWith("/file:")) {
        // text like: /file:<id>:<filename>
        const parts = text.split(":");
        // parts = ["/file", "<id>", "<filename>"]
        fileObj = { id: parts[1], name: parts[2] };  // <-- fixed indices
        type = "file";
      } else if (text.startsWith("You:")) {
        type = "user";
      } else if (text.includes("entered") || text.includes("left")) {
        type = "notification";
      }

      setRoomsMessages((prev) => ({
        ...prev,
        [room]: [...(prev[room] || []), { text, type, file: fileObj }],
      }));
    };

    return () => ws.current?.close();
  }, [room, clientId]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(input);
      setInput("");
    } else {
      alert("WebSocket not ready. Join a room first!");
    }
  };

  const handleFile = (e) => {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  };

  const uploadFile = async () => {
    if (!file || !room || !clientId) return;
    const formData = new FormData();
    formData.append("upload", file);
    try {
      const route_url = `http://localhost:8000/upload/${room}/${encodeURIComponent(clientId)}`;
      const response = await fetch(route_url, { method: "POST", body: formData });
      const data = await response.json();
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(`/file:${data.file_id}:${data.filename}`); // matches parser
      }
      setFile(null);
    } catch (err) {
      console.error("Upload failed:", err);
    }
  };

  return (
    <div className="chat-container">
      <h2>Your ID: <span id="ws-id">{clientId || "(not signed in)"}</span></h2>
      <h2>Current Room: {room}</h2>

      <div className="message-box">
        <div id="messages">
          {messages.map((msg, idx) =>
            msg.type === "file" ? (
              <p key={idx} className={msg.type}>
                <a href={`http://localhost:8000/download/${msg.file.id}`} download={msg.file.name}>
                  {msg.file.name}
                </a>
              </p>
            ) : (
              <p key={idx} className={msg.type}>{msg.text}</p>
            )
          )}
        </div>
      </div>

      <div className="user-text">
        <form onSubmit={sendMessage}>
          <input
            className="user-chat"
            type="text"
            autoComplete="off"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!connected}
            placeholder="Type a message..."
          />
          <label htmlFor="file-input" className="file-upload-btn">+</label>
          <input id="file-input" type="file" onChange={handleFile} style={{ display: "none" }} />
          <button type="submit" className="send-btn" disabled={!connected}>Send</button>
        </form>
      </div>

      {file && (
        <div className="file-preview-box">
          <p><strong>{file.name}</strong> — {(file.size / 1024).toFixed(2)} KB</p>
          <button onClick={uploadFile}>Upload File</button>
        </div>
      )}
    </div>
  );
}

export default Chat;
