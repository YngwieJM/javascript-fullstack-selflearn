const pool = require("../config/db");
const staffService = require("../services/staff.service");
const asyncHandler = require("../utils/asyncHandler");

exports.createStaff = asyncHandler(async(req, res) => {
    const{ name, email, password, role } = req.body;

    const staff = await staffService.createStaff(name, email, password, role);

    res.status(201).json({ message: "STAFF_CREATED", staff });
});

exports.getAllStaff = asyncHandler(async(req, res) => {
    const staff = await staffService.getAllStaff();

    res.json(staff)
});

exports.getStaffById = asyncHandler(async(req, res) => {
    const id = req.params.id;
    const staff = await staffService.getStaffById(id);

    res.json(staff);
});

exports.updateStaff = asyncHandler(async(req, res) => {
    const id = req.params.id;
    const {name, email, role} = req.body;

    const staff = await staffService.updateStaff(id, name, email, role );

    res.json(staff);
});

exports.updatePassword = asyncHandler(async(req, res) => {
    const id = req.params.id;
    const {currentPassword, newPassword} = req.body;

    const staff = await staffService.updatePassword(id, currentPassword, newPassword);
    res.status(200).json({message: "Password updated successfully"}); 
})


exports.deleteStaff = asyncHandler(async(req, res) => {
    const id = req.params.id;
     await staffService.deleteStaff(id);
    res.status(204).send();
})