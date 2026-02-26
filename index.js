// const math1 = require("./math");

// try {
//     console.log("Add:", math.add(10, 5));
//     console.log("Multiply:", math.multiply(10, 5));
//     console.log("Divide:", math.divide(10, 0));
// } catch (error) {
//     console.error("Error occurred:", error.message);
// }

// require('./a');

const fs = require('fs').promises;

async function ensureFileExists() {
    try {
        await fs.access('data.txt');
        console.log("File exists.");
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log("File not found. Creating a new file...");
            await fs.writeFile("data.txt", "This is a new file created because the original file was not found.");
            console.log("File created successfully.");
        } else {
            console.error("An error occurred while checking the file:", error.message);
        }
    }
}

async function readFile() {
  try {
    const data = await fs.readFile("data.txt", "utf-8");
    console.log("File content:");
    console.log(data);
  } catch (error) {
    console.error("Error reading file:", error.message);
  }
}

ensureFileExists().then(() => {
    readFile();
});