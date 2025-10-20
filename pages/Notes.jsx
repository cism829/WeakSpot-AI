import React, { useState } from "react";
import Card from "../components/Card";
import FileUploader from "../components/FileUploader";

export default function Notes() {
    const [files, setFiles] = useState([]);
    const [myNotes] = useState([
        { id: 1, name: "Calculus – Integrals.pdf", date: "Aug 30", status: "Processed" },
        { id: 2, name: "Biology – Cells.docx", date: "Aug 28", status: "Processed" },
    ]);

    return (
        <div className="container">
            <h2>📝 My Notes</h2>
            <div className="grid grid--2">
                <Card title="Upload notes" tone="blue">
                    <FileUploader onFiles={(f) => setFiles(f)} />
                    {files.length > 0 && (
                        <div className="mt">
                            <strong>Selected:</strong>
                            <ul className="list">
                                {files.map(f => <li key={f.name}>{f.name} ({Math.round(f.size / 1024)} KB)</li>)}
                            </ul>
                            <button className="btn btn--primary mt">Upload</button>
                        </div>
                    )}
                </Card>

                <Card title="Recent notes" tone="green">
                    <ul className="list">
                        {myNotes.map(n => (
                            <li key={n.id} className="list__row">
                                <span>{n.name}</span>
                                <span className={`badge ${n.status === "Processed" ? "badge--success" : ""}`}>
                                    {n.status}
                                </span>
                            </li>
                        ))}
                    </ul>
                </Card>
            </div>
        </div>
    );
}
