const { KkutuQuery, Agent, duum } = require("./modules/kkutu.js");

// DB 로드
const kkutu = new KkutuQuery("././config/db.json");

// 메인
kkutu.connection
.then(async () => {
    console.log("DB 로드됨");

    // 경기 무한 반복
    let round = 0;
    while (true) {
        round++;
        console.log(`round ${round}`);
        let startWord = await kkutu.initWord();
        let agents = [new Agent(kkutu), new Agent(kkutu)];
        console.log(`시작단어: '${startWord}'`);

        let usages = {
            0: [],
            1: []
        }

        agents.forEach((agent) => {
            agent.updateCurrent(startWord);
        });

        let turn = 1;
        while (true) { // 턴 진행
            turn = Number(!turn); // 0이면 1로, 1이면 0으로
            let agent = agents[turn];

            let word = await agent.getPick();
            if (word != "gg") {
                let wordStart = word.charAt(word.length - 1);
                let alt = duum(wordStart);
                let altText = wordStart != alt ? `(${alt})` : "";

                usages[turn].push(word);
                console.log(`agent ${turn}: ${word}${altText}`);
                agents.forEach((agent) => {
                    agent.updateCurrent(word);
                    //agent.used.push(word);
                });
            } else { // 게임 끝
                // 한방단어로 죽으면 해당 패인인 단어 가중치 감소
                let deathReasonWord = agent.used[agent.used.length - 2];
                let deathWord = agent.used[agent.used.length - 1];
                console.log(`패인: '${deathReasonWord}'`);
                kkutu.hanbang(deathWord)
                .then((hanbang) => {
                    if (hanbang) {
                        // console.log(`${deathReasonWord}의 가중치값을 감소시킵니다.`);
                        kkutu.updateWeight(deathReasonWord, -300);
                    }
                });

                // 이긴 쪽 단어 전부 가중치 증가
                let winWords = usages[Number(!turn)];
                usages = { 0: [], 1: [] };
                for (let i in winWords) {
                    kkutu.updateWeight(winWords[i], 10);
                }

                console.log(`agent ${Number(!turn)}의 승리!`); 
                break;
            }
        }
    }

})