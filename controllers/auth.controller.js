const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto"); 
const { jwtSecret, passwordResetMinutes = 15 } = require("../config/env");
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

exports.forgotPassword = async (req, res) => {
    const { email } = req.body;

    const genericMessage = "If the account exists, a password reset instruction has been generated";

    try{
        const userResult = await pool.query("SELECT id FROM staff WHERE email = $1", [email]);

        if(userResult.rows.length === 0){
            return res.status(200).json({message: genericMessage});
        }

        const staffId = userResult.rows[0].id;

        await pool.query(
            `DELETE FROM password_reset_tokens
            WHERE staff_id = $1 AND used_at IS NULL`, [staffId]
        );

        const rawToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

        await pool.query(`
            INSERT INTO password_reset_tokens (staff_id, token_hash, expires_at)
            VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval)`,
        [staffId, tokenHash, String(passwordResetMinutes)]);

        // TODO: send rawToken via email (do not return token in production)
        if(process.env.NODE_ENV !== "production"){
            return res.status(200).json({message: genericMessage, resetToken:rawToken});
        }

        return res.status(200).json({message: genericMessage});
    }catch(err){
        console.error(err);
        return res.status(500).json({message:"Internal server error"});
    }
};

exports.resetPassword = async (req, res) => {
    const {token, newPassword} = req.body;

    try{
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

        const tokenResult = await pool.query(`
            SELECT id, staff_id FROM password_reset_tokens
            WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW() LIMIT 1`, [tokenHash]);

        if(tokenResult.rows.length === 0){
            return res.status(400).json({message:"Invalid or expired reset token"});
        }

        const resetRow = tokenResult.rows[0];
        const staffId = resetRow.staff_id;
        const resetTokenId = resetRow.id;

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await pool.query(`
            UPDATE staff SET password = $1 WHERE id = $2`, [hashedPassword, staffId]);

        await pool.query(`
            UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`, [resetTokenId]);

        await pool.query(`
            UPDATE password_reset_tokens SET used_at = NOW() WHERE staff_id = $1 AND used_at IS NULL`, [staffId]);


        return res.status(200).json({message: "Password reset successful"});
    }catch (err){
        console.error(err);
        return res.status(500).json({message:"Internal server error"});
    }
};
