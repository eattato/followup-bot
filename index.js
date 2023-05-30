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
  // if (!req.session.uuid) {
  //   res.json({
  //     result: false,
  //     reason: "이미 로그인되어 있습니다!"
  //   });
  //   return;
  // }

  const id = v4();
  let user = new KkutuUser(kkutu);
  let agent = new Agent(kkutu);
  req.session.uuid = id;
  req.session.save();
  console.log(`user ${id} 등장`);

  kkutu.initWord().then((word) => {
    user.updateCurrent(word);
    userDatas[id] = {
      user: user,
      agent: agent,
      turn: "user",
      turnPassed: 0
    }
    res.json({ result: true, param: word });
  });
});

app.post("/answer", (req, res) => {
  let id = req.session.uuid;
  let word = req.body.word;
  console.log(`user ${id} 채팅 전송: ${word}`);
  if (!id || !userDatas[id]) {
    res.json({ result: false, reason: "등록되지 않은 유저입니다." });
    return;
  }

  let data = userDatas[req.session.uuid];
  if (typeof word != "string") {
    res.json({ result: false, reason: "옳지 않은 형태의 입력입니다." });
    return;
  }
  if (data.turn != "user") {
    res.json({ result: false, reason: "유저의 차례가 아닙니다." });
    return;
  }

  let user = data.user;
  let agent = data.agent;
  data.turn = "agent";

  kkutu.exists(word)
  .then(async (exist) => {
    if (data.turnPassed == 0) {
      let hanbang = await kkutu.hanbang(word);
      if (hanbang) {
        res.json({ result: false, reason: "첫 턴에 한 방 단어를 사용할 수 없습니다." });
        return;
      }
    }

    if (!exist) {
      data.turn = "user";
      res.json({ result: false, reason: "없는 단어입니다." });
      return;
    }
    if (user.used.includes(word)) {
      data.turn = "user";
      res.json({ result: false, reason: "이미 사용한 단어입니다." });
      return;
    }

    data.turnPassed++;
    user.updateCurrent(word);
    agent.updateCurrent(word);

    // 받고 봇으로 답장
    agent.getPick().then((agentRes) => {
      data.turn = "user"
      console.log(`user ${id} 에 대한 봇의 응답: ${agentRes}`)
      res.json({ result: true, param: agentRes });
    })
  })
});

app.post("/meaning", (req, res) => {
  if (!req.session.id) {
    res.json({ result: false, reason: "등록되지 않은 유저입니다." });
    return;
  }

  let word = req.body.word;
  if (typeof word != "string") {
    res.json({ result: false, reason: "옳지 않은 매개변수입니다." });
    return;
  }

  const themeTags = {
    JAN: "애니메이션",
    JLN: "라이트 노벨",
    NEX: "비디오 게임",
    LOL: "리그 오브 레전드",
    POK: "포켓몬스터",
    VOC: "보컬로이드",
    RAG: "라면/과자",
    HSS: "하스스톤",
    OIJ: "히어로즈 오브 더 스톰",
    MAP: "메이플스토리",
    OVW: "오버워치",
    KPO: "유명인",
    NSK: "니세코이",
    DGM: "디지몬",
    KRR: "개구리 중사 케로로",
    STA: "스타크래프트",
    DOT: "도타2",
    WMV: "외국영화",
  }

  kkutu.getWordInfo(word)
  .then((info) => {
    if (!info) {
      res.json({ result: false, reason: "없는 단어 입니다." });
      return;
    }

    if (themeTags[word.theme]) {
      res.json({
        result: true,
        param: {
          word: word,
          desc: themeTags[word.theme]
        }
      });
    }
    else {
      try {
        axios.get(`https://stdict.korean.go.kr/api/search.do?key=${dictionaryKey}&type_search=search&req_type=json&q=${word}`)
        .then((dictRes) => {
          try {
            let items = dictRes.data.channel.item;
            let desc = items[0].sense.definition;
            res.json({
              result: true,
              param: {
                word: word,
                desc: desc
              }
            })
          } catch (e) {
            console.log(`뜻을 찾을 수 없습니다. - ${word}, ${word.theme}`)
            res.json({
              result: true,
              param: {
                word: word,
                desc: "뜻을 로드하지 못했습니다."
              }
            });
          }
        })
      } catch (e) {
        console.log(`뜻을 로드하던 중 에러가 발생했습니다. - ${word}, ${word.theme}`)
        res.json({
          result: true,
          param: {
            word: word,
            desc: "뜻을 로드하지 못했습니다."
          }
        });
      }
    }
  })
});

// Static pages
console.log(__dirname + "/public");
app.use("/", express.static(__dirname + "/public"));
app.use("/main", express.static(__dirname + "/public/pages/main/main.html"));

// Run server
let server = app.listen(8887, () => {
  console.log("서버 실행 완료");
});
