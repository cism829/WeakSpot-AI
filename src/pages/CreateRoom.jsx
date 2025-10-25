import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { roomsCreate } from "../lib/api";
import { useAuth } from "../context/Authcontext";

export default function CreateRoom() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [imagePreview, setImagePreview] = useState(null);
  const [privacy, setPrivacy] = useState("public");

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setImagePreview(file ? URL.createObjectURL(file) : null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const form = e.currentTarget;
    const fd = new FormData(form);

    // Ensure required fields exist with the exact names backend expects
    const name = (fd.get("room_name") || "").toString().trim();
    if (!name) { alert("Title is required"); return; }

    const subject = (fd.get("room_subject") || "").toString();
    const description = (fd.get("description") || "").toString();
    const privacyValue = (fd.get("is_private") || "public").toString();
    let password = "";
    if (privacyValue === "private") {
      password = (fd.get("password") || "").toString();
      if (!pwd) { alert("Password required for a private room"); return; }
    } else {
      // avoid sending password for public rooms (some browsers include empty field)
      password = null;
    }

    try {
      const payload = {
        room_name: name,
        room_subject: subject || null,
        description: description || null,
        is_private: privacyValue,
        password,
      };
      const data = await roomsCreate(payload);
      if (!data?.room_id) { alert("Failed to create room"); return; }
      navigate(`/chat/${data.room_id}`);  // no clientId now
    } catch (err) {
      console.error("Error creating room:", err);
      alert(parseErr(err));
    }
  };
  return (
    <div className="create-room-con">
      <h2 className="create-room-title">Create a New Room</h2>
      <div className="room-form">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Room Image</label>
            <div
              className="upload-box"
              onClick={() => document.getElementById("room-image-input").click()}
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="image-preview" />
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

          <label>
            Title:
            <input type="text" name="room_name" required />
          </label>



          <label>
            Subject:
            <input type="text" name="room_subject" />
          </label>
          <label>
            Description:
            <input type="text" name="description" />
          </label>
          <label>
            Privacy:
            <select name="is_private" onChange={(e) => setPrivacy(e.target.value)} value={privacy}>
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </label>

          {privacy === "private" && (
            <label>
              <input type="password" name="password" placeholder="Enter Password" required />
            </label>
          )}

          <button type="submit">Create Room</button>
        </form>
      </div>
    </div>
  );
}
