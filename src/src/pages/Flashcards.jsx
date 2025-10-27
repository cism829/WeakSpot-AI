import React, { useState } from "react";
import Card from "../components/Card";

export default function Flashcards() {
    const [topic, setTopic] = useState("");
    const [count, setCount] = useState(10);

    return (
        <div className="container">
            <h2>🧠 Flashcards & Topic Quizzes</h2>
            <div className="grid grid--2">
                <Card title="Generate flashcards" tone="blue">
                    <label className="field">
                        <span>Topic</span>
                        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g., Photosynthesis" />
                    </label>
                    <label className="field">
                        <span>Number of cards</span>
                        <input type="number" min="5" max="50" value={count} onChange={(e) => setCount(+e.target.value)} />
                    </label>
                    <button className="btn btn--primary">Generate Flashcards</button>
                </Card>

                <Card title="Generate a quiz from topic" tone="green" subtitle="Difficulty adapts to your progress">
                    <label className="field">
                        <span>Topic</span>
                        <input placeholder="e.g., Newton's Laws" />
                    </label>
                    <label className="field">
                        <span>Questions</span>
                        <input type="number" min="5" max="30" defaultValue={10} />
                    </label>
                    <button className="btn btn--primary">Generate Quiz</button>
                </Card>
            </div>
        </div>
    );
}
