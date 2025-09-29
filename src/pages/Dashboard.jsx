import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/Authcontext";
import { req } from "../lib/api";

export default function Dashboard() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [quizzes, setQuizzes] = useState({ practice: [], exam: [] });
    const [notes, setNotes] = useState([]);

    const displayName = useMemo(
        () => user?.first_name || user?.name || user?.username || "there",
        [user]
    );

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                setErr("");
                // Pull profile (for future use), your quizzes, and notes (if endpoint exists)
                const [mineP, notesP] = await Promise.allSettled([
                    req("/quizzes/mine"),
                    req("/notes/mine"),
                ]);

                if (!alive) return;

                if (mineP.status === "fulfilled" && mineP.value) {
                    setQuizzes({
                        practice: mineP.value.practice || [],
                        exam: mineP.value.exam || [],
                    });
                } else {
                    setQuizzes({ practice: [], exam: [] });
                }

                if (notesP.status === "fulfilled" && Array.isArray(notesP.value)) {
                    setNotes(notesP.value);
                } else {
                    // fallback: synthesize "recent notes" from recent quiz titles
                    const recentFromQuizzes = [...(mineP.value?.practice || []), ...(mineP.value?.exam || [])]
                        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                        .slice(0, 3)
                        .map((q) => ({ id: `q-${q.id}`, title: q.title }));
                    setNotes(recentFromQuizzes);
                }
            } catch (e) {
                if (alive) setErr(e?.message || "Failed to load dashboard.");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, []);

    // “this week” = quizzes with a result in last 7 days (uses last_taken_at aggregate)
    const quizzesThisWeek = useMemo(() => {
        const all = [...quizzes.practice, ...quizzes.exam];
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        return all.filter((q) => q.last_taken_at && new Date(q.last_taken_at).getTime() >= weekAgo).length;
    }, [quizzes]);

    if (loading) {
        return (
            <div className="dashboard">
                <h2 className="dashboard-title">👋 Welcome back, {displayName}</h2>
                <div className="card">Loading…</div>
            </div>
        );
    }
    if (err) {
        return (
            <div className="dashboard">
                <h2 className="dashboard-title">👋 Welcome back, {displayName}</h2>
                <div className="card" style={{ color: "crimson" }}>{err}</div>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <h2 className="dashboard-title">👋 Welcome back, {displayName}</h2>

            <div className="dashboard-grid">
                {/* Progress Section */}
                <div className="card progress-card">
                    <h3>Your Progress 📈</h3>
                    <p>
                        You’ve completed{" "}
                        <span className="highlight">{quizzesThisWeek}</span> quiz
                        {quizzesThisWeek === 1 ? "" : "zes"} this week!
                    </p>
                    <p className="muted">
                        Total quizzes with attempts:{" "}
                        {(quizzes.practice || []).filter(q => (q.attempts || 0) > 0).length +
                            (quizzes.exam || []).filter(q => (q.attempts || 0) > 0).length}
                    </p>
                </div>

                {/* Notes Section */}
                <div className="card notes-card">
                    <h3>Recent Notes 📝</h3>
                    {notes?.length ? (
                        <ul>
                            {notes.slice(0, 5).map((n) => (
                                <li key={n.id || n.note_id || n.title}>{n.title || n.filename || "Untitled"}</li>
                            ))}
                        </ul>
                    ) : (
                        <div className="muted">No recent notes.</div>
                    )}
                </div>
            </div>
        </div>
    );
}
