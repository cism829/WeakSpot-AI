// SecuritySettings.jsx — minimal view: Reset Password + Delete Account only
import React, { useMemo, useState } from "react";
import Card from "../components/Card";
import { useAuth } from "../context/Authcontext";
import { changePassword, deleteAccount } from "../lib/api";

export default function SecuritySettings() {
    const { user, setUser } = useAuth();
    const token = user?.token;

    const [err, setErr] = useState("");
    const [pwdForm, setPwdForm] = useState({ current: "", next: "", confirm: "", show: false });
    const strongPwd = useMemo(() => strengthScore(pwdForm.next) >= 3, [pwdForm.next]);

    const [danger, setDanger] = useState({ confirmText: "", busy: false });

    async function handleUpdatePassword(e) {
        e.preventDefault();
        if (pwdForm.next !== pwdForm.confirm) return alert("Passwords do not match.");
        if (!strongPwd) return alert("Choose a stronger password.");
        try {
            setErr("");
            // If your backend expects { current, new }, keep this; if it expects new_password, change the key.
            await changePassword({ current: pwdForm.current, new_password: pwdForm.next }, token);
            alert("Password updated.");
            setPwdForm({ current: "", next: "", confirm: "", show: false });
        } catch (e) {
            setErr(readErr(e));
        }
    }

    async function handleDeleteAccount() {
        if (danger.confirmText !== "DELETE") return alert('Type DELETE to confirm.');
        try {
            setErr("");
            setDanger((d) => ({ ...d, busy: true }));
            await deleteAccount("DELETE", token);
            alert("Account deleted.");
            setUser?.(null); // log out locally
        } catch (e) {
            setErr(readErr(e));
        } finally {
            setDanger({ confirmText: "", busy: false });
        }
    }

    return (
        <div className="container" style={{ maxWidth: 640 }}>
            <h2>🔒 Security</h2>
            {err && <div className="alert alert--error" style={{ marginBottom: 12 }}>{err}</div>}

            {/* Reset Password */}
            <Card title="Reset Password" subtitle="Update your password" tone="purple">
                <form onSubmit={handleUpdatePassword} className="grid grid--3" style={{ gap: 12 }}>
                    <label>
                        <div className="muted">Current password</div>
                        <input
                            type={pwdForm.show ? "text" : "password"}
                            value={pwdForm.current}
                            onChange={(e) => setPwdForm({ ...pwdForm, current: e.target.value })}
                            required
                        />
                    </label>
                    <label>
                        <div className="muted">New password</div>
                        <input
                            type={pwdForm.show ? "text" : "password"}
                            value={pwdForm.next}
                            onChange={(e) => setPwdForm({ ...pwdForm, next: e.target.value })}
                            required
                        />
                        <StrengthMeter value={pwdForm.next} />
                    </label>
                    <label>
                        <div className="muted">Confirm new password</div>
                        <input
                            type={pwdForm.show ? "text" : "password"}
                            value={pwdForm.confirm}
                            onChange={(e) => setPwdForm({ ...pwdForm, confirm: e.target.value })}
                            required
                        />
                    </label>
                    <label style={{ gridColumn: "1 / -1" }}>
                        <input
                            type="checkbox"
                            checked={pwdForm.show}
                            onChange={(e) => setPwdForm({ ...pwdForm, show: e.target.checked })}
                        />{" "}
                        Show passwords
                    </label>
                    <div style={{ gridColumn: "1 / -1" }}>
                        <button className="btn btn--primary" type="submit">Update Password</button>
                    </div>
                </form>
            </Card>

            {/* Delete Account */}
            <Card title="Danger Zone" subtitle="Permanent actions" tone="red">
                <p>Deleting your account removes your quizzes, flashcards, notes, results, and profile.</p>
                <div className="grid grid--2" style={{ gap: 12 }}>
                    <input
                        placeholder='Type DELETE to confirm'
                        value={danger.confirmText}
                        onChange={(e) => setDanger({ ...danger, confirmText: e.target.value })}
                    />
                    <button className="btn btn--danger" onClick={handleDeleteAccount} disabled={danger.busy}>
                        {danger.busy ? "Processing…" : "Delete my account"}
                    </button>
                </div>
            </Card>
        </div>
    );
}

/* ---- Small helpers (same as before) ---- */
function StrengthMeter({ value }) {
    const score = strengthScore(value);
    const labels = ["Very weak", "Weak", "Okay", "Strong", "Very strong"];
    return (
        <div className="muted" style={{ marginTop: 6 }}>
            Strength: <b>{labels[score]}</b>
        </div>
    );
}
function strengthScore(pw = "") {
    let s = 0;
    if (pw.length >= 10) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[a-z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return Math.min(s, 4);
}
function readErr(e) {
    if (!e) return "Unknown error";
    if (typeof e === "string") return e.slice(0, 300);
    if (e.detail) return String(e.detail).slice(0, 300);
    if (e.message) return String(e.message).slice(0, 300);
    try { return JSON.stringify(e).slice(0, 300); } catch { return "Request failed"; }
}
