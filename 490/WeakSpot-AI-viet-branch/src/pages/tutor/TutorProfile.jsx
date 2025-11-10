import { useEffect, useState } from "react";
import { useAuth } from "../../context/Authcontext";
import { getTutor, upsertTutor } from "../../lib/api";

// -------- helpers --------
function toSubjectsText(arr = []) {
    return Array.isArray(arr) ? arr.join(", ") : "";
}
function fromSubjectsText(txt = "") {
    return txt.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
}
// Availability: simple free-form, one per line
function toAvailabilityText(arr = []) {
    return Array.isArray(arr) ? arr.join("\n") : "";
}
function fromAvailabilityText(txt = "") {
    return txt.split(/\n/).map(s => s.trim()).filter(Boolean);
}

export default function TutorProfile() {
    const { user } = useAuth();
    const token = user?.token;
    // Backend treats this path param as User.id
    const userId = user?.tutor_user_id || user?.tutorUserId || user?.id;

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

    const [bio, setBio] = useState("");
    const [subjectsText, setSubjectsText] = useState("");
    const [hourlyRate, setHourlyRate] = useState(0);
    const [rating, setRating] = useState(0);
    const [availabilityText, setAvailabilityText] = useState("");

    // load profile
    useEffect(() => {
        (async () => {
            setLoading(true);
            setErr(""); setOk("");
            try {
                if (!userId) throw new Error("Missing user id");
                const t = await getTutor(userId, token); // returns defaults if no row yet
                setProfile(t);

                // prefill form (used when switching to edit)
                setFirstName(t?.first_name || "");
                setLastName(t?.last_name || "");
                setEmail(t?.email || "");
                setBio(t?.bio || "");
                setSubjectsText(toSubjectsText(t?.subjects));
                setHourlyRate(t?.hourly_rate ?? 0);
                setRating(t?.rating ?? 0);
                setAvailabilityText(toAvailabilityText(t?.availability));

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
        setFirstName(profile.first_name || "");
        setLastName(profile.last_name || "");
        setEmail(profile.email || "");
        setBio(profile.bio || "");
        setSubjectsText(toSubjectsText(profile.subjects));
        setHourlyRate(profile.hourly_rate ?? 0);
        setRating(profile.rating ?? 0);
        setAvailabilityText(toAvailabilityText(profile.availability));
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
            const saved = await upsertTutor(
                {
                    user_id: user?.id, // lenient backend upsert supports this
                    bio: bio || "",
                    subjects: fromSubjectsText(subjectsText),
                    hourly_rate: Number.isFinite(+hourlyRate) ? +hourlyRate : 0,
                    rating: Number.isFinite(+rating) ? +rating : 0,
                    availability: fromAvailabilityText(availabilityText),
                },
                token
            );

            // Update canonical profile from server response
            setProfile(saved);

            // Keep form in sync with what's saved
            setFirstName(saved?.first_name || "");
            setLastName(saved?.last_name || "");
            setEmail(saved?.email || "");
            setBio(saved?.bio || "");
            setSubjectsText(toSubjectsText(saved?.subjects));
            setHourlyRate(saved?.hourly_rate ?? 0);
            setRating(saved?.rating ?? 0);
            setAvailabilityText(toAvailabilityText(saved?.availability));

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
                <h2>👤 Tutor Profile</h2>
                <div className="muted mt">Loading…</div>
            </div>
        );
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
                            <div>
                                <div className="muted">Name</div>
                                <div className="bold">{profile?.first_name} {profile?.last_name}</div>
                            </div>
                            <div>
                                <div className="muted">Email</div>
                                <div>{profile?.email || "—"}</div>
                            </div>
                            <div>
                                <div className="muted">Hourly Rate</div>
                                <div>${profile?.hourly_rate ?? 0}/hr</div>
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
                            <div className="muted">Subjects</div>
                            {Array.isArray(profile?.subjects) && profile.subjects.length ? (
                                <ul className="list">
                                    {profile.subjects.map((s, i) => (
                                        <li key={i} className="list__row">{s}</li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="muted">—</div>
                            )}
                        </div>

                        <div className="mt">
                            <div className="muted">Availability</div>
                            {Array.isArray(profile?.availability) && profile.availability.length ? (
                                <ul className="list">
                                    {profile.availability.map((a, i) => (
                                        <li key={i} className="list__row">{a}</li>
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
            <h2>👤 Tutor Profile</h2>
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
                    <span className="muted">Bio</span>
                    <textarea rows={3} value={bio} onChange={e => setBio(e.target.value)} />
                </label>

                <label className="field mt">
                    <span className="muted">Subjects (comma or newline separated)</span>
                    <textarea rows={2} value={subjectsText} onChange={e => setSubjectsText(e.target.value)} />
                </label>

                <div className="grid grid--2">
                    <label className="field mt">
                        <span className="muted">Hourly Rate</span>
                        <input
                            type="number"
                            step="1"
                            value={hourlyRate}
                            onChange={e => setHourlyRate(e.target.value)}
                        />
                    </label>
                    <label className="field mt">
                        <span className="muted">Rating</span>
                        <input
                            type="number"
                            step="0.1"
                            value={rating}
                            onChange={e => setRating(e.target.value)}
                        />
                    </label>
                </div>

                <label className="field mt">
                    <span className="muted">
                        Availability (one per line — e.g., "2025-10-28 14:00–15:00 @ Petty 101")
                    </span>
                    <textarea
                        rows={4}
                        value={availabilityText}
                        onChange={e => setAvailabilityText(e.target.value)}
                    />
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
