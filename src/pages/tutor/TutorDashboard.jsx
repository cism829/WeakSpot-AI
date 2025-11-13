import { useEffect, useState } from "react";
import { useAuth } from "../../context/Authcontext";
import { getTutor /*, upsertTutor (optional) */ } from "../../lib/api";

export default function TutorDashboard() {
    const { user } = useAuth();
    const token = user?.token;
    // IMPORTANT: backend treats this param as User.id
    const tutorUserId = user?.tutor_user_id || user?.tutorUserId || user?.id;

    const [tutor, setTutor] = useState(null);
    const [err, setErr] = useState("");

    useEffect(() => {
        (async () => {
            try {
                if (!tutorUserId) throw new Error("Missing user id");
                // GET /tutors/{user_id} returns TutorOut (falls back to user-only defaults if no profile exists)
                const data = await getTutor(tutorUserId, token);
                setTutor(data || null);
            } catch (e) {
                setErr(e.message || "Failed to load");
                // If you want to auto-create a blank tutor profile on first visit,
                // uncomment the below (and make sure api.js exports upsertTutor):
                //
                // try {
                //   await upsertTutor({ bio: "", subjects: [], hourly_rate: 0, rating: 0, availability: [] }, token);
                //   const data2 = await getTutor(tutorUserId, token);
                //   setTutor(data2 || null);
                // } catch (e2) { setErr(e2.message || "Failed to create tutor profile"); }
            }
        })();
    }, [tutorUserId, token]);

    const subjects = tutor?.subjects || [];
    const availability = tutor?.availability || [];
    const hourly = tutor?.hourly_rate ?? 0;
    const rating = tutor?.rating ?? 0;

    return (
        <div className="container">
            <h2>👋 Welcome back, Tutor!</h2>
            <p className="muted">
                Here’s a quick snapshot of your profile and availability.
            </p>
            {err && <div className="error">{err}</div>}

            <div className="grid grid--3 mt">
                <div className="card card--blue">
                    <div className="card__head"><h3>Subjects</h3></div>
                    <div className="card__body">
                        <h2>{subjects.length}</h2>
                        <div className="muted" style={{ marginTop: 8 }}>
                            {subjects.length ? subjects.join(", ") : "—"}
                        </div>
                    </div>
                </div>

                <div className="card card--green">
                    <div className="card__head"><h3>Hourly Rate</h3></div>
                    <div className="card__body"><h2>${hourly}/hr</h2></div>
                </div>

                <div className="card card--purple">
                    <div className="card__head"><h3>Rating</h3></div>
                    <div className="card__body"><h2>{rating}</h2></div>
                </div>
            </div>

            <div className="card mt">
                <div className="card__head"><h3>Availability</h3></div>
                <div className="card__body">
                    {!availability.length ? (
                        <div className="muted">No availability added yet.</div>
                    ) : (
                        <ul className="list">
                            {availability.map((slot, i) => (
                                <li key={i} className="list__row">{slot}</li>
                            ))}
                        </ul>
                    )}

                    <div className="mt">
                        <div className="grid grid--3">
                            <button className="btn btn--primary">➕ Add Session</button>
                            <button className="btn btn--primary">📤 Share Resource</button>
                            <button className="btn btn--primary">📩 Message Student</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
