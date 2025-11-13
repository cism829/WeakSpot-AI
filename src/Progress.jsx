import React, { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import Stat from "../components/Stat";
import { req } from "../lib/api";

// Helper: compute a basic "study streak" using last_taken_at days
function computeStreak(lastDates) {
    const days = new Set(
        lastDates
            .filter(Boolean)
            .map((d) => new Date(d))
            .map((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime())
    );
    if (days.size === 0) return 0;

    const oneDay = 24 * 60 * 60 * 1000;
    let streak = 0;
    let cursor = new Date();
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()); // midnight today

    while (days.has(cursor.getTime())) {
        streak += 1;
        cursor = new Date(cursor.getTime() - oneDay);
    }
    return streak;
}

export default function Progress() {
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [mine, setMine] = useState({ practice: [], exam: [] });

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                setErr("");
                const data = await req("/quizzes/mine");
                if (!alive) return;
                setMine({
                    practice: data.practice || [],
                    exam: data.exam || [],
                });
            } catch (e) {
                if (alive) setErr(e?.message || "Failed to load progress.");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, []);

    const stats = useMemo(() => {
        const all = [...(mine.practice || []), ...(mine.exam || [])];
        const completed = all.filter((q) => (q.attempts || 0) > 0);

        const avg =
            completed.length > 0
                ? Math.round(
                    (completed.reduce((s, q) => s + (q.best_score || 0), 0) / completed.length) * 10
                ) / 10
                : 0;

        const streak = computeStreak(all.map((q) => q.last_taken_at));

        // Timeseries for “scores over time” using last_taken_at + best_score (best we have without a full results endpoint)
        const series = completed
            .map((q) => ({
                date: q.last_taken_at ? new Date(q.last_taken_at) : null,
                score: q.best_score ?? null,
                title: q.title,
            }))
            .filter((x) => x.date && typeof x.score === "number")
            .sort((a, b) => a.date - b.date);

        // Weak topics: lowest best scores
        const weak = [...completed]
            .sort((a, b) => (a.best_score ?? 0) - (b.best_score ?? 0))
            .slice(0, 5)
            .map((q) => q.title);

        return {
            completedCount: completed.length,
            avgScore: avg,
            streakDays: streak,
            series,
            weak,
        };
    }, [mine]);

    if (loading) return <div className="container"><Card>Loading…</Card></div>;
    if (err) return <div className="container"><Card tone="red">{err}</Card></div>;

    return (
        <div className="container">
            <h2>📈 Your Progress</h2>
            <div className="grid grid--3">
                <Card title="Overall stats" tone="green">
                <Stat label="Quizzes completed" value={String(stats.completedCount)} emoji="✅" tone="blue" />
                <Stat label="Avg. score" value={`${stats.avgScore}`} emoji="🎯" tone="purple" />
                <Stat label="Study streak" value={`${stats.streakDays} day${stats.streakDays === 1 ? "" : "s"}`} emoji="🔥" tone="green" />
                </Card>
            </div>

            <div className="grid grid--2">
                <Card title="Scores over time" tone="blue">
                    {/* If you later add a chart lib, feed `stats.series` to it */}
                    {stats.series.length === 0 ? (
                        <div className="muted">No scores yet.</div>
                    ) : (
                        <ul className="list">
                            {stats.series.slice(-10).map((p, i) => (
                                <li key={i}>
                                    <span className="muted">{p.date.toLocaleDateString()}</span> — <b>{Math.round(p.score)}</b> · {p.title}
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>

                <Card title="Weak topics" tone="purple">
                    {stats.weak.length === 0 ? (
                        <div className="muted">No weak topics yet.</div>
                    ) : (
                        <ul className="list-chips">
                            {stats.weak.map((t, i) => <li key={i}>{t}</li>)}
                        </ul>
                    )}
                </Card>
            </div>
        </div>
    );
}
