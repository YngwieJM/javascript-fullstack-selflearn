const { Pool } = require("pg");

const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "fullstack_db",
    password: "168168168",
    port: 5432,
});

module.exports = pool;