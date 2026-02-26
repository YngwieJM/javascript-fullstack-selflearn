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

//--------------------------------------------------------------------------// Previous code was for Express server, now we will create a simple HTTP server using Node's built-in http module.

// const http = require('http');

// const server = http.createServer((req, res) => {

//     res.setHeader("Content-Type", "application/json");

//     const routes = {
//         "/": ["GET"],
//         "/about": ["GET"],
//         "/time": ["GET"]
//     };

//     if (routes[req.url] && routes[req.url].includes(req.method)) {
//         if (req.url === "/") {
//             res.write(JSON.stringify({ message: "Welcome to the homepage!" }));
//         } else if (req.url === "/about") {
//             res.write(JSON.stringify({ message: "About page" }));
//         } else if (req.url === "/time") {
//             res.write(JSON.stringify({ time: new Date().toISOString() }));
//         }
//     } else {
//         res.statusCode = 404;
//         res.write(JSON.stringify({ error: `${res.statusCode} Not Found` }));
//     }
//     res.end();
// });

// server.listen(3000, () => {
//     console.log("Server running at http://localhost:3000");
// });

//--------------------------------------------------------------------------// Previous code was for HTTP server, now we will enhance it to handle POST requests and echo back the received JSON data.

const { error } = require('console');
const http = require('http');

const MAX_SIZE = 1 * 1024 * 1024; // 1MB

const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");

    if (req.url === "/echo" && req.method === "POST" ) {

        if(req.headers["Content-Type"] !== "application/json"){
            res.statusCode = 415;
            res.write(JSON.stringify({ error: "Unsupported Media Type" }));
            return;
        }
        let body = "";
        let siize = 0;

        req.on("data", chunk => {
            size += chunk.length;
            if(size > MAX_SIZE){
                res.statusCode = 413;
                res.end(JSON.stringify({ error: "Payload Too Large" }));
                req.destroy();
                return;
            }

            body += chunk.toString();
        });

        req.on("end", () => {
            try {
                const parsed = JSON.parse(body);

                res.statusCode = 200;
                res.write(JSON.stringify({
                    received: parsed
                }));
            
            } catch (error){
                res.statusCode = 400;
                res.write(JSON.stringify({
                    error: "Invalid JSON"
                }));
            }
        });
            }else {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: `${res.statusCode} Not Found` }));
            }
});

server.listen(3000, () => {
    console.log("Server running at http://localhost:3000");
});