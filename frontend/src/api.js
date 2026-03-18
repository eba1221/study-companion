
const BASE = "https://study-companion-production-cec1.up.railway.app"; //base URL for the backend API
const LS_USER_KEY = "sc_user"; //key used to store user data (including auth token) in local storage

/*Auth (local storage)*/

export function getStoredUser() { // retrieves the stored user data from local storage, parsing it from JSON. If parsing fails, it returns null
  try {
    return JSON.parse(localStorage.getItem(LS_USER_KEY));
  } catch {
    return null;
  }
}

export function setStoredUser(user) { // saves the user data (including auth token) to local storage as a JSON string
  localStorage.setItem(LS_USER_KEY, JSON.stringify(user));
}


// removes the stored user data from local storage, logging the user out
export function clearStoredUser() {
  localStorage.removeItem(LS_USER_KEY);
}

// retrieves the auth token from the stored user data. If no user is stored or if the token is missing, it returns null
function getToken() {
  const user = getStoredUser();
  return user?.token ?? null;
}

/*request helpers*/


function headers(extra = {}) { // prepares info that goes with every request (data format and auth token if available)
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function asJson(res) { // converts the API response to JSON, handling errors appropriately
  const text = await res.text(); 
  try {
    const data = text ? JSON.parse(text) : null;  //
    if (!res.ok) {
      throw new Error(data?.error || data?.message || `HTTP ${res.status}`); 
    }
    return data;
  } catch {
    if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
    return text;
  }
}

async function GET(path) { // if used then app wants to retrieve data from backend 
  const res = await fetch(`${BASE}${path}`, { headers: headers() });
  return asJson(res);
}

async function POST(path, body) { // if used then app wants to send new data to the backend
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body ?? {}),
  });
  return asJson(res);
}

async function PUT(path, body) { // if used then app wants to update data on the backend
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify(body ?? {}),
  });
  return asJson(res);
}

async function DEL(path) { // if used then app wants to delete data on the backend
  const res = await fetch(`${BASE}${path}`, {
    method: "DELETE",
    headers: headers(),
  });
  return asJson(res);
}

/*Health */

// checks if the backend and database are healthy by sending a GET request to the /api/health/db endpoint

export async function dbHealth() {
  return GET("/api/health/db");
}

/* Auth */

export async function login(payload) { 
  const data = await POST("/api/auth/login", payload); // sends the user's login credentials to the backend
  if (data?.user && data?.token) {
    setStoredUser({ ...data.user, token: data.token }); // if the login is successful and the backend returns user data and an auth token
  }
  return data; // returns the response data from the backend 
}

export async function register(payload) {
  const data = await POST("/api/auth/signup", payload);
  if (data?.user && data?.token) {
    setStoredUser({ ...data.user, token: data.token });
  }
  return data;
}

export function logout() {
  clearStoredUser();
}

/* ---------------- Subjects / Topics / Spec points ---------------- */

export async function getSubjects() {
  return GET("/api/subjects");
}

export async function getTopicsBySubject(subjectId) {
  return GET(`/api/subjects/${subjectId}/topics`);
}

export async function getSpecPointsByTopic(topicId) {
  return GET(`/api/topics/${topicId}/spec-points`);
}

/* ---------------- Notes ---------------- */

export async function getNotes(params) {
  const qs = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v) !== "") qs.set(k, v);
  });
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return GET(`/api/notes${suffix}`);
}

export async function createNote(payload) {
  return POST("/api/notes", payload);
}

export async function updateNote(id, payload) {
  return PUT(`/api/notes/${id}`, payload);
}

export async function deleteNote(id) {
  return DEL(`/api/notes/${id}`);
}

/* ---------------- Decks ---------------- */

export async function getDecks() {
  return GET("/api/decks");
}

export async function createDeck(name) {
  return POST("/api/decks", { name });
}

export async function renameDeck(id, name) {
  return PUT(`/api/decks/${id}`, { name });
}

export async function deleteDeck(id) {
  return DEL(`/api/decks/${id}`);
}

/* ---------------- Cards ---------------- */

export async function getCards(deckId) {
  return GET(`/api/decks/${deckId}/cards`);
}

export async function addCard(deckId, front, back) {
  return POST(`/api/decks/${deckId}/cards`, { front, back });
}

export async function updateCard(id, front, back) {
  return PUT(`/api/cards/${id}`, { front, back });
}

export async function deleteCard(id) {
  return DEL(`/api/cards/${id}`);
}
