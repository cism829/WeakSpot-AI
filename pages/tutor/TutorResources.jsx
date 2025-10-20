import { useState } from "react";
import Card from "../../components/Card";

export default function TutorResources() {
    const [resources, setResources] = useState([]);
    const [linkForm, setLinkForm] = useState({ title: "", url: "", description: "" });

    // Handle file upload (mock)
    const handleFileUpload = (e) => {
        const files = Array.from(e.target.files);
        const newResources = files.map((file) => ({
            id: Date.now() + Math.random(),
            name: file.name,
            type: "file",
            file,
        }));
        setResources((prev) => [...prev, ...newResources]);
        e.target.value = ""; // reset input
    };

    // Handle link add
    const handleAddLink = (e) => {
        e.preventDefault();
        if (!linkForm.title || !linkForm.url) return;
        setResources((prev) => [
            ...prev,
            {
                id: Date.now(),
                ...linkForm,
                type: "link",
            },
        ]);
        setLinkForm({ title: "", url: "", description: "" });
    };

    // Delete a resource
    const handleDelete = (id) => {
        setResources((prev) => prev.filter((r) => r.id !== id));
    };

    return (
        <div className="container">
            <h2>📚 Tutor Resources</h2>
            <p className="muted">Upload materials or share helpful links with your students.</p>

            <div className="grid grid--2 mt">
                {/* File upload section */}
                <Card>
                    <div className="card__head">
                        <h3 className="card__title">Upload Files</h3>
                    </div>
                    <div className="card__body">
                        <input
                            type="file"
                            multiple
                            onChange={handleFileUpload}
                            className="file-input"
                        />
                        <p className="muted mt-small">Supported: PDFs, Docs, Slides, etc.</p>
                    </div>
                </Card>

                {/* Add link section */}
                <Card>
                    <div className="card__head">
                        <h3 className="card__title">Share a Resource Link</h3>
                    </div>
                    <div className="card__body">
                        <form onSubmit={handleAddLink} className="form">
                            <div className="field">
                                <input
                                    type="text"
                                    placeholder="Title"
                                    value={linkForm.title}
                                    onChange={(e) =>
                                        setLinkForm((f) => ({ ...f, title: e.target.value }))
                                    }
                                />
                            </div>
                            <div className="field">
                                <input
                                    type="url"
                                    placeholder="URL"
                                    value={linkForm.url}
                                    onChange={(e) =>
                                        setLinkForm((f) => ({ ...f, url: e.target.value }))
                                    }
                                />
                            </div>
                            <div className="field">
                                <textarea
                                    placeholder="Description (optional)"
                                    value={linkForm.description}
                                    onChange={(e) =>
                                        setLinkForm((f) => ({ ...f, description: e.target.value }))
                                    }
                                />
                            </div>
                            <button type="submit" className="btn btn--primary">
                                Add Link
                            </button>
                        </form>
                    </div>
                </Card>
            </div>

            {/* Resource list */}
            <Card tone="blue" className="mt">
                <div className="card__head">
                    <h3 className="card__title">Your Resources</h3>
                </div>
                <div className="card__body">
                    {resources.length === 0 ? (
                        <p className="muted">No resources added yet.</p>
                    ) : (
                        <ul className="resource-list">
                            {resources.map((r) => (
                                <li key={r.id} className="resource-item">
                                    {r.type === "file" ? (
                                        <>
                                            <span>📄 {r.name}</span>
                                        </>
                                    ) : (
                                        <>
                                            <a href={r.url} target="_blank" rel="noopener noreferrer">
                                                🔗 {r.title}
                                            </a>
                                            {r.description && (
                                                <p className="muted small">{r.description}</p>
                                            )}
                                        </>
                                    )}
                                    <button
                                        onClick={() => handleDelete(r.id)}
                                        className="btn btn--danger btn--small"
                                    >
                                        Delete
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </Card>
        </div>
    );
}
