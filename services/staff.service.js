const pool = require("../config/db");
const bcrypt = require("bcrypt");

exports.getAllStaff = async () => {
    const result = await pool.query(`
        SELECT id, name, email, role, created_at
        FROM staff ORDER BY id`);

        return result.rows;
    
};

exports.getStaffById = async (id) => {
    const result = await pool.query(`
        SELECT id, name, role FROM staff
        WHERE id = $1`,[id]);

        if(result.rows.length === 0){
            throw new Error("STAFF_NOT_FOUND");
        }

        return result.rows[0];
};

exports.createStaff = async (name, email, password, role) => {
    
    if(!name || !email || !password || !role){
        throw new Error("INVALID_STAFF_DATA");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(`
        INSERT INTO staff (name, email, password, role)
        VALUES ($1, $2, $3, $4) RETURNING id, name, email, role`, [name, email, hashedPassword, role]);

        return result.rowCount[0];
};

exports.updateStaff = async (id, name, email, role) => {
    const result = await pool.query(`
        UPDATE staff SET
        name = COALCASE($1),
        email = COALCASE ($2),
        role = COALCASE ($3),
        WHERE id = $4 RETURNING id, name, email, role`, [name, email, role, id]);

        if(result.rows.length === 0){
            throw new Error("STAFF_NOT_FOUND");
        }

        return result.rows[0];
};

exports.updatePassword = async (id, currectPassword, newPassword) => {
    

    const staffResult = await pool.query(
        `SELECT password FROM staff WHERE id = $1`,[id]
    );

    if(staffResult.rows.length === 0){
        throw new Error("STAFF_NOT_FOUND");
    }

    const storedPassword = staffResult.rows[0].password;

    const passwordMacth = await bcrypt.compare(currectPassword, storedPassword);

    if(!passwordMacth){
        throw new Error("INVALID_PASSWORD");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const result = await pool.query(
        `UPDATE staff SET password = $1
        WHERE id = $2 RETURNING id`,[hashedPassword, id]
    );

    return {message: "Password Updated"};
};

exports.deleteStaff = async (id) => {
    const result = await pool.query(`
        DELETE FROM staff
        WHERE id = $1 RETURNING id, name`, [id]);

        if(result.rows.length === 0){
            throw new Error("STAFF_NOT_FOUND");
        }

        return result.rows[0];
};