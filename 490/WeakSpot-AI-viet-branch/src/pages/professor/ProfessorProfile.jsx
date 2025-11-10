import { useEffect, useState } from "react";
import { useAuth } from "../../context/Authcontext";
import { getProfessor, upsertProfessor } from "../../lib/api";

// -------- helpers --------
function toCoursesText(arr = []) {
    return Array.isArray(arr) ? arr.join(", ") : "";
}
function fromCoursesText(txt = "") {
    return txt.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
}
// Office hours text format for textarea:  Mon,13:00,15:00,Petty 101 (one per line)
function toOfficeHoursText(list = []) {
    if (!Array.isArray(list)) return "";
    return list
        .map(o => `${o.day || ""},${o.start || ""},${o.end || ""},${o.location || ""}`.trim())
        .join("\n");
}
function fromOfficeHoursText(txt = "") {
    return txt
        .split(/\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
            const [day = "", start = "", end = "", ...rest] = line.split(",");
            const location = rest.join(",").trim();
            return { day: day.trim(), start: start.trim(), end: end.trim(), location };
        });
}

export default function ProfessorProfile() {
    const { user } = useAuth();
    const token = user?.token;
    // Backend treats this as User.id
    const userId = user?.professor_user_id || user?.professorUserId || user?.id;

    const [mode, setMode] = useState("view"); // "view" | "edit"
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");
    const [ok, setOk] = useState("");

    // canonical profile from server
    const [profile, setProfile] = useState(null);

    // form state (for edit mode)
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [department, setDepartment] = useState("");
    const [bio, setBio] = useState("");
    const [coursesText, setCoursesText] = useState("");
    const [officeHoursText, setOfficeHoursText] = useState("");
    const [rating, setRating] = useState(0);

    // load profile
    useEffect(() => {
        (async () => {
            setLoading(true);
            setErr(""); setOk("");
            try {
                if (!userId) throw new Error("Missing user id");
                const p = await getProfessor(userId, token); // returns defaults if no row yet
                setProfile(p);
                // prefill form (used when switching to edit)
                setFirstName(p?.first_name || "");
                setLastName(p?.last_name || "");
                setEmail(p?.email || "");
                setDepartment(p?.department || "");
                setBio(p?.bio || "");
                setCoursesText(toCoursesText(p?.courses));
                setOfficeHoursText(toOfficeHoursText(p?.office_hours));
                setRating(p?.rating ?? 0);
                setMode("view"); // ensure we start in view
            } catch (e) {
                setErr(e.message || "Failed to load profile");
            } finally {
                setLoading(false);
            }
        })();
    }, [userId, token]);

    function enterEdit() {
        if (!profile) return;
        // sync form with current profile before editing
        setFirstName(profile.first_name || "");
        setLastName(profile.last_name || "");
        setEmail(profile.email || "");
        setDepartment(profile.department || "");
        setBio(profile.bio || "");
        setCoursesText(toCoursesText(profile.courses));
        setOfficeHoursText(toOfficeHoursText(profile.office_hours));
        setRating(profile.rating ?? 0);
        setOk("");
        setErr("");
        setMode("edit");
    }

    function cancelEdit() {
        setOk("");
        setErr("");
        setMode("view");
    }

    async function onSave(e) {
        e.preventDefault();
        setSaving(true);
        setErr(""); setOk("");
        try {
            const saved = await upsertProfessor(
                {
                    user_id: user?.id, // safe for your loosened schema
                    department: department || "",
                    bio: bio || "",
                    courses: fromCoursesText(coursesText),
                    office_hours: fromOfficeHoursText(officeHoursText),
                    rating: Number.isFinite(+rating) ? +rating : 0,
                },
                token
            );
            // Update canonical profile from server response
            setProfile(saved);
            // Ensure form reflects what was saved
            setFirstName(saved?.first_name || "");
            setLastName(saved?.last_name || "");
            setEmail(saved?.email || "");
            setDepartment(saved?.department || "");
            setBio(saved?.bio || "");
            setCoursesText(toCoursesText(saved?.courses));
            setOfficeHoursText(toOfficeHoursText(saved?.office_hours));
            setRating(saved?.rating ?? 0);

            setOk("Saved!");
            setMode("view"); // switch back to view
        } catch (e2) {
            setErr(e2.message || "Save failed");
        } finally {
            setSaving(false);
        }
    }

    // ---------- UI ----------
    if (loading) {
        return (
            <div className="container">
                <h2>👤 Professor Profile</h2>
                <div className="muted mt">Loading…</div>
            </div>
        );
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
                            <div>
                                <div className="muted">Name</div>
                                <div className="bold">{profile?.first_name} {profile?.last_name}</div>
                            </div>
                            <div>
                                <div className="muted">Email</div>
                                <div>{profile?.email || "—"}</div>
                            </div>
                            <div>
                                <div className="muted">Department</div>
                                <div>{profile?.department || "—"}</div>
                            </div>
                            <div>
                                <div className="muted">Rating</div>
                                <div>{profile?.rating ?? 0}</div>
                            </div>
                        </div>

                        <div className="mt">
                            <div className="muted">Bio</div>
                            <p>{profile?.bio || "—"}</p>
                        </div>

                        <div className="mt">
                            <div className="muted">Courses</div>
                            {Array.isArray(profile?.courses) && profile.courses.length ? (
                                <ul className="list">
                                    {profile.courses.map((c, i) => (
                                        <li key={i} className="list__row">{c}</li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="muted">—</div>
                            )}
                        </div>

                        <div className="mt">
                            <div className="muted">Office Hours</div>
                            {Array.isArray(profile?.office_hours) && profile.office_hours.length ? (
                                <ul className="list">
                                    {profile.office_hours.map((o, i) => (
                                        <li key={i} className="list__row">
                                            <span>{o.day || "Day"} {o.start || ""}{o.end ? `–${o.end}` : ""}</span>
                                            {o.location ? <span className="muted">@ {o.location}</span> : null}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="muted">—</div>
                            )}
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
                    <label className="field">
                        <span className="muted">First name</span>
                        <input value={firstName} readOnly />
                    </label>
                    <label className="field">
                        <span className="muted">Last name</span>
                        <input value={lastName} readOnly />
                    </label>
                </div>

                <label className="field mt">
                    <span className="muted">Email</span>
                    <input value={email} readOnly />
                </label>

                <label className="field mt">
                    <span className="muted">Department</span>
                    <input value={department} onChange={e => setDepartment(e.target.value)} />
                </label>

                <label className="field mt">
                    <span className="muted">Bio</span>
                    <textarea rows={3} value={bio} onChange={e => setBio(e.target.value)} />
                </label>

                <label className="field mt">
                    <span className="muted">Courses (comma or newline separated)</span>
                    <textarea rows={2} value={coursesText} onChange={e => setCoursesText(e.target.value)} />
                </label>

                <label className="field mt">
                    <span className="muted">Office Hours (one per line: Day,HH:MM,HH:MM,Location)</span>
                    <textarea rows={3} value={officeHoursText} onChange={e => setOfficeHoursText(e.target.value)} />
                </label>

                <label className="field mt">
                    <span className="muted">Rating</span>
                    <input type="number" step="0.1" value={rating} onChange={e => setRating(e.target.value)} />
                </label>

                <div className="mt" style={{ display: "flex", gap: 12 }}>
                    <button className="btn btn--primary" disabled={saving}>
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                    <button type="button" className="btn" onClick={cancelEdit} disabled={saving}>
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
}
