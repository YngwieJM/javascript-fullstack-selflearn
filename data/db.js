let staff = [
    {id: 1, name: "John", role: "WAITER", created_at: new Date()},
    {id: 2, name: "anna", role: "BARTENDER", created_at: new Date()}
];

let restaurantTables = [
    {id: 1, table_number: "VIP1", capacity: 4},
    {id: 2, table_number: "T1", capacity: 2}
];

let menuItems = [
    {id: 1, name: "Burger", category: "food", price: 80, is_available: true},
    {id: 2, name: "Beer", category: "drink", price: 35, is_available: true}
];

let orders = [];
let orderItems = [];

module.exports = {
    staff, restaurantTables, menuItems, orders, orderItems
}''