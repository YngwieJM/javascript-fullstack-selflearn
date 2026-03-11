const { z } = require("zod");
const { idParamSchema, paginationSchema } = require("./common.validator");

const createStaffSchema = z.object({
    body: z.object({
        name: z.string().trim().min(2).max(100),
        email: z.string().trim().email(),
        password: z.string().trim().min(6),
        role: z.enum(["WAITER", "BARTENDER", "MANAGER"])
    })
});

const updateStaffSchema = z.object({
    params: idParamSchema.shape.params,
    body: z.object({
        name: z.string().trim().min(2).max(100).optional(),
        email: z.string().trim().email().optional(),
        role: z.enum(["WAITER", "BARTENDER", "MANAGER"]).optional()
    }).refine((data) => Object.keys(data).length > 0, {
        message: "At least one field must be provided"
    })
});

const updatePasswordSchema = z.object({
    params: idParamSchema.shape.params,
    body: z.object({
        currentPassword: z.string().trim().optional(),
        newPassword: z.string().trim().min(6)
    })
});

const getStaffByIdSchema = idParamSchema;
const deleteStaffSchema = idParamSchema;

module.exports = {
    createStaffSchema,
    updateStaffSchema,
    updatePasswordSchema,
    getStaffByIdSchema: idParamSchema,
    deleteStaffSchema: idParamSchema,
    getStaffSchema: paginationSchema
};
