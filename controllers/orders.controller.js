const orderService = require("../services/orders.service");
const asyncHandler = require("../utils/asyncHandler");

exports.createOrder = asyncHandler(async(req, res) => {
    const{table_id, staff_id} = req.body;


    const order = await orderService.createOrder(table_id, staff_id, req.user);
    res.status(201).json({message:"Order Created", order});
});

exports.addItemOrder = asyncHandler(async(req, res) => {
    const orderId = req.params.id;
    const{ menu_item_id, quantity} = req.body;

    const orderItem = await orderService.addItemToOrder(orderId, menu_item_id, quantity, req.user);
    res.status(200).json({message:"Item added to order", orderItem});
});

exports.getAllOrders = asyncHandler(async(req, res) => {
    const orders = await orderService.getAllOrders();
    res.status(200).json({message: "All Orders", orders});
})

exports.getOrderById = asyncHandler(async(req, res) => {
    const orderId = req.params.id;
    const order = await orderService.getOrderById(orderId, req.user);
    res.status(200).json({message:"Order id of " + orderId, order});
});

exports.closeOrder = asyncHandler(async(req, res) => {
    const orderId = req.params.id;

    const order = await orderService.closeOrder(orderId, req.user);
    res.status(200).json({message:"Order of id " + orderId + " is closed", order});
});

exports.deleteOrder = asyncHandler(async(req, res) => {
    const orderId = req.params.id;
    const order = await orderService.deleteOrder(orderId);
    res.status(200).json({message:"Order of id "+ orderId + " deleted", order});
})