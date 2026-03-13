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
});

exports.getSalesByStaff = asyncHandler(async(req, res) => {

    const data = await reportsService.getSalesByStaff();

    res.json(data);
});

exports.getSalesByCategory = asyncHandler(async(req, res) => {

    const data = await reportsService.getSalesByCategory();

    res.json(data);
});

exports.getHourlySales = asyncHandler(async(req, res) => {

    const data = await reportsService.getHourlySales(req.query.date);

    res.json(data);
});

