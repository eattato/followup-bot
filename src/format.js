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
