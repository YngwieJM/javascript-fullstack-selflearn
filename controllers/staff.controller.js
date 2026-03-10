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
    const id = Number(req.params.id);
    const {currentPassword, newPassword} = req.body;

    const isManager = req.user.role === "MANAGER";
    const isSelf = req.user.id === id;

    if(!isManager && !isSelf){
        return res.status(403).json({message:"Access forbidden"});
    }

    const skipCurrentCheck = isManager && !isSelf;

    if(!skipCurrentCheck && !currentPassword){
        return res.status(400).json({message: "Current password is required"})
    }

    await staffService.updatePassword(id, currentPassword, newPassword, {skipCurrentCheck});
    res.status(200).json({message: "Password updated successfully"}); 
});


exports.deleteStaff = asyncHandler(async(req, res) => {
    const id = req.params.id;
     await staffService.deleteStaff(id);
    res.status(204).send();
});
