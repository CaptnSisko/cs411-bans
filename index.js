const express = require('express');
const session = require('express-session')
const mysql = require('mysql2');
const dbinfo = require('./secret').dbinfo;
const cookieSecret = require('./secret').cookie;
const bcrypt = require('bcrypt');
const fetch = require('node-fetch');

const app = express();
const port = 3000;
app.set('view engine', 'pug');
app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));
app.use(express.static('public'));

// use secure cookie since website served w/ SSL
app.use(session({
    secret: cookieSecret.key,
    cookie: { secure: cookieSecret.secure }
}));


const pool = mysql.createPool(dbinfo);

// https://mc-oauth.net/
function oAuthToUUID(token) {
    return fetch('https://mc-oauth.net/api/api?token', {
       method: "GET",
       headers: {
          "token": token
       }
    }).then(response => {
       return response.json();
    });
}

app.get('/', function (req, res) {
    res.render('index', { logged_in: req.session.user_id !== undefined, email:req.session.email })
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
    if(!req.session.user_id) {
        res.send('You must be <a href=/login>logged in</a> to do that!');
        return;
    }
    res.render('report');
});

app.post('/report_submit', (req, res) => {
    const query = `INSERT INTO Reports
        (submitted_by, minecraft_uuid, urgency_level, content, submitted_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP());`;

    if(!req.session.user_id) {
        res.send('You must be <a href=/login>logged in</a> to do that!');
        return;
    }
    
    submission = req.body
    pool.query(query, [parseInt(req.session.user_id), submission.minecraft_uuid, parseInt(submission.urgency_level),
    submission.content], (error, results, fields) => {
        if (error) console.error(error);
        res.send('Your report of player ' + submission.minecraft_uuid + ' was successfully submitted. <a href="/">Go home</a>');
    });
});

app.get('/processreport/:id', (req, res) => {
    const id = req.params.id
    const query = `SELECT * FROM Reports WHERE id = ?;`;

    pool.query(query, [id], (error, results, fields) => {
        if (error) console.error(error);
        console.log(results[0])
        res.render('processreport', { report: results[0], is_admin: req.session.is_admin });
    });
});

app.post('/process_submit', (req, res) => {
    const query = `UPDATE Reports SET
        processed_at = CURRENT_TIMESTAMP(),
        accepted_by = ?,
        accepted = ?
        WHERE id = ?;`;

    if(!req.session.is_admin) {
        res.send('You must be an admin to do that! <a href="/">Go home</a>');
        return;
    }

    const submission = req.body
    const report = JSON.parse(submission.report)
    pool.query(query, [parseInt(req.session.user_id), parseInt(submission.accepted), parseInt(report.id)], (error, results, fields) => {
        if (error) console.error(error);
        res.redirect('/processreport/' + report.id);
    });
});

app.get('/delete_report/:id', (req, res) => {
    const query = `DELETE FROM Reports
        WHERE id = ?;`;
    const id = req.params.id

    if(!req.session.is_admin) {
        res.send('You must be an admin to do that! <a href="/">Go home</a>');
        return;
    }

    pool.query(query, [id], (error, results, fields) => {
        if (error) console.error(error);
        res.redirect('/reports');
    });
});

app.get('/delete_minecraft_account/:uuid', (req, res) => {
    const queryUser = `SELECT * FROM MinecraftAccounts
        WHERE minecraft_uuid = ?;`;
    const queryDelete = `DELETE FROM MinecraftAccounts
        WHERE minecraft_uuid = ?;`;
    const uuid = req.params.uuid

    if(!req.session.user_id) {
        res.send('You must be <a href=/login>logged in</a> to do that!');
    }

    pool.query(queryUser, [uuid], (error, results, fields) => {
        if (error) console.error(error);
        if(results !== undefined && results[0] !== undefined && results[0].user_id === req.session.user_id) {
            pool.query(queryDelete, [uuid], (error, results, fields) => {
                if (error) console.error(error);
                res.redirect('/profile');
            });
        } else {
            res.send('You can only delete your own Minecraft account! <a href="/">Go home</a>')
        }
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

app.get('/login', (req, res) => {
    console.log(req.session)
    if(req.session.user_id !== undefined) {
        res.send(`You are already logged in as ${req.session.email}! Click <a href="/logout">here</a> to log out.`);
    } else {
        res.render('login');
    }
});

app.post('/login_submit', (req, res) => {
    const email = req.body.email;
    const password = req.body.password;
    const query = `SELECT id, email, hash, is_admin FROM Users
                    WHERE email = ?`;

    if(req.session.user_id !== undefined) {
        res.send(`You are already logged in as ${req.session.email}! Click <a href="/logout">here</a> to log out.`);
    } else if (email === undefined || password === undefined) {
        res.json({
            success: false,
            error: 'Request did not include email and password'
        });
    } else {
        pool.query(query, [email], function (error, results, fields) {
            if (error) console.error(error);
            if(results[0] === undefined) {
                res.send(`Error: invalid email! <a href="/login">Try again</a>.`);
                return;
            }
            const userData = results[0];
            const valid = bcrypt.compareSync(password, userData.hash);
            if (valid) {
                req.session.user_id = userData.id;
                req.session.email = userData.email;
                req.session.is_admin = userData.is_admin === 1 ? true : false;
                console.log(req.session);
                res.redirect('/profile')
            } else {
                res.send(`Wrong password! <a href="/login">Try again</a>.`);
            }
        });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(function(err) {
        if(err) {
            console.error(err);
            res.send(`Error logging out`);
        } else {
            res.send(`Successfully logged out! <a href="/">Go home</a>`);
        }
    });
});

app.get('/change_password', (req, res) => {
    res.render('changepassword', { admin: req.session.is_admin });
});

app.post('/change_password_submit', (req, res) => {
    const email = req.body.email;
    const old_password = req.body.old_password;
    const new_password = req.body.new_password;
    const queryUser = `SELECT id, email, hash, is_admin FROM Users
                    WHERE email = ?`;

    const queryUpdate = `UPDATE Users
                    SET hash = ?
                    WHERE email = ?`;
    if (email === undefined || new_password === undefined) {
        res.json({
            success: false,
            error: 'Request did not include email and password'
        });
    } else if(req.session.is_admin === true) {
        bcrypt.hash(new_password, 10).then(hash => {
            pool.query(queryUpdate, [hash, email], function (error, results, fields) {
                if (error) {
                    console.error(error);
                    res.send('Error updating password. <a href="/change_password">Try again</a>.');
                    return;
                }
                res.send('Password has been updated. <a href="/login">Log in</a>');
            });
        });
    }  else {
        pool.query(queryUser, [email], function (error, results, fields) {
            if (error) console.error(error);
            if(results[0] === undefined) {
                res.send(`Error: invalid email! <a href="/change_password">Try again</a>.`);
                return;
            }
            const userData = results[0];
            const valid = bcrypt.compareSync(old_password, userData.hash);
            if (valid) {
                bcrypt.hash(new_password, 10).then(hash => {
                    pool.query(queryUpdate, [hash, email], function (error, results, fields) {
                        if (error) {
                            console.error(error);
                            res.send('Error updating password. <a href="/change_password">Try again</a>.');
                            return;
                        }
                        res.send('Password has been updated. <a href="/">Go home</a>');
                    });
                });
            } else {
                res.send(`Wrong old password! <a href="/change_password">Try again</a>.`);
            }
        });
    }
});

app.get('/verifymc', (req, res) => {
    if(req.session.user_id === undefined) {
        res.send(`You must be <a href=/login>logged in</a> to do that!`);
    } else {
        res.render('verifymc');
    }
});

app.post('/verifymc_submit', (req, res) => {
    const token = req.body.code;
    const query = `INSERT INTO MinecraftAccounts VALUES (?, ?, ?)`;

    if(req.session.user_id === undefined) {
        res.send(`You must be <a href=/login>logged in</a> to do that!`);
    } else if (token === undefined) {
        res.send(`You must submit a token. <a href="/verifymc">Try again</a>`);
    } else {
        oAuthToUUID(token).then(mcData => {
            if(mcData.status !== 'success' ) {
                res.send(`Invalid token! <a href="/verifymc">Try again</a>`);
            } else {
                pool.query(query, [mcData.uuid, req.session.user_id, mcData.username], (err) => {
                    if(err) {
                        res.send(`${mcData.username} has already been verified. <a href="/verifymc">Try again</a>`)
                    } else {
                        res.send(`Successfully added ${mcData.username} to your Minecraft accounts! <a href="/">Go home</a>`)
                    }
                });
            }
        });
    }
});

app.get('/profile', (req, res) => {
    const queryReports = `SELECT * FROM Reports
                WHERE submitted_by = ?
                ORDER BY id DESC;`;

    const queryAccounts = `SELECT * FROM MinecraftAccounts
                WHERE user_id = ?;`;

    if(req.session.user_id === undefined) {
        res.send('You must be <a href=/login>logged in</a> to do that!')
        return;
    }

    pool.query(queryReports, [req.session.user_id], (error, reportsResult, fields) => {
        if (error) console.error(error);
        pool.query(queryAccounts, [req.session.user_id], function (error, accountsResult, fields) {
            if (error) console.error(error);
            res.render('profile', { reports: reportsResult, minecraft_accounts: accountsResult, userdata: {
                id: req.session.user_id,
                email: req.session.email,
                is_admin: req.session.is_admin
            } });
        });
    
    });



});

app.get('/leaderboard', (req, res) => {
    const query = `SELECT * FROM Users
                    WHERE is_admin = TRUE
                   ORDER BY ranking;`;

    pool.query(query, (error, results, fields) => {
        if (error) console.error(error);
        results[results.length - 1].ranking -= 1; 
        res.render('leaderboard', { admins: results });
    });
})


app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
});
