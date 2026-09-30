# TaskBuddy Full-Stack Thiranex Project

A complete task-management website with frontend, backend, MongoDB database, authentication, CRUD operations, task status tracking and optional real-time updates.

## Run

1. Install Node.js.
2. Create MongoDB Atlas database OR run local MongoDB.
3. Open terminal in this folder:
   npm install
4. Copy `.env.example` to `.env`.
5. Put your MongoDB connection string in `MONGODB_URI`.
6. Set a private `JWT_SECRET`.
7. Run:
   npm run dev
8. Open:
   http://localhost:5000

## Features

- Register/login
- JWT authentication
- Password hashing
- Create task
- Read/list tasks
- Update task
- Delete task
- Status tracking
- Priority
- Due date
- Search/filter
- Responsive mobile design
- MongoDB
- Socket.IO real-time refresh

Never upload `.env` to GitHub.
