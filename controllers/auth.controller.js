const pool = require("../config/db");
const bcrypt = require("bcrypt");

function regenerateSession(req) {
    return new Promise((resolve, reject) => {
        req.session.regenerate((err) => (err ? reject(err) : resolve()));
    });
}

function saveSession(req) {
    return new Promise((resolve, reject) => {
        req.session.save((err) => (err ? reject(err) : resolve()));
    });
}

function destroySession(req) {
    return new Promise((resolve, reject) => {
        req.session.destroy((err) => (err ? reject(err) : resolve()));
    });
}

exports.register = async (req, res) => {
    const {name, email, password, role} = req.body;

    if(!name || !email || !password || !role){
        return res.status(400).json({message: "All fields are required"});
    }

    try{
        //hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO staff (name, email, password, role)
            VALUES($1, $2, $3, $4) RETURNING id, name, email, password`,
            [name,email,hashedPassword,role]
        );

        res.status(201).json({message: "User registered successfully"}, result.rows[0]);
    }catch(err){
        console.error(err);

        if(err.code === "23505"){
            return res.status(400).json({message: "Email already exists"});

        }

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
            `SELECT id, name, email, role, password 
             FROM staff WHERE LOWER(email) = LOWER($1) LIMIT 1`, [email]
        );

        if(result.rows.length === 0){
            return res.status(401).json({message: "Invalid credentials"});
        }

        const user = result.rows[0];

        const isMatch = await bcrypt.compare(password, user.password);

        if(!isMatch){
            return res.status(401).json({message: "Invalid credentials"});
        }

        await regenerateSession(req);

        req.session.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        };

        await saveSession(req);

        return res.json({
            message:"Login successful",
            user: req.session.user
        });

    }catch(err){
        console.error(err);
        return res.status(500).json({message: "Internal server error"});
    }
};

exports.logout = async (req, res) => {
    try{
        await destroySession(req);
        res.clearCookie("sid");
        return res.json({ message: "Logged Out"});
    }catch(err){
        console.error(err);
        return res.status(500).json({message: "Internal Server Error"});
    }
};

exports.me = async (req, res) => {
    if(!req.session || !req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    return res.json({ user: req.session.user});
}