import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/Authcontext";
import { useTheme } from "../context/ThemeContext";

export default function Navbar({ onToggleSidebar }) {
    const { pathname } = useLocation();
    const { user, logout, coins } = useAuth();
    const { theme, toggle } = useTheme();

    const links = [
        { to: "/", label: "Home" },
        { to: "/notes", label: "Notes" },
        { to: "/flashcards", label: "Flashcards" },
        { to: "/progress", label: "Progress" },
        { to: "/leaderboard", label: "Leaderboard" },
        { to: "/groups", label: "Study Groups" },
    ];

    return (
        <header className="nav">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button className="btn btn--light" onClick={onToggleSidebar} title="Menu">☰</button>
                <div className="nav__brand">📘 WeakSpot</div>
            </div>

            <nav className="nav__links" style={{ display: "none" }}>
                {links.map(l => (
                    <Link
                        key={l.to}
                        to={l.to}
                        className={`nav__link ${pathname === l.to ? "is-active" : ""}`}
                    >
                        {l.label}
                    </Link>
                ))}
            </nav>

            <div className="nav__right">
                <button className="btn btn--light" onClick={toggle} title="Toggle theme">
                    {theme === "light" ? "🌙" : "☀️"}
                </button>
                <div className="coin-pill" title="StudyCoins">🪙 {coins}</div>
                {user ? (
                    <>
                        <Link to="/profile" className="btn btn--ghost">Hi, {user.name}</Link>
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
