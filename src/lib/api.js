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
export const authLogin = (payload) => req('/auth/login', { method: 'POST', body: payload });
export const authMe = (token) => req('/auth/me', { token });










export const genQuiz = (payload, token) => req('/quizzes/generate', { method: 'POST', body: payload, token });

export const listNotes = (token) => req('/notes/', { token });
export const createNote = (note, token) => req('/notes/', { method: 'POST', body: note, token });
export const deleteNote = (id, token) => req(`/notes/${id}`, { method: 'DELETE', token });
export const listFlashcards = (token) => req('/flashcards/', { token });
export const createFlashcard = (card, token) => req('/flashcards/', { method: 'POST', body: card, token });
export const deleteFlashcard = (id, token) => req(`/flashcards/${id}`, { method: 'DELETE', token });
export const getStats = (token) => req('/stats/', { token });
export const submitQuiz = (quiz_id, answers, token) => req(`/quizzes/${quiz_id}/submit`, { method: 'POST', body: { answers }, token });
export const getLeaderboard = (token) => req('/leaderboard/', { token });
export const getProfile = (token) => req('/profile/', { token });
export const updateProfile = (payload, token) => req('/profile/', { method: 'PUT', body: payload, token });
export const getProgress = (token) => req('/progress/', { token });
export const listGroups = (token) => req('/groups/', { token });
export const createGroup = (name, token) => req('/groups/', { method: 'POST', body: { name }, token });
export const joinGroup = (id, token) => req(`/groups/${id}/join`, { method: 'POST', token });
export const leaveGroup = (id, token) => req(`/groups/${id}/leave`, { method: 'POST', token });
export const groupMembers = (id, token) => req(`/groups/${id}/members`, { token });
