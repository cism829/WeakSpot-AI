import React from "react";
import { useAuth } from "../context/Authcontext";

export default function Dashboard() {
    const { user } = useAuth();
    return (
        <div className="dashboard">
            <h2 className="dashboard-title">👋 Welcome back, {user.name}</h2>

            <div className="dashboard-grid">
                {/* Progress Section */}
                <div className="card progress-card">
                    <h3>Your Progress 📈</h3>
                    <p>You’ve completed <span className="highlight">12 quizzes</span> this week!</p>
                </div>

                {/* Notes Section */}
                <div className="card notes-card">
                    <h3>Recent Notes 📝</h3>
                    <ul>
                        <li>Math – Integration by Parts</li>
                        <li>History – WWII</li>
                        <li>Biology – Cell Structure</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
