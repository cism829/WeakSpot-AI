import React from "react";
export default function ProgressBar({ value = 0 }) {
    return (
        <div style={{
            height: 10, background: "var(--border)", borderRadius: 999, overflow: "hidden"
        }}>
            <div style={{
                width: `${Math.max(0, Math.min(100, value))}%`,
                height: "100%",
                background: "linear-gradient(90deg,var(--blue),var(--purple))"
            }} />
        </div>
    );
}