const pool = require("../config/db");
const menuService = require("../services/menu.service");

exports.createMenuItem = async(req, res) => {
    const {name, category, price} = req.body;

    try{
        const item = await menuService.createMenuItem(name, category, price);

        res.status(201).json(item);
    }catch(err){

        if(err.message === "INVALID_MENU_DATA"){
            return res.status(400).json({message: "Invalid Menu Item"});
        }
        console.error(err);
        res.status(500).json({message: "Internal Server Error"});
    }
};

exports.getAllMenuItems = async (req, res) => {
    try{
        const item = await menuService.getAllMenuItems();
        res.json(item);
    }catch(err){
        console.error(err);
        res.status(500).jsone({message: "Internal Server Error"});
    }
};

exports.getMenuItemById = async (req, res) => {
    const id = req.params.id;

    try{
        const item = await menuService.getMenuItemById();
        res.json(item);
    }catch(err){

        if(err.message === "MENU_ITEM_NOT_FOUND"){
            return res.json(404).json({message: "Menu Item not found"});
        }
        console.error(err);
        res.status(500).json({message: "Internal Server Error"});
    }
};

exports.updateMenuItem = async (req, res) => {
    const id = req.params.id;
    const {name, category, price} = req.body;

    try{
        const item = await menuService.updateMenuItem(id, name, category, price);

        res.json(item);
    }catch(err){

        if(err.message ==="MENU_ITEM_NOT_FOUND"){
            return res.status(404).json({message: "Menu item not found"});
        }
        console.error(err);
        res.status({message: "Internal Server Error"});
    }
};

exports.toggleAvailablity = async (req, res) => {
    const id = req.params.id;
    const {is_available} = req.body;

    try{
        const item = await menuService.toggleAvailability(id, is_available);
        res.json(item);
    }catch(err){
        if(err.message === "MENU_ITEM_NOT_FOUND"){
            return res.status(404).json({message:"Menu item not found"})
        }

        console.error(err);
        res.status(500).json({message:"Internal Server Error"});
    }
}

exports.deleteMenuItem = async (req, res) => {
    const id = req.params.id

    try{
        const item = await menuService.deleteMenuItem(id);
        res.json({message: "Item deleted successfully", item});

    }catch(err){

        if(err.message === "MENU_ITEM_NOT_FOUND"){
            return res.status(404).json({message:"Menu item not found"})
            }

        console.error(err);
        res.status(500).json({message: "Internal Server Error"});
    }
};