const express = require("express");
const http = require("http");
const path = require("path");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { MongoClient, ObjectId } = require("mongodb");
const { Server } = require("socket.io");

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// -----------------------------
// MongoDB
// -----------------------------

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
    console.error("ERROR: MONGODB_URI is missing in .env");
    process.exit(1);
}

const client = new MongoClient(mongoUri);

let users;
let tasks;


// -----------------------------
// Middleware
// -----------------------------

app.use(express.json());

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


// -----------------------------
// JWT
// -----------------------------

function tokenFor(id) {

    return jwt.sign(
        {
            userId: id.toString()
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "7d"
        }
    );

}


// -----------------------------
// Authentication Middleware
// -----------------------------

function auth(req, res, next) {

    const header =
        req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {

        return res.status(401).json({
            message: "Login required"
        });

    }


    try {

        const token =
            header.slice(7);

        const decoded =
            jwt.verify(
                token,
                process.env.JWT_SECRET
            );


        req.userId =
            new ObjectId(decoded.userId);

        next();


    } catch (error) {

        return res.status(401).json({
            message: "Invalid or expired login"
        });

    }

}


// -----------------------------
// REGISTER
// -----------------------------

app.post("/api/register", async (req, res) => {

    try {

        const name =
            String(req.body.name || "").trim();

        const email =
            String(req.body.email || "")
                .trim()
                .toLowerCase();

        const password =
            String(req.body.password || "");


        // Check fields

        if (!name || !email || !password) {

            return res.status(400).json({
                message: "All fields are required"
            });

        }


        // Check password

        if (password.length < 6) {

            return res.status(400).json({
                message:
                    "Password must be at least 6 characters"
            });

        }


        // Check existing user

        const existingUser =
            await users.findOne({
                email: email
            });


        if (existingUser) {

            return res.status(409).json({
                message:
                    "Email already registered"
            });

        }


        // Hash password

        const hashedPassword =
            await bcrypt.hash(
                password,
                10
            );


        // Create user

        const user = {

            name: name,

            email: email,

            password: hashedPassword,

            createdAt: new Date()

        };


        // Save user

        const result =
            await users.insertOne(user);


        // Create JWT

        const token =
            tokenFor(result.insertedId);


        // Send response

        res.status(201).json({

            token: token,

            user: {

                id: result.insertedId,

                name: user.name,

                email: user.email

            }

        });


    } catch (error) {

        console.error(
            "Registration error:",
            error
        );

        res.status(500).json({
            message: "Registration failed"
        });

    }

});


// -----------------------------
// LOGIN
// -----------------------------

app.post("/api/login", async (req, res) => {

    try {

        const email =
            String(req.body.email || "")
                .trim()
                .toLowerCase();

        const password =
            String(req.body.password || "");


        const user =
            await users.findOne({
                email: email
            });


        if (
            !user ||
            !(await bcrypt.compare(
                password,
                user.password
            ))
        ) {

            return res.status(401).json({
                message:
                    "Invalid email or password"
            });

        }


        const token =
            tokenFor(user._id);


        res.json({

            token: token,

            user: {

                id: user._id,

                name: user.name,

                email: user.email

            }

        });


    } catch (error) {

        console.error(
            "Login error:",
            error
        );

        res.status(500).json({
            message: "Login failed"
        });

    }

});


// -----------------------------
// GET TASKS
// -----------------------------

app.get(
    "/api/tasks",
    auth,
    async (req, res) => {

        try {

            const list =
                await tasks
                    .find({
                        owner: req.userId
                    })
                    .sort({
                        createdAt: -1
                    })
                    .toArray();


            res.json(list);


        } catch (error) {

            console.error(
                "Get tasks error:",
                error
            );

            res.status(500).json({
                message: "Could not load tasks"
            });

        }

    }
);


// -----------------------------
// CREATE TASK
// -----------------------------

app.post(
    "/api/tasks",
    auth,
    async (req, res) => {

        try {

            const title =
                String(req.body.title || "")
                    .trim();

            const description =
                String(
                    req.body.description || ""
                ).trim();

            const status =
                req.body.status || "todo";

            const priority =
                req.body.priority || "medium";

            const dueDate =
                req.body.dueDate || null;


            if (!title) {

                return res.status(400).json({
                    message:
                        "Task title is required"
                });

            }


            const task = {

                title: title,

                description: description,

                status: status,

                priority: priority,

                dueDate: dueDate,

                owner: req.userId,

                createdAt: new Date(),

                updatedAt: new Date()

            };


            const result =
                await tasks.insertOne(task);


            task._id =
                result.insertedId;


            io.emit("taskChanged");


            res.status(201).json(task);


        } catch (error) {

            console.error(
                "Create task error:",
                error
            );

            res.status(500).json({
                message:
                    "Could not create task"
            });

        }

    }
);


// -----------------------------
// UPDATE TASK
// -----------------------------

app.put(
    "/api/tasks/:id",
    auth,
    async (req, res) => {

        try {

            const id =
                new ObjectId(req.params.id);


            const allowedFields = [
                "title",
                "description",
                "status",
                "priority",
                "dueDate"
            ];


            const update = {};


            allowedFields.forEach(
                function (field) {

                    if (
                        req.body[field] !==
                        undefined
                    ) {

                        update[field] =
                            req.body[field];

                    }

                }
            );


            update.updatedAt =
                new Date();


            const result =
                await tasks.findOneAndUpdate(

                    {
                        _id: id,

                        owner: req.userId
                    },

                    {
                        $set: update
                    },

                    {
                        returnDocument: "after"
                    }

                );


            if (!result) {

                return res.status(404).json({
                    message:
                        "Task not found"
                });

            }


            io.emit("taskChanged");


            res.json(result);


        } catch (error) {

            console.error(
                "Update task error:",
                error
            );

            res.status(400).json({
                message:
                    "Invalid task id"
            });

        }

    }
);


// -----------------------------
// DELETE TASK
// -----------------------------

app.delete(
    "/api/tasks/:id",
    auth,
    async (req, res) => {

        try {

            const id =
                new ObjectId(req.params.id);


            const result =
                await tasks.deleteOne({

                    _id: id,

                    owner: req.userId

                });


            if (!result.deletedCount) {

                return res.status(404).json({
                    message:
                        "Task not found"
                });

            }


            io.emit("taskChanged");


            res.json({
                message:
                    "Task deleted"
            });


        } catch (error) {

            console.error(
                "Delete task error:",
                error
            );

            res.status(400).json({
                message:
                    "Invalid task id"
            });

        }

    }
);


// -----------------------------
// Socket.IO
// -----------------------------

io.on(
    "connection",
    function (socket) {

        console.log(
            "Realtime client connected:",
            socket.id
        );

    }
);


// -----------------------------
// Frontend
// -----------------------------

app.get(
    "*",
    function (req, res) {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );

    }
);


// -----------------------------
// Start Server
// -----------------------------

async function start() {

    try {

        await client.connect();


        const db =
            client.db("taskbuddy");


        users =
            db.collection("users");


        tasks =
            db.collection("tasks");


        // Unique email

        await users.createIndex(
            {
                email: 1
            },
            {
                unique: true
            }
        );


        console.log(
            "MongoDB connected"
        );


        const PORT =
            process.env.PORT || 5000;


        server.listen(
            PORT,
            function () {

                console.log(
                    `TaskBuddy running at http://localhost:${PORT}`
                );

            }
        );


    } catch (error) {

        console.error(
            "MongoDB connection failed:",
            error.message
        );

        process.exit(1);

    }

}


start();