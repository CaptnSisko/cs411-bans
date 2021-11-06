const express = require('express');
const mysql = require('mysql2');
dbinfo = require('./secret').dbinfo;

const app = express()
const port = 3000

const pool  = mysql.createPool(dbinfo);

app.get('/', (req, res) => {
  res.send('Hello World!')
});

app.get('/test', (req, res) => {
    pool.query('SELECT * FROM MinecraftAccounts', function (error, results, fields) {
        if (error) throw error;
        res.json(results);
    });      
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
});
