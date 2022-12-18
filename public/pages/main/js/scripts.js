String.prototype.format = function () {
  var result = this;
  for (let ind in arguments) {
    result = result.replace("{}", arguments[ind]);
  }
  return result;
};

const random = (min, max) => {
  return Math.floor(Math.random() * max + min);
};

const getChatFrame = () => {
  result = null;
  $.get("../../fragments/chat.html", (res) => {
    result = res;
  });
  return result;
};

const chat = (frame, content) => {
  let duration = 4000;
  let disappearTime = 1000;

  let bubble = $($.parseHTML('<div class="chat"></div>'));
  bubble.text(content);
  frame.prepend(bubble);
  frame.parent().addClass("active");
  frame.parent().css({ opacity: 1 });
  setTimeout(() => {
    if (frame.children().length == 1) {
      frame.parent().animate({ opacity: 0 }, disappearTime);
    } else {
      bubble.animate({ opacity: 0 }, disappearTime);
    }
    setTimeout(() => {
      bubble.remove();
      if (frame.children().length == 1) {
        frame.parent().removeClass("active");
      }
    }, disappearTime);
  }, duration);
};

const url = "http://localhost:8887";

$().ready(() => {
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
      chat(
        $(".face_frame.bot .chat_main"),
        chatData.start[random(0, chatData.start.length)]
      );
    });
});
