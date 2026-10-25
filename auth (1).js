import { Router } from "express";
import bcrypt from "bcryptjs";
import db from "../db.js";
import { signToken } from "../middleware/auth.js";

const router = Router();
const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/register", (req, res) => {
  const { username = "", email = "", password = "" } = req.body;
  if (!USERNAME_RE.test(username)) return res.status(400).json({ error: "Username must be 3-20 letters, numbers or underscores" });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Enter a valid email address" });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

  const taken = db.prepare("SELECT 1 FROM users WHERE username = ? OR email = ?").get(username, email);
  if (taken) return res.status(409).json({ error: "Username or email is already in use" });

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)").run(username, email, hash);
  const user = { id: info.lastInsertRowid, username };
  res.status(201).json({ token: signToken(user), user });
});

router.post("/login", (req, res) => {
  const { username = "", password = "" } = req.body;
  const row = db.prepare("SELECT id, username, password_hash FROM users WHERE username = ? OR email = ?").get(username, username);
  if (!row || !bcrypt.compareSync(password, row.password_hash))
    return res.status(401).json({ error: "Username or password is incorrect" });
  const user = { id: row.id, username: row.username };
  res.json({ token: signToken(user), user });
});

export default router;
