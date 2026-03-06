const pool = require("../config/db");
const staffService = require("../services/staff.service");

exports.createStaff = async(req, res, next) => {
    const {name, email, password, role} = req.body;

    try{
        const staff = await staffService.createStaff(name, email, password, role);
        res.status(201).json({message: "STAFF_CREATED", staff});
    }catch(err){
        next(err);
    }
    
};

exports.getAllStaff = async (req, res, next) => {
    try{
       const staff = await staffService.getAllStaff();

       res.status(200).json(staff)
    }catch(err){
        next(err);
    }
};

exports.getStaffById = async (req, res, next) => {
    const id = req.params.id;

    try{
        const staff = await staffService.getStaffById(id);

        res.status(200).json(staff);
    }catch(err){

        next(err);
    }
};

exports.updateStaff = async (req, res, next) => {
    const id = req.params.id;
    const{name, email, role} = req.body;

    try{
        const staff = await staffService.updateStaff(id, name, email, role);

        res.status(200).json(staff);
    }catch(err){

        next(err);
    }
};

exports.updatePassword = async (req, res, next) => {
    const id = req.params.id;
    const {currentPassword, newPassword} = req.body;

    try{
        const staff = await staffService.updatePassword(id, currentPassword, newPassword);
        res.json(staff);
    }catch(err){
    next(err);
    }
};


exports.deleteStaff = async (req, res, next) => {
    const id = req.params.id;

    try{
        const staff = await staffService.deleteStaff(id);

        res.json({message: "Staff deleted successfully", staff});
    }catch (err){
        next(err);
    }
};