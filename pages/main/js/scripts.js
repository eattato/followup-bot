const getChatFrame = () => {
  result = null;
  $.get("../../fragments/chat.html", (res) => {
    result = res;
  });
  return result;
};

const chat = (frame, content) => {
  let duration = 3000;
  let disappearTime = 1000;

  let bubble = $($.parseHTML('<div class="chat"></div>'));
  bubble.text(content);
  frame.insertAfter(frame.find(".chat_tail"));
  setTimeout(() => {
    bubble.animate({ opacity: 1 }, disappearTime);
    if (frame.children().length == 2) {
      frame.find(".chat_tail").animate({ opacity: 1 }, disappearTime);
    }
    setTimeout(() => {
      bubble.remove();
    }, disappearTime);
  }, duration);
};

const url = "http://localhost:8887";

$().ready(() => {
  chatData = null;
  fetch(url + "/chat", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  }).then((res) => {
    console.log(res);
  });

  // $.getJSON("chat.json", function (res) {
  //   console.log("ok");
  //   chatData = res;
  //   setTimeout(() => {
  //     chat(
  //       $(".face_frame.bot > .chat_frame"),
  //       chatData.start[random(0, chatData.start.length)]
  //     );
  //   }, 1000);
  // }).fail(() => {
  //   console.log("로드 실패");
  // });
});
