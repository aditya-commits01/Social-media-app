import { Router } from "express";
import db from "../db.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";

const router = Router();
const PAGE_SIZE = 10;
const MAX_POST = 280;

const BASE = `
SELECT p.id, p.content, p.created_at, u.username,
  (SELECT COUNT(*) FROM likes    WHERE post_id = p.id) AS like_count,
  (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comment_count,
  EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = @me) AS liked
FROM posts p JOIN users u ON u.id = p.user_id`;

function listPosts({ where = "1=1", params = {}, me, page }) {
  const offset = (Math.max(1, Number(page) || 1) - 1) * PAGE_SIZE;
  const rows = db
    .prepare(`${BASE} WHERE ${where} ORDER BY p.created_at DESC, p.id DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, me, limit: PAGE_SIZE + 1, offset });
  const hasMore = rows.length > PAGE_SIZE;
  return { posts: rows.slice(0, PAGE_SIZE).map((r) => ({ ...r, liked: !!r.liked })), hasMore };
}

// GET /api/posts?feed=all|following&user=<username>&page=1
router.get("/", optionalAuth, (req, res) => {
  const me = req.user?.id ?? 0;
  const { feed, user, page } = req.query;

  if (user) {
    const u = db.prepare("SELECT id FROM users WHERE username = ?").get(user);
    if (!u) return res.status(404).json({ error: "User not found" });
    return res.json(listPosts({ where: "p.user_id = @uid", params: { uid: u.id }, me, page }));
  }
  if (feed === "following") {
    if (!me) return res.status(401).json({ error: "Log in to see your following feed" });
    return res.json(
      listPosts({
        where: "(p.user_id IN (SELECT following_id FROM follows WHERE follower_id = @me) OR p.user_id = @me)",
        me,
        page,
      })
    );
  }
  res.json(listPosts({ me, page }));
});

router.post("/", requireAuth, (req, res) => {
  const content = String(req.body.content ?? "").trim();
  if (!content) return res.status(400).json({ error: "Write something before posting" });
  if (content.length > MAX_POST) return res.status(400).json({ error: `Posts are limited to ${MAX_POST} characters` });
  const info = db.prepare("INSERT INTO posts (user_id, content) VALUES (?, ?)").run(req.user.id, content);
  const post = db.prepare(`${BASE} WHERE p.id = @id`).get({ id: info.lastInsertRowid, me: req.user.id });
  res.status(201).json({ ...post, liked: !!post.liked });
});

router.delete("/:id", requireAuth, (req, res) => {
  const post = db.prepare("SELECT user_id FROM posts WHERE id = ?").get(req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (post.user_id !== req.user.id) return res.status(403).json({ error: "You can only delete your own posts" });
  db.prepare("DELETE FROM posts WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// Like / unlike toggle.
router.post("/:id/like", requireAuth, (req, res) => {
  const post = db.prepare("SELECT id FROM posts WHERE id = ?").get(req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });
  const had = db.prepare("SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?").get(req.user.id, post.id);
  if (had) db.prepare("DELETE FROM likes WHERE user_id = ? AND post_id = ?").run(req.user.id, post.id);
  else db.prepare("INSERT INTO likes (user_id, post_id) VALUES (?, ?)").run(req.user.id, post.id);
  const like_count = db.prepare("SELECT COUNT(*) AS n FROM likes WHERE post_id = ?").get(post.id).n;
  res.json({ liked: !had, like_count });
});

router.get("/:id/comments", (req, res) => {
  const rows = db
    .prepare(
      `SELECT c.id, c.content, c.created_at, u.username
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.post_id = ? ORDER BY c.created_at ASC, c.id ASC`
    )
    .all(req.params.id);
  res.json(rows);
});

router.post("/:id/comments", requireAuth, (req, res) => {
  const content = String(req.body.content ?? "").trim();
  if (!content) return res.status(400).json({ error: "Write a comment first" });
  if (content.length > 200) return res.status(400).json({ error: "Comments are limited to 200 characters" });
  const post = db.prepare("SELECT id FROM posts WHERE id = ?").get(req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });
  const info = db.prepare("INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)").run(post.id, req.user.id, content);
  const comment = db
    .prepare("SELECT c.id, c.content, c.created_at, u.username FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?")
    .get(info.lastInsertRowid);
  res.status(201).json(comment);
});

router.delete("/:postId/comments/:id", requireAuth, (req, res) => {
  const c = db.prepare("SELECT user_id FROM comments WHERE id = ? AND post_id = ?").get(req.params.id, req.params.postId);
  if (!c) return res.status(404).json({ error: "Comment not found" });
  if (c.user_id !== req.user.id) return res.status(403).json({ error: "You can only delete your own comments" });
  db.prepare("DELETE FROM comments WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

export default router;
