import { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/Authcontext";
import { ThemeProvider } from "./context/ThemeContext";

// Layout
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";

// Pages
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Notes from "./pages/Notes";
import Flashcards from "./pages/Flashcards";
import Progress from "./pages/Progress";
import Leaderboard from "./pages/Leaderboard";
import StudyGroups from "./pages/StudyGroups";
import NotesAnalysis from "./pages/NotesAnalysis";
import SecuritySettings from "./pages/SecuritySettings";
import Profile from "./pages/Profile";
import Exam from "./pages/Exam";
import Quiz from "./pages/Quiz";
import QuizFeedback from "./pages/QuizFeedback";
import ProfessorAnnouncements from "./pages/professor/ProfessorAnnouncements";
import ProfessorClasses from "./pages/professor/ProfessorClasses";
import ProfessorDashboard from "./pages/professor/ProfessorDashboard";
import ProfessorMaterials from "./pages/professor/ProfessorMaterials";
import ProfessorStudents from "./pages/professor/ProfessorStudents";
import ProfessorProfile from "./pages/professor/ProfessorProfile";
import TutorDashboard from "./pages/tutor/TutorDashboard";
import TutorMessages from "./pages/tutor/TutorMessages";
import TutorProfile from "./pages/tutor/TutorProfile";
import TutorSchedule from "./pages/tutor/TutorSchedule";
import TutorStudents from "./pages/tutor/TutorStudents";
import TutorResources from "./pages/tutor/TutorResources";

// Protected Route wrapper
function PrivateRoute({ children }) {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Navigate to="/login" replace />;
}

function AppShell() {
  const { isLoggedIn } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <>
      <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      {isLoggedIn && (
        <div
          className={`with-sidebar ${sidebarCollapsed ? "is-collapsed" : ""}`}
        >
          <Sidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </div>
      )}
      <main
        className={`app-shell ${isLoggedIn ? (sidebarCollapsed ? "with-sidebar is-collapsed" : "with-sidebar") : ""
          }`}
      >
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected routes */}
          <Route path="/tutor/dashboard" element={<PrivateRoute><TutorDashboard /></PrivateRoute>} />
          <Route path="/tutor/students" element={<PrivateRoute><TutorStudents /></PrivateRoute>} />
          <Route path="/tutor/schedule" element={<PrivateRoute><TutorSchedule /></PrivateRoute>} />
          <Route path="/tutor/messages" element={<PrivateRoute><TutorMessages /></PrivateRoute>} />
          <Route path="/tutor/profile" element={<PrivateRoute><TutorProfile /></PrivateRoute>} />
          <Route path="/tutor/resources" element={<PrivateRoute><TutorResources /></PrivateRoute>} />
          <Route path="/professor/dashboard" element={<PrivateRoute><ProfessorDashboard /></PrivateRoute>} />
          <Route path="/professor/classes" element={<PrivateRoute><ProfessorClasses /></PrivateRoute>} />
          <Route path="/professor/materials" element={<PrivateRoute><ProfessorMaterials /></PrivateRoute>} />
          <Route path="/professor/students" element={<PrivateRoute><ProfessorStudents /></PrivateRoute>} />
          <Route path="/professor/announcements" element={<PrivateRoute><ProfessorAnnouncements /></PrivateRoute>} />
          <Route path="/professor/profile" element={<PrivateRoute><ProfessorProfile /></PrivateRoute>} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/notes" element={<PrivateRoute><Notes /></PrivateRoute>} />
          <Route path="/flashcards" element={<PrivateRoute><Flashcards /></PrivateRoute>} />
          <Route path="/progress" element={<PrivateRoute><Progress /></PrivateRoute>} />
          <Route path="/leaderboard" element={<PrivateRoute><Leaderboard /></PrivateRoute>} />
          <Route path="/studygroups" element={<PrivateRoute><StudyGroups /></PrivateRoute>} />
          <Route path="/notes-analysis" element={<PrivateRoute><NotesAnalysis /></PrivateRoute>} />
          <Route path="/security" element={<PrivateRoute><SecuritySettings /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
          <Route path="/exam" element={<PrivateRoute><Exam /></PrivateRoute>} />
          <Route path="/quiz" element={<PrivateRoute><Quiz /></PrivateRoute>} />
          <Route path="/quiz-feedback" element={<PrivateRoute><QuizFeedback /></PrivateRoute>} />
        </Routes>
      </main>
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <AppShell />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
