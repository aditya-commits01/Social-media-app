import { api, session } from "./api.js";

const app = document.getElementById("app");
const nav = document.getElementById("nav");

// ---------- tiny DOM helper (uses text nodes, so user content can't inject HTML) ----------
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return el;
}

const timeAgo = (iso) => {
  const s = (Date.now() - new Date(iso.replace(" ", "T") + "Z").getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const errorBox = () => h("p", { class: "error", hidden: true, role: "alert" });
const showError = (box, msg) => { box.textContent = msg; box.hidden = !msg; };

// ---------- navigation ----------
function renderNav() {
  const user = session.user;
  nav.replaceChildren(
    ...(user
      ? [
          h("a", { href: `#/u/${user.username}` }, `@${user.username}`),
          h("button", { class: "linkbtn", onclick: () => { session.clear(); location.hash = "#/login"; route(); } }, "Log out"),
        ]
      : [h("a", { href: "#/login" }, "Log in"), h("a", { href: "#/register", class: "btn" }, "Sign up")])
  );
}

// ---------- components ----------
function commentsSection(post, countEl) {
  const wrap = h("div", { class: "comments" });
  const list = h("div");
  const err = errorBox();

  const renderComment = (c) => {
    const row = h("div", { class: "comment" },
      h("span", {}, h("a", { href: `#/u/${c.username}` }, `@${c.username}`), " ", c.content),
    );
    if (session.user?.username === c.username) {
      row.append(h("button", { class: "linkbtn danger small", onclick: async () => {
        try {
          await api(`/posts/${post.id}/comments/${c.id}`, { method: "DELETE" });
          row.remove();
          post.comment_count--; countEl.textContent = `Comments (${post.comment_count})`;
        } catch (e) { showError(err, e.message); }
      } }, "Delete"));
    }
    return row;
  };

  api(`/posts/${post.id}/comments`).then((cs) => {
    list.replaceChildren(...(cs.length ? cs.map(renderComment) : [h("p", { class: "muted small" }, "No comments yet.")]));
  }).catch((e) => showError(err, e.message));

  wrap.append(list, err);

  if (session.user) {
    const input = h("input", { placeholder: "Write a comment", maxlength: 200, "aria-label": "Write a comment" });
    wrap.append(h("form", { class: "comment-form", onsubmit: async (e) => {
      e.preventDefault();
      try {
        const c = await api(`/posts/${post.id}/comments`, { method: "POST", body: { content: input.value } });
        if (list.querySelector("p.muted")) list.replaceChildren();
        list.append(renderComment(c));
        input.value = "";
        post.comment_count++; countEl.textContent = `Comments (${post.comment_count})`;
        showError(err, "");
      } catch (e2) { showError(err, e2.message); }
    } }, input, h("button", { class: "btn" }, "Reply")));
  } else {
    wrap.append(h("p", { class: "muted small" }, h("a", { href: "#/login" }, "Log in"), " to comment."));
  }
  return wrap;
}

function postCard(post, onDelete) {
  const me = session.user;
  const err = errorBox();
  const likeBtn = h("button", { class: `linkbtn like${post.liked ? " on" : ""}`, "aria-pressed": String(post.liked) });
  const paintLike = () => {
    likeBtn.textContent = `${post.liked ? "Liked" : "Like"} (${post.like_count})`;
    likeBtn.classList.toggle("on", post.liked);
    likeBtn.setAttribute("aria-pressed", String(post.liked));
  };
  paintLike();
  likeBtn.addEventListener("click", async () => {
    if (!me) { location.hash = "#/login"; return; }
    try {
      const r = await api(`/posts/${post.id}/like`, { method: "POST" });
      post.liked = r.liked; post.like_count = r.like_count; paintLike();
    } catch (e) { showError(err, e.message); }
  });

  const countEl = h("button", { class: "linkbtn" }, `Comments (${post.comment_count})`);
  let section = null;
  countEl.addEventListener("click", () => {
    if (section) { section.remove(); section = null; return; }
    section = commentsSection(post, countEl);
    card.append(section);
  });

  const head = h("div", { class: "head" },
    h("span", {}, h("a", { href: `#/u/${post.username}` }, `@${post.username}`), " ", h("span", { class: "muted small" }, timeAgo(post.created_at))),
  );
  if (me?.username === post.username) {
    head.append(h("button", { class: "linkbtn danger small", onclick: async () => {
      if (!confirm("Delete this post?")) return;
      try { await api(`/posts/${post.id}`, { method: "DELETE" }); onDelete(); } catch (e) { showError(err, e.message); }
    } }, "Delete"));
  }

  const card = h("article", { class: "card post" }, head, h("p", { class: "body" }, post.content), h("div", { class: "actions" }, likeBtn, countEl), err);
  return card;
}

// Paginated list of posts. `fetchPage(page)` must return { posts, hasMore }.
function postList(fetchPage) {
  const box = h("div");
  const more = h("button", { class: "btn outline", hidden: true }, "Load more");
  const err = errorBox();
  let page = 1;

  const load = async () => {
    try {
      const { posts, hasMore } = await fetchPage(page);
      if (page === 1 && posts.length === 0) box.append(h("p", { class: "empty" }, "Nothing here yet."));
      posts.forEach((p) => { const c = postCard(p, () => c.remove()); box.append(c); });
      more.hidden = !hasMore;
      showError(err, "");
    } catch (e) { showError(err, e.message); }
  };
  more.addEventListener("click", () => { page++; load(); });
  load();
  return h("div", {}, box, err, more);
}

function composer(onPosted) {
  const text = h("textarea", { maxlength: 280, placeholder: "What's happening?", "aria-label": "New post" });
  const count = h("span", { class: "muted small" }, "280");
  const err = errorBox();
  text.addEventListener("input", () => { count.textContent = String(280 - text.value.length); });
  return h("form", { class: "card composer", onsubmit: async (e) => {
    e.preventDefault();
    try {
      const p = await api("/posts", { method: "POST", body: { content: text.value } });
      text.value = ""; count.textContent = "280"; showError(err, "");
      onPosted(p);
    } catch (e2) { showError(err, e2.message); }
  } }, text, err, h("div", { class: "row" }, count, h("button", { class: "btn" }, "Post")));
}

// ---------- pages ----------
function feedPage() {
  const user = session.user;
  let tab = user ? "following" : "all";
  const listHolder = h("div");
  const tabs = h("div", { class: "tabs" });

  const draw = () => {
    tabs.replaceChildren(
      ...(user ? [["following", "Following"], ["all", "Everyone"]] : [["all", "Everyone"]]).map(([key, label]) =>
        h("button", { class: key === tab ? "on" : "", onclick: () => { tab = key; draw(); } }, label))
    );
    listHolder.replaceChildren(postList((page) => api(`/posts?feed=${tab}&page=${page}`)));
  };

  app.replaceChildren(
    user ? composer(() => draw()) : h("div", { class: "card" }, h("a", { href: "#/register" }, "Create an account"), " or ", h("a", { href: "#/login" }, "log in"), " to post, like and follow."),
    tabs, listHolder
  );
  draw();
}

function authPage(mode) {
  const isLogin = mode === "login";
  const f = { username: h("input", { required: true, autocomplete: "username", id: "f-user" }), email: h("input", { type: "email", required: true, autocomplete: "email", id: "f-email" }), password: h("input", { type: "password", required: true, minlength: 6, autocomplete: isLogin ? "current-password" : "new-password", id: "f-pass" }) };
  const err = errorBox();
  const btn = h("button", { class: "btn" }, isLogin ? "Log in" : "Sign up");

  const form = h("form", { class: "card form", onsubmit: async (e) => {
    e.preventDefault();
    btn.disabled = true;
    try {
      const body = isLogin ? { username: f.username.value, password: f.password.value } : { username: f.username.value, email: f.email.value, password: f.password.value };
      const r = await api(`/auth/${isLogin ? "login" : "register"}`, { method: "POST", body });
      session.save(r.token, r.user);
      location.hash = "#/";
    } catch (e2) { showError(err, e2.message); } finally { btn.disabled = false; }
  } },
    h("h1", {}, isLogin ? "Log in" : "Create your account"),
    h("label", { for: "f-user" }, isLogin ? "Username or email" : "Username", f.username),
    !isLogin && h("label", { for: "f-email" }, "Email", f.email),
    h("label", { for: "f-pass" }, "Password", f.password),
    err, btn,
    h("p", { class: "muted" }, isLogin ? ["New here? ", h("a", { href: "#/register" }, "Create an account")] : ["Already registered? ", h("a", { href: "#/login" }, "Log in")])
  );
  app.replaceChildren(form);
}

async function profilePage(username) {
  app.replaceChildren(h("p", { class: "muted" }, "Loading..."));
  let u;
  try { u = await api(`/users/${encodeURIComponent(username)}`); }
  catch (e) { app.replaceChildren(h("p", { class: "error" }, e.message)); return; }

  const err = errorBox();
  const followers = h("strong", {}, String(u.followers));
  const bio = h("p", {}, u.bio || (u.is_me ? "Add a short bio." : ""));
  let action = null;

  if (u.is_me) {
    action = h("button", { class: "btn outline", onclick: async () => {
      const next = prompt("Update your bio (max 160 characters)", u.bio);
      if (next === null) return;
      try { const r = await api("/users/me/bio", { method: "PUT", body: { bio: next } }); u.bio = r.bio; bio.textContent = r.bio || "Add a short bio."; }
      catch (e) { showError(err, e.message); }
    } }, "Edit bio");
  } else {
    action = h("button", { class: u.is_following ? "btn outline" : "btn" }, u.is_following ? "Following" : "Follow");
    action.addEventListener("click", async () => {
      if (!session.user) { location.hash = "#/login"; return; }
      try {
        const r = await api(`/users/${u.username}/follow`, { method: "POST" });
        u.is_following = r.is_following; followers.textContent = String(r.followers);
        action.textContent = r.is_following ? "Following" : "Follow";
        action.className = r.is_following ? "btn outline" : "btn";
      } catch (e) { showError(err, e.message); }
    });
  }

  app.replaceChildren(
    h("section", { class: "card profile" },
      h("div", { class: "top" }, h("div", {}, h("h1", {}, `@${u.username}`), h("span", { class: "muted small" }, `Joined ${new Date(u.created_at.replace(" ", "T") + "Z").toLocaleDateString()}`)), action),
      bio,
      h("div", { class: "stats" },
        h("div", {}, h("strong", {}, String(u.posts)), "Posts"),
        h("div", {}, followers, "Followers"),
        h("div", {}, h("strong", {}, String(u.following)), "Following")),
      err),
    postList((page) => api(`/posts?user=${encodeURIComponent(u.username)}&page=${page}`))
  );
}

// ---------- user search ----------
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");
let searchTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  const q = searchInput.value.trim();
  if (!q) { searchResults.hidden = true; return; }
  searchTimer = setTimeout(async () => {
    try {
      const users = await api(`/users/search?q=${encodeURIComponent(q)}`);
      searchResults.replaceChildren(...(users.length ? users.map((u) => h("li", {}, h("a", { href: `#/u/${u.username}` }, `@${u.username}`))) : [h("li", { class: "muted small", style: "padding:8px 10px" }, "No people found")]));
      searchResults.hidden = false;
    } catch { searchResults.hidden = true; }
  }, 250);
});
document.getElementById("search").addEventListener("submit", (e) => e.preventDefault());
document.addEventListener("click", (e) => { if (!e.target.closest("#search")) searchResults.hidden = true; });
searchResults.addEventListener("click", () => { searchResults.hidden = true; searchInput.value = ""; });

// ---------- router ----------
function route() {
  renderNav();
  const hash = location.hash || "#/";
  const m = hash.match(/^#\/u\/(.+)$/);
  if (m) return profilePage(decodeURIComponent(m[1]));
  if (hash === "#/login") return authPage("login");
  if (hash === "#/register") return authPage("register");
  return feedPage();
}
window.addEventListener("hashchange", route);
route();
