const url = `${window.location.protocol}//${window.location.host}`;

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
const usedLog = (frame, res, who) => {
  let log = $(
    $.parseHTML(
      "<div class='used_log'><div class='used_main'></div><div class='used_desc'></div></div>"
    )
  );
  log.find(".used_main").text(res.param.word);
  log.find(".used_desc").text(res.param.desc);
  if (who != null) {
    log.addClass(who);
  }
  frame.prepend(log);
};

// 메인
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
    .then((res) => {
      if (res.result == false) alert(res.reason);
      input.attr(
        "placeholder",
        `${res.param.charAt(res.param.length - 1)} 으로 시작하는 단어를 입력하세요.`
      );
    });

  // 봇 대화 데이터 로드
  let botChatFrame = $(".face_frame.bot .chat_main");
  let userChatFrame = $(".face_frame.user .chat_main");
  chatres = null;
  fetch(url + "/resource/chat.json", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  })
    .then((res) => res.json())
    .then((res) => {
      chatres = res;
      chat(botChatFrame, chatres.start[random(0, chatres.start.length)]);
    });

  // 뜻 조회하는 함수
  const getMeaning = (word, who) => {
    fetch(`${url}/meaning`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        word: word
      })
    }).then((res) => res.json())
    .then((res) => {
      if (res.result) {
        usedLog(logFrame, res, who);
      }
    })
  }

  let canFetch = true;
  let dead = false;
  // 서버로 입력 전송
  const answer = (content) => {
    if (dead) return;
    if (!canFetch) return;
    canFetch = false;

    // 항복
    if (content == "gg" || content == "GG") {
      dead = true;
      setTimeout(() => {
        chat(botChatFrame, chatres.win[random(0, chatres.win.length - 1)]);
      }, 500);

      setTimeout(() => {
        alert(`당신이 패배했습니다!\n{}턴에 걸쳐 패배!\n확인을 누르면 다시 플레이합니다.`);
        window.location.href = window.location.href;
      }, 2000);
    } else { // 입력
      input.val("");
      fetch(url + "/answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          word: content,
        }),
      })
        .then((res) => res.json())
        .then((res) => {
          if (res.result == false) { canFetch = true; alert(res.reason); return; }
          let word = res.param;

          chat(userChatFrame, content);
          getMeaning(content, "user");

          // 봇의 수비 단어를 표시
          setTimeout(() => {
            chat(botChatFrame, word);
            getMeaning(word, "bot");
            input.attr(
              "placeholder",
              `${word.charAt(word.length - 1)} 으로 시작하는 단어를 입력하세요.`
            );
            canFetch = true;

            // 봇 패배
            if (res.param == "gg") {
              dead = true;

              setTimeout(() => {
                chat(botChatFrame, chatres.lose[random(0, chatres.lose.length - 1)]);
              }, 500);

              setTimeout(() => {
                alert(`당신이 승리했습니다!\n{}턴에 걸쳐 승리!\n확인을 눌러 재시작합니다.`);
                window.href = `${url}/main`;
              }, 1000);
            }
          }, 500);
        });
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
