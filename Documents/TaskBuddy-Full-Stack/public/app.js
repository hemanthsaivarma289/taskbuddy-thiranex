const app = document.getElementById("app");

const socket = io();

let token = localStorage.getItem("task_token");
let user = JSON.parse(localStorage.getItem("task_user") || "null");

let tasks = [];
let editing = null;


// -----------------------------
// Utility
// -----------------------------

function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (match) {
        return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        }[match];
    });
}


// -----------------------------
// API
// -----------------------------

async function api(url, options = {}) {

    options.headers = {
        ...(options.headers || {})
    };

    if (token) {
        options.headers.Authorization = "Bearer " + token;
    }

    if (options.body) {
        options.headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, options);

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Request failed");
    }

    return data;
}


// -----------------------------
// Login
// -----------------------------

function saveLogin(data) {

    token = data.token;
    user = data.user;

    localStorage.setItem("task_token", token);
    localStorage.setItem("task_user", JSON.stringify(user));

    render();
}


// -----------------------------
// Logout
// -----------------------------

function logout() {

    localStorage.removeItem("task_token");
    localStorage.removeItem("task_user");

    token = null;
    user = null;
    tasks = [];

    render();
}


// -----------------------------
// Load Tasks
// -----------------------------

async function load() {

    try {

        tasks = await api("/api/tasks");

        draw();

    } catch (error) {

        console.error(error);

        if (
            error.message.includes("Login") ||
            error.message.includes("Invalid") ||
            error.message.includes("expired")
        ) {
            logout();
        }
    }
}


// -----------------------------
// Real-time updates
// -----------------------------

socket.on("taskChanged", function () {

    if (user) {
        load();
    }

});


// -----------------------------
// Render
// -----------------------------

function render() {

    if (user) {

        dashboard();

    } else {

        auth();

    }

}


// -----------------------------
// Authentication Page
// -----------------------------

function auth() {

    app.innerHTML = `
        <main class="auth">

            <section class="authbox">

                <div class="logo">
                    Task<span>Buddy</span>
                </div>

                <p class="eyebrow">
                    TASK MANAGEMENT APPLICATION
                </p>

                <h1>
                    ${window.register ? "Create account" : "Welcome back"}
                </h1>

                <p class="muted">
                    ${
                        window.register
                            ? "Register to start managing your tasks."
                            : "Login to manage your tasks."
                    }
                </p>

                <form id="authForm">

                    ${
                        window.register
                            ? `
                                <label>Name</label>

                                <input
                                    id="name"
                                    type="text"
                                    placeholder="Enter your name"
                                    required
                                >
                            `
                            : ""
                    }

                    <label>Email</label>

                    <input
                        id="email"
                        type="email"
                        placeholder="Enter your email"
                        required
                    >

                    <label>Password</label>

                    <input
                        id="password"
                        type="password"
                        minlength="6"
                        placeholder="Minimum 6 characters"
                        required
                    >

                    <button
                        type="submit"
                        class="btn"
                    >
                        ${window.register ? "Register" : "Login"}
                    </button>

                </form>

                <p id="err"></p>

                <button
                    class="link switch"
                    id="switch"
                >
                    ${
                        window.register
                            ? "Already have an account? Login"
                            : "Don't have an account? Register"
                    }
                </button>

            </section>

        </main>
    `;


    // Switch Login/Register

    document.getElementById("switch").onclick = function () {

        window.register = !window.register;

        render();

    };


    // Form Submit

    document.getElementById("authForm").onsubmit = async function (event) {

        event.preventDefault();

        try {

            // Get input elements correctly

            const emailInput =
                document.getElementById("email");

            const passwordInput =
                document.getElementById("password");


            // Create request body

            const body = {

                email: emailInput.value.trim(),

                password: passwordInput.value

            };


            // Add name only during registration

            if (window.register) {

                const nameInput =
                    document.getElementById("name");

                body.name = nameInput.value.trim();

            }


            console.log("Sending:", body);


            // Send request

            const data = await api(

                window.register
                    ? "/api/register"
                    : "/api/login",

                {
                    method: "POST",

                    body: JSON.stringify(body)

                }

            );


            // Login successful

            saveLogin(data);


        } catch (error) {

            console.error(error);

            const errorBox =
                document.getElementById("err");

            errorBox.textContent = error.message;

            errorBox.style.color = "#c33434";

        }

    };

}


// -----------------------------
// Dashboard
// -----------------------------

function dashboard() {

    app.innerHTML = `

        <header class="top">

            <div class="logo">
                Task<span>Buddy</span>
            </div>

            <div class="user">

                <span>
                    Hi, ${esc(user.name)}
                </span>

                <button
                    class="outline"
                    id="logout"
                >
                    Logout
                </button>

            </div>

        </header>


        <main class="wrap">


            <section class="hero">

                <div>

                    <p class="eyebrow">
                        MY WORKSPACE
                    </p>

                    <h1>
                        Manage your tasks.
                    </h1>

                    <p class="muted">
                        Create, update, track and complete
                        your work in one place.
                    </p>

                </div>


                <div class="live">
                    ● Live updates
                </div>

            </section>


            <section class="stats">

                <div class="stat">
                    <small>Total</small>
                    <b id="total">0</b>
                </div>

                <div class="stat">
                    <small>To Do</small>
                    <b id="todo">0</b>
                </div>

                <div class="stat">
                    <small>In Progress</small>
                    <b id="progress">0</b>
                </div>

                <div class="stat">
                    <small>Completed</small>
                    <b id="done">0</b>
                </div>

            </section>


            <section class="grid">


                <!-- CREATE TASK -->

                <div class="card sticky">

                    <p class="eyebrow">
                        ${editing ? "EDIT TASK" : "NEW TASK"}
                    </p>

                    <h2>
                        ${editing ? "Update task" : "Create a task"}
                    </h2>


                    <form id="taskForm">


                        <label>
                            Task title
                        </label>

                        <input
                            id="title"
                            required
                            placeholder="e.g. Complete assignment"
                        >


                        <label>
                            Description
                        </label>

                        <textarea
                            id="description"
                            rows="4"
                            placeholder="Task details"
                        ></textarea>


                        <div class="row">

                            <div>

                                <label>
                                    Status
                                </label>

                                <select id="status">

                                    <option value="todo">
                                        To Do
                                    </option>

                                    <option value="in-progress">
                                        In Progress
                                    </option>

                                    <option value="completed">
                                        Completed
                                    </option>

                                </select>

                            </div>


                            <div>

                                <label>
                                    Priority
                                </label>

                                <select id="priority">

                                    <option value="low">
                                        Low
                                    </option>

                                    <option value="medium" selected>
                                        Medium
                                    </option>

                                    <option value="high">
                                        High
                                    </option>

                                </select>

                            </div>

                        </div>


                        <label>
                            Due date
                        </label>

                        <input
                            id="dueDate"
                            type="date"
                        >


                        <button
                            type="submit"
                            class="btn"
                        >
                            ${editing ? "Save Changes" : "Add Task"}
                        </button>

                    </form>


                    <p id="msg"></p>

                </div>


                <!-- TASK LIST -->

                <div class="card">

                    <div
                        style="
                            display:flex;
                            justify-content:space-between
                        "
                    >

                        <div>

                            <p class="eyebrow">
                                TASK LIST
                            </p>

                            <h2>
                                Your tasks
                            </h2>

                        </div>

                        <b id="count"></b>

                    </div>


                    <div class="toolbar">

                        <input
                            id="search"
                            placeholder="Search tasks..."
                        >


                        <select id="filter">

                            <option value="all">
                                All
                            </option>

                            <option value="todo">
                                To Do
                            </option>

                            <option value="in-progress">
                                In Progress
                            </option>

                            <option value="completed">
                                Completed
                            </option>

                        </select>

                    </div>


                    <div id="list"></div>

                </div>

            </section>

        </main>

    `;


    document.getElementById("logout").onclick = logout;

    document.getElementById("taskForm").onsubmit = saveTask;

    loadForm();

    draw();

}


// -----------------------------
// Load Edit Form
// -----------------------------

function loadForm() {

    if (!editing) {
        return;
    }

    const task =
        tasks.find(function (item) {
            return item._id === editing;
        });


    if (!task) {
        return;
    }


    document.getElementById("title").value =
        task.title;

    document.getElementById("description").value =
        task.description || "";

    document.getElementById("status").value =
        task.status;

    document.getElementById("priority").value =
        task.priority;

    document.getElementById("dueDate").value =
        task.dueDate || "";

}


// -----------------------------
// Save Task
// -----------------------------

async function saveTask(event) {

    event.preventDefault();


    const body = {

        title:
            document.getElementById("title").value.trim(),

        description:
            document.getElementById("description").value.trim(),

        status:
            document.getElementById("status").value,

        priority:
            document.getElementById("priority").value,

        dueDate:
            document.getElementById("dueDate").value

    };


    try {

        if (editing) {

            await api(

                "/api/tasks/" + editing,

                {
                    method: "PUT",
                    body: JSON.stringify(body)
                }

            );

        } else {

            await api(

                "/api/tasks",

                {
                    method: "POST",
                    body: JSON.stringify(body)
                }

            );

        }


        editing = null;

        await load();


    } catch (error) {

        const message =
            document.getElementById("msg");

        message.textContent =
            error.message;

        message.className =
            "message";

    }

}


// -----------------------------
// Draw Tasks
// -----------------------------

function draw() {

    if (!user) {
        return;
    }


    const searchElement =
        document.getElementById("search");

    const filterElement =
        document.getElementById("filter");


    const query =
        searchElement
            ? searchElement.value.toLowerCase()
            : "";


    const filter =
        filterElement
            ? filterElement.value
            : "all";


    const filteredTasks =
        tasks.filter(function (task) {

            const matchesFilter =
                filter === "all" ||
                task.status === filter;


            const matchesSearch =
                !query ||
                task.title
                    .toLowerCase()
                    .includes(query) ||

                (task.description || "")
                    .toLowerCase()
                    .includes(query);


            return matchesFilter && matchesSearch;

        });


    // Statistics

    const total =
        document.getElementById("total");

    const todo =
        document.getElementById("todo");

    const progress =
        document.getElementById("progress");

    const done =
        document.getElementById("done");


    if (total) {
        total.textContent = tasks.length;
    }

    if (todo) {
        todo.textContent =
            tasks.filter(t => t.status === "todo").length;
    }

    if (progress) {
        progress.textContent =
            tasks.filter(t => t.status === "in-progress").length;
    }

    if (done) {
        done.textContent =
            tasks.filter(t => t.status === "completed").length;
    }


    // Count

    const count =
        document.getElementById("count");

    if (count) {

        count.textContent =
            filteredTasks.length + " tasks";

    }


    // Task list

    const list =
        document.getElementById("list");

    if (!list) {
        return;
    }


    if (filteredTasks.length === 0) {

        list.innerHTML = `
            <div class="empty">
                No tasks found.
                <br>
                Create a task or change the filter.
            </div>
        `;

        return;
    }


    list.innerHTML =
        filteredTasks.map(function (task) {

            const statusText =
                task.status === "todo"
                    ? "To Do"
                    : task.status === "in-progress"
                        ? "In Progress"
                        : "Completed";


            const dueDate =
                task.dueDate
                    ? `
                        <span>
                            Due:
                            ${new Date(
                                task.dueDate + "T00:00:00"
                            ).toLocaleDateString()}
                        </span>
                    `
                    : "";


            return `

                <article class="task">

                    <div class="taskhead">

                        <div>

                            <h3>
                                ${esc(task.title)}
                            </h3>

                            <p>
                                ${esc(
                                    task.description ||
                                    "No description"
                                )}
                            </p>

                        </div>


                        <span
                            class="pill ${task.priority}"
                        >
                            ${task.priority}
                        </span>

                    </div>


                    <div class="meta">

                        <span>
                            ${statusText}
                        </span>

                        ${dueDate}

                    </div>


                    <div class="actions">


                        <select
                            onchange="
                                changeStatus(
                                    '${task._id}',
                                    this.value
                                )
                            "
                        >

                            <option
                                value="todo"
                                ${
                                    task.status === "todo"
                                        ? "selected"
                                        : ""
                                }
                            >
                                To Do
                            </option>


                            <option
                                value="in-progress"
                                ${
                                    task.status === "in-progress"
                                        ? "selected"
                                        : ""
                                }
                            >
                                In Progress
                            </option>


                            <option
                                value="completed"
                                ${
                                    task.status === "completed"
                                        ? "selected"
                                        : ""
                                }
                            >
                                Completed
                            </option>

                        </select>


                        <button
                            class="outline"
                            onclick="
                                editTask('${task._id}')
                            "
                        >
                            Edit
                        </button>


                        <button
                            class="danger"
                            onclick="
                                deleteTask('${task._id}')
                            "
                        >
                            Delete
                        </button>

                    </div>

                </article>

            `;

        }).join("");

}


// -----------------------------
// Change Status
// -----------------------------

async function changeStatus(id, status) {

    try {

        await api(

            "/api/tasks/" + id,

            {
                method: "PUT",

                body: JSON.stringify({
                    status: status
                })
            }

        );

        await load();

    } catch (error) {

        alert(error.message);

    }

}


// -----------------------------
// Delete Task
// -----------------------------

async function deleteTask(id) {

    if (!confirm("Delete this task?")) {
        return;
    }


    try {

        await api(

            "/api/tasks/" + id,

            {
                method: "DELETE"
            }

        );

        await load();

    } catch (error) {

        alert(error.message);

    }

}


// -----------------------------
// Edit Task
// -----------------------------

function editTask(id) {

    editing = id;

    dashboard();

}


// -----------------------------
// Search
// -----------------------------

document.addEventListener("input", function (event) {

    if (event.target.id === "search") {

        draw();

    }

});


// -----------------------------
// Filter
// -----------------------------

document.addEventListener("change", function (event) {

    if (event.target.id === "filter") {

        draw();

    }

});


// -----------------------------
// Start Application
// -----------------------------

render();