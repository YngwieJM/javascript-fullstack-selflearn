require("dotenv").config({path: "./config/.env"});
const express = require("express");
const ordersRoute = require("./routes/orders.routes");
const menuRoute = require("./routes/menu.routes");
const staffRoute = require("./routes/staff.routes");
const tablesRoute = require("./routes/tables.routes");
const authRoute = require("./routes/auth.routes");
const {errorHandler} = require("./middleware/error.middleware");

const app = express();

app.use(express.json());
app.use("/orders", ordersRoute);
app.use("/menu", menuRoute);
app.use("/staff", staffRoute);
app.use("/tables", tablesRoute);
app.use("/auth", authRoute);
app.use(errorHandler);

 const PORT = Number(process.env.PORT) || 3000;

if(require.main === module){
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    })
}

module.exports = app;