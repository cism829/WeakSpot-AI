import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/Authcontext";
import { useTheme } from "../context/ThemeContext";

export default function Navbar({ onToggleSidebar }) {
    const { pathname } = useLocation();
    const { user, logout} = useAuth();
    const { theme, toggle } = useTheme();

    console.log("Navbar user:", user);

    const links = [
        { to: "/dashboard", label: "Dashboard" },
        { to: "/notes", label: "Notes" },
        { to: "/notes-analysis", label: "Notes Analysis" },
        { to: "/flashcards", label: "Flashcards" },

        { to: "/generate-quiz",  label: "Generate Quiz" },
        { to: "/quizzes",        label: "My Quizzes" },

        { to: "/exam", label: "Exam" },
        { to: "/leaderboard", label: "Leaderboard" },
        { to: "/studygroups", label: "Study Groups" },
        { to: "/progress", label: "Progress" },
        { to: "/profile", label: "Profile" },
        { to: "/security", label: "Security Settings" },

        // Not in main nav (flow-only route):
        // { to: "/quiz-feedback", label: "Quiz Feedback", hidden: true },
    ];

    return (
        <header className="nav">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button className="btn btn--light" onClick={onToggleSidebar} title="Menu">☰</button>
                <div className="nav__brand">📘 WeakSpot</div>
            </div>

            {/* <nav className="nav__links" style={{ display: "none" }}>
                {links.map(l => (
                    <Link
                        key={l.to}
                        to={l.to}
                        className={`nav__link ${pathname === l.to ? "is-active" : ""}`}
                    >
                        {l.label}
                    </Link>
                ))}
            </nav> */}

            <div className="nav__right">
                <button className="btn btn--light" onClick={toggle} title="Toggle theme">
                    {theme === "light" ? "🌙" : "☀️"}
                </button>
                {user ? (
                    
                    <>
                        <div className="coin-pill" title="StudyCoins">🪙 {user.coins_balance}</div>
                        <Link to="/profile" className="btn btn--ghost">Hi, {user.first_name} {user.last_name}!</Link>
                        <button className="btn btn--primary" onClick={logout}>Logout</button>
                    </>
                ) : (
                    <>
                        <Link className="btn btn--ghost" to="/login">Login</Link>
                        <Link className="btn btn--ghost" to="/register">Register</Link>
                    </>
                )}
            </div>
        </header>
    );
}
