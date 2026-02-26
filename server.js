const express = require('express');
const app = express();

app.use(express.json());

let users = [];
let nextId = 1;

// GET all users
app.get("/users", (req, res) => {
    res.json(users);
});

// Get one user by ID
app.get("/users/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const user = users.find(u => u.id === id);

    if(!user){
        return res.status(404).json({error: "User Not Found"});
    }
    res.json(user);
});

// Create a new user
app.post("/users", (req, res) => {
    const {name} = req.body;

    if(!name){
        return res.status(400).json({error: "Name is required"});
    }

    const newUser = { id: nextId++, name };
    user.push(newUser);
    res.status(201).json(newUser);
});

// Update user by ID
app.put("/users/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const user = users.find(u => u.id === id);

    if(!user){
        return res.status(404).json({error: "User not found"});
    }

    user.name = req.body.nam || user.name;
    res.json(user);
});

// Delete a user
app.delete("/users/id:", (req, res) => {
    const id =parseInt(req.params.id);
    const index = users.findIndex(u => u.id === id);

    if(index === -1){
        return res.status(404).json({error: "User not found"});
    }

    users.splice(index, 1);
    res.status(204).send();
});

app.listen(3000, () => {
    console.log("Server runnig at http://localhost:3000");
});