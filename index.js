const express = require('express');
const mysql = require('mysql2');
dbinfo = require('./secret').dbinfo;

const app = express()
const port = 3000
app.set('view engine', 'pug');

const pool  = mysql.createPool(dbinfo);

app.get('/', function (req, res) {
    res.render('index', { title: 'Hey', message: 'Hello there!' })
});

app.get('/report', function (req, res) {
    res.render('report')
});

app.post('/report_submit', (req, res) => {
    res.json({success: true});
});

app.get('/test', (req, res) => {
    pool.query('SELECT * FROM MinecraftAccounts', function (error, results, fields) {
        if (error) throw error;
        res.json(results);
    });      
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
