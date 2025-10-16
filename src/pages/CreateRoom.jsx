// CreateRoom.jsx
import { color } from "chart.js/helpers";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function CreateRoom() {
    const navigate = useNavigate();
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.currentTarget)
        const roomData = {}
        for(let [key, value] of formData.entries()){
            roomData[key] = value;
            console.log({ key, value })
        }

        try{
            const response = await fetch("http://127.0.0.1:8000/rooms", {
                method: "POST",
                // headers: {"Content-Type": "application/json"},
                body: formData
            });

            const data = await response.json();
            console.log("Room was Created", data);

            if(!response.ok){
                alert('failed to make room')
            } else{
                // alert('room was created')
                const clientId = Math.floor(Math.random() * 10) + 1;
                console.log(data.room_id)
                navigate("/chat/"+data.room_id+ "/" +clientId)
            }
        } catch(err){
            console.error("error creating room: ", err)
        }
    };
    

  return (
    <div className="create-room-con">
      <h2>Create a New Room</h2>
      <div className="room-form">
        <form onSubmit={handleSubmit}>
            <div className="form-image">
                <input type="file"></input>
                <p style={{ color: "blue" }}>Use File Uploaded component for this as well, I think it would look good here too!</p>
            </div>
            <label>
                Title: 
                <input type="text" name="room_name" placeholder="Title"></input>
            </label>
            <label>
                Description: 
                <input type="text" name="description"></input>
            </label>
            <label>
                Subject: 
                <input type="text" name="room_subject"></input>
            </label>
            <select name="privacy">
                <option value="public">Public</option>
                <option value="private">Private</option>
            </select>
            <button type="submit"> Submit Button </button>
        </form>
      </div>
      
    </div>
  );
}
