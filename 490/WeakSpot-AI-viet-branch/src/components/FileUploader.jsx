import React, { useRef, useState } from "react";

export default function FileUploader({ onFiles }) {
    const inputRef = useRef();
    const [isOver, setIsOver] = useState(false);

    function handleDrop(e) {
        e.preventDefault();
        setIsOver(false);
        const files = Array.from(e.dataTransfer.files || []);
        onFiles?.(files);
    }

    return (
        <div
            className={`uploader ${isOver ? "is-over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
            onDragLeave={() => setIsOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
        >
            <input
                ref={inputRef}
                type="file"
                multiple
                hidden
                onChange={(e) => onFiles?.(Array.from(e.target.files || []))}
                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
            />
            <div className="uploader__icon">📤</div>
            <div className="uploader__text">
                <strong>Drop notes here</strong> or <span className="uploader__link">browse files</span><br />
                <small>PDF, DOCX, TXT, PNG, JPG</small>
            </div>
        </div>
    );
}
