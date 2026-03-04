const a = require('./a');
console.log("Inside B, A =", a.value);
exports.value = "A";