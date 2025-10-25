import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/Authcontext";
import { uploadChatFile, API_URL } from "../lib/api";


const WS_PATH = import.meta.env.VITE_WS_PATH || "/groupchat/ws";
const DOWNLOAD_PATH = import.meta.env.VITE_DOWNLOAD_PATH || "/fileupload/download";

// Build WS base from API_URL so we connect to the API host/port, not the frontend
const API_HTTP = (typeof API_URL === "string" ? API_URL : "").replace(/\/+$/, "");
const WS_BASE = API_HTTP
  ? API_HTTP.replace(/^http/i, "ws")
  : (location.protocol === "https:" ? "wss://" : "ws://") + window.location.host;

function Chat() {
  const { room } = useParams();
  const { user } = useAuth();

  const [roomsMessages, setRoomsMessages] = useState({});
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [file, setFile] = useState(null);
  const ws = useRef(null);

  const messages = roomsMessages[room] || [];

  useEffect(() => {
    if (!room || !user?.id) return;

    // Close previous socket if any
    ws.current?.close();

    // Ensure local state has the room bucket
    setRoomsMessages((prev) => (prev[room] ? prev : { ...prev, [room]: [] }));

    // /{WS_PATH}/{room}/{userId}[?token=...]
    const url =
      `ws://localhost:8000${WS_PATH}/${room}/${user.id}`;

    const socket = new WebSocket(url);
    ws.current = socket;

    socket.onopen = () => setConnected(true);
    socket.onclose = () => {
      setConnected(false);
      // avoid stale ref
      if (ws.current === socket) ws.current = null;
    };
    socket.onerror = (err) => {
      console.error("WebSocket error:", err, "URL:", url);
    };
    socket.onmessage = (event) => {
      const text = event.data;
      let type = "other";
      let fileObj = null;

      // Expected: "/file:<id>:<filename>"
      if (text.startsWith("/file:")) {
        const parts = text.split(":"); // ["/file", file_id, filename...]
        const fileId = parts[1];
        const filename = parts.slice(2).join(":");
        fileObj = { id: fileId, name: filename };
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

    return () => socket.close();
  }, [room, user?.id, user?.token]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (ws.current?.readyState === WebSocket.OPEN && input.trim()) {
      ws.current.send(input);
      setInput("");
    } else {
      alert("WebSocket not ready. Join a room first!");
    }
  };

  const handleFile = (e) => {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  };

  const uploadFileHandler = async () => {
    if (!file || !room || !user?.id) return;
    try {
      // POST upload; your helper should include Authorization if token provided
      const data = await uploadChatFile(room, user.id, file, user.token);
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(`/file:${data.file_id}:${data.filename}`);
      }
      setFile(null);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed.");
    }
  };

  return (
    <div>
      <div className="chat-container">
        <h2>
          Your ID: <span id="ws-id">{user?.id ?? "unknown"}</span>
        </h2>
        <h2>Current Room: {room}</h2>
        <p className="muted">Connection: {connected ? "connected" : "disconnected"}</p>

        <div className="message">
          <div className="message-box">
            <div id="messages">
              {messages.map((msg, idx) => {
                if (msg.type === "file" && msg.file) {
                  return (
                    <p key={idx} className={msg.type}>
                      <a
                        href={`${API_HTTP}${DOWNLOAD_PATH}/${encodeURIComponent(msg.file.id)}`}
                        download={msg.file.name}
                        rel="noopener noreferrer"
                      >
                        {msg.file.name}
                      </a>
                    </p>
                  );
                }
                return (
                  <p key={idx} className={msg.type}>
                    {msg.text}
                  </p>
                );
              })}
            </div>
          </div>

          <div className="user-text">
            <form onSubmit={sendMessage}>
              <input
                className="user-chat"
                type="text"
                id="messageText"
                autoComplete="off"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={!connected}
                placeholder={connected ? "Type a message..." : "Connecting…"}
                aria-label="Message"
              />
              <label htmlFor="file-input" className="file-upload-btn" aria-label="Attach file">
                +
              </label>
              <input id="file-input" type="file" onChange={handleFile} style={{ display: "none" }} />
              <button type="submit" className="send-btn" disabled={!connected}>
                Send
              </button>
            </form>
          </div>
        </div>

        {file && (
          <div className="file-preview-box">
            <p>
              <strong>{file.name}</strong> — {(file.size / 1024).toFixed(2)} KB
            </p>
            <button onClick={uploadFileHandler}>Upload File</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Chat;
