export const API_URL = import.meta.env.VITE_API_URL || "";           // e.g. "http://localhost:8000"
export const UPLOAD_PATH = import.meta.env.VITE_UPLOAD_PATH || "/fileupload/upload";
export const DOWNLOAD_PATH = import.meta.env.VITE_DOWNLOAD_PATH || "/fileupload/download";

async function req(p, { method = 'GET', body, token, credentials = 'include', headers = {} } = {}) {
  const h = { 'Content-Type': 'application/json', ...headers };
  if (token) h['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${p}`, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
    credentials
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data?.detail || res.statusText || 'Request failed');
  return data;
}

export { req };

export const authRegister = (payload) => req('/auth/register', { method: 'POST', body: payload });
export const authLogin = (payload) => req('/auth/login', { method: 'POST', body: payload });
export const authMe    = () => req('/auth/me');
export const authLogout = () => req('/auth/logout', { method: 'POST' });

// --- Quizzes: OpenAI generators ---
// Generate WITHOUT note
export const quizzesGenerateAI = (
  {
    user_id = 1,
    subject = "general",
    difficulty = "medium", // "easy" | "medium" | "hard"
    mode = "practice",     // "practice" | "exam"
    num_items = 10,
    types = ["mcq"],       // ["mcq","short_answer","fill_blank","true_false"]
  },
  token
) =>
  req("/quizzes/generate-ai", {
    method: "POST",
    body: { user_id, subject, difficulty, mode, num_items, types },
    token,
  });

// Generate WITH note
export const quizzesGenerateAIFromNote = (
  {
    user_id = 1,
    subject = "general",
    difficulty = "medium",
    mode = "practice",
    num_items = 10,
    types = ["mcq"],
    note_id,               // required for this endpoint
  },
  token
) =>
  req("/quizzes/generate-ai-from-note", {
    method: "POST",
    body: { user_id, subject, difficulty, mode, num_items, types, note_id },
    token,
  });

// --- Quizzes: list mine ---
export const getQuiz = (id) => req(`/quizzes/${id}`);
export const listMyQuizzes = () => req('/quizzes/mine');
export const startPractice = (id) => req(`/quizzes/${id}/start`, { method: 'POST' });
export const gradeQuiz = (quizId, payload, token) =>
  req(`/quizzes/${quizId}/grade`, { method: "POST", body: payload, token });


// --- Exams ---
export const getMyExams = () => req('/exams/mine');
export const startExamById = (id) => req(`/exams/${id}/start`, { method: 'POST' });
// --- Leaderboard ---
export async function getLeaderboard({ token, signal } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`; // <-- attach JWT

  const res = await fetch(`${API_URL}/leaderboard/`, {
    method: "GET",
    headers,
    signal,
    // optional: include cookies too if you sometimes use cookie auth
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let detail;
    try { detail = text ? JSON.parse(text)?.detail : undefined; } catch {}
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return res.json();
}
// --- Reviews ---
export const getBestReview = (quizId, token) =>
  req(`/quizzes/${quizId}/best`, { method: "GET", token });


export const listMyFlashcards = (token) =>
  req("/flashcards/mine", { token });

export const getFlashcard = (id, token) =>
  req(`/flashcards/${id}`, { token });

export const flashcardsGenerateAI = ({ subject, num_items, title }, token) =>
  req("/flashcards/generate-ai", {
    method: "POST",
    body: { subject, num_items, title },
    token,
  });

export const flashcardsGenerateAIFromNote = ({ note_id, subject, num_items, title }, token) =>
  req("/flashcards/generate-ai-from-note", {
    method: "POST",
    body: { note_id, subject, num_items, title },
    token,
  });

// Security (me)
export const getSecurity = (token) =>
  req('/auth/security', { token });

export const updatePrivacy = (payload, token) =>
  req('/auth/privacy', { method: 'POST', body: payload, token });

export const changePassword = (payload, token) =>
  req('/auth/security/password', { method: 'POST', body: payload, token });

export const startTotpEnrollment = (token) =>
  req('/auth/security/2fa/totp/start', { method: 'POST', token });

export const confirmTotp = (code, token) =>
  req('/auth/security/2fa/totp/confirm', { method: 'POST', body: { code }, token });

export const disable2fa = (token) =>
  req('/auth/security/2fa/disable', { method: 'POST', token });

export const signOutOtherSessions = (token) =>
  req('/auth/sessions/others', { method: 'DELETE', token });

export const updateAlerts = (payload, token) =>
  req('/auth/security/alerts', { method: 'POST', body: payload, token });

export const deleteAccount = (confirm, token) =>
  req('/auth', { method: 'DELETE', body: { confirm }, token });

export const listMyNotes = (token) => req('/notes/', { token });





export const createNote = (note, token) => req('/notes/', { method: 'POST', body: note, token });
export const deleteNote = (id, token) => req(`/notes/${id}`, { method: 'DELETE', token });
export const listFlashcards = (token) => req('/flashcards/', { token });
export const createFlashcard = (card, token) => req('/flashcards/', { method: 'POST', body: card, token });
export const deleteFlashcard = (id, token) => req(`/flashcards/${id}`, { method: 'DELETE', token });
export const getStats = (token) => req('/stats/', { token });
export const getProfile = (token) => req('/profile/', { token });
export const updateProfile = (payload, token) => req('/profile/', { method: 'PUT', body: payload, token });
export const getProgress = (token) => req('/progress/', { token });
export const listGroups = (token) => req('/groups/', { token });
export const createGroup = (name, token) => req('/groups/', { method: 'POST', body: { name }, token });
export const joinGroup = (id, token) => req(`/groups/${id}/join`, { method: 'POST', token });
export const leaveGroup = (id, token) => req(`/groups/${id}/leave`, { method: 'POST', token });
export const groupMembers = (id, token) => req(`/groups/${id}/members`, { token });
