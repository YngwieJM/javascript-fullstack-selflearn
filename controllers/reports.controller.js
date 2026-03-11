const reportsService = require("../services/reports.service");
const asyncHandler = require("../utils/asyncHandler");

exports.getDailySales = asyncHandler(async (req, res) => {

    const data = await reportsService.getDailySales();

    res.json(data);
});

exports.getTopMenu = asyncHandler(async (req, res) => {

    const data = await reportsService.getTopMenuItems();

    res.json(data);
});

exports.getRevenue = asyncHandler(async (req, res) => {

    const data = await reportsService.getRevenue();

    res.json(data);
})