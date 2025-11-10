import React from "react";
export default function Stat({ label, value, emoji, tone = "default" }) {
    return (
        <div className={`stat stat--${tone}`}>
            <div className="stat__emoji">{emoji}</div>
            <div className="stat__value">{value}</div>
            <div className="stat__label">{label}</div>
        </div>
    );
}
