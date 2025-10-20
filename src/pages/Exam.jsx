import React, { useMemo, useState } from "react";
import Card from "../components/Card";
import { useAuth } from "../context/Authcontext";
import { useNavigate } from "react-router-dom";

const EXAM_COST = 20;

export default function Exam() {
    const nav = useNavigate();
    const { coins, addCoins } = useAuth();
    const [topic, setTopic] = useState("");
    const [qCount, setQCount] = useState(20);

    const canStart = useMemo(() => coins >= EXAM_COST && topic.trim().length > 0, [coins, topic]);

    function startExam() {
        if (!canStart) return;
        addCoins(-EXAM_COST);
        nav("/quiz", { state: { mode: "exam", topic, qCount } });
    }

    return (
        <div className="container">
            <h2>📘 Exam Mode</h2>
            <div className="grid grid--2">
                <Card title="Exam details" tone="purple" subtitle={`Cost: 🪙 ${EXAM_COST} StudyCoins`}>
                    <label className="field">
                        <span>Topic</span>
                        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g., Thermodynamics" />
                    </label>
                    <label className="field">
                        <span>Questions</span>
                        <input type="number" min="10" max="50" value={qCount} onChange={(e) => setQCount(+e.target.value)} />
                    </label>

                    <div className="mt">
                        <button
                            className="btn btn--primary"
                            disabled={!canStart}
                            onClick={startExam}
                            title={coins < EXAM_COST ? "Not enough coins" : undefined}
                        >
                            {coins < EXAM_COST ? `Need ${EXAM_COST - coins} more coins` : "Start Exam"}
                        </button>
                    </div>
                    <p className="muted mt">Earn coins by completing practice quizzes. Higher scores reward more coins.</p>
                </Card>

                <Card title="How it works" tone="green">
                    <ol className="list num">
                        <li>Choose a topic and length.</li>
                        <li>Pay with StudyCoins (earned via practice).</li>
                        <li>Complete the exam in one sitting.</li>
                        <li>Get detailed feedback and study plan.</li>
                    </ol>
                </Card>
            </div>
        </div>
    );
}
