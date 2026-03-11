require("dotenv").config({path: "./config/.env"});
const express = require("express");
const fs = require("fs");
const path = require("path");
const ordersRoute = require("./routes/orders.routes");
const menuRoute = require("./routes/menu.routes");
const staffRoute = require("./routes/staff.routes");
const tablesRoute = require("./routes/tables.routes");
const authRoute = require("./routes/auth.routes");
const reportRoutes = require("./routes/reports.routes");
const {errorHandler} = require("./middleware/error.middleware");
let swaggerUi = null;

try{
    swaggerUi = require("swagger-ui-express");
}catch(_err){
    swaggerUi = null;
}

const app = express();
const openApiPath = path.join(__dirname, "docs", "openapi.json");

app.use(express.json());
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
