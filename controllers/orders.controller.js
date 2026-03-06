const pool = require("../config/db");
const orderService = require("../services/orders.service");

function toInt(value){
    const n = Number.parseInt(value, 10);
    return Number.isNaN(n) ? null : n;
}

exports.createOrder = async (req, res, next) => {
    const { table_id, staff_id } = req.body;

    try{
        const order = await orderService.createOrder(table_id, staff_id);

        res.status(201).json(order);
    }catch(err){
        next(err);
    }
};

exports.addItemOrder = async (req, res, next) => {
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
        next(err)
    }
};

exports.getAllOrders = async (req, res, next) => {
    try{
        const orders = await orderService.getAllOrders();
        res.json(orders);
    }catch(err){
        next(err);
    }
};

exports.getOrderById = async (req, res, next) => {
    const orderId = req.params.id;

    try{
        const order = await orderService.getOrderById(orderId);

        res.json(order);
    }catch(err){
       next(err);
    }
}

exports.closeOrder = async (req, res, next) => {
    const orderId = req.params.id

    try{
        const order = await orderService.closeOrder(orderId);

        res.json(order);
    }catch(err){
        next(err);
    }
}

exports.deleteOrder = async (req, res, next) => {
    const orderId = req.params.id;

    try{
       const order = await orderService.deleteOrder(orderId);
       
       res.json({message: "Order deleted", order});
    }catch(err){
        next(err);
    }
}