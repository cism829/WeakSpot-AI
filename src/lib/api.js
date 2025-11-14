// ------------------------------------------------------------
// Config
// ------------------------------------------------------------
export const API_URL = import.meta.env.VITE_API_URL || ""; // e.g. "http://localhost:8000"
export const UPLOAD_PATH = import.meta.env.VITE_UPLOAD_PATH || "/fileupload/upload";
export const DOWNLOAD_PATH = import.meta.env.VITE_DOWNLOAD_PATH || "/fileupload/download";

// ------------------------------------------------------------
// Core request helper
// ------------------------------------------------------------
async function req(
  p,
  { method = "GET", body, token, credentials = "include", headers = {} } = {}
) {
  const h = { "Content-Type": "application/json", ...headers };
  if (token) h["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${p}`, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
    credentials,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) throw new Error(data?.detail || res.statusText || "Request failed");
  return data;
}

export { req };

// ------------------------------------------------------------
// Auth
// ------------------------------------------------------------
export const authRegister = (payload) =>
  req("/auth/register", { method: "POST", body: payload });

export const authLogin = (payload) =>
  req("/auth/login", { method: "POST", body: payload });

export const authMe = () => req("/auth/me");

export const authLogout = () => req("/auth/logout", { method: "POST" });

// ------------------------------------------------------------
// Quizzes (OpenAI generators)
// ------------------------------------------------------------
export const deleteQuiz = (quizId, token) =>
  req(`/quizzes/delete/${quizId}`, { method: "DELETE", token });

// Generate WITHOUT note
export const quizzesGenerateAI = (
  {
    user_id = 1,
    subject = "general",
    difficulty = "medium", // "easy" | "medium" | "hard"
    mode = "practice", // "practice" | "exam"
    num_items = 10,
    types = ["mcq"], // ["mcq","short_answer","fill_blank","true_false"]
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
    note_id, // required for this endpoint
  },
  token
) =>
  req("/quizzes/generate-ai-from-note", {
    method: "POST",
    body: { user_id, subject, difficulty, mode, num_items, types, note_id },
    token,
  });

// List & grade
export const getQuiz = (id) => req(`/quizzes/${id}`);
export const listMyQuizzes = () => req("/quizzes/mine");
export const startPractice = (id) => req(`/quizzes/${id}/start`, { method: "POST" });
export const gradeQuiz = (quizId, payload, token) =>
  req(`/quizzes/${quizId}/grade`, { method: "POST", body: payload, token });

// Reviews
export const getBestReview = (quizId, token) =>
  req(`/quizzes/${quizId}/best`, { method: "GET", token });

// ------------------------------------------------------------
// Exams
// ------------------------------------------------------------
export const getMyExams = () => req("/exams/mine");
export const startExamById = (id) => req(`/exams/${id}/start`, { method: "POST" });

// ------------------------------------------------------------
// Leaderboard
// ------------------------------------------------------------
export async function getLeaderboard({ token, signal } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/leaderboard/`, {
    method: "GET",
    headers,
    signal,
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let detail;
    try {
      detail = text ? JSON.parse(text)?.detail : undefined;
    } catch {}
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ------------------------------------------------------------
// Flashcards
// ------------------------------------------------------------
export const listMyFlashcards = (token) => req("/flashcards/mine", { token });

export const getFlashcard = (id, token) => req(`/flashcards/${id}`, { token });

export const flashcardsGenerateAI = ({ subject, num_items, title }, token) =>
  req("/flashcards/generate-ai", {
    method: "POST",
    body: { subject, num_items, title },
    token,
  });

export const flashcardsGenerateAIFromNote = (
  { note_id, subject, num_items, title },
  token
) =>
  req("/flashcards/generate-ai-from-note", {
    method: "POST",
    body: { note_id, subject, num_items, title },
    token,
  });

// ------------------------------------------------------------
// Security / Account
// ------------------------------------------------------------
export const getSecurity = (token) => req("/auth/security", { token });

export const updatePrivacy = (payload, token) =>
  req("/auth/privacy", { method: "POST", body: payload, token });

export const changePassword = (payload, token) =>
  req("/auth/security/password", { method: "POST", body: payload, token });

export const startTotpEnrollment = (token) =>
  req("/auth/security/2fa/totp/start", { method: "POST", token });

export const confirmTotp = (code, token) =>
  req("/auth/security/2fa/totp/confirm", { method: "POST", body: { code }, token });

export const disable2fa = (token) =>
  req("/auth/security/2fa/disable", { method: "POST", token });

export const signOutOtherSessions = (token) =>
  req("/auth/sessions/others", { method: "DELETE", token });

export const updateAlerts = (payload, token) =>
  req("/auth/security/alerts", { method: "POST", body: payload, token });

export const deleteAccount = (confirm, token) =>
  req("/auth", { method: "DELETE", body: { confirm }, token });

// ------------------------------------------------------------
// Notes
// ------------------------------------------------------------
export const listMyNotes = (token) => req("/notes/mine", { token });

export const getNote = (id, token) => req(`/notes/${id}`, { token });

export const createNote = (og_text, token) =>
  fetch(`${API_URL}/notes`, {
    method: "POST",
    headers: { Authorization: token ? `Bearer ${token}` : undefined },
    body: (() => { const fd = new FormData(); fd.append("og_text", og_text); return fd; })(),
    credentials: "include",
  }).then(async (r) => {
    const text = await r.text();
    const data = text ? JSON.parse(text) : null;
    if (!r.ok) throw new Error(data?.detail || r.statusText || "Request failed");
    return data;
  });

export const uploadNoteFile = (file, token) => {
  const fd = new FormData();
  fd.append("file", file);
  return fetch(`${API_URL}/notes/upload`, {
    method: "POST",
    headers: { Authorization: token ? `Bearer ${token}` : undefined },
    body: fd,
    credentials: "include",
  }).then(async (r) => {
    const text = await r.text();
    const data = text ? JSON.parse(text) : null;
    if (!r.ok) throw new Error(data?.detail || r.statusText || "Upload failed");
    return data;
  });
};

export const deleteNote = (id, token) => req(`/notes/${id}`, { method: "DELETE", token });

export const semanticSearchNotes = (payload, token, userId) => {
  const qs = userId ? `?user_id=${encodeURIComponent(userId)}` : "";
  return req(`/search${qs}`, {
    method: "POST",
    body: payload,    
    token,
  });
};

export const analyzeNote = (id, token, subject) => {
  const qs = subject ? `?subject=${encodeURIComponent(subject)}` : "";
  return req(`/analysis/${id}${qs}`, { method: "POST", token });
};

export const getLatestAnalysis = (id, token) => req(`/analysis/${id}/latest`, { token });



export async function ocrZipUpload(file, token) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_URL}/ocr/zip`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
    credentials: "include",
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data?.detail || res.statusText || "OCR zip upload failed");
  return data;
}

// Create chunks/embeddings for all (or only missing)
export const chunkBackfill = (opts = {}, token) => {
  const {
    only_missing = true, max_chars = 800, overlap = 80,
    embed_model = "text-embedding-3-small",
  } = opts;
  const qs = new URLSearchParams({
    only_missing: String(only_missing),
    max_chars: String(max_chars),
    overlap: String(overlap),
    embed_model,
  }).toString();
  return req(`/chunk/backfill?${qs}`, { method: "POST", token });
};

// Chunk one note
export const chunkOne = (noteId, opts = {}, token) => {
  const {
    max_chars = 800, overlap = 80,
    embed_model = "text-embedding-3-small",
  } = opts;
  const qs = new URLSearchParams({
    max_chars: String(max_chars),
    overlap: String(overlap),
    embed_model,
  }).toString();
  return req(`/chunk/${noteId}?${qs}`, { method: "POST", token });
};

// OCR repair: suggest → apply/reject → get one
export const ocrRepairSuggest = (noteId, token) =>
  req(`/ocr/repair/suggest/${noteId}`, { method: "POST", token });

export const ocrApply = (repairId, edited_text, token) =>
  req(`/ocr/repair/apply/${repairId}`, { method: "POST", body: { edited_text }, token });

export const ocrReject = (repairId, token) =>
  req(`/ocr/repair/reject/${repairId}`, { method: "POST", token });

export const ocrGetRepair = (repairId, token) =>
  req(`/ocr/repair/${repairId}`, { token });

// ------------------------------------------------------------
// Tutors & Professors
// ------------------------------------------------------------

// Tutors
export const searchTutors = (params = {}, token) => {
  const { name, q, page = 1, pageSize, page_size } = params;

  const effectiveQ = (name ?? q ?? "").toString().trim();
  const finalParams = {};

  if (effectiveQ) {
    finalParams.q = effectiveQ;
    finalParams.name = effectiveQ; // harmless if backend ignores it
  }

  finalParams.page = page;
  const ps = pageSize ?? page_size;
  if (ps) finalParams.page_size = ps;

  const usp = new URLSearchParams(finalParams).toString();
  return req(`/tutors${usp ? `?${usp}` : ""}`, { token });
};

export const getTutor = (id, token) => req(`/tutors/${id}`, { token });

export const requestTutor = (id, payload, token) =>
  req(`/tutors/${id}/request`, { method: "POST", body: payload, token });

export const upsertTutor = (payload, token) =>
  req(`/tutors`, { method: "POST", body: payload, token });

// Professors
export const searchProfessors = async (params = {}, token) => {
  const { name, q, page, pageSize, page_size, dept } = params;

  const effectiveQ = (name ?? q ?? "").toString().trim();
  const finalParams = {};
  if (effectiveQ) finalParams.q = effectiveQ;
  if (dept) finalParams.dept = dept;

  const ps = pageSize ?? page_size;
  if (page != null) finalParams.page = page;
  if (ps != null) finalParams.page_size = ps;

  const qs = new URLSearchParams(finalParams).toString();

  try {
    return await req(`/professors${qs ? `?${qs}` : ""}`, { token });
  } catch (e) {
    return await req(`/professors/search`, {
      method: "POST",
      body: finalParams,
      token,
    });
  }
};

export const getProfessor = (id, token) => req(`/professors/${id}`, { token });

export const requestProfessor = (profId, body, token) =>
  req(`/professors/${profId}/request`, { method: "POST", body, token });

export const upsertProfessor = (payload, token) =>
  req(`/professors`, { method: "POST", body: payload, token });

export const listMyConnections = (token) => req(`/connections/mine`, { token });

export const listIncomingConnections = (token) =>
  req(`/connections/incoming`, { token });

export const acceptConnection = (id, token) =>
  req(`/connections/${id}/accept`, { method: "POST", token });

export const declineConnection = (id, token) =>
  req(`/connections/${id}/decline`, { method: "POST", token });

export const listTutorStudents = (token) =>
  req(`/tutors/me/students`, { token });