const express = require('express');
const mysql = require('mysql2');
const dbinfo = require('./secret').dbinfo;

const app = express()
const port = 3000
app.set('view engine', 'pug');
app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));


const pool = mysql.createPool(dbinfo);

app.get('/', function (req, res) {
    res.render('index', { title: 'Hey', message: 'Hello there!' })
});


app.get('/users/:id', (req, res) => {
    const id = req.params.id
    const query = `SELECT * FROM Users WHERE id = ?;`;

    pool.query(query, [id], (error, results, fields) => {
        if (error) console.error(error);
        console.log(results[0])
        res.render('user', { userdata: results[0] });
    });
});

app.get('/long-ban-appeals', (req, res) => {
    const query = `SELECT id AS appeal_id, sub.ban_id, sub.user_id, sub.mc_username, content
    FROM Appeals JOIN ( 
        SELECT Bans.id AS ban_id, MinecraftAccounts.user_id AS user_id, MinecraftAccounts.minecraft_username AS mc_username 
        FROM Bans JOIN MinecraftAccounts ON (Bans.banned_minecraft_uuid = MinecraftAccounts.minecraft_uuid) 
        WHERE Bans.start < FROM_UNIXTIME(UNIX_TIMESTAMP(CURRENT_TIMESTAMP) - 15780000) 
            AND Bans.end > FROM_UNIXTIME(UNIX_TIMESTAMP(CURRENT_TIMESTAMP) - 7890000) 
    ) AS sub ON (Appeals.ban_id = sub.ban_id) WHERE accepted = 1;`
    pool.query(query, (error, results, fields) => {
        if (error) console.error(error);
        console.log(results[0])
        res.render('longterm', { results: results })
    });
});

app.get('/reports/less-credible', (req, res) => {
    const query = `SELECT sub.user_id, sub.mc_username, id AS report_id
             FROM Reports 
             JOIN (SELECT Bans.id AS ban_id, 
                          MinecraftAccounts.user_id AS user_id, 
                          MinecraftAccounts.minecraft_username AS mc_username
                   FROM Bans 
                   JOIN MinecraftAccounts 
                   ON (Bans.banned_minecraft_uuid = MinecraftAccounts.minecraft_uuid)) AS sub
              ON (Reports.submitted_by = sub.user_id);`
    pool.query(query, (error, results, fields) => {
        if (error) console.error(error);
        res.render('lesscredible_reports', { results: results })
    });
});

app.get('/reports', (req, res) => {
    const query = `SELECT * FROM Reports
                   ORDER BY id DESC;`;

    pool.query(query, (error, results, fields) => {
        if (error) console.error(error);
        res.render('reports', { reports: results });
    });
})

app.get('/report', function (req, res) {
    res.render('report')
});

app.post('/report_submit', (req, res) => {
    const query = `INSERT INTO Reports
        (submitted_by, minecraft_uuid, urgency_level, content, submitted_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP());`;
    submission = req.body
    console.log(submission)
    pool.query(query, [parseInt(submission.submitted_by), submission.minecraft_uuid, parseInt(submission.urgency_level),
    submission.content], (error, results, fields) => {
        if (error) console.error(error);
        res.send('Your report of player ' + submission.minecraft_uuid + ' was successfully submitted.');
    });
});

app.get('/processreport/:id', (req, res) => {
    const id = req.params.id
    const query = `SELECT * FROM Reports WHERE id = ?;`;

    pool.query(query, [id], (error, results, fields) => {
        if (error) console.error(error);
        console.log(results[0])
        res.render('processreport', { report: results[0] });
    });
});

app.post('/process_submit', (req, res) => {
    const query = `UPDATE Reports SET
        processed_at = CURRENT_TIMESTAMP(),
        accepted_by = ?,
        accepted = ?
        WHERE id = ?;`;
    const submission = req.body
    const report = JSON.parse(submission.report)
    pool.query(query, [parseInt(submission.submitted_by), parseInt(submission.accepted), parseInt(report.id)], (error, results, fields) => {
        if (error) console.error(error);
        res.redirect('/processreport/' + report.id);
    });
});

app.get('/delete_report/:id', (req, res) => {
    const query = `DELETE FROM Reports
        WHERE id = ?;`;
    const id = req.params.id
    pool.query(query, [id], (error, results, fields) => {
        if (error) console.error(error);
        res.redirect('/reports');
    });
});

app.get('/bans/find', (req, res) => {
    res.render('ban-find', { player: null, bans: null });
});

app.post('/bans/find', (req, res) => {
    const username = req.body.minecraft_username;
    const query = `SELECT * FROM Bans b
                   JOIN MinecraftAccounts m 
                     ON b.banned_minecraft_uuid = m.minecraft_uuid
                   WHERE m.minecraft_username = ?
                   ORDER BY b.id DESC;`;

    pool.query(query, [username], (error, results, fields) => {
        if (error) console.error(error);
        res.render('ban-find', { player: username, bans: results });
    });
});

app.get('/bans', (req, res) => {
    const query = `SELECT * FROM Bans
                   JOIN Users ON Bans.banned_by = Users.id
                   ORDER BY Bans.id DESC;`;

    pool.query(query, (error, results, fields) => {
        if (error) console.error(error);
        res.render('bans', { bans: results });
    });
});

app.get('/minecraft_accounts', (req, res) => {
    pool.query('SELECT * FROM MinecraftAccounts', function (error, results, fields) {
        if (error) console.error(error);
        res.render('minecraftaccounts', { users: results });
    });
});


app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
});
