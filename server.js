// const express = require("express");
// const app = express();

// app.use(express.json());

// let students = [
//   { name: "John", score: 85 },
//   { name: "Sarah", score: 92 },
//   { name: "Mike", score: 68 },
//   { name: "Anna", score: 74 }
// ];

// const getAverage = () =>
//     students.reduce((total, s) => total + s.score, 0) / students.length;

// // GET all students
// app.get("/students", (req, res) => {
//     res.json(students);
// });

// // GET average score
// app.get("/students/average", (req, res) => {
//     const average = getAverage();

//     res.json({ average });
// });

// // GET students above average
// app.get("/students/above-average", (req, res) => {

//     const average = getAverage();

//     const aboveAverage = students
//         .filter(student => student.score > average)
//         .map(student => ({
//             name: student.name,
//             score: student.score
//         }));

//     res.json({
//         average,
//         aboveAverage
//     });
// });

// app.listen(8080, () => {    
//     console.log("Server running on port 8080");
// });
const http = require('http');

const server = http.createServer((req, res) => {

    res.setHeader("Content-Type", "application/json");

    // const routes = {
    //     "/": ["GET"],
    //     "/about": ["GET"],
    //     "/time": ["GET"]
    // };

    if (req.url === "/") {
    if (req.method === "GET") {
        res.statusCode = 200;
        res.write(JSON.stringify({ message: "Home" }));
    } else {
        res.statusCode = 405;
        res.write(JSON.stringify({ error: res.statusCode + " Method Not Allowed" }));
    }
}
else if (req.url === "/about") {
    if (req.method === "GET") {
        res.statusCode = 200;
        res.write(JSON.stringify({ message: "About" }));
    } else {
        res.statusCode = 405;
        res.write(JSON.stringify({ error: res.statusCode + " Method Not Allowed" }));
    }
}
else if (req.url === "/time") {
    if (req.method === "GET") {
        res.statusCode = 200;
        res.write(JSON.stringify({ time: new Date().toISOString() }));
    } else {
        res.statusCode = 405;
        res.write(JSON.stringify({ error: res.statusCode + " Method Not Allowed" }));
    }
}
else {
    res.statusCode = 404;
    res.write(JSON.stringify({ error: res.statusCode + " Not Found" }));
}

    res.end();
});

server.listen(3000, () => {
    console.log("Server running at http://localhost:3000");
});