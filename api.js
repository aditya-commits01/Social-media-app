// Thin wrapper around fetch: adds the JWT and turns error responses into Errors.
export const session = {
  get user() { return JSON.parse(localStorage.getItem("user") || "null"); },
  get token() { return localStorage.getItem("token"); },
  save(token, user) { localStorage.setItem("token", token); localStorage.setItem("user", JSON.stringify(user)); },
  clear() { localStorage.removeItem("token"); localStorage.removeItem("user"); },
};

export async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && session.token) session.clear(); // expired token
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}
