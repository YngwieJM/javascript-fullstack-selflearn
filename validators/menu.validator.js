const { z } = require("zod");
const { idParamSchema, paginationSchema } = require("./common.validator");

const menuIdParam = z.object({
    params: z.object({
        id: z.string().regex(/^\d+$/, "Menu id must be a number")
    })
});

const createMenuSchema = z.object({
    body: z.object({
        name: z.string().trim().min(1, "Name is required"),
        category: z.string().trim().min(1, "Category is required"),
        price: z.number().min(0, "Price must be >= 0"),
        is_available: z.boolean().optional()
    })
});

const updateMenuSchema = z.object({
    params: menuIdParam.shape.params,
    body: z.object({
        name: z.string().trim().min(2).max(100).optional(),
        price: z.number().nonnegative().optional(),
        category: z.enum(["FOOD", "DRINK", "DESSERT"]).optional(),
    }).partial().refine((data) => Object.keys(data).length > 0, {message: "At least one field must be provided"}),
});

const updateAvailabilitySchema = z.object({
    params: menuIdParam.shape.params,
    body: z.object({
        is_available: z.boolean()
    })
});

const getMenuByIdSchema = menuIdParam;

module.exports = {
    createMenuSchema,
    updateMenuSchema,
    updateAvailabilitySchema,
    getMenuByIdSchema,
    deleteMenuSchema: idParamSchema,
    getMenuSchema: paginationSchema,
};
