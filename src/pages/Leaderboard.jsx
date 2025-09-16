import React from "react";
import Card from "../components/Card";

export default function Leaderboard() {
    const rows = [
        { name: "Alice", score: 980, coins: 140 },
        { name: "Ben", score: 920, coins: 120 },
        { name: "Chloe", score: 880, coins: 105 },
    ];

    return (
        <div className="container">
            <h2>🏆 Leaderboard</h2>
            <Card tone="purple">
                <div className="table">
                    <div className="table__head">
                        <div>Rank</div><div>Name</div><div>Score</div><div>Coins</div>
                    </div>
                    {rows.map((r, i) => (
                        <div className={`table__row ${i === 0 ? "is-top" : ""}`} key={r.name}>
                            <div>#{i + 1}</div><div>{r.name}</div><div>{r.score}</div><div>🪙 {r.coins}</div>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}
