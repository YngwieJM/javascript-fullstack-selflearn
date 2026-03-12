require("dotenv").config({path: "./config/.env"});
const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const session = require("express-session");
const PgStore = require("connect-pg-simple")(session);
const pool = require("./config/db");
const ordersRoute = require("./routes/orders.routes");
const menuRoute = require("./routes/menu.routes");
const staffRoute = require("./routes/staff.routes");
const tablesRoute = require("./routes/tables.routes");
const authRoute = require("./routes/auth.routes");
const reportRoutes = require("./routes/reports.routes");
const {errorHandler} = require("./middleware/error.middleware");
const { session: sessionCfg } = require("./config/env");
let swaggerUi = null;

try{
    swaggerUi = require("swagger-ui-express");
}catch(_err){
    swaggerUi = null;
}

const app = express();
const openApiPath = path.join(__dirname, "docs", "openapi.json");

app.use(cors({ origin: sessionCfg.corsOrigin, credentials: true }));
app.use(express.json());
app.use(session({
    store: new PgStore({
        pool,
        tableName: "session",
        createTableIfMissing: true
    }),
    name: "sid",
    secret: sessionCfg.secret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    unset: "destroy",
    cookie: {
        httpOnly: true,
        secure: sessionCfg.cookieSecure,
        sameSite: sessionCfg.cookieSameSite,
        maxAge: sessionCfg.ttlMinutes * 60 * 1000
    }
}));

app.get("/openapi.json", (req, res) => {
    if(!fs.existsSync(openApiPath)){
        return res.status(404).json({message: "OpenAPI spec not found"});
    }

    return res.sendFile(openApiPath);
});

if(swaggerUi && fs.existsSync(openApiPath)){
    try{
        const spec = JSON.parse(fs.readFileSync(openApiPath, "utf8"));
        app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(spec));
    }catch(_err){
        // keep server booting even when docs fail to parse
    }
}

app.use("/orders", ordersRoute);
app.use("/menu", menuRoute);
app.use("/staff", staffRoute);
app.use("/tables", tablesRoute);
app.use("/auth", authRoute);
app.use("/reports", reportRoutes);

app.use(errorHandler);

 const PORT = Number(process.env.PORT) || 3000;

if(require.main === module){
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    })
}

module.exports = app;
