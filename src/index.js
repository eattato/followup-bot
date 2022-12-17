const fs = require("fs");
const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const { Client } = require("pg");
const Query = require("pg").Query;
require("./format");

// Init
const app = express();
app.use(session({}));
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

const query = async (queryStr, callback) => {
  pg.query(queryStr, (e, res) => {
    if (!e) {
      callback(res);
    } else console.log(e);
    // pg.end();
  });
};

const checkOneCom = async (word) => {
  let last = word.split("").pop();
  console.log("{}이 한 방 단어인지 체크 중..".format(last));
  result = false;
  await query(
    "SELECT * FROM public.kkutu_ko WHERE _id LIKE '{}%';".format(last),
    (qres) => {
      if (qres.rowCount >= 1) {
        console.log("반격 할 수 있습니다!");
        result = false;
      } else {
        console.log("한 방 단어!");
        result = true;
      }
    }
  );
  return result;
};

gameData = [];

// Requests
// app.get("/", (req, res) => {});

app.get("/", (req, res) => {
  console.log(req.session);
  if (req.session == null) {
  }
  res.send("ok");
});

app.post("/answer", (req, res) => {
  let answer = req.body.answer;
  if (typeof answer == "string") {
    query(
      "SELECT * FROM public.kkutu_ko WHERE _id = '{}';".format(answer),
      async (qres) => {
        if (qres.rowCount >= 1) {
          res.send("단어 {}를 찾았습니다!".format(answer));
          checkOneCom(answer);
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
