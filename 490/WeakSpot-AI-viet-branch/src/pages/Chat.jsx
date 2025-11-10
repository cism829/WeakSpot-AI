// src/pages/Chat.jsx
import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/Authcontext";

function splitOnce(str, sep = ": ") {
  const i = str.indexOf(sep);
  if (i === -1) return [null, str]; // no prefix, whole string is content
  return [str.slice(0, i), str.slice(i + sep.length)];
}

export default function Chat() {
  const { room } = useParams(); // route: /chat/:room
  const { user } = useAuth();

  // Prefer UUID on user.id; add fallbacks if your auth shape varies
  const clientId = user?.id ?? user?.userId ?? user?.user?.id ?? "";

  const [roomsMessages, setRoomsMessages] = useState({});
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [file, setFile] = useState(null);
  const ws = useRef(null);

  const messages = room && roomsMessages[room] ? roomsMessages[room] : [];

  useEffect(() => {
    if (!room || !clientId) return;

    if (ws.current) {
      try { ws.current.close(); } catch {}
    }

    setRoomsMessages((prev) => (prev[room] ? prev : { ...prev, [room]: [] }));

    const url = `ws://localhost:8000/ws/${room}/${encodeURIComponent(clientId)}`;
    const socket = new WebSocket(url);
    ws.current = socket;

    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);

    socket.onmessage = (event) => {
      const raw = event.data ?? "";
      const [prefixMaybe, rest] = splitOnce(raw, ": "); // e.g., "You" | "viet.test", "/file:.. or normal"
      const prefix = prefixMaybe || "";                 // speaker label (may be empty)
      const content = rest ?? raw;                      // the actual message content

      let type = "other";
      let fileObj = null;

      const trimmed = (content || "").trim();

      // Detect file messages whether or not they have a speaker prefix
      if (trimmed.startsWith("/file:")) {
        // Format: /file:<id>:<filename>  (filename may include ':', so rejoin)
        const parts = trimmed.split(":"); // ["/file","<id>","<filename>..."]
        const fid = parts[1];
        const fname = parts.slice(2).join(":"); // robust if filename has ':'
        fileObj = { id: fid, name: fname };
        type = prefix === "You" ? "user" : "file"; // still show your bubble style for you
        // Debug the link once to confirm
        // eslint-disable-next-line no-console
        console.log("DOWNLOAD LINK →", `http://localhost:8000/download/${fid}`, "NAME →", fname);
      } else if (prefix === "You") {
        type = "user";
      } else if (raw.includes("entered") || raw.includes("left")) {
        type = "notification";
      } else {
        type = "other";
      }

      setRoomsMessages((prev) => ({
        ...prev,
        [room]: [
          ...(prev[room] || []),
          { raw, prefix, content, type, file: fileObj },
        ],
      }));
    };

    return () => {
      try { socket.close(); } catch {}
    };
  }, [room, clientId]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (ws.current?.readyState === WebSocket.OPEN) {
      if (!input.trim()) return;
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

      if (!response.ok) {
        alert(data?.detail || "Upload failed");
        return;
      }

      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(`/file:${data.file_id}:${data.filename}`);
      }
      setFile(null);
    } catch (err) {
      console.error("Upload failed:", err);
    }
  };

  return (
    <div className="chat-container">
      <h2>
        Your ID: <span id="ws-id">{clientId || "(not signed in)"}</span>
      </h2>
      <h2>Current Room: {room}</h2>

      <div className="message-box">
        <div id="messages">
          {messages.map((msg, idx) => {
            if (msg.file) {
              // File message: show speaker label + clickable link + fallback button
              const link = `http://localhost:8000/download/${msg.file.id}`;
              return (
                <p key={idx} className={msg.type} style={{ position: "relative", zIndex: 5 }}>
                  {msg.prefix ? <strong>{msg.prefix}:</strong> : null}{" "}
                  <a
                    style={{ pointerEvents: "auto", position: "relative", zIndex: 5 }}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {msg.file.name}
                  </a>
                  <button
                    type="button"
                    style={{ marginLeft: 8, pointerEvents: "auto", position: "relative", zIndex: 5 }}
                    onClick={() => window.open(link, "_blank", "noopener")}
                  >
                    Download
                  </button>
                </p>
              );
            }

            // Non-file messages
            return (
              <p key={idx} className={msg.type}>
                {msg.raw}
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
            autoComplete="off"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!connected}
            placeholder="Type a message..."
          />
          <label htmlFor="file-input" className="file-upload-btn">
            +
          </label>
          <input id="file-input" type="file" onChange={handleFile} style={{ display: "none" }} />
          <button type="submit" className="send-btn" disabled={!connected}>
            Send
          </button>
        </form>
      </div>

      {file && (
        <div className="file-preview-box">
          <p>
            <strong>{file.name}</strong> — {(file.size / 1024).toFixed(2)} KB
          </p>
          <button onClick={uploadFile}>Upload File</button>
        </div>
      )}
    </div>
  );
}
