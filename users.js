import { Router } from "express";
import db from "../db.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";

const router = Router();

// Search users by username: GET /api/users/search?q=ad
router.get("/search", (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json([]);
  const rows = db
    .prepare("SELECT id, username, bio FROM users WHERE username LIKE ? ESCAPE '\\' ORDER BY username LIMIT 10")
    .all(`%${q.replace(/[\\%_]/g, "\\$&")}%`);
  res.json(rows);
});

// Public profile with counts and whether the viewer follows them.
router.get("/:username", optionalAuth, (req, res) => {
  const me = req.user?.id ?? 0;
  const user = db
    .prepare(
      `SELECT u.id, u.username, u.bio, u.created_at,
        (SELECT COUNT(*) FROM follows WHERE following_id = u.id) AS followers,
        (SELECT COUNT(*) FROM follows WHERE follower_id = u.id)  AS following,
        (SELECT COUNT(*) FROM posts   WHERE user_id = u.id)      AS posts,
        EXISTS(SELECT 1 FROM follows WHERE follower_id = ? AND following_id = u.id) AS is_following
       FROM users u WHERE u.username = ?`
    )
    .get(me, req.params.username);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ ...user, is_following: !!user.is_following, is_me: user.id === me });
});

// Update own bio.
router.put("/me/bio", requireAuth, (req, res) => {
  const bio = String(req.body.bio ?? "").slice(0, 160);
  db.prepare("UPDATE users SET bio = ? WHERE id = ?").run(bio, req.user.id);
  res.json({ bio });
});

// Follow / unfollow toggle.
router.post("/:username/follow", requireAuth, (req, res) => {
  const target = db.prepare("SELECT id FROM users WHERE username = ?").get(req.params.username);
  if (!target) return res.status(404).json({ error: "User not found" });
  if (target.id === req.user.id) return res.status(400).json({ error: "You can't follow yourself" });

  const existing = db.prepare("SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?").get(req.user.id, target.id);
  if (existing) db.prepare("DELETE FROM follows WHERE follower_id = ? AND following_id = ?").run(req.user.id, target.id);
  else db.prepare("INSERT INTO follows (follower_id, following_id) VALUES (?, ?)").run(req.user.id, target.id);

  const followers = db.prepare("SELECT COUNT(*) AS n FROM follows WHERE following_id = ?").get(target.id).n;
  res.json({ is_following: !existing, followers });
});

export default router;
