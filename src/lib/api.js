const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function req(p,{method='GET',body,token}={}){
  const h={'Content-Type':'application/json'};if(token)h['Authorization']=`Bearer ${token}`;
  const r=await fetch(`${API_URL}${p}`,{method,headers:h,body:body?JSON.stringify(body):undefined});const t=await r.text();
  let d;
  try{d=t?JSON.parse(t):null}catch{d={raw:t}}if(!r.ok)throw new Error(d?.detail||r.statusText||'Request failed');
  return d
}

export {req};

export const authRegister = (payload) => req('/auth/register', { method: 'POST', body: payload });
export const authLogin = (payload) => req('/auth/login', { method: 'POST', credentials: "include", body: payload });
export const authMe = () => req('/auth/me', { credentials: "include", });

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

// --- Quizzes: read + submit ---
export const getQuiz = (quiz_id, token) =>
  req(`/quizzes/${quiz_id}`, { token });

export const getQuizItems = (quiz_id, token) =>
  req(`/quizzes/${quiz_id}/items`, { token });

export const submitQuiz = (
  quiz_id,
  { user_id = 1, score = 0, time_spent_sec = 0 },
  token
) =>
  req(`/quizzes/${quiz_id}/submit`, {
    method: "POST",
    body: { user_id, score, time_spent_sec },
    token,
  });

// --- Quizzes: list mine ---
export const listMyQuizzes = (user_id = 1, token) =>
  req(`/quizzes/mine?user_id=${user_id}`, { token });







export const listNotes = (token) => req('/notes/', { token });
export const createNote = (note, token) => req('/notes/', { method: 'POST', body: note, token });
export const deleteNote = (id, token) => req(`/notes/${id}`, { method: 'DELETE', token });
export const listFlashcards = (token) => req('/flashcards/', { token });
export const createFlashcard = (card, token) => req('/flashcards/', { method: 'POST', body: card, token });
export const deleteFlashcard = (id, token) => req(`/flashcards/${id}`, { method: 'DELETE', token });
export const getStats = (token) => req('/stats/', { token });
export const getLeaderboard = (token) => req('/leaderboard/', { token });
export const getProfile = (token) => req('/profile/', { token });
export const updateProfile = (payload, token) => req('/profile/', { method: 'PUT', body: payload, token });
export const getProgress = (token) => req('/progress/', { token });
export const listGroups = (token) => req('/groups/', { token });
export const createGroup = (name, token) => req('/groups/', { method: 'POST', body: { name }, token });
export const joinGroup = (id, token) => req(`/groups/${id}/join`, { method: 'POST', token });
export const leaveGroup = (id, token) => req(`/groups/${id}/leave`, { method: 'POST', token });
export const groupMembers = (id, token) => req(`/groups/${id}/members`, { token });
