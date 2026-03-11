const pool = require("../config/db");
const menuService = require("../services/menu.service");
const asyncHandler = require("../utils/asyncHandler");

exports.createMenuItem = asyncHandler(async(req, res, next) => {
    const {name, category, price} = req.body

    const item = await menuService.createMenuItem(name, category, price);
    res.json(item)
});

exports.getAllMenuItems = asyncHandler(async(req, res) => {
    const items = await menuService.getAllMenuItems();
    res.json(items);
});

exports.getMenuItemById = asyncHandler(async(req, res) => {
    const id = req.params.id;
    const item = await menuService.getMenuItemById(id);
    res.json(item);
});

exports.updateMenuItem = asyncHandler(async(req, res) => {
    const id = req.params.id;
    const {name, category, price} = req.body;
    const item = await menuService.updateMenuItem(id, name, category, price);
    res.json(item);
});

exports.toggleAvailability = asyncHandler(async(req, res) => {
    const id = req.params.id;
    const { is_available } = req.body;
    const item = await menuService.toggleAvailability(id, is_available);
    res.json(item)
});

exports.deleteMenuItem = asyncHandler(async(req, res) => {
    const id = req.params.id;

    const item = await menuService.deleteMenuItem(id);
    res.json({message : "Menu item deleted", item});
})
