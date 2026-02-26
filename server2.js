const http = require('http');

let users = [];
let nextId = 1;

const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");

    const {method, url} = req;

    // Basic routing

    // API Get all users
    if (method === "GET" && url === "/users"){
        res.statusCode = 200;
        res.end(JSON.stringify(users));
        return;
    }

    // API Create new user
    if(method === "POST" && url === "/users"){
        let body = "";

        req.on("data", chunk => {
            body += chunk.toString();
    });

    req.on("end", () => {
        try{
            const data = JSON.parse(body);

            const newUser = {
                id: nextId++,
                name: data.name
            };

            users.push(newUser);

            res.statusCode = 201;
            res.end(JSON.stringify(newUser));
        }catch(err){
            res.statusCode = 400;
            res.end(JSON.stringify({error: `${res.statusCode} Invalid JSON`}));
        }
    });

    return;
}

    // API Get user by ID
    if (method === "GET" && url.startsWith("/users/")){

        const id = parseInt(url.split("/")[2]);
        const user = users.find(u => u.id === id);

        if(!user){
            res.statusCode = 404;
            res.end(JSON.stringify({error: `${res.statusCode} User Not Found`}));
            return;
        }

        res.statusCode = 200;
        res.end(JSON.stringify(user));
        return;
    }

    // API Delete user by ID
    if(method === "DELETE" && url.startsWith("/users/")){
        const id = parseInt(url.split("/")[2]);
        const index = users.findIndex(u => u.id === id);

        if(index === -1){
            res.statusCode = 404;
            res.end(JSON.stringify({error: `${res.statusCode} User Not Found`}));
            return;
        }

        users.splice(index, 1);

        res.statusCode = 204;
        res.end();
        return;
    }

    if(method === "PUT" && url.startsWith("/users/")){
        const id = parseInt(url.split("/")[2]);
        const user = users.find(u => u.id === id);

        if(!user){
            res.statusCode = 404;
            res.end(JSON.stringify({error: `${res.statusCode} User Not Found`}));
            return;
        }

        let body = "";

        req.on("data", chunk => {
            body += chunk.toString();
        });

        req.on("end", () => {
            try{
                const data = JSON.parse(body);
                user.name = data.name;

                res.statusCode = 200;
                res.end(JSON.stringify(user));

            }catch{
                res.statusCode
                res.end(JSON.stringify({error: `${res.statusCode} Invalid JSON`}));
            }
        });
        return;
    }
    

    res.statusCode = 404;
    res.end(JSON.stringify({ error: `${res.statusCode} Not Found` }));
});



server.listen(3000, () => {
    console.log("Server running at http://localhost:3000");
});