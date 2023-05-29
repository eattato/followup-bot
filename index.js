const { KkutuQuery, KkutuUser, Agent, duum } = require("./modules/kkutu.js");

const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const { v4 } = require("uuid");
const axios = require("axios");
const fs = require("fs");

// 메인
const app = express();
app.use(
  session(JSON.parse(fs.readFileSync("././config/session.json", "utf8")))
);
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const kkutu = new KkutuQuery("././config/db.json"); // DB 로드
const chatData = JSON.parse(
  // 봇 채팅 로드
  fs.readFileSync("././public/resource/chat.json", "utf8")
);
const dictionaryKey = JSON.parse(
  // 국립대사전 API key 로드
  fs.readFileSync("././config/key.json", "utf8")
)["key"];

// 요청 처리
let userDatas = {}

app.get("/chat", (req, res) => {
  res.json(chatData);
});

app.get("/init", (req, res) => {
  if (!req.session.uuid) {
    const id = v4();
    let user = new KkutuUser(kkutu);
    let agent = new Agent(kkutu);

    kkutu.initWord().then((word) => {
      user.updateCurrent(word);
      userDatas[id] = {
        user: user,
        agent: agent,
        turn: "user"
      }
      req.session.uuid = id;
      res.send(JSON.stringify({ result: true, param: word }));
    });
  } else {
    res.send(JSON.stringify({
      result: false,
      reason: "이미 로그인되어 있습니다!"
    }));
  }
});

app.post("/answer", (req, res) => {
  let word = req.body.word;
  if (req.session.uuid && userDatas[req.session.uuid]) {
    let data = userDatas[req.session.uuid];

    if (typeof word != "string") {
      res.json(JSON.stringify({ result: false, reason: "옳지 않은 형태의 입력입니다." }));
      return;
    }
    if (data.turn != "user") {
      res.json(JSON.stringify({ result: false, reason: "유저의 차례가 아닙니다." }));
      return;
    }

    let user = data.user;
    let agent = data.agent;
    data.turn = "agent";

    kkutu.exists(word)
    .then((exist) => {
      if (exist) {
        user.updateCurrent(word);
        agent.updateCurrent(word);

        // 받고 봇으로 답장
        agent.getPick().then((agentRes) => {
          data.turn = "user"
          res.json(JSON.stringify({ result: true, param: agentRes }));
        })
      }
      else {
        data.turn = "user";
        res.json(JSON.stringify({ result: false, reason: "없는 단어입니다." }));
      }
    })
  } else {
    res.json(JSON.stringify({ result: false, reason: "등록되지 않은 유저입니다." }));
  }
});

// Static pages
console.log(__dirname + "/public");
app.use("/", express.static(__dirname + "/public"));
app.use("/main", express.static(__dirname + "/public/pages/main/main.html"));

// Run server
let server = app.listen(8887, () => {
  console.log("서버 실행 완료");
});
