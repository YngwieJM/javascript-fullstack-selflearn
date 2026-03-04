console.log(exports === module.exports); // true

exports.test = 123; // This adds a property 'test' to the object that both exports and module.exports reference

console.log(exports === module.exports); // true, because exports is a reference to module.exports

exports = { hello:"world"}; // This does not change module.exports, it only changes the local variable exports

console.log(exports === module.exports); // false, because exports now points to a new object, while module.exports still points to the original object
console.log(module.exports); // Output will be { test: 123 }, because module.exports was not changed by the assignment to exports
console.log(exports); // Output will be { hello: "world" }, because exports now points to the new object