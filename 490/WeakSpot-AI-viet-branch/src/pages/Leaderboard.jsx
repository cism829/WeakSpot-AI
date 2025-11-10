import { useEffect, useState } from "react";
import Card from "../components/Card";
import { getLeaderboard } from "../lib/api";
import { useAuth } from "../context/Authcontext"; // <-- grab token

export default function Leaderboard() {
    const { token } = useAuth();                      // <-- token from context
    const [rows, setRows] = useState([]);
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const ac = new AbortController();
        (async () => {
            try {
                setLoading(true);
                const data = await getLeaderboard({ token, signal: ac.signal }); // <-- pass token
                if (!ac.signal.aborted) {
                    setRows(Array.isArray(data) ? data : []);
                    setErr("");
                }
            } catch (e) {
                if (!ac.signal.aborted) setErr(e?.message || "Failed to load leaderboard");
            } finally {
                if (!ac.signal.aborted) setLoading(false);
            }
        })();
        return () => ac.abort();
    }, [token]); // re-fetch if token changes

    if (err) return <div className="container"><Card tone="red">{err}</Card></div>;

    return (
        <div className="container">
            <h2>🏆 Leaderboard</h2>
            <Card tone="purple">
                {loading ? (
                    <div className="py-4">Loading…</div>
                ) : (
                    <div className="table">
                        <div className="table__head">
                            <div>Rank</div><div>Name</div><div>Coins (earned)</div><div>Total points</div>
                        </div>
                        {rows.map((r) => (
                            <div className={`table__row ${r.rank === 1 ? "is-top" : ""}`} key={r.id ?? r.userId ?? r.username ?? r.rank}>
                                <div>#{r.rank}</div><div>{r.username}</div><div>🪙 {r.coins}</div><div>{r.points}</div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}
