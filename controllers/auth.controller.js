const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { jwtSecret } = require("../config/env");
const PUBLIC_REGISTER_ROLES = new Set(["WAITER", "BARTENDER"]);

exports.register = async (req, res) => {
    const {name, email, password, role} = req.body;

    if(!name || !email || !password || !role){
        return res.status(400).json({message: "All fields are required"});
    }

    if(!PUBLIC_REGISTER_ROLES.has(role)){
        return res.status(400).json({message:"Invalid role for public registration"});
    }

    try{
        //hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO staff (name, email, password, role)
            VALUES($1, $2, $3, $4) RETURNING id, name, email, role`,
            [name,email,hashedPassword,role]
        );

        res.status(201).json({message: "User registered successfully", user: result.rows[0]});
    }catch(err){

        if(err.code === "23505"){
            return res.status(400).json({message: "Email already exists"});

        }

        console.error(err);
        res.status(500).json({message: "Internal server error"});
    }
};

exports.login = async (req, res) => {
    const {email, password} = req.body;

    if(!email || !password){
        return res.status(400).json({message: "Email and password are required"});
    }

    try{
        const result = await pool.query(
            `SELECT * FROM staff WHERE email = $1`, [email]
        );

        if(result.rows.length === 0){
            return res.status(401).json({message: "Invalid credentials"});
        }

        const user = result.rows[0];

        const isMatch = await bcrypt.compare(password, user.password);

        if(!isMatch){
            return res.status(401).json({message: "Invalid credentials"});
        }

        const token = jwt.sign(
            {id: user.id, role: user.role}, jwtSecret, {expiresIn: "8h"}
        );

        res.json({message: "Login successful", token});
    }catch(err){
        console.error(err);
        res.status(500).json({message: "Internal server error"});
    }
};
