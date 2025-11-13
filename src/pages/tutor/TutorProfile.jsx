import { useEffect, useState } from "react";
import { useAuth } from "../../context/Authcontext";
import { getTutor, upsertTutor } from "../../lib/api";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function TutorProfile() {
    const { user } = useAuth();
    const token = user?.token;
    const userId = user?.tutor_user_id || user?.tutorUserId || user?.id;

    const [mode, setMode] = useState("view");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");
    const [ok, setOk] = useState("");

    const [profile, setProfile] = useState(null);

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");

    const [bio, setBio] = useState("");
    const [subjectsText, setSubjectsText] = useState("");
    const [hourlyRate, setHourlyRate] = useState(0);
    const [rating, setRating] = useState(0);

    // NEW: availability as strings, with simple builder
    const [availability, setAvailability] = useState([]);
    const [day, setDay] = useState("Mon");
    const [start, setStart] = useState("13:00");
    const [end, setEnd] = useState("15:00");
    const [place, setPlace] = useState("");

    const toSubjectsText = (arr = []) => Array.isArray(arr) ? arr.join(", ") : "";
    const fromSubjectsText = (txt = "") => txt.split(/[,\n]/).map(s => s.trim()).filter(Boolean);

    useEffect(() => {
        (async () => {
            setLoading(true); setErr(""); setOk("");
            try {
                if (!userId) throw new Error("Missing user id");
                const t = await getTutor(userId, token);
                setProfile(t);

                setFirstName(t?.first_name || "");
                setLastName(t?.last_name || "");
                setEmail(t?.email || "");
                setBio(t?.bio || "");
                setSubjectsText(toSubjectsText(t?.subjects));
                setHourlyRate(t?.hourly_rate ?? 0);
                setRating(t?.rating ?? 0);
                setAvailability(Array.isArray(t?.availability) ? t.availability : []);

                setMode("view");
            } catch (e) {
                setErr(e.message || "Failed to load profile");
            } finally {
                setLoading(false);
            }
        })();
    }, [userId, token]);

    function enterEdit() { setOk(""); setErr(""); setMode("edit"); }
    function cancelEdit() { setOk(""); setErr(""); setMode("view"); }

    function addSlot(example) {
        const text = example
            ? example
            : `${day} ${start}–${end}${place.trim() ? ` @ ${place.trim()}` : ""}`;
        if (!text.trim()) return;
        setAvailability(prev => [...prev, text]);
        // keep builder values, just clear place for convenience
        setPlace("");
    }
    function removeSlot(i) {
        setAvailability(prev => prev.filter((_, idx) => idx !== i));
    }

    async function onSave(e) {
        e.preventDefault();
        setSaving(true); setErr(""); setOk("");
        try {
            const saved = await upsertTutor({
                user_id: user?.id,
                bio: bio || "",
                subjects: fromSubjectsText(subjectsText),
                hourly_rate: Number.isFinite(+hourlyRate) ? +hourlyRate : 0,
                rating: Number.isFinite(+rating) ? +rating : 0,
                availability: availability.filter(Boolean),
            }, token);

            setProfile(saved);

            setFirstName(saved?.first_name || "");
            setLastName(saved?.last_name || "");
            setEmail(saved?.email || "");
            setBio(saved?.bio || "");
            setSubjectsText(toSubjectsText(saved?.subjects));
            setHourlyRate(saved?.hourly_rate ?? 0);
            setRating(saved?.rating ?? 0);
            setAvailability(Array.isArray(saved?.availability) ? saved.availability : []);

            setOk("Saved!");
            setMode("view");
        } catch (e2) {
            setErr(e2.message || "Save failed");
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return <div className="container"><h2>👤 Tutor Profile</h2><div className="muted mt">Loading…</div></div>;
    }

    if (mode === "view") {
        return (
            <div className="container">
                <h2>👤 Tutor Profile</h2>
                {err && <div className="error mt">{err}</div>}
                {ok && <div className="success mt">{ok}</div>}

                <div className="card mt">
                    <div className="card__head">
                        <h3>Overview</h3>
                        <button className="btn btn--primary" onClick={enterEdit}>Edit Profile</button>
                    </div>
                    <div className="card__body">
                        <div className="grid grid--2">
                            <div><div className="muted">Name</div><div className="bold">{profile?.first_name} {profile?.last_name}</div></div>
                            <div><div className="muted">Email</div><div>{profile?.email || "—"}</div></div>
                            <div><div className="muted">Hourly Rate</div><div>${profile?.hourly_rate ?? 0}/hr</div></div>
                            <div><div className="muted">Rating</div><div>{profile?.rating ?? 0}</div></div>
                        </div>

                        <div className="mt">
                            <div className="muted">Bio</div>
                            <p>{profile?.bio || "—"}</p>
                        </div>

                        <div className="mt">
                            <div className="muted">Subjects</div>
                            {Array.isArray(profile?.subjects) && profile.subjects.length
                                ? <ul className="list">{profile.subjects.map((s, i) => <li key={i} className="list__row">{s}</li>)}</ul>
                                : <div className="muted">—</div>}
                        </div>

                        <div className="mt">
                            <div className="muted">Availability</div>
                            {Array.isArray(profile?.availability) && profile.availability.length
                                ? <ul className="list">{profile.availability.map((a, i) => <li key={i} className="list__row">{a}</li>)}</ul>
                                : <div className="muted">—</div>}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // EDIT MODE
    return (
        <div className="container">
            <h2>👤 Tutor Profile</h2>
            {err && <div className="error mt">{err}</div>}
            {ok && <div className="success mt">{ok}</div>}

            <form className="form mt" onSubmit={onSave}>
                <div className="grid grid--2">
                    <label className="field"><span className="muted">First name</span><input value={firstName} readOnly /></label>
                    <label className="field"><span className="muted">Last name</span><input value={lastName} readOnly /></label>
                </div>

                <label className="field mt"><span className="muted">Email</span><input value={email} readOnly /></label>
                <label className="field mt"><span className="muted">Bio</span><textarea rows={3} value={bio} onChange={e => setBio(e.target.value)} placeholder="Short introduction…" /></label>
                <label className="field mt"><span className="muted">Subjects (comma or newline separated)</span><textarea rows={2} value={subjectsText} onChange={e => setSubjectsText(e.target.value)} placeholder="Algebra, Data Structures" /></label>

                <div className="grid grid--2">
                    <label className="field mt"><span className="muted">Hourly Rate</span><input type="number" step="1" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} /></label>
                    <label className="field mt"><span className="muted">Rating</span><input type="number" step="0.1" value={rating} onChange={e => setRating(e.target.value)} /></label>
                </div>

                {/* NEW: Easy Availability Editor */}
                <div className="mt card">
                    <div className="card__head"><h3>Availability</h3></div>
                    <div className="card__body">
                        <div className="muted" style={{ marginBottom: 8 }}>
                            Quick examples:
                            <button type="button" className="btn sm" style={{ marginLeft: 8 }} onClick={() => addSlot("Tue 13:00–15:00 @ Petty 101")}>+ Tue 13:00–15:00 @ Petty 101</button>
                            <button type="button" className="btn sm" style={{ marginLeft: 8 }} onClick={() => addSlot("Thu 10:00–12:00 @ Jackson Library")}>+ Thu 10:00–12:00 @ Jackson Library</button>
                        </div>

                        {/* Builder row */}
                        <div className="slot-row">
                            <select value={day} onChange={e => setDay(e.target.value)} aria-label="Day">
                                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                            <input type="time" value={start} onChange={e => setStart(e.target.value)} aria-label="Start time" />
                            <span>–</span>
                            <input type="time" value={end} onChange={e => setEnd(e.target.value)} aria-label="End time" />
                            <input placeholder="Location (optional, e.g., Petty 101 / Zoom)" value={place} onChange={e => setPlace(e.target.value)} />
                            <button type="button" className="btn" onClick={() => addSlot()}>Add</button>
                        </div>

                        {/* Current slots */}
                        {availability.length
                            ? <ul className="chiplist">
                                {availability.map((a, i) => (
                                    <li key={i} className="chip">
                                        <span>{a}</span>
                                        <button type="button" className="chip__x" onClick={() => removeSlot(i)} aria-label="Remove">×</button>
                                    </li>
                                ))}
                            </ul>
                            : <div className="muted">No availability yet. Add a time above.</div>}
                    </div>
                </div>

                <div className="mt" style={{ display: "flex", gap: 12 }}>
                    <button className="btn btn--primary" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
                    <button type="button" className="btn" onClick={cancelEdit} disabled={saving}>Cancel</button>
                </div>
            </form>

            <style>{`
        .slot-row { display:grid; grid-template-columns: 90px 120px 16px 120px 1fr 80px; gap:8px; align-items:center; margin-bottom:8px; }
        .chiplist { display:flex; flex-wrap:wrap; gap:8px; padding:0; margin-top:8px; list-style:none; }
        .chip { display:flex; align-items:center; gap:8px; padding:6px 10px; border:1px solid var(--border,#e5e7eb); border-radius:999px; }
        .chip__x { border:none; background:transparent; cursor:pointer; font-size:16px; line-height:1; }
        .btn.sm { padding:4px 8px; font-size:12px; }
      `}</style>
        </div>
    );
}
