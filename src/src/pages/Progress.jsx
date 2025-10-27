import React from "react";
import Card from "../components/Card";
import Stat from "../components/Stat";

export default function Progress() {
    return (
        <div className="container">
            <h2>📈 Your Progress</h2>
            <div className="grid grid--3">
                <Stat label="Quizzes completed" value="24" emoji="✅" tone="blue" />
                <Stat label="Avg. score" value="82%" emoji="🎯" tone="purple" />
                <Stat label="Study streak" value="7 days" emoji="🔥" tone="green" />
            </div>

            <div className="grid grid--2">
                <Card title="Scores over time" tone="blue">
                    {/* Hook your chart lib here later */}
                    <div className="placeholder-chart">Chart Placeholder</div>
                </Card>
                <Card title="Weak topics" tone="purple">
                    <ul className="list-chips">
                        <li>Organic Chemistry</li>
                        <li>Derivatives</li>
                        <li>Cold War</li>
                    </ul>
                </Card>
            </div>
        </div>
    );
}
