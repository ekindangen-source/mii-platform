import api from "./api";

const TOKEN_KEY = "MII_AUTH_TOKEN";
const USER_KEY = "MII_AUTH_USER";

export async function login(email, password) {
  const response = await api.post("/auth/login", {
    Email: email,
    Password: password,
  });

  const { token, user } = response.data;

  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));

  return user;
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getCurrentUser() {
  const storedUser = localStorage.getItem(USER_KEY);

  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser);
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function isLoggedIn() {
  return Boolean(getToken());
}

export async function verifySession() {
  if (!getToken()) {
    return null;
  }

  try {
    const response = await api.get("/auth/me");
    return response.data.user;
  } catch {
    logout();
    return null;
  }
}
