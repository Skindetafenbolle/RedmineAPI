const express = require('express');
const axios = require('axios');
const session = require('express-session');
const bcrypt = require('bcrypt');
const app = express();
const dotenv = require('dotenv').config();
const PORT = 3000;

const API_KEY = process.env.API_KEY;

app.set('view engine', 'ejs');
app.use(express.urlencoded({extended: true}));

app.use(session({
    secret: process.env.API_SECRET_KEY,
    resave: false,
    saveUninitialized: true,
}));

const users = {
    admin: {
        password: process.env.HASH_PASS
    }
};

app.get('/login', (req, res) => {
    res.send(`
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f0f0f0;
        }
        form {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        }
        input, button {
            display: block;
            width: 100%;
            padding: 10px;
            margin: 10px 0;
            border-radius: 5px;
            border: 1px solid #ddd;
        }
        button {
            background-color: #4CAF50;
            color: white;
            cursor: pointer;
        }
        button:hover {
            background-color: #45a049;
        }
    </style>
    <form method="post" action="/login">
      <input type="text" name="username" placeholder="Username" required>
      <input type="password" name="password" placeholder="Password" required>
      <button type="submit">Login</button>
    </form>
  `);
});
app.post('/login', async (req, res) => {
    const {username, password} = req.body;
    const user = users[username];

    if (user && await bcrypt.compare(password, user.password)) {
        req.session.userId = username;
        res.redirect('/external_time_entries');
    } else {
        res.send('Login failed');
    }
});


function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
}

app.get('/external_time_entries', isAuthenticated, async (req, res) => {
    const {from, to} = req.query;

    let apiUrl = process.env.API_URL;
    const params = [];
    if (from) params.push(`from=${from}`);
    if (to) params.push(`to=${to}`);
    if (params.length) apiUrl += '?' + params.join('&');

    try {
        const response = await axios.get(apiUrl, {
            headers: {
                'X-Redmine-API-Key': API_KEY
            }
        });
        const data = response.data;

        let userProjects = {};

        data.time_entries.forEach(entry => {
            const userId = entry.user.id;
            const userName = entry.user.name;
            const projectId = entry.project.id;
            const projectName = entry.project.name;
            const isPayable = entry.custom_fields.find(field => field.name === "Billable").value === "1";
            const hours = entry.hours;

            if (!userProjects[userId]) {
                userProjects[userId] = {
                    name: userName,
                    projects: {}
                };
            }

            if (!userProjects[userId].projects[projectId]) {
                userProjects[userId].projects[projectId] = {
                    name: projectName,
                    payable: 0,
                    nonPayable: 0
                };
            }

            if (isPayable) {
                userProjects[userId].projects[projectId].payable += hours;
            } else {
                userProjects[userId].projects[projectId].nonPayable += hours;
            }
        });

        const users = Object.values(userProjects);

        res.render('time_entries', {users, from, to});
    } catch (error) {
        console.error(error);
        res.status(500).send('Ошибка при получении данных');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
