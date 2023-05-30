const { KkutuQuery, KkutuUser, Agent, duum } = require("./modules/kkutu.js");
const fs = require("fs");
const readline = require("readline");

let paths = [
    "Resources/attack.txt",
    "Resources/defense.txt"
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

            if (!tags.includes("어인정") && !tags.includes("한방")) {
                kkutu.updateWeight(word, 500);
                console.log(word);
            }
        });
    }
})