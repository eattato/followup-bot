const url = "http://localhost:8887";

String.prototype.format = function () {
  var result = this;
  for (let ind in arguments) {
    result = result.replace("{}", arguments[ind]);
  }
  return result;
};

// min ~ max 까지의 랜덤 값을 리턴
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

// 대상 채팅 프레임에 새 말풍선 추가
const chat = (frame, content) => {
  let duration = 4000;
  let disappearTime = 1000;

  let bubble = $($.parseHTML('<div class="chat"></div>'));
  bubble.text(content);
  frame.append(bubble);
  frame.data("new", bubble);

  frame.parent().addClass("active");
  frame.parent().stop();
  frame.parent().css({ opacity: 1 });
  setTimeout(() => {
    if (frame.data("new") == bubble) {
      frame.parent().animate({ opacity: 0 }, disappearTime);
    } else {
      bubble.animate({ opacity: 0 }, disappearTime);
    }
    setTimeout(() => {
      bubble.remove();
      if (frame.data("new") == bubble) {
        frame.parent().removeClass("active");
      }
    }, disappearTime);
  }, duration);
};

// 기록 남기기
const usedLog = (frame, data, who) => {
  let log = $(
    $.parseHTML(
      "<div class='used_log'><div class='used_main'></div><div class='used_desc'></div></div>"
    )
  );
  log.find(".used_main").text(data.word);
  log.find(".used_desc").text(data.desc);
  if (who != null) {
    log.addClass(who);
  }
  frame.prepend(log);
};

$().ready(() => {
  let session = null;
  let input = $(".input_frame input");
  let logFrame = $(".used_list");
  // 유저 세션 가져오기
  fetch(url + "/init", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.result == true) {
        input.attr(
          "placeholder",
          "{} 으로 시작하는 단어를 입력하세요.".format(data.word)
        );
        session = data;
      } else {
        console.log("refetching..");
      }
    });

  // 봇 대화 데이터 로드
  let botChatFrame = $(".face_frame.bot .chat_main");
  let userChatFrame = $(".face_frame.user .chat_main");
  chatData = null;
  fetch(url + "/resource/chat.json", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  })
    .then((res) => res.json())
    .then((data) => {
      chatData = data;
      chat(botChatFrame, chatData.start[random(0, chatData.start.length)]);
    });

  let dead = false;
  // 서버로 입력 전송
  const answer = (content) => {
    if (dead == false) {
      if (content == "gg" || content == "GG") {
        dead = true;
        setTimeout(() => {
          chat(botChatFrame, chatData.win[random(0, chatData.lose.length - 1)]);
        }, 500);

        setTimeout(() => {
          alert(
            "당신이 패배했습니다!\n{}턴에 걸쳐 패배!\n확인을 누르면 다시 플레이합니다.".format(
              session.turn
            )
          );
          window.location.href = window.location.href;
        }, 2000);
      } else {
        input.val("");
        fetch(url + "/answer", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            answer: content,
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            // 입력 결과 (봇의 수비 결과)
            if (data.result == true) {
              // 오류 없으면 자신의 공격 단어 표시
              chat(userChatFrame, content);

              for (let ind in data.used) {
                let usedData = data.used[ind];
                if (content == usedData.word) {
                  usedLog(logFrame, usedData, "user");
                  break;
                }
              }

              // 봇이 공격을 수비했음
              if (data.word != "victory") {
                // 세션 데이터 새로고침
                session = data;
                input.attr(
                  "placeholder",
                  "{} 으로 시작하는 단어를 입력하세요.".format(
                    session.word.charAt(session.word.length - 1)
                  )
                );

                // 봇의 수비 단어를 표시
                setTimeout(() => {
                  chat(botChatFrame, data.word);
                  for (let ind in data.used) {
                    let usedData = data.used[ind];
                    if (data.word == usedData.word) {
                      usedLog(logFrame, usedData, "bot");
                      break;
                    }
                  }
                }, 500);

                if (data.chat != null) {
                  let chatDelay = 750;
                  if (data.chatFirst == true) {
                    chatDelay = 250;
                  }
                  setTimeout(() => {
                    chatList = chatData[data.chat];
                    chat(
                      botChatFrame,
                      chatList[random(0, chatList.length - 1)]
                    );
                  }, chatDelay);
                }
              } else {
                // 유저 승리
                setTimeout(() => {
                  chat(
                    botChatFrame,
                    chatData.lose[random(0, chatData.lose.length - 1)]
                  );
                }, 500);

                setTimeout(() => {
                  alert(
                    "당신이 승리했습니다!\n{}턴에 걸쳐 승리!\n다시 플레이하려면 새로고침을 누르세요.".format(
                      session.turn
                    )
                  );
                }, 2000);
              }
            } else {
              // 오류 발생
              if (data.error == "not same start") {
                chat(
                  userChatFrame,
                  '시작 단어는 "{}" 입니다!'.format(
                    session.word.charAt(session.word.length - 1)
                  )
                );
              } else if (data.error == "already used") {
                chat(
                  userChatFrame,
                  '"{}"는 이미 사용된 단어입니다!'.format(content)
                );
              } else if (data.error == "no such word") {
                chat(
                  userChatFrame,
                  '"{}"라는 단어는 존재하지 않습니다!'.format(content)
                );
              } else if (data.error == "no kill word in first") {
                chat(
                  userChatFrame,
                  "첫 턴부터 한 방 단어를 사용할 수 없습니다!"
                );
              }
            }
          });
      }
    }
  };

  let button = $(".input_frame button");
  button.click(() => {
    answer(input.val());
  });
  input.bind("keypress", (i) => {
    if (i.which == 13) {
      answer(input.val());
    }
  });
});
