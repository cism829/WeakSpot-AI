import React, { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import { useAuth } from "../context/Authcontext";
import { req } from "../lib/api";

export default function Profile() {
    const { user, setUser, logout } = useAuth();
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [mine, setMine] = useState({ practice: [], exam: [] });

    // Load latest profile + basic activity aggregates
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                setErr("");
                const [meP, mineP] = await Promise.allSettled([
                    req("/auth/me"),
                    req("/quizzes/mine"),
                ]);
                if (!alive) return;

                if (meP.status === "fulfilled" && meP.value) {
                    setUser ? setUser(meP.value) : undefined;
                }
                if (mineP.status === "fulfilled" && mineP.value) {
                    setMine({
                        practice: mineP.value.practice || [],
                        exam: mineP.value.exam || [],
                    });
                }
            } catch (e) {
                if (alive) setErr(e?.message || "Failed to load profile.");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [setUser]);

    const fullName = useMemo(() => {
        const fn = user?.first_name || "";
        const ln = user?.last_name || "";
        const combined = `${fn} ${ln}`.trim();
        return combined || user?.name || user?.username || "Student";
    }, [user]);

    const initials = useMemo(() => {
        const src = (user?.first_name && user?.last_name)
            ? `${user.first_name[0] || ""}${user.last_name[0] || ""}`
            : (user?.username || user?.email || "U?").slice(0, 2);
        return src.toUpperCase();
    }, [user]);

    const coins = {
        balance: user?.coins_balance ?? 0,
        lifetime: user?.coins_earned_total ?? user?.coins_total ?? 0,
    };
    const points = user?.total_points ?? 0;

    // aggregates from /quizzes/mine
    const totals = useMemo(() => {
        const p = mine.practice || [];
        const e = mine.exam || [];
        const all = [...p, ...e];
        const totalQuizzes = all.length;
        const attempts = all.reduce((s, q) => s + (q.attempts || 0), 0);
        const best = all.reduce((m, q) => Math.max(m, Number(q.best_score || 0)), 0);
        const lastTaken = all
            .map((q) => q.last_taken_at ? new Date(q.last_taken_at) : null)
            .filter(Boolean)
            .sort((a, b) => b - a)[0];
        return {
            totalQuizzes,
            practiceCount: p.length,
            examCount: e.length,
            attempts,
            bestScore: Math.round(best),
            lastTaken,
        };
    }, [mine]);

    async function refresh() {
        setLoading(true);
        setErr("");
        try {
            const [me, m] = await Promise.all([req("/auth/me"), req("/quizzes/mine")]);
            setUser ? setUser(me) : undefined;
            setMine({ practice: m.practice || [], exam: m.exam || [] });
        } catch (e) {
            setErr(e?.message || "Failed to refresh.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="container">
            <h2>👤 Profile</h2>

            {err && <div className="alert alert--error" style={{ marginBottom: 12 }}>{err}</div>}

            <Card tone="purple">
                <div className="profile" style={{ display: "flex", gap: 16, alignItems: "center" }}>
                    <div className="avatar" style={{
                        width: 56, height: 56, borderRadius: 12, display: "grid", placeItems: "center",
                        background: "#eee", fontWeight: 700, fontSize: 18
                    }}>{initials}</div>
                    <div className="grow">
                        <div><strong>Name:</strong> {fullName}</div>
                        <div><strong>Username:</strong> {user?.username || "—"}</div>
                        <div><strong>Email:</strong> {user?.email || "—"}</div>
                        <div><strong>Grade level:</strong> {user?.grade_level || "—"}</div>
                        <div><strong>Role:</strong>{user?.role}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn btn--light" onClick={refresh} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
                        {logout && <button className="btn" onClick={logout}>Logout</button>}
                    </div>
                </div>
            </Card>

            <div className="grid grid--3" style={{ marginTop: 16 }}>
                <Card title="Coins (balance)" tone="blue"><div style={{ fontSize: 24, fontWeight: 700 }}>🪙 {coins.balance}</div></Card>
                <Card title="Coins (lifetime earned)" tone="blue"><div style={{ fontSize: 24, fontWeight: 700 }}>🪙 {coins.lifetime}</div></Card>
                <Card title="Total points" tone="green"><div style={{ fontSize: 24, fontWeight: 700 }}>{points}</div></Card>
            </div>

            <div className="grid grid--2" style={{ marginTop: 16 }}>
                <Card title="Your quizzes">
                    <div className="table">
                        <div className="table__head"><div>Total</div><div>Practice</div><div>Exams</div><div>Attempts</div><div>Best</div><div>Last taken</div></div>
                        <div className="table__row">
                            <div>{totals.totalQuizzes}</div>
                            <div>{totals.practiceCount}</div>
                            <div>{totals.examCount}</div>
                            <div>{totals.attempts}</div>
                            <div>{totals.bestScore}%</div>
                            <div className="muted">{totals.lastTaken ? totals.lastTaken.toLocaleString() : "—"}</div>
                        </div>
                    </div>
                </Card>

                <Card title="Security & Account">
                    <ul className="list">
                        <li>Email verified: <b>{user?.email_verified ? "Yes" : "No"}</b></li>
                        <li>Member since: <span className="muted">{user.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}</span></li>
                    </ul>
                    <div className="muted" style={{ marginTop: 8 }}>
                        Need changes to your name or email? Contact support or add an edit form here.
                    </div>
                </Card>
            </div>
        </div>
    );
}
