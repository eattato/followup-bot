const fs = require("fs");
const express = require("express");
const bodyParser = require("body-parser");
const { Client } = require("pg");
const Query = require("pg").Query;
require("./format");

// Init
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
// app.use(bodyParser.text());

const dbConfig = JSON.parse(fs.readFileSync("././config/db.json", "utf8"));
const pg = new Client(dbConfig);
pg.connect((e) => {
  if (e) {
    console.log(e);
  } else {
    console.log("데이터베이스 연결 완료");
  }
});

const query = (queryStr, callback) => {
  pg.query(queryStr, (e, res) => {
    if (!e) {
      callback(res);
    } else console.log(e);
    pg.end();
  });
};

// Requests
// app.get("/", (req, res) => {});

app.post("/answer", (req, res) => {
  let answer = req.body.answer;
  if (typeof answer == "string") {
    query(
      "SELECT * FROM public.kkutu_ko WHERE _id = '{}';".format(answer),
      (qres) => {
        if (qres.rowCount >= 1) {
          res.send("단어 {}를 찾았습니다!".format(answer));
        } else {
          res.send("그런 단어는 없습니다!");
        }
      }
    );
  } else {
    res.send(
      "매개변수 answer는 string 형태여야 합니다! 입력: {}".format(typeof answer)
    );
  }
});

// Static pages
// app.use("/", express.static(__dirname + "/pages/main"));

// Run server
let server = app.listen(8887, () => {
  console.log("서버 실행 완료");
});
