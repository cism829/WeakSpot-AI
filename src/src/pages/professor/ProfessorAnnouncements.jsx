import { useState } from "react";
import Card from "../../components/Card";

export default function ProfessorAnnouncements() {
    const [announcements, setAnnouncements] = useState([
        { id: 1, text: "Exam review this Friday", date: "Oct 10, 2025" },
    ]);
    const [newText, setNewText] = useState("");

    const postAnnouncement = (e) => {
        e.preventDefault();
        setAnnouncements([{ id: Date.now(), text: newText, date: new Date().toLocaleDateString() }, ...announcements]);
        setNewText("");
    };

    return (
        <div className="container">
            <h2>📢 Announcements</h2>

            <form className="form mt" onSubmit={postAnnouncement}>
                <div className="field">
                    <span>New Announcement</span>
                    <textarea value={newText} onChange={(e) => setNewText(e.target.value)} rows={3} required />
                </div>
                <button className="btn btn--primary">Post</button>
            </form>

            <div className="mt">
                {announcements.map((a) => (
                    <Card key={a.id} tone="purple">
                        <p>{a.text}</p>
                        <small className="muted">{a.date}</small>
                    </Card>
                ))}
            </div>
        </div>
    );
}
