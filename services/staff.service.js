const pool = require("../config/db");
const bcrypt = require("bcrypt");

exports.getAllStaff = async (page = 1, limit = 10) => {
    const offset = (page - 1) * limit;

    const result = await pool.query(`
        SELECT id, name, email, role, created_at
        FROM staff ORDER BY id
        LIMIT $1 OFFSET $2`, [limit, offset]);

    const countQuery = await pool.query("SELECT COUNT(*) FROM staff");
    const total = parseInt(countQuery.rows[0].count, 10);

    return {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
        data: result.rows
    };
    
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

        return result.rows[0];
};

exports.updateStaff = async (id, name, email, role) => {
    const result = await pool.query(`
        UPDATE staff SET
        name = COALESCE($1, name),
        email = COALESCE ($2, email),
        role = COALESCE ($3, role)
        WHERE id = $4 RETURNING id, name, email, role`, [name, email, role, id]);

        if(result.rows.length === 0){
            throw new Error("STAFF_NOT_FOUND");
        }

        return result.rows[0];
};

exports.updatePassword = async (id, currentPassword, newPassword, options = {}) => {
    const { skipCurrentCheck = false } = options;

    const staffResult = await pool.query(
        `SELECT password FROM staff WHERE id = $1`,[id]
    );

    if(staffResult.rows.length === 0){
        throw new Error("STAFF_NOT_FOUND");
    }

    const storedPassword = staffResult.rows[0].password;

    if(!skipCurrentCheck){
         const passwordMatch = await bcrypt.compare(currentPassword, storedPassword);

    if(!passwordMatch){
        throw new Error("INVALID_PASSWORD");
        }   
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
