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

                console.log(`agent ${turn}: ${word}${altText}`);
                agents.forEach((agent) => {
                    agent.updateCurrent(word);
                    agent.used.push(word);
                });
            } else { // 게임 끝
                console.log(`agent ${Number(!turn)}의 승리!`);

                // 가중치 저장 & 초기화
                let winnerUses = agents[Number(!turn)].used;
                let loserUses = agent.used;
                agents.forEach((agent) => {
                    agent.updateWeight(winnerUses, 1);
                    agent.updateWeight(loserUses, -1);
                    agent.used = [];
                });

                break;
            }
        }
    }

})