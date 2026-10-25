import "dotenv/config";
import bcrypt from "bcryptjs";
import db from "./db.js";

db.exec("DELETE FROM follows; DELETE FROM likes; DELETE FROM comments; DELETE FROM posts; DELETE FROM users;");

const hash = bcrypt.hashSync("password123", 10);
const add = db.prepare("INSERT INTO users (username, email, password_hash, bio) VALUES (?, ?, ?, ?)");
const alice = add.run("alice", "alice@example.com", hash, "Coffee, code and curiosity.").lastInsertRowid;
const bob = add.run("bob", "bob@example.com", hash, "Building things on the web.").lastInsertRowid;
const cara = add.run("cara", "cara@example.com", hash, "Photographer and hiker.").lastInsertRowid;

const post = db.prepare("INSERT INTO posts (user_id, content) VALUES (?, ?)");
const p1 = post.run(alice, "Just shipped my first full-stack project. Feels great!").lastInsertRowid;
const p2 = post.run(bob, "Hot take: SQLite is underrated for small apps.").lastInsertRowid;
post.run(cara, "Sunrise from the ridge this morning was unreal.");

db.prepare("INSERT INTO follows VALUES (?, ?)").run(bob, alice);
db.prepare("INSERT INTO follows VALUES (?, ?)").run(cara, alice);
db.prepare("INSERT INTO likes VALUES (?, ?)").run(bob, p1);
db.prepare("INSERT INTO likes VALUES (?, ?)").run(alice, p2);
db.prepare("INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)").run(p1, bob, "Congrats, well deserved!");

console.log("Seeded users alice, bob, cara (password: password123)");
