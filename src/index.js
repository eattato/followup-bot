const fs = require("fs");
const express = require("express");
const bodyParser = require("body-parser");
const { Pool } = require("pg");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(bodyParser.text());

const dbConfig = JSON.parse(fs.readFileSync("././config/db.json", "utf8"));
const pg = new Pool(dbConfig);
pg.connect((e) => {
  if (e) {
    console.log(e);
  } else {
    console.log("데이터베이스 연결 완료");
  }
});

// Requests
app.get("/", (req, res) => {});

// Static pages
app.use("/", express.static(__dirname + "/pages/main"));
