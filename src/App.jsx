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
import Chat from "./pages/Chat"


// Protected Route wrapper
function PrivateRoute({ children }) {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Navigate to="/login" replace />;
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
          <div className={`with-sidebar ${sidebarCollapsed ? "is-collapsed" : ""}`}>
            <Sidebar
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              collapsed={sidebarCollapsed}
              onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
            <main className="app-shell">
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                <Route path="/chat" element={<Chat />} />

                {/* Protected routes */}
                <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                <Route path="/notes" element={<PrivateRoute><Notes /></PrivateRoute>} />
                <Route path="/flashcards" element={<PrivateRoute><Flashcards /></PrivateRoute>} />
                <Route path="/progress" element={<PrivateRoute><Progress /></PrivateRoute>} />
                <Route path="/leaderboard" element={<PrivateRoute><Leaderboard /></PrivateRoute>} />
                <Route path="/studygroups" element={<PrivateRoute><StudyGroups /></PrivateRoute>} />

                {/* <Route path="/chat" element={<PrivateRoute><Chat /></PrivateRoute>} /> */}
                
                <Route path="/notes-analysis" element={<PrivateRoute><NotesAnalysis /></PrivateRoute>} />
                <Route path="/security" element={<PrivateRoute><SecuritySettings /></PrivateRoute>} />
                <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
                <Route path="/exam" element={<PrivateRoute><Exam /></PrivateRoute>} />
                <Route path="/quiz" element={<PrivateRoute><Quiz /></PrivateRoute>} />
                <Route path="/quiz-feedback" element={<PrivateRoute><QuizFeedback /></PrivateRoute>} />
              </Routes>
            </main>
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
