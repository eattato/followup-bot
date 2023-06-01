const { KkutuQuery, KkutuUser, Agent, duum } = require("./modules/kkutu.js");
const fs = require("fs");
const readline = require("readline");

let paths = [
    "Resources/attack.txt",
    "Resources/defense.txt",
    "Resources/hanbang.txt",
]

const kkutu = new KkutuQuery("././config/db.json"); // DB 로드
kkutu.connection.then(() => {
    for (let i in paths) {
        let path = paths[i];
        console.log(path);
        let stream = fs.createReadStream(path);
        let reader = readline.createInterface(stream, process.stdout);
    
        reader.on("line", function(line) {
            let split = line.split(" ");
            let word = split[0];
            let tags = [];
            for (let i = 1; i < split.length; i++) {
                tags.push(split[i]);
            }

            if (!tags.includes("어인정")) {
                // 한방 방어를 위해 기회만 되면 한방을 많이 쓰게함
                // let query = tags.includes("한방") ? kkutu.setWeight(word, 99999) : kkutu.setWeight(word, 3);
                // query.then(() => {console.log(`query done ${word}`)})
                // console.log(word);

                if (tags.includes("한방")) {
                    let query = kkutu.setWeight(word, -1);
                    query.then(() => {
                        console.log(`query done ${word}`);
                    })
                }
            }
        });
    }
})