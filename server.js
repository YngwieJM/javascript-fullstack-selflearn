const express = require("express");
const pool = require("./db");

const app = express();
app.use(express.json());

// API GET all users
app.get("/users", async(req, res) =>{
    try{
        const result = await pool.query("SELECT * FROM users");
        res.json(result.rows);
    }catch(err){
        res.status(500).json({error: "500 Internal Server Error"});
    }
});

// API GET user by ID
app.get("/users/:id", async(req, res) => {
    try{
        const id = parseInt(req.params.id);
        const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);

        if(result.rows.length ===0){
            return res.status(404).json({error: "User not found"});
        }
        res.json(result.rows[0]);
    }catch(err){
        res.status(500).json({error: "500 Internal Server Error"});
    }
});

app.post("/users", async(req, res) => {
    try{
        const {name} = req.body;

        if(!name){
            return res.status(400).json({error: "Name is required"});
        }
        const result = await pool.query("INSERT INTO users (name) VALUES ($1) RETURNING *", [name]);
        res.status(201).json({message: "User created", user: result.rows[0]});
    }catch(err){
        res.status(500).json({error: "500 Internal Server Error"});
    }
});

app.listen(3000, () => {
    console.log("Server running at http://localhost:3000");
});