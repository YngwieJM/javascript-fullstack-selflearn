const math1 = require("./math");

try {
    console.log("Add:", math.add(10, 5));
    console.log("Multiply:", math.multiply(10, 5));
    console.log("Divide:", math.divide(10, 0));
} catch (error) {
    console.error("Error occurred:", error.message);
}