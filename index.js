const fs = require("fs");

const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const { Client } = require("pg");
const Hangul = require("hangul-js");

const Query = require("pg").Query;
const Path = require("path");
const axios = require("axios");

// Init
String.prototype.format = function () {
  var result = this;
  for (let ind in arguments) {
    result = result.replace("{}", arguments[ind]);
  }
  return result;
};

const random = (min, max) => {
  return Math.floor(Math.random() * max + min);
};

const shuffle = (sourceArray) => {
  for (var i = 0; i < sourceArray.length - 1; i++) {
    var j = i + Math.floor(Math.random() * (sourceArray.length - i));

    var temp = sourceArray[j];
    sourceArray[j] = sourceArray[i];
    sourceArray[i] = temp;
  }
};

const app = express();
app.use(
  session(JSON.parse(fs.readFileSync("././config/session.json", "utf8")))
);
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
// app.engine("html", expressThymeleaf(new TemplateEngine()));

const dbConfig = JSON.parse(fs.readFileSync("././config/db.json", "utf8"));
const pg = new Client(dbConfig);
pg.connect((e) => {
  if (e) {
    console.log(e);
  } else {
    console.log("데이터베이스 연결 완료");
  }
});

const chatData = JSON.parse(
  fs.readFileSync("././public/resource/chat.json", "utf8")
);
const dictionaryKey = JSON.parse(
  fs.readFileSync("././config/key.json", "utf8")
)["key"];

// DB 쿼리 함수
const query = (queryStr, callback) => {
  // console.log(queryStr);
  // Promise 객체를 리턴
  return new Promise((resolve, reject) => {
    // {tables}이 있다면 UNION으로 여러 테이블 묶어서 실행
    if (queryStr.indexOf("{tables}") != -1) {
      //let tables = ["public.kkutu_ko", "public.kkutu_injeong"];
      let tables = ["public.kkutu_ko"];
      let queries = [];
      queryStr = queryStr.replace(";", "");
      for (let ind in tables) {
        let tableName = tables[ind];
        let queryCopy = queryStr.replace("{tables}", tableName);
        queries.push(queryCopy);
      }
      queryStr = queries.join(" UNION ") + ";";
    }

    // 비동기함수인 pg.query를 실행, 값을 받고 resolve로 promise.then으로 전달
    pg.query(queryStr, (e, res) => {
      if (e) {
        reject(e);
      } else {
        resolve(res); // 콜백에서 resolve 실행, query().then((res) => {})로 받을 수 있음
      }
      // pg.end();
    });
  });
};

// 한 방 단어 여부 체크
const checkOneCom = (word) => {
  return new Promise((resolve, reject) => {
    // console.log("{}이 한 방 단어인지 체크 중..".format(last));
    let last = word.split("").pop();
    query(
      "SELECT _id FROM {tables} WHERE _id LIKE '{}%' AND CHAR_LENGTH(_id) > 1;".format(
        last
      )
    ).then((res) => {
      if (res.rowCount >= 1) {
        console.log("반격 할 수 있습니다!");
        resolve(false);
      } else {
        console.log("한 방 단어입니다!");
        resolve(true);
      }
    });
  });
};

const usedFilter = (used) => {
  let output = "";
  for (let ind in used) {
    let word = used[ind];
    output += " AND _id != '{}'".format(word);
    if (typeof word.word != "string") {
      console.log(word);
    }
  }
  return output;
};

const getMin = (target) => {
  let result = null;
  for (let key in target) {
    if (result == null) {
      result = key;
    } else {
      if (target[key] > target[result]) {
        result = key;
      }
    }
  }
  return result;
};

// 두음법칙 적용해서 리턴해주는 함수
const duum = (originWord) => {
  let charSplit = Hangul.disassemble(originWord);
  if (
    // 한자음 녀, 뇨, 뉴, 니 → 여, 요, 유, 이
    charSplit[0] == "ㄴ" &&
    (charSplit[1] == "ㅕ" ||
      charSplit[1] == "ㅛ" ||
      charSplit[1] == "ㅠ" ||
      charSplit[1] == "ㅣ")
  ) {
    charSplit[0] = "ㅇ";
  } else if (
    // 한자음 랴, 려, 례, 료, 류, 리 → 야, 여, 예, 요, 유, 이
    charSplit[0] == "ㄹ" &&
    (charSplit[1] == "ㅑ" ||
      charSplit[1] == "ㅕ" ||
      charSplit[1] == "ㅖ" ||
      charSplit[1] == "ㅛ" ||
      charSplit[1] == "ㅠ" ||
      charSplit[1] == "ㅣ")
  ) {
    charSplit[0] = "ㅇ";
  } else if (
    // 한자음 라, 래, 로, 뢰, 루, 르 → 나, 내, 노, 뇌, 누, 느
    charSplit[0] == "ㄹ" &&
    (charSplit[1] == "ㅏ" ||
      charSplit[1] == "ㅐ" ||
      charSplit[1] == "ㅗ" ||
      (charSplit[1] == "ㅗ" && charSplit[2] == "ㅣ") ||
      charSplit[1] == "ㅜ" ||
      charSplit[1] == "ㅡ")
  ) {
    charSplit[0] = "ㄴ";
  }
  charSplit = Hangul.assemble(charSplit);
  return charSplit;
};

// 뜻을 찾아줌
const getMeaning = (target) => {
  return new Promise((resolve, reject) => {
    axios
      .get(
        "https://stdict.korean.go.kr/api/search.do?key={}&type_search=search&req_type=json&q={}".format(
          dictionaryKey,
          target.word
        )
      )
      .then((res) => {
        try {
          let items = res.data.channel.item;
          target.desc = items[0].sense.definition;
        } catch (e) {
          let themeTag = {
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
          };

          let tagSplit = target.desc.split(",");
          let tags = [];
          for (let ind in tagSplit) {
            let tag = tagSplit[ind];
            if (tag in themeTag) {
              tags.push(themeTag[tag]);
            }
          }

          if (tags.length == 0) {
            target.desc = "뜻을 로드하지 못했습니다..\n{}".format(target.desc);
          } else {
            target.desc = tags.join(", ");
          }
        }
        resolve();
      });
  });
};

// Requests
// app.post("/query", (req, res) => {
//   query(req.body.query).then((qres) => {
//     console.log(qres.rows);
//     console.log(qres.rowCount);
//     res.send(qres.rows);
//   });
// });

app.get("/chat", (req, res) => {
  res.json(chatData);
});

app.get("/init", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  // if (req.session.word == null) {
  query(
    "SELECT _id FROM {tables} WHERE CHAR_LENGTH(_id) > 1 AND CHAR_LENGTH(_id) <= 5;"
  ).then((qres) => {
    if (qres.rowCount >= 1) {
      selectedWord = qres.rows[random(0, qres.rowCount - 1)]["_id"];
      req.session.word = selectedWord.charAt(0);
      req.session.used = [];
      req.session.turn = 0;
      console.log("시작: " + selectedWord);

      res.json({
        result: true,
        word: req.session.word,
        used: req.session.used,
        turn: req.session.turn,
      });
    } else {
      res.json({
        result: false,
      });
    }
  });
  // }
});

app.post("/answer", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  let session = req.session;
  let answer = req.body.answer;

  if (session.word != null) {
    if (typeof answer == "string") {
      // 디버깅용 첫 턴 시작글자 맘대로 하는 코드
      if (session.turn == 0) {
        session.word = answer.charAt(0);
      }

      // 두음 법칙 적용
      let originWord = session.word.charAt(session.word.length - 1);
      charSplit = duum(originWord);

      // 첫 자 동일 여부
      if (answer.charAt(0) == originWord || answer.charAt(0) == charSplit) {
        // 사용 여부
        let alreadyUsed = false;
        for (let ind in session.used) {
          let usedData = session.used[ind];
          if (usedData.word == answer) {
            alreadyUsed = true;
            break;
          }
        }
        if (alreadyUsed == false) {
          // 단어 존재 여부 체크
          query(
            "SELECT _id, theme FROM {tables} WHERE _id = '{}' AND CHAR_LENGTH(_id) > 1;".format(
              answer
            )
          ).then((qres) => {
            if (qres.rowCount >= 1) {
              session.word = answer.charAt(answer.length - 1);
              session.turn += 1;

              console.log("공격: {}".format(answer));
              let answerData = { word: answer, desc: qres.rows[0]["theme"] };
              session.used.push(answerData);
              console.log(session.used);
              let answerDesc = getMeaning(answerData);

              // 한 방 단어 체크
              query(
                "SELECT _id, theme FROM {tables} WHERE (_id LIKE '{}%' OR _id LIKE '{}%') AND CHAR_LENGTH(_id) > 1{};".format(
                  answer.charAt(answer.length - 1),
                  duum(answer.charAt(answer.length - 1)),
                  usedFilter(session.used)
                )
              ).then((qres) => {
                if (qres.rowCount >= 1) {
                  // 수비
                  let wordDatas = [];

                  // 단어 방어력 체크
                  let wordCheckPromises = [];
                  console.log("{}개의 방어력 체크..".format(qres.rowCount));
                  shuffle(qres.rows);
                  for (let ind in qres.rows) {
                    let word = qres.rows[ind]["_id"];
                    let desc = qres.rows[ind]["theme"];
                    let wordCheck = query(
                      "SELECT _id FROM {tables} WHERE (_id LIKE '{}%' OR _id LIKE '{}%') AND CHAR_LENGTH(_id) > 1 AND _id != '{}'{};".format(
                        word.charAt(word.length - 1),
                        duum(answer.charAt(answer.length - 1)),
                        word,
                        usedFilter(session.used)
                      )
                    ).then((qres) => {
                      wordDatas.push({
                        word: word,
                        desc: desc,
                        count: qres.rowCount,
                      });
                    });
                    wordCheckPromises.push(wordCheck);

                    if (ind >= 10) {
                      // 일단 방어력 체크 쿼리 10개로 제한
                      break;
                    }
                  }

                  // 모든 방어력 체크가 끝날때까지 대기
                  Promise.all(wordCheckPromises).then(() => {
                    // 가장 방어력이 높은 단어 채택
                    let attack = null;
                    for (let ind in wordDatas) {
                      let wordData = wordDatas[ind];
                      if (wordData.count != 0) {
                        if (
                          attack == null ||
                          wordData.count < wordDatas[attack].count
                        ) {
                          attack = ind;
                        }
                      }
                    }

                    if (attack != null) {
                      session.word = wordDatas[attack].word;
                      console.log("수비: {}".format(session.word));
                    } else {
                      // 한 방 단어 밖에 없음
                      attack = random(0, wordDatas.length - 1);
                      session.word = wordDatas[attack].word;
                      console.log(
                        "한 방 단어로 공격!: {}".format(session.word)
                      );
                    }

                    let defenseData = {
                      word: session.word,
                      desc: wordDatas[attack].desc,
                    };
                    session.used.push(defenseData);
                    let defenseDesc = getMeaning(defenseData);

                    let resData = {
                      result: true,
                      word: session.word,
                      used: session.used,
                      turn: session.turn,
                    };
                    if (wordDatas[attack].count == 0) {
                      resData["chat"] = "finish";
                      resData["chatFirst"] = true;
                    } else if (wordDatas[attack].count <= 30) {
                      resData["chat"] = "attack";
                      resData["chatFirst"] = false;
                    } else if (qres.rowCount <= 30) {
                      resData["chat"] = "danger";
                      resData["chatFirst"] = true;
                    }

                    // 단어 뜻 모두 찾을 때 까지 대기
                    Promise.all([answerDesc, defenseDesc]).then(() => {
                      res.json(resData);
                    });
                  });
                } else {
                  // 한 방 단어 또는 다 소진된 단어로 공격 받음
                  if (session.turn == 1) {
                    res.json({
                      result: false,
                      error: "no kill word in first", // 첫 공격에 한 방 단어
                    });
                  } else {
                    // 유저 승리
                    res.json({
                      result: true,
                      word: "victory",
                      used: req.session.used,
                      turn: req.session.turn,
                    });
                    req.session.word = null;
                    req.session.used = null;
                    req.session.turn = null;
                  }
                }
              });
            } else {
              res.json({
                result: false,
                error: "no such word", // 해당 단어 없음
              });
            }
          });
        } else {
          res.json({
            result: false,
            error: "already used", // 이미 사용된 단어
          });
        }
      } else {
        console.log(
          "{} != {}".format(
            answer.charAt(0),
            session.word.charAt(session.word.length - 1)
          )
        );
        res.json({
          result: false,
          error: "not same start", // 잘못된 시작 단어
        });
      }
    } else {
      res.json({
        result: false,
        error: "answer not string", // 잘못된 입력
      });
    }
  } else {
    res.json({
      result: false,
      error: "not logged in", // 로그인 안 됨
    });
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
