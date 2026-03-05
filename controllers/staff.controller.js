const pool = require("../config/db");
const staffService = require("../services/staff.service");

exports.createStaff = async(req, res) => {
    const {name, email, password, role} = req.body;

    try{
        const staff = await staffService.createStaff(name, email, password, role);
        res.status(201).json({message: "STAFF_CREATED", staff});
    }catch(err){

        if(err.message === "INVALID_STAFF_DATA"){
            res.stats(400).json({message: "Invalid staff data"})
        }
        console.error(err);
        res.status(500).json({message:"Internal Server Error"});
    }
    
};

exports.getAllStaff = async (req, res) => {
    try{
       const staff = await staffService.getAllStaff();

       res.status(200).json(staff)
    }catch(err){

        console.error(err);
        res.status(500).json({message: "Internal Server Error"});
    }
};

exports.getStaffById = async (req, res) => {
    const id = req.params.id;

    try{
        const staff = await staffService.getStaffById(id);

        res.status(200).json(staff);
    }catch(err){

        if(err.message === "STAFF_NOT_FOUND"){
            res.status(404).json({message: "Staff not found"});
        }
        console.error(err);
        res.status(500).json({message: "Internal Server Error"});
    }
};

exports.updateStaff = async (req, res) => {
    const id = req.params.id;
    const{name, email, role} = req.body;

    try{
        const staff = await staffService.updateStaff(id, name, email, role);

        res.status(200).json(staff);
    }catch(err){

        if(err.message === "STAFF_NOT_FOUND"){
            res.status(404).json({message:"Staff not found"})
        }
        console.error(err);
        res.status(500).json({message: "Internal Server Error"});
    }
};

exports.updatePassword = async (req, res) => {
    const id = req.params.id;
    const {currentPassword, newPassword} = req.body;

    try{
        const staff = await staffService.updatePassword(id, newPassword, currentPassword);
        res.json(staff);
    }catch(err){
    if(err.message === "STAFF_NOT_FOUND"){
        return res.status(404).json({message: "Staff not found"})
    }

    if(err.message === "INVALID_PASSWORD"){
        return res.status (401).json({message: "Wrong Password"});
    }

    res.status(500).json({message: "Internal Server Error"});
    }
};


exports.deleteStaff = async (req, res) => {
    const id = req.params.id;

    try{
        const staff = staffService.deleteStaff(id);

        res.json({message: "Staff deleted successfully", staff});
    }catch (err){
        console.error(err);

        if(err.code === "23503"){
            return res.status(400).json({message: "Cannot delete staff member associated with an order"});
        }

        res.status(500).json({message: "Internal Server Error"});
    }
};