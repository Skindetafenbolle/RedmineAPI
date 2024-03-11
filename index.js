const express = require('express');
const axios = require('axios');
const app = express();
const dotenv = require('dotenv').config();
const PORT = 3000;

const API_KEY = process.env.API_KEY;

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

app.get('/external_time_entries', async (req, res) => {
    const { from, to } = req.query;

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

        res.render('time_entries', { users, from, to });
    } catch (error) {
        console.error(error);
        res.status(500).send('Ошибка при получении данных');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
