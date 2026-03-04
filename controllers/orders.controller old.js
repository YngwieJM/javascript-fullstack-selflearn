const db = require("../data/db");

function toInt(value){
    const n = Number.parseInt(value, 10);
    return Number.isNaN(n) ? null : n;
}

// Create a new order
exports.createOrder = (req, res) => {
    const {table_id, staff_id} = req.body;

    const table = db.restaurantTables.find (t => t.id === table_id);
    const staff = db.staff.find(s => s.id === staff_id);

    if(!table){
        return res.status(404).json({message: "Table not found"});
    }
    if(!staff){
        return res.status(404).json({message: "Staff member not found"});
    }

    const newOrder = {
        id: db.orders.length + 1,
        table_id,
        staff_id,
        status: "OPEN",
        open_at: new Date()
    };

    db.orders.push(newOrder);

    res.status(201).json(newOrder);
};

// Get all orders
exports.getAllOrders = (req, res) => {
    res.json(db.orders);
};

exports.addItemToOrder = (req, res) => {
    const orderId = parseInt(req.params.id);
    const {menu_item_id, quantity} = req.body;

    const order = db.orders.find(o => o.id === orderId);
    if(!order){
        return res.status(404).json({message: "Order not found"});
    }

    if(order.status !== "OPEN"){
        return res.status(404).json({message: "Order is closed"});
    }

    const menuItem = db.menuItems.find(m => m.id === menu_item_id);
    if(!menuItem || !menuItem.is_available){
        return res.status(404).json({message: "Menu item not available"});
    }

    const newItem = {
        id: db.orderItems.length + 1,
        order_id: orderId,
        menu_item_id,
        quantity,
        price_at_time: menuItem.price
    };

    db.orderItems.push(newItem);

    res.status(201).json(newItem);
};

exports.getOrderById = (req, res) => {
    const orderId = parseInt(req.params.id);

    const order = db.orders.find(o => o.id === orderId);

    if(!order){
        return res.status(404).json({message: "Order not found"});
    }

    const items = db.orderItems.filter(item => item.order_id === orderId).map(item => {
        const menu = db.menuItems.find(m => m.id === item.menu_item_id);

        return{
            id: item.id,
            name: menu.name,
            quantity: item.quantity,
            price: item.price_at_time,
            subtotal: item.quantity * item.price_at_time
        };
    });

    const total = items.reduce((sum, item) => sum + item.subtotal, 0);

    res.json({
        ...order,
        items,
        total
    });
};

exports.closeOrder = (req, res) => {
    const orderId = parseInt(req.params.id);

    const order = db.orders.find(o => o.id === orderId);
    if(!order){
        return res.status(404).json({message: "Order not found"});
    }

    if(order.status === "CLOSED"){
        return res.status(400).json({message: "Order already closed"});
    }

    order.status = "CLOSED";
    order.closed_at = new Date();

    res.json({message: "Order closed successfully", order});
};