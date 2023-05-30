const Hangul = require("hangul-js");
const fs = require("fs");
const { Client } = require("pg");

const KkutuQuery = class {
  constructor(configPath) {
    this.connected = false;
    this.tables = "public.kkutu_ko";

    // DB 연결
    this.connection = new Promise((resolve, reject) => {
      const config = JSON.parse(fs.readFileSync(configPath));
      this.client = new Client(config);
      this.client
        .connect()
        .then(() => {
          console.log("데이터베이스 연결 완료");
          this.connected = true;
          resolve();
        })
        .catch((e) => {
          console.error(e);
        });
    });
  }

  /**
   * 말 그대로 DB query 해주는 메소드
   * @param {String} queryStr query 내용
   * @returns {Promise} query 내용이 들어간 Promise 객체
   */
  query(queryStr) {
    if (this.connected) {
      return new Promise((resolve, reject) => {
        this.client.query(queryStr, (e, res) => {
          if (!e) {
            resolve(res.rows);
          } else {
            reject(e);
          }
        });
      });
    }
    return null;
  }

  /**
   * 해당 글자로 시작하는 단어 목록 주는 메소드
   * @param {String} start 해당 글자로 시작함
   * @returns {Promise} 단어 rows 리턴하는 Promise 객체
   */
  dictionary(start) {
    let alt = duum(start);
    let altCondition = start != alt ? `OR _id LIKE '${alt}%'` : "";

    const queryStr = `SELECT * FROM ${this.tables} WHERE (_id LIKE '${start}%' ${altCondition}) AND CHAR_LENGTH(_id) > 1;`;
    return new Promise((resolve, reject) => {
      this.query(queryStr)
        .then((res) => {
          // res = res.map((v) => v["_id"]);
          resolve(res);
        })
        .catch((e) => {
          reject(e);
        });
    });
  }

  /**
   * 해당 단어 정보 주는 메소드
   * @param {String} word 조회할 단어
   * @returns {Promise} 단어 정보 리턴하는 Promise 객체
   */
  getWordInfo(word) {
    const queryStr = `SELECT _id, theme FROM ${this.tables} WHERE _id = '${word}' AND CHAR_LENGTH(_id) > 1;`;
    return new Promise((resolve, reject) => {
      this.query(queryStr)
        .then((res) => {
          let info = res[0];
          if (info) resolve(info);
          else resolve(null);
        })
        .catch((e) => {
          reject(e);
        });
    });
  }

  /**
   * 단어가 한 방 단어인지 아닌지 확인해주는 메소드
   * @param {String} word 확인할 단어
   * @returns {Promise} 결과로 bool을 내주는 Promise 객체
   */
  hanbang(word) {
    word = word.charAt(word.length - 1);
    return new Promise((resolve, reject) => {
      this.dictionary(word)
        .then((res) => {
          resolve(res.length == 0);
        }).catch((e) => {
          reject(e);
        });
    });
  }

  /**
   * 시작할 단어를 리턴
   * @returns {String} 랜덤한 단어
   */
  initWord() {
    let queryStr =
      `SELECT _id FROM ${this.tables} WHERE CHAR_LENGTH(_id) > 1 AND CHAR_LENGTH(_id) <= 5;`;
    return new Promise((resolve, reject) => {
      this.query(queryStr)
        .then((res) => {
          let rand = Math.floor(Math.random() * res.length);
          resolve(res[rand]["_id"]);
        })
        .catch((e) => {
          reject(e);
        });
    });
  }

  /**
   * 단어가 존재하는지 확인하는 메소드
   * @param {String} word 체크할 단어
   * @returns {Promise} bool리턴하는 Promise 객체
   */
  exists(word) {
    const queryStr = `SELECT _id FROM ${this.tables} WHERE _id = '${word}' AND CHAR_LENGTH(_id) > 1;`;
    return new Promise((resolve, reject) => {
      this.query(queryStr)
        .then((res) => {
            if (res.length >= 1) resolve(true);
            else resolve(false);
        })
        .catch((e) => {
          reject(e);
        });
    });
  }

  /**
   * 해당 단어의 가중치 값을 업데이트함
   * @param {String} word 변화 시킬 단어
   * @param {number} weight 가중치 변화값
   */
  updateWeight(word, weight) {
    weight = weight > 0 ? `+ ${weight}` : `- ${-weight}`;
    const queryStr = `UPDATE ${this.tables} SET weight = GREATEST(1, weight ${weight}) WHERE _id = '${word}';`
    return this.query(queryStr);
  }
};

const KkutuUser = class {
  constructor(db) {
    this.db = db;
    this.used = []; // 사용한 단어
    this.current = ""; // 현재 단어
  }

  /**
   * 현재 단어를 업데이트함
   * @param {String} word 현재 단어
   */
  updateCurrent(word) {
    this.current = word.charAt(word.length - 1);
    this.used.push(word);
  }

  /**
   * 낼 수 있는 단어 목록을 가져오는 함수
   * @returns {Promise} 사용한 것을 제외해 사용 가능한 단어 목록을 리턴하는 Promise 객체
   */
  getUsableWords() {
    return new Promise((resolve, reject) => {
      this.db.dictionary(this.current).then((words) => {
        // 이미 쓴 단어 제거
        let used = this.used;
        words = words.reduce((arr, c) => {
          if (used.includes(c["_id"])) return arr;
          else {
            arr.push(c);
            return arr;
          }
        }, []);
        resolve(words);
      });
    });
  }
};

const Agent = class extends KkutuUser {
  constructor(db) {
    super(db);
    this.weights = {}; // 단어 가중치
  }

  /**
   * 단어 가중치 목록을 업데이트함
   * @param {[String]} words 업데이트할 가중치 목록
   * @param {number} value 가중치에 추가할 값
   */
  updateWeight(words, value) {
    for (let i in words) {
      let word = words[i];
      if (!this.weights[word]) {
        this.weights[word] = 1;
      }
      this.weights[word] += value;
    }
  }

  /**
   * 현재 단어를 기반으로 사용할 단어를 리턴
   * @returns {String} 사용할 단어
   */
  getPick() {
    return new Promise((resolve, reject) => {
      this.getUsableWords().then((wordDatas) => {
        if (wordDatas.length >= 1) {
          // 가중치 테이블 생성
          let words = [];
          let weights = [];
          for (let i in wordDatas) {
            let wordData = wordDatas[i];
            let word = wordData["_id"];
            let weight = wordData.weight;

            words.push(word);
            weight = weight == 0 ? 1 : weight;
            weights.push(weight);
          }
          // console.log(words);
          // console.log(weights);

          // 가중치 기반 랜덤
          let sum = weights.reduce((a, c) => a + c, 0);
          let rand = Math.floor(Math.random() * sum) + 1; // 1 ~ sum

          // 해당 범위 내에 들어가면, 예: 5, 2, 3 = 10인 상태에서 rand 9 => 9 - 5 = 4, 그럼 첫번째인거임
          resolve(
            weights.reduce((a, c, i) => {
              sum -= c;
              if (!a) return sum <= rand ? words[i] : null;
              else return a; // 이미 값을 구했으면 값 계속 리턴
            }, null)
          );
        } else resolve("gg");
      });
    });
  }
};

const duum = (originWord) => {
  const realMoums = ["ㅏ", "ㅓ", "ㅗ", "ㅜ", "ㅡ", "ㅣ"];
  const duumTable = [
    {
      // 한자음 녀, 뇨, 뉴, 니 → 여, 요, 유, 이
      start: "ㄴ",
      end: "ㅇ",
      targets: ["ㅕ", "ㅛ", "ㅠ", "ㅣ"],
    },
    {
      // 한자음 랴, 려, 례, 료, 류, 리 → 야, 여, 예, 요, 유, 이
      start: "ㄹ",
      end: "ㅇ",
      targets: ["ㅑ", "ㅕ", "ㅖ", "ㅛ", "ㅠ", "ㅣ"],
    },
    {
      // 한자음 라, 래, 로, 뢰, 루, 르 → 나, 내, 노, 뇌, 누, 느
      start: "ㄹ",
      end: "ㄴ",
      targets: ["ㅏ", "ㅐ", "ㅗ", "ㅚ", "ㅜ", "ㅡ"],
    },
  ];

  // 두음 법칙 적용
  let charSplit = Hangul.disassemble(originWord);
  for (let i in duumTable) {
    let rule = duumTable[i];
    let moum = charSplit[1];

    // 모음 2개짜리면 합쳐줌
    if (
      charSplit[1] &&
      charSplit[2] &&
      realMoums.includes(charSplit[1]) &&
      realMoums.includes(charSplit[2])
    ) {
      moum = Hangul.assemble([charSplit[1], charSplit[2]]);
    }

    if (charSplit[0] == rule.start && rule.targets.includes(moum)) {
      charSplit[0] = rule.end;
    }
  }
  charSplit = Hangul.assemble(charSplit);
  return charSplit;
};

exports.KkutuQuery = KkutuQuery;
exports.KkutuUser = KkutuUser;
exports.Agent = Agent;
exports.duum = duum;
