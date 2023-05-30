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

        let pass = 0;
        let turn = 1;
        while (true) { // 턴 진행
            turn = Number(!turn); // 0이면 1로, 1이면 0으로
            let agent = agents[turn];

            let word = await agent.getPick(pass == 0);
            pass++;
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
                // 가중치 조정
                let winWords = usages[Number(!turn)];
                let loseWords = usages[turn];
                usages = { 0: [], 1: [] };

                for (let i in winWords) {
                    kkutu.updateWeight(winWords[i], 1);
                }
                for (let i in loseWords) {
                    kkutu.updateWeight(loseWords[i], -1);
                }

                // 한방단어로 죽으면 해당 패인인 단어 가중치 추가 감소
                let deathReasonWord = agent.used[agent.used.length - 2];
                let deathWord = agent.used[agent.used.length - 1];
                console.log(`패인: '${deathReasonWord}'`);
                // kkutu.hanbang(deathWord)
                // .then((hanbang) => {
                //     if (hanbang) {
                //         kkutu.updateWeight(deathReasonWord, -1);
                //     }
                // });

                console.log(`agent ${Number(!turn)}의 승리!`); 
                break;
            }
        }
    }

})