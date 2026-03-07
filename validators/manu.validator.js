const { z } = require("zod");

const menudIdParam = z.object({
    params: z.object({
        id: z.string().regex(/^\d+$/, "Menu id must be a number")
    })
});

const createMenuSchema = z.object({
    body: z.object({
        name: z.string().min(2).max(100),
        price: z.number().positive(),
        category: z.enum(["FOOD", "DRINK", "DESSERT"]),
        isAvailable: z.boolean().optional()
    })
});

const updateMenuSchema = z.object({
    params: menudIdParam.shape.params,
    body: z.object({
        name: z.string().min(2).max(100).optional(),
        price: z.number().positive().optional(),
        category: z.enum(["FOOD", "DRINK", "DESSERT"]).optional(),
    }).partial().refine((data) => Object.keys(data).length > 0, {message: "At least one field must be provided"}),
});

const updateAvailabilitySchema = z.object({
    params: menudIdParam.shape.params,
    body: z.object({
        is_available: z.boolean()
    })
});

const getMenuByIdSchema = menudIdParam;

module.exports = {
    createMenuSchema,
    updateMenuSchema,
    updateAvailabilitySchema,
    getMenuByIdSchema
};