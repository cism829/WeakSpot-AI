import { useState } from "react";
import Calendar from "react-calendar";

export default function TutorSchedule() {
    const [date, setDate] = useState(new Date());

    const sessions = [
        { date: "2025-10-14", time: "10:00 AM", student: "Alex Johnson", subject: "Algebra" },
        { date: "2025-10-15", time: "2:00 PM", student: "Sara Lee", subject: "Essay Writing" },
        { date: "2025-10-17", time: "1:00 PM", student: "Kevin Tran", subject: "Physics" },
    ];

    const formatted = date.toISOString().split("T")[0];
    const sessionsForDate = sessions.filter((s) => s.date === formatted);

    return (
        <div className="container">
            <h2>🗓 Schedule</h2>
            <p className="muted">Click a date to view your tutoring sessions.</p>

            <div className="grid grid--2 mt">
                <div className="card">
                    <div className="card__body">
                        <Calendar
                            onChange={setDate}
                            value={date}
                            className="calendar"
                        />
                    </div>
                </div>

                <div className="card">
                    <div className="card__head">
                        <h3 className="card__title">Sessions for {date.toDateString()}</h3>
                    </div>
                    <div className="card__body">
                        {sessionsForDate.length === 0 ? (
                            <p className="muted">No sessions scheduled.</p>
                        ) : (
                            <ul className="list">
                                {sessionsForDate.map((s, i) => (
                                    <li key={i} className="list__row">
                                        <span>{s.time}</span>
                                        <span>{s.student}</span>
                                        <span>{s.subject}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
