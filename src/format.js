String.prototype.format = function () {
  var result = this;
  for (let ind in arguments) {
    result = result.replace("{}", arguments[ind]);
  }
  return result;
};
