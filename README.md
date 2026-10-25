# Chirp: Mini Social Media App

A small social media platform with user profiles, posts, comments, likes and a follow system.

- **Frontend:** HTML, CSS and vanilla JavaScript (single-page app, no framework)
- **Backend:** Node.js with Express.js
- **Database:** SQLite (tables for users, posts, comments, likes and followers)

## Features

- Sign up and log in with JWT authentication and bcrypt-hashed passwords
- **User profiles:** bio, post count, followers and following counts
- **Posts:** create (up to 280 characters), delete your own, paginated feed
- **Comments:** add and delete comments on any post
- **Likes:** like and unlike posts
- **Follow system:** follow and unfollow users; a "Following" feed shows posts from people you follow
- Search for users by username
- Posts and comments are rendered as text, so user content can't inject HTML

## Project structure

```
social-media-app/
├── server/
│   ├── server.js          Express app entry point
│   ├── db.js              SQLite connection and schema
│   ├── seed.js            Demo data
│   ├── middleware/auth.js JWT helpers
│   └── routes/            auth, users, posts
└── public/                Frontend served by Express
    ├── index.html
    ├── css/style.css
    └── js/                api.js (fetch wrapper), app.js (pages and router)
```

## Database schema

| Table | Columns |
| --- | --- |
| `users` | id, username, email, password_hash, bio, created_at |
| `posts` | id, user_id, content, created_at |
| `comments` | id, post_id, user_id, content, created_at |
| `likes` | user_id, post_id (composite key) |
| `follows` | follower_id, following_id (composite key) |

Deleting a user or post cascades to their related rows.

## Getting started

You need Node.js 18 or newer.

```bash
npm install
cp .env.example .env     # set JWT_SECRET to a long random string
npm run seed             # optional demo data
npm run dev              # or: npm start
```

Open http://localhost:3000.

Seeded accounts (password `password123`): `alice`, `bob`, `cara`.

## API

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | No | Create account |
| POST | `/api/auth/login` | No | Log in with username or email |
| GET | `/api/users/search?q=` | No | Find users |
| GET | `/api/users/:username` | Optional | Profile and counts |
| PUT | `/api/users/me/bio` | Yes | Update your bio |
| POST | `/api/users/:username/follow` | Yes | Follow or unfollow |
| GET | `/api/posts?feed=all\|following&user=&page=` | Optional | List posts |
| POST | `/api/posts` | Yes | Create post |
| DELETE | `/api/posts/:id` | Yes | Delete your post |
| POST | `/api/posts/:id/like` | Yes | Like or unlike |
| GET | `/api/posts/:id/comments` | No | List comments |
| POST | `/api/posts/:id/comments` | Yes | Add comment |
| DELETE | `/api/posts/:postId/comments/:id` | Yes | Delete your comment |

## Ideas for next steps

- Profile pictures and image posts
- Notifications for likes, comments and new followers
- Rate limiting and input sanitization middleware
- Tests with Jest and Supertest
- Deploy to Render or Railway

## License

MIT
