import { NavLink } from "react-router-dom";
import { useAuth } from "../context/Authcontext";

function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse }) {
  const { isLoggedIn } = useAuth();

  if (!isLoggedIn) return null;

  const links = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/notes", label: "Notes" },
    { to: "/flashcards", label: "Flashcards" },
    { to: "/progress", label: "Progress" },
    { to: "/leaderboard", label: "Leaderboard" },
    { to: "/studygroups", label: "Study Groups" },
    { to: "/notes-analysis", label: "Notes Analysis" },
    { to: "/generate-quiz",  label: "Generate Quiz" },
    { to: "/quizzes",        label: "My Quizzes" },
    { to: "/quiz", label: "Quiz" },
    { to: "/exam", label: "Exam" },
    { to: "/quiz-feedback", label: "Quiz Feedback" },
    { to: "/profile", label: "Profile" },
    { to: "/security", label: "Security Settings" },
  ];

  return (
    <aside className={`sidebar ${isOpen ? "is-open" : ""} ${collapsed ? "is-collapsed" : ""}`}>
      <div className="sidebar__header">
        <span className="sidebar__brand">📘 {!collapsed && "Weakspot"}</span>
        <div className="sidebar__actions">
          <button className="sidebar__collapse" onClick={onToggleCollapse}>
            {collapsed ? "➡️" : "⬅️"}
          </button>
        </div>
      </div>
      <nav className="sidebar__nav">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              `sidebar__link ${isActive ? "is-active" : ""}`
            }
            onClick={onClose}
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
