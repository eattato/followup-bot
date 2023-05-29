const { KkutuQuery, duum } = require("./modules/kkutu.js");

// DB 로드
const kkutu = new KkutuQuery("././config/db.json");

// Agent 클래스
const Agent = class {
    constructor() {
        this.used = []; // 사용한 단어
        this.current = ""; // 현재 단어
        this.weights = {} // 단어 가중치
    }

    /**
     * 현재 단어를 업데이트함
     * @param {String} word 현재 단어
     */
    updateCurrent(word) {
        this.current = word.charAt(word.length - 1);
    }

    /**
     * 단어 가중치 목록을 업데이트함
     * @param {[String]} words 업데이트할 가중치 목록
     * @param {number} value 가중치에 추가할 값
     */
    updateWeight(words, value) {
        for (let i in words) {
            let word = words[i];
            if (!this.weights[word]) { this.weights[word] = 1; }
            this.weights[word] += value;
        }
    }

    /**
     * 현재 단어를 기반으로 사용할 단어를 리턴
     * @returns {String} 사용할 단어
     */
    getPick() {
        return new Promise((resolve, reject) => {
            kkutu.dictionary(this.current)
            .then((words) => {
                // 이미 쓴 단어 제거
                words = words.reduce((arr, c) => {
                    if (this.used.includes(c)) return arr;
                    else {
                        arr.push(c);
                        return arr;
                    }
                }, []);

                if (words.length >= 1) {
                    // 가중치 테이블 생성
                    let weightTable = [];
                    for (let i in words) {
                        let word = words[i];
                        if (this.weights[word]) { weightTable.push(this.weights[word]); }
                        else { weightTable.push(1); } // 쓰이지 않은 단어 = 가중치 1
                    }

                    // 가중치 기반 랜덤
                    let sum = weightTable.reduce((a, c) => a + c, 0);
                    let rand = Math.floor(Math.random() * sum) + 1; // 1 ~ sum

                    // 해당 범위 내에 들어가면, 예: 5, 2, 3 = 10인 상태에서 rand 9 => 9 - 5 = 4, 그럼 첫번째인거임
                    resolve(
                        weightTable.reduce((a, c, i) => {
                            sum -= c;
                            if (!a) return sum <= rand ? words[i] : null;
                            else return a; // 이미 값을 구했으면 값 계속 리턴
                        }, null)
                    );
                } else resolve("gg");
            })
        });
    }
}

// 메인
kkutu.connection
.then(async () => {
    console.log("DB 로드됨");

    let startWord = await kkutu.initWord();
    let agents = [new Agent(), new Agent()];
    console.log(`시작단어: '${startWord}'`);

    agents.forEach((agent) => {
        agent.updateCurrent(startWord);
    });

    let turn = 1;
    while (true) {
        turn = Number(!turn); // 0이면 1로, 1이면 0으로
        let agent = agents[turn];

        let word = await agent.getPick();
        if (word != "gg") {
            let wordStart = word.charAt(word.length - 1);
            let alt = duum(wordStart);
            let altText = wordStart != alt ? `(${alt})` : "";

            console.log(`agent ${turn}: ${word}${altText}`);
            agents.forEach((agent) => {
                agent.updateCurrent(word);
                agent.used.push(word);
            });
        } else {
            console.log(`agent ${Number(!turn)}의 승리!`);
            break;
        }
    }

})