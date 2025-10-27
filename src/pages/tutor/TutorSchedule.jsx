import { useEffect, useState, useMemo } from "react";
import Calendar from "react-calendar";
import { useAuth } from "../../context/Authcontext";
import { getTutor /*, upsertTutor */ } from "../../lib/api";

function ymdLocal(d) {
    // format local date as YYYY-MM-DD (avoids UTC shifting from toISOString)
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function normalizeSlots(avail = []) {
    // Accepts strings like "2025-10-28 14:00" or ISO strings,
    // or objects like { date:"2025-10-28", start:"14:00", end:"15:00", location:"..." }
    return (avail || [])
        .map((s) => {
            if (!s) return null;

            if (typeof s === "string") {
                // Trim and normalize typical forms
                const raw = s.replace("T", " ").replace("Z", "").trim();
                // split once on space to separate date/time if present
                const parts = raw.split(/\s+/);
                const datePart = parts[0] || "";
                const timePart = parts[1] || "";
                if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
                    // try to parse as Date and reformat to local y-m-d
                    const dt = new Date(s);
                    if (!isNaN(dt.getTime())) {
                        return { date: ymdLocal(dt), time: dt.toTimeString().slice(0, 5) };
                    }
                    return null;
                }
                return { date: datePart, time: timePart };
            }

            if (typeof s === "object") {
                // try common keys
                const date =
                    s.date ||
                    s.day ||
                    (s.start && String(s.start).split("T")[0]) ||
                    "";
                let time =
                    s.time ||
                    (s.start &&
                        String(s.start).includes("T") &&
                        String(s.start).split("T")[1]?.slice(0, 5)) ||
                    s.start ||
                    "";
                const end =
                    s.end &&
                    (String(s.end).includes("T")
                        ? String(s.end).split("T")[1]?.slice(0, 5)
                        : s.end);

                return {
                    date,
                    time,
                    end,
                    location: s.location || s.place || "",
                    raw: s,
                };
            }

            return null;
        })
        .filter(Boolean);
}

export default function TutorSchedule() {
    const { user } = useAuth();
    const token = user?.token;
    // IMPORTANT: Backend treats this param as User.id
    const tutorUserId = user?.tutor_user_id || user?.tutorUserId || user?.id;

    const [date, setDate] = useState(new Date());
    const [availability, setAvailability] = useState([]); // normalized slots
    const [err, setErr] = useState("");

    useEffect(() => {
        (async () => {
            try {
                if (!tutorUserId) throw new Error("Missing user id");
                const data = await getTutor(tutorUserId, token); // GET /tutors/{user_id}
                const slots = normalizeSlots(data?.availability || []);
                setAvailability(slots);
            } catch (e) {
                setErr(e.message || "Failed to load");

            }
        })();
    }, [tutorUserId, token]);

    const selected = useMemo(() => ymdLocal(date), [date]);
    const sessionsForDate = useMemo(
        () => availability.filter((s) => String(s.date).startsWith(selected)),
        [availability, selected]
    );

    return (
        <div className="container">
            <h2>📅 Schedule</h2>
            <div className="grid grid--2 mt">
                <div className="card">
                    <div className="card__head"><h3>Calendar</h3></div>
                    <div className="card__body">
                        <Calendar onChange={setDate} value={date} />
                    </div>
                </div>
                <div className="card">
                    <div className="card__head"><h3>Sessions on {selected}</h3></div>
                    <div className="card__body">
                        {err && <div className="error">{err}</div>}
                        {!sessionsForDate.length ? (
                            <div className="muted">No sessions.</div>
                        ) : (
                            <ul className="list">
                                {sessionsForDate.map((s, i) => {
                                    const timeLabel =
                                        s.end && s.time
                                            ? `${s.time}–${s.end}`
                                            : s.time || "Time TBA";
                                    return (
                                        <li key={i} className="list__row">
                                            <span>{timeLabel}</span>
                                            <span className="muted">
                                                {s.location ? `@ ${s.location}` : ""}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
