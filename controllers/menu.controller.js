const pool = require("../config/db");
const menuService = require("../services/menu.service");

exports.createMenuItem = async(req, res, next) => {
    const {name, category, price} = req.body;

    try{
        const item = await menuService.createMenuItem(name, category, price);

        res.status(201).json(item);
    }catch(err){

        next(err);
    }
};

exports.getAllMenuItems = async (req, res, next) => {
    try{
        const item = await menuService.getAllMenuItems();
        res.json(item);
    }catch(err){
        next(err);
    }
};

exports.getMenuItemById = async (req, res, next) => {
    const id = req.params.id;

    try{
        const item = await menuService.getMenuItemById(id);
        res.json(item);
    }catch(err){
        next(err);
    }
};

exports.updateMenuItem = async (req, res, next) => {
    const id = req.params.id;
    const {name, category, price} = req.body;

    try{
        const item = await menuService.updateMenuItem(id, name, category, price);

        res.json(item);
    }catch(err){
        next(err);
    }
};

exports.toggleAvailablity = async (req, res, next) => {
    const id = req.params.id;
    const {is_available} = req.body;

    try{
        const item = await menuService.toggleAvailability(id, is_available);
        res.json(item);
    }catch(err){
        next(err);
    }
}

exports.deleteMenuItem = async (req, res, next) => {
    const id = req.params.id

    try{
        const item = await menuService.deleteMenuItem(id);
        res.json({message: "Item deleted successfully", item});

    }catch(err){
        next(err);
    }
};