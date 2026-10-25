import jwt from "jsonwebtoken";

const secret = () => process.env.JWT_SECRET || "dev-secret-change-me";

export const signToken = (user) => jwt.sign({ id: user.id, username: user.username }, secret(), { expiresIn: "7d" });

function read(req) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(h.slice(7), secret());
  } catch {
    return null;
  }
}

// Requires a valid token.
export function requireAuth(req, res, next) {
  const user = read(req);
  if (!user) return res.status(401).json({ error: "Please log in to continue" });
  req.user = user;
  next();
}

// Attaches req.user when a token is present, but never blocks.
export function optionalAuth(req, _res, next) {
  req.user = read(req);
  next();
}
