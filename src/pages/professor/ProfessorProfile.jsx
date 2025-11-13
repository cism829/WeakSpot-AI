import { useEffect, useState } from "react";
import { useAuth } from "../../context/Authcontext";
import { getProfessor, upsertProfessor } from "../../lib/api";

// Helpers
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const emptyHour = () => ({ day: "Mon", start: "13:00", end: "15:00", location: "" });

export default function ProfessorProfile() {
    const { user } = useAuth();
    const token = user?.token;
    const userId = user?.professor_user_id || user?.professorUserId || user?.id;

    const [mode, setMode] = useState("view");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");
    const [ok, setOk] = useState("");

    const [profile, setProfile] = useState(null);

    // form state
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [department, setDepartment] = useState("");
    const [bio, setBio] = useState("");
    const [coursesText, setCoursesText] = useState("");
    const [rating, setRating] = useState(0);

    // NEW: structured office hours editor
    const [officeHours, setOfficeHours] = useState([emptyHour()]);

    // mini helpers
    const toCoursesText = (arr = []) => Array.isArray(arr) ? arr.join(", ") : "";
    const fromCoursesText = (txt = "") => txt.split(/[,\n]/).map(s => s.trim()).filter(Boolean);

    useEffect(() => {
        (async () => {
            setLoading(true); setErr(""); setOk("");
            try {
                if (!userId) throw new Error("Missing user id");
                const p = await getProfessor(userId, token);
                setProfile(p);

                setFirstName(p?.first_name || "");
                setLastName(p?.last_name || "");
                setEmail(p?.email || "");
                setDepartment(p?.department || "");
                setBio(p?.bio || "");
                setCoursesText(toCoursesText(p?.courses));
                setRating(p?.rating ?? 0);

                // normalize office hours
                const oh = Array.isArray(p?.office_hours) ? p.office_hours : [];
                setOfficeHours(
                    oh.length ? oh.map(o => ({
                        day: o.day || "Mon",
                        start: (o.start || "13:00").slice(0, 5),
                        end: (o.end || "15:00").slice(0, 5),
                        location: o.location || ""
                    })) : [emptyHour()]
                );

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

    function addOfficeRow(example) {
        setOfficeHours(prev => [...prev, example || emptyHour()]);
    }
    function removeOfficeRow(i) {
        setOfficeHours(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);
    }
    function updateOfficeRow(i, key, val) {
        setOfficeHours(prev => prev.map((row, idx) => idx === i ? { ...row, [key]: val } : row));
    }

    async function onSave(e) {
        e.preventDefault();
        setSaving(true); setErr(""); setOk("");
        try {
            // clean rows (require day/start/end)
            const cleaned = officeHours
                .map(r => ({ ...r, day: r.day.trim(), location: r.location.trim() }))
                .filter(r => r.day && r.start && r.end);

            const saved = await upsertProfessor({
                user_id: user?.id,
                department: department || "",
                bio: bio || "",
                courses: fromCoursesText(coursesText),
                office_hours: cleaned,
                rating: Number.isFinite(+rating) ? +rating : 0,
            }, token);

            setProfile(saved);

            // sync back
            setFirstName(saved?.first_name || "");
            setLastName(saved?.last_name || "");
            setEmail(saved?.email || "");
            setDepartment(saved?.department || "");
            setBio(saved?.bio || "");
            setCoursesText(toCoursesText(saved?.courses));
            setRating(saved?.rating ?? 0);
            setOfficeHours(
                Array.isArray(saved?.office_hours) && saved.office_hours.length
                    ? saved.office_hours.map(o => ({
                        day: o.day || "Mon",
                        start: (o.start || "13:00").slice(0, 5),
                        end: (o.end || "15:00").slice(0, 5),
                        location: o.location || ""
                    }))
                    : [emptyHour()]
            );

            setOk("Saved!");
            setMode("view");
        } catch (e2) {
            setErr(e2.message || "Save failed");
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return <div className="container"><h2>👤 Professor Profile</h2><div className="muted mt">Loading…</div></div>;
    }

    if (mode === "view") {
        return (
            <div className="container">
                <h2>👤 Professor Profile</h2>
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
                            <div><div className="muted">Department</div><div>{profile?.department || "—"}</div></div>
                            <div><div className="muted">Rating</div><div>{profile?.rating ?? 0}</div></div>
                        </div>

                        <div className="mt">
                            <div className="muted">Bio</div>
                            <p>{profile?.bio || "—"}</p>
                        </div>

                        <div className="mt">
                            <div className="muted">Courses</div>
                            {Array.isArray(profile?.courses) && profile.courses.length
                                ? <ul className="list">{profile.courses.map((c, i) => <li key={i} className="list__row">{c}</li>)}</ul>
                                : <div className="muted">—</div>}
                        </div>

                        <div className="mt">
                            <div className="muted">Office Hours</div>
                            {Array.isArray(profile?.office_hours) && profile.office_hours.length
                                ? <ul className="list">
                                    {profile.office_hours.map((o, i) => (
                                        <li key={i} className="list__row">
                                            <span>{o.day} {o.start}{o.end ? `–${o.end}` : ""}</span>
                                            {o.location ? <span className="muted"> @ {o.location}</span> : null}
                                        </li>
                                    ))}
                                </ul>
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
            <h2>👤 Professor Profile</h2>
            {err && <div className="error mt">{err}</div>}
            {ok && <div className="success mt">{ok}</div>}

            <form className="form mt" onSubmit={onSave}>
                <div className="grid grid--2">
                    <label className="field"><span className="muted">First name</span><input value={firstName} readOnly /></label>
                    <label className="field"><span className="muted">Last name</span><input value={lastName} readOnly /></label>
                </div>

                <label className="field mt"><span className="muted">Email</span><input value={email} readOnly /></label>
                <label className="field mt"><span className="muted">Department</span><input value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g., Computer Science" /></label>
                <label className="field mt"><span className="muted">Bio</span><textarea rows={3} value={bio} onChange={e => setBio(e.target.value)} placeholder="Short introduction…" /></label>
                <label className="field mt"><span className="muted">Courses (comma or newline separated)</span><textarea rows={2} value={coursesText} onChange={e => setCoursesText(e.target.value)} placeholder="CSC 230, CSC 340" /></label>

                {/* NEW: Easy Office Hours Editor */}
                <div className="mt card">
                    <div className="card__head">
                        <h3>Office Hours</h3>
                    </div>
                    <div className="card__body">
                        <div className="muted" style={{ marginBottom: 8 }}>
                            Quick examples:
                            <button type="button" className="btn sm" style={{ marginLeft: 8 }} onClick={() => addOfficeRow({ day: "Tue", start: "13:00", end: "15:00", location: "Petty 101" })}>+ Tue 13:00–15:00 @ Petty 101</button>
                            <button type="button" className="btn sm" style={{ marginLeft: 8 }} onClick={() => addOfficeRow({ day: "Thu", start: "10:00", end: "12:00", location: "Zoom" })}>+ Thu 10:00–12:00 @ Zoom</button>
                        </div>

                        {officeHours.map((row, idx) => (
                            <div key={idx} className="oh-row">
                                <select value={row.day} onChange={e => updateOfficeRow(idx, "day", e.target.value)} aria-label="Day">
                                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                                <input type="time" value={row.start} onChange={e => updateOfficeRow(idx, "start", e.target.value)} aria-label="Start time" />
                                <span>–</span>
                                <input type="time" value={row.end} onChange={e => updateOfficeRow(idx, "end", e.target.value)} aria-label="End time" />
                                <input placeholder="Location (e.g., Petty 101 / Zoom)" value={row.location} onChange={e => updateOfficeRow(idx, "location", e.target.value)} />
                                <button type="button" className="btn danger" onClick={() => removeOfficeRow(idx)} aria-label="Remove row">Remove</button>
                            </div>
                        ))}

                        <button type="button" className="btn" onClick={() => addOfficeRow()}>+ Add time</button>
                    </div>
                </div>

                <label className="field mt"><span className="muted">Rating</span><input type="number" step="0.1" value={rating} onChange={e => setRating(e.target.value)} /></label>

                <div className="mt" style={{ display: "flex", gap: 12 }}>
                    <button className="btn btn--primary" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
                    <button type="button" className="btn" onClick={cancelEdit} disabled={saving}>Cancel</button>
                </div>
            </form>

            <style>{`
        .oh-row { display:grid; grid-template-columns: 90px 120px 16px 120px 1fr 90px; gap:8px; align-items:center; margin-bottom:8px; }
        .btn.sm { padding:4px 8px; font-size:12px; }
        .btn.danger { background:#ef4444; color:#fff; }
      `}</style>
        </div>
    );
}
