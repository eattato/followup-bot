const Hangul = require("hangul-js");
const fs = require("fs");
const { Client } = require("pg");

const KkutuQuery = class {
    constructor(configPath) {
        this.connected = false;

        // DB 연결
        this.connection = new Promise((resolve, reject) => {
            const config = JSON.parse(fs.readFileSync(configPath));
            this.client = new Client(config);
            this.client.connect()
            .then(() => {
                console.log("데이터베이스 연결 완료");
                this.connected = true;
                resolve();
            })
            .catch((e) => { console.error(e)});
        })
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
                })
            })
        } return null;
    }

    /**
     * 해당 글자로 시작하는 단어 목록 주는 메소드
     * @param {String} start 해당 글자로 시작함
     * @returns {Promise} 단어 목록 리턴하는 Promise 객체
     */
    dictionary(start) {
        let alt = duum(start);
        let altCondition = start != alt ? `OR _id LIKE '${alt}%'` : "";

        const queryStr = `SELECT _id FROM public.kkutu_ko WHERE _id LIKE '${start}%' ${altCondition} AND CHAR_LENGTH(_id) > 1;`;
        return new Promise((resolve, reject) => {
            this.query(queryStr)
            .then((res) => {
                res = res.map((v) => v["_id"]);
                resolve(res);
            }).catch((e) => {
                reject(e);
            });
        })
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
                if (res.length >= 1) { resolve(true); }
                else { resolve(false); }
            }).catch((e) => {
                reject(e);
            });
        })
    }

    /**
     * 시작할 단어를 리턴
     * @returns {String} 랜덤한 단어
     */
    initWord() {
        let queryStr = "SELECT _id FROM public.kkutu_ko WHERE CHAR_LENGTH(_id) > 1 AND CHAR_LENGTH(_id) <= 5;";
        return new Promise((resolve, reject) => {
            this.query(queryStr)
            .then((res) => {
                let rand = Math.floor(Math.random() * res.length);
                resolve(res[rand]["_id"]);
            }).catch((e) => {
                reject(e);
            });
        })
    }
}

const duum = (originWord) => {
    const realMoums = ["ㅏ", "ㅓ", "ㅗ", "ㅜ", "ㅡ", "ㅣ"];
    const duumTable = [
        { // 한자음 녀, 뇨, 뉴, 니 → 여, 요, 유, 이
            start: "ㄴ",
            end: "ㅇ",
            targets: ["ㅕ", "ㅛ", "ㅠ", "ㅣ"]
        },
        { // 한자음 랴, 려, 례, 료, 류, 리 → 야, 여, 예, 요, 유, 이
            start: "ㄹ",
            end: "ㅇ",
            targets: ["ㅑ", "ㅕ", "ㅖ", "ㅛ", "ㅠ", "ㅣ"]
        },
        { // 한자음 라, 래, 로, 뢰, 루, 르 → 나, 내, 노, 뇌, 누, 느
            start: "ㄹ",
            end: "ㄴ",
            targets: ["ㅏ", "ㅐ", "ㅗ", "ㅚ", "ㅜ", "ㅡ"]
        }
    ];

    // 두음 법칙 적용
    let charSplit = Hangul.disassemble(originWord);
    for (let i in duumTable) {
        let rule = duumTable[i];
        let moum = charSplit[1];

        // 모음 2개짜리면 합쳐줌
        if (charSplit[1] && charSplit[2] && realMoums.includes(charSplit[1]) && realMoums.includes(charSplit[2])) {
            moum = Hangul.assemble([ charSplit[1], charSplit[2] ]);
        }

        if (charSplit[0] == rule.start && rule.targets.includes(moum)) {
            charSplit[0] = rule.end;
        }
    }
    charSplit = Hangul.assemble(charSplit);
    return charSplit;
};

exports.KkutuQuery = KkutuQuery;
exports.duum = duum;