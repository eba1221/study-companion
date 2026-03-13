// frontend/src/api.js

const BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";
const LS_USER_KEY = "sc_user";

/* ---------------- Auth (local storage) ---------------- */

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(LS_USER_KEY));
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  localStorage.setItem(LS_USER_KEY, JSON.stringify(user));
}

export function clearStoredUser() {
  localStorage.removeItem(LS_USER_KEY);
}

function getToken() {
  const user = getStoredUser();
  return user?.token ?? null;
}

/* ---------------- Request helpers ---------------- */

function headers(extra = {}) {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function asJson(res) {
  const text = await res.text();
  try {
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
    }
    return data;
  } catch {
    if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
    return text;
  }
}

async function GET(path) {
  const res = await fetch(`${BASE}${path}`, { headers: headers() });
  return asJson(res);
}

async function POST(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body ?? {}),
  });
  return asJson(res);
}

async function PUT(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify(body ?? {}),
  });
  return asJson(res);
}

async function DEL(path) {
  const res = await fetch(`${BASE}${path}`, {
    method: "DELETE",
    headers: headers(),
  });
  return asJson(res);
}

/* ---------------- Health ---------------- */

export async function dbHealth() {
  return GET("/api/health/db");
}

/* ---------------- Auth ---------------- */

export async function login(payload) {
  const data = await POST("/api/auth/login", payload);
  if (data?.user && data?.token) {
    setStoredUser({ ...data.user, token: data.token });
  }
  return data;
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
