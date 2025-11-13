import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/Authcontext";

export default function CreateRoom() {
  const { user } = useAuth();
  const clientId = user?.id ?? user?.userId ?? user?.user?.id ?? "";
  const navigate = useNavigate();
  const [imagePreview, setImagePreview] = useState(null);
  const [privacy, setPrivacy] = useState("public")

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImagePreview(URL.createObjectURL(file));
    } else {
      setImagePreview(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      const response = await fetch("http://127.0.0.1:8000/rooms", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok || !data.room_id) {
        alert(data?.detail || "Failed to create room");
        return;
      }
      // Go to the new room; Chat pulls clientId from auth
      navigate(`/chat/${data.room_id}`);
    } catch (err) {
      console.error("Error creating room:", err);
    }
  };

  return (
    <div className="create-room-con">
      <h2 className="create-room-title">Create a New Room</h2>
      <div className="room-form">
        <form onSubmit={handleSubmit}>
          {/* IMAGE UPLOAD SECTION */}
          <div className="form-group">
            <label>Room Image</label>
            <div
              className="upload-box"
              onClick={() => document.getElementById("room-image-input").click()}
            >
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="image-preview"
                />
              ) : (
                <div className="upload-placeholder">
                  <p>Click to upload an image</p>
                </div>
              )}
            </div>

            <input
              id="room-image-input"
              type="file"
              name="image"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
          </div>

          {/* TEXT INPUTS */}
          <label>
            Title:
            <input
              type="text"
              name="room_name"
              placeholder="Enter title"
              required
            />
          </label>

          <label>
            Description:
            <input
              type="text"
              name="description"
              placeholder="Brief description"
            />
          </label>

          <label>
            Subject:
            <input
              type="text"
              name="room_subject"
              placeholder="Enter subject"
            />
          </label>

          <label>
            Privacy:
            <select name="is_private" onChange={(e) => setPrivacy(e.target.value)}value={privacy}>
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </label>
          {privacy === "private" && (
            <label>
              <input type="password" name="password" placeholder="Enter Password" required>
              </input>
            </label>
          )}

          <button type="submit">Create Room</button>
        </form>
      </div>
    </div>
  );
}
