const pool = require("../config/db");
const orderService = require("../services/orders.service");

function toInt(value){
    const n = Number.parseInt(value, 10);
    return Number.isNaN(n) ? null : n;
}

exports.createOrder = async (req, res) => {
    const { table_id, staff_id } = req.body;

    try{
        const order = await orderService.createOrder(table_id, staff_id);

        res.status(201).json(order);
    }catch(err){

         if(err.message === "TABLE_NOT_FOUND"){
            return res.status(404).json({message: "Table not found"});
         }

         if(err.message === "STAFF_NOT_FOUND"){
            res.status(404).json({message: "Staff not found"});
         }

        console.error(err);
        res.status(500).json({message: "Internal Server Error"});
    }
};

exports.addItemOrder = async (req, res) => {
    const orderId = req.params.id
    const { menu_item_id, quantity} = req.body;

    try{
       const item = await orderService.addItemToOrder(
        orderId,
        menu_item_id,
        quantity
       );

       res.status(201).json(item);
    }catch(err){
        
        if(err.message === "INVALID_QUANTITY"){
            return res.status(400).json({message: "Invalid quantity"});
        }

        if(err.message === "ORDER_NOT_FOUND"){
            return res.status(400).json({message: "Order not found"});
        }

        if(err.message === "ORDER_CLOSED"){
            return res.status(400).json({message: "Order already closed"});
        }

        if(err.message === "MENU_NOT_AVAILABLE"){
            return res.status(404).json({message: "Menu item not available"});
        }

        console.error(err);
        res.status(500).json({message: "Internal Server Error"});
    }
};

exports.getAllOrders = async (req, res) => {
    try{
        const orders = await orderService.getAllOrders();
        res.json(orders);
    }catch(err){
        console.error(err);
        res.status(500).json({message: "Internal Server Error"});
    }
};

exports.getOrderById = async (req, res) => {
    const orderId = req.params.id;

    try{
        const order = await orderService.getOrderById(orderId);

        res.json(order);
    }catch(err){
        
        if(err.message === "ORDER_NOT_FOUND"){
            return res.status(404).json({message: "Order not found"});
        }

        console.error(err);
        res.status(500).json({ message: "Internal Server Error"});
    }
};

exports.closeOrder = async (req, res) => {
    const orderId = req.params.id

    try{
        const order = await orderService.closeOrder(orderId);

        res.json(order);
    }catch(err){

        if(err.message === "ORDER_NOT_FOUND_OR_ALREADY_CLOSE"){
            return res.json(400).json({message: "Order not found or already closed"});
        }

        console.error(err);
        res.status(500).json({message: "Internal Server Error"});
    }
};

exports.deleteOrder = async (req, res) => {
    const orderId = req.params.id;

    try{
       const order = await orderService.deleteOrder(orderId);
       
       res.json({message: "Order deleted", order});
    }catch(err){

        if(err.message === "ORDER_NOT_FOUND"){
            return res.status(400).json({message: "Order not found"});
        }

        console.error(err);
        res.status(500).json({message: "Internal Server Error"});
    }
}