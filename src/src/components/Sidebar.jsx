import { NavLink } from "react-router-dom";
import { useAuth } from "../context/Authcontext";

function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse }) {
  const { isLoggedIn, user } = useAuth();

  if (!isLoggedIn) return null;

  const StudentLinks = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/notes", label: "Notes" },
    { to: "/flashcards", label: "Flashcards" },
    { to: "/progress", label: "Progress" },
    { to: "/leaderboard", label: "Leaderboard" },
    { to: "/studygroups", label: "Study Groups" },
    { to: "/notes-analysis", label: "Notes Analysis" },
    { to: "/quiz", label: "Quiz" },
    { to: "/exam", label: "Exam" },
    { to: "/quiz-feedback", label: "Quiz Feedback" },
    { to: "/profile", label: "Profile" },
    { to: "/security", label: "Security Settings" },
  ];

  const ProfessorLinks = [
    { to: "/professor/dashboard", label: "Dashboard" },
    { to: "/professor/classes", label: "My Classes" },
    { to: "/professor/materials", label: "Materials" },
    { to: "/professor/students", label: "Students" },
    { to: "/professor/announcements", label: "Announcements" },
    { to: "/professor/profile", label: "Profile" },
  ];

  const TutorLinks = [
    { to: "/tutor/dashboard", label: "Dashboard" },
    { to: "/tutor/students", label: "My Students" },
    { to: "/tutor/schedule", label: "Schedule" },
    { to: "/tutor/messages", label: "Messages" },
    { to: "/tutor/resources", label: "Resources" },
    { to: "/tutor/profile", label: "Profile" },
  ];

  const links =
    user?.role === "Professor"
      ? ProfessorLinks
      : user?.role === "Tutor"
        ? TutorLinks
        : StudentLinks;

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
