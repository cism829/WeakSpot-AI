import { useState } from "react";

export default function TutorDashboard() {
    const [students] = useState([
        { name: "Alex Johnson", subject: "Math", progress: 85 },
        { name: "Sara Lee", subject: "English", progress: 92 },
        { name: "Kevin Tran", subject: "Science", progress: 78 },
    ]);

    return (
        <div className="container">
            <h2>👋 Welcome back, Tutor!</h2>
            <p className="muted">Here’s an overview of your tutoring activity and students’ progress.</p>

            <div className="grid grid--3 mt">
                <div className="card card--blue">
                    <div className="card__head">
                        <h3 className="card__title">Total Students</h3>
                    </div>
                    <div className="card__body">
                        <h2>12</h2>
                        <p className="muted">Active students enrolled</p>
                    </div>
                </div>

                <div className="card card--green">
                    <div className="card__head">
                        <h3 className="card__title">Upcoming Sessions</h3>
                    </div>
                    <div className="card__body">
                        <h2>3</h2>
                        <p className="muted">This week’s scheduled meetings</p>
                    </div>
                </div>

                <div className="card card--purple">
                    <div className="card__head">
                        <h3 className="card__title">Average Progress</h3>
                    </div>
                    <div className="card__body">
                        <h2>85%</h2>
                        <p className="muted">Student performance average</p>
                    </div>
                </div>
            </div>

            <div className="card mt">
                <div className="card__head">
                    <h3 className="card__title">Student Progress</h3>
                    <p className="card__subtitle">Track progress at a glance</p>
                </div>
                <div className="card__body">
                    {students.map((s, i) => (
                        <div key={i} className="list__row">
                            <span>{s.name} — {s.subject}</span>
                            <div
                                style={{
                                    width: "120px",
                                    background: "#eee",
                                    borderRadius: "8px",
                                    overflow: "hidden",
                                }}
                            >
                                <div
                                    style={{
                                        width: `${s.progress}%`,
                                        background: "linear-gradient(90deg, var(--blue), var(--purple))",
                                        height: "8px",
                                    }}
                                />
                            </div>
                            <span>{s.progress}%</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="card mt">
                <div className="card__head">
                    <h3 className="card__title">Quick Actions</h3>
                </div>
                <div className="card__body">
                    <div className="grid grid--3">
                        <button className="btn btn--primary">➕ Add Session</button>
                        <button className="btn btn--primary">📤 Share Resource</button>
                        <button className="btn btn--primary">📩 Message Student</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
