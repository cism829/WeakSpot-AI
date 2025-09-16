import React from "react";
import Card from "../components/Card";

export default function NotesAnalysis() {
    return (
        <div className="container">
            <h2>🔍 Notes Analysis</h2>
            <div className="grid grid--2">
                <Card title="Key Concepts" tone="green">
                    <ul className="list">
                        <li>Cell respiration</li>
                        <li>Limits & continuity</li>
                        <li>Cold War diplomacy</li>
                    </ul>
                </Card>
                <Card title="Suggested Study Plan" tone="blue">
                    <ol className="list num">
                        <li>Review weak topics (15m)</li>
                        <li>Flashcards (20m)</li>
                        <li>Topic quiz (10m)</li>
                    </ol>
                </Card>
            </div>
        </div>
    );
}
