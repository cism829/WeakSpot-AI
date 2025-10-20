import React, { useState } from "react";
export default function Tabs({ tabs, initial = 0 }) {
    const [i, setI] = useState(initial);
    return (
        <div className="tabs">
            <div className="tabs__list">
                {tabs.map((t, idx) => (
                    <button
                        key={t.label}
                        className={`tabs__tab ${i === idx ? "is-active" : ""}`}
                        onClick={() => setI(idx)}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
            <div className="tabs__panel">{tabs[i]?.content}</div>
        </div>
    );
}
