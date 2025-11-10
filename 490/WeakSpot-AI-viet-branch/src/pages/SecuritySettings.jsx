import React, { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import { useAuth } from "../context/Authcontext";
import {
    getSecurity,
    updatePrivacy,
    changePassword,
    startTotpEnrollment,
    confirmTotp,
    disable2fa,
    signOutOtherSessions,
    updateAlerts,
    deleteAccount,
} from "../lib/api";

export default function SecuritySettings() {
    const { user, setUser } = useAuth();
    const token = user?.token;

    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    const [twoFAEnabled, setTwoFAEnabled] = useState(false);
    const [publicProfile, setPublicProfile] = useState(false);
    const [publicLeaderboard, setPublicLeaderboard] = useState(true);
    const [emailAlerts, setEmailAlerts] = useState({
        newDevice: true,
        passwordChange: true,
        twoFAChange: true,
    });

    const [totp, setTotp] = useState({ secret: "", otpauth: "", qrcodeDataUrl: "" });
    const [backupCodes, setBackupCodes] = useState([]);
    const [registeringWebAuthn, setRegisteringWebAuthn] = useState(false);

    const [pwdForm, setPwdForm] = useState({ current: "", next: "", confirm: "", show: false });
    const strongPwd = useMemo(() => strengthScore(pwdForm.next) >= 3, [pwdForm.next]);

    const [sessions, setSessions] = useState([]);
    const [danger, setDanger] = useState({ confirmText: "", busy: false });

    useEffect(() => {
        if (!token) return;
        (async () => {
            try {
                setLoading(true);
                setErr("");
                const res = await getSecurity(token);
                // shape: { twoFAEnabled, privacy:{public_profile,public_leaderboard}, alerts:{...}, sessions:[...] }
                setTwoFAEnabled(!!res.twoFAEnabled);
                setPublicProfile(!!res.privacy?.public_profile);
                setPublicLeaderboard(!!res.privacy?.public_leaderboard);
                setEmailAlerts({
                    newDevice: !!res.alerts?.new_device,
                    passwordChange: !!res.alerts?.password_change,
                    twoFAChange: !!res.alerts?.twofa_change,
                });
                setSessions(Array.isArray(res.sessions) ? res.sessions : []);
            } catch (e) {
                setErr(readErr(e));
            } finally {
                setLoading(false);
            }
        })();
    }, [token]);

    // ---- Handlers (now calling your backend) ----
    async function handleSavePrivacy() {
        try {
            setErr("");
            await updatePrivacy(
                { public_profile: publicProfile, public_leaderboard: publicLeaderboard },
                token
            );
            alert("Privacy settings saved.");
        } catch (e) {
            setErr(readErr(e));
        }
    }

    async function handleStartTOTP() {
        try {
            setErr("");
            const res = await startTotpEnrollment(token);
            setTotp({
                secret: res.secret || "",
                otpauth: res.otpauth || "",
                qrcodeDataUrl: res.qr || "",
            });
        } catch (e) {
            setErr(readErr(e));
        }
    }

    async function handleConfirmTOTP(code) {
        try {
            if (!code || code.length < 6) return alert("Enter the 6-digit code.");
            setErr("");
            const res = await confirmTotp(code, token);
            setTwoFAEnabled(true);
            setBackupCodes(res.backup_codes || []);
            alert("Two-factor authentication enabled.");
        } catch (e) {
            setErr(readErr(e));
        }
    }

    async function handleDisable2FA() {
        try {
            setErr("");
            await disable2fa(token);
            setTwoFAEnabled(false);
            setBackupCodes([]);
            setTotp({ secret: "", otpauth: "", qrcodeDataUrl: "" });
            alert("Two-factor authentication disabled.");
        } catch (e) {
            setErr(readErr(e));
        }
    }

    async function handleRegisterPasskey() {
        // Placeholder; needs WebAuthn ceremony + backend challenge endpoints
        try {
            setRegisteringWebAuthn(true);
            alert("Passkey registration flow not implemented yet.");
        } finally {
            setRegisteringWebAuthn(false);
        }
    }

    async function handleUpdatePassword(e) {
        e.preventDefault();
        if (pwdForm.next !== pwdForm.confirm) return alert("Passwords do not match.");
        if (!strongPwd) return alert("Choose a stronger password.");
        try {
            setErr("");
            await changePassword({ current: pwdForm.current, new: pwdForm.next }, token);
            alert("Password updated.");
            setPwdForm({ current: "", next: "", confirm: "", show: false });
        } catch (e) {
            setErr(readErr(e));
        }
    }

    async function handleRevokeSession(id) {
        // You only have "sign out other sessions" on backend right now.
        // If you add a per-session revoke endpoint later, call it here.
        alert("Per-session revoke not available. Use 'Sign out of other sessions'.");
    }

    async function handleSignOutOthers() {
        try {
            setErr("");
            await signOutOtherSessions(token);
            // Keep only the current session in UI
            setSessions((s) => s.filter((x) => x.current));
            alert("Signed out of other sessions.");
        } catch (e) {
            setErr(readErr(e));
        }
    }

    async function handleSaveAlerts() {
        try {
            setErr("");
            await updateAlerts(
                {
                    new_device: emailAlerts.newDevice,
                    password_change: emailAlerts.passwordChange,
                    twofa_change: emailAlerts.twoFAChange,
                },
                token
            );
            alert("Alert preferences saved.");
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
            // Optional: log user out client-side
            setUser?.(null);
        } catch (e) {
            setErr(readErr(e));
        } finally {
            setDanger({ confirmText: "", busy: false });
        }
    }

    return (
        <div className="container" style={{ maxWidth: 900 }}>
            <h2>🔒 Security Settings</h2>
            {err && <div className="alert alert--error" style={{ marginBottom: 12 }}>{err}</div>}
            {loading && <div className="muted" style={{ marginBottom: 12 }}>Loading security settings…</div>}

            {/* Two-Factor Authentication */}
            <Card title="Two-Factor Authentication (2FA)" subtitle="Add a second step to sign in" tone="blue">
                {!twoFAEnabled ? (
                    <>
                        <p>Protect your account with an authenticator app (TOTP) or a passkey (WebAuthn).</p>
                        <div className="grid grid--2" style={{ gap: 12 }}>
                            <div>
                                <b>TOTP (Authenticator app)</b>
                                {totp.secret ? (
                                    <>
                                        <p>Scan this QR in Google Authenticator (or enter the secret):</p>
                                        {totp.qrcodeDataUrl ? (
                                            <img alt="TOTP QR" src={totp.qrcodeDataUrl} style={{ width: 160, height: 160 }} />
                                        ) : (
                                            <code style={{ display: "block", wordBreak: "break-all" }}>{totp.otpauth}</code>
                                        )}
                                        <TOTPConfirm onConfirm={handleConfirmTOTP} />
                                    </>
                                ) : (
                                    <button className="btn btn--primary" onClick={handleStartTOTP}>Set up TOTP</button>
                                )}
                            </div>

                            <div>
                                <b>Passkeys / Security Keys (WebAuthn)</b>
                                <p>Use a hardware key or device biometrics.</p>
                                <button className="btn" onClick={handleRegisterPasskey} disabled={registeringWebAuthn}>
                                    {registeringWebAuthn ? "Registering…" : "Register a Passkey"}
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <p>2FA is <b>enabled</b>. Keep your backup codes safe.</p>
                        {backupCodes.length > 0 && <CodeList codes={backupCodes} />}
                        <button className="btn btn--danger mt" onClick={handleDisable2FA}>Disable 2FA</button>
                    </>
                )}
            </Card>

            {/* Change Password */}
            <Card title="Change Password" subtitle="Use a unique, strong password" tone="purple">
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

            {/* Sessions & Devices */}
            <Card title="Active Sessions & Devices" subtitle="Sign out devices you don’t recognize" tone="teal">
                <div className="table">
                    <div className="table__row table__row--header">
                        <div>Device</div><div>IP</div><div>Last active</div><div></div>
                    </div>
                    {sessions.map((s) => (
                        <div className="table__row" key={s.id}>
                            <div>{s.device}{s.current ? " (This device)" : ""}</div>
                            <div>{s.ip}</div>
                            <div>{s.last}</div>
                            <div>
                                {!s.current && (
                                    <button className="btn btn--small" onClick={() => handleRevokeSession(s.id)}>Sign out</button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                <button className="btn btn--secondary mt" onClick={handleSignOutOthers}>Sign out of other sessions</button>
            </Card>

            {/* Alerts */}
            <Card title="Login & Security Alerts" subtitle="Emails that help you stay informed" tone="orange">
                <label className="switch">
                    <input
                        type="checkbox"
                        checked={emailAlerts.newDevice}
                        onChange={(e) => setEmailAlerts({ ...emailAlerts, newDevice: e.target.checked })}
                    />
                    <span>New device login</span>
                </label>
                <label className="switch">
                    <input
                        type="checkbox"
                        checked={emailAlerts.passwordChange}
                        onChange={(e) => setEmailAlerts({ ...emailAlerts, passwordChange: e.target.checked })}
                    />
                    <span>Password changed</span>
                </label>
                <label className="switch">
                    <input
                        type="checkbox"
                        checked={emailAlerts.twoFAChange}
                        onChange={(e) => setEmailAlerts({ ...emailAlerts, twoFAChange: e.target.checked })}
                    />
                    <span>2FA enabled/disabled</span>
                </label>
                <button className="btn btn--primary mt" onClick={handleSaveAlerts}>Save</button>
            </Card>

            {/* Privacy */}
            <Card title="Privacy" subtitle="Control what others can see" tone="gray">
                <label className="switch">
                    <input type="checkbox" checked={publicProfile} onChange={(e) => setPublicProfile(e.target.checked)} />
                    <span>Show profile publicly</span>
                </label>
                <label className="switch">
                    <input type="checkbox" checked={publicLeaderboard} onChange={(e) => setPublicLeaderboard(e.target.checked)} />
                    <span>Show me on leaderboards</span>
                </label>
                <button className="btn btn--primary mt" onClick={handleSavePrivacy}>Save Settings</button>
            </Card>

            {/* Danger Zone */}
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

/* ---- Small helpers/components (inline for convenience) ---- */

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

function TOTPConfirm({ onConfirm }) {
    const [code, setCode] = useState("");
    return (
        <div className="grid" style={{ gap: 8, marginTop: 8 }}>
            <input
                placeholder="Enter 6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
            />
            <button className="btn btn--primary" onClick={() => onConfirm(code)}>Confirm</button>
        </div>
    );
}

function CodeList({ codes = [] }) {
    if (!codes.length) return null;
    return (
        <div className="mt">
            <div className="muted" style={{ marginBottom: 6 }}>Backup codes (store safely):</div>
            <div className="code" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
                {codes.map((c) => <code key={c}>{c}</code>)}
            </div>
        </div>
    );
}

function readErr(e) {
    if (!e) return "Unknown error";
    if (typeof e === "string") return e.slice(0, 300);
    if (e.detail) return String(e.detail).slice(0, 300);
    if (e.message) return String(e.message).slice(0, 300);
    try { return JSON.stringify(e).slice(0, 300); } catch { return "Request failed"; }
}
