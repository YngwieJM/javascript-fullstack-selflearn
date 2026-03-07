const { z } = require("zod");

const idParamSchema = z.object({
    params: z.object({
        id:z.string().regex(/^\d+$/)
    })
});

const createStaffSchema = z.object({
    body: z.object({
        name: z.string().min(2).max(100),
        email: z.string().email(),
        password: z.string().min(6),
        role: z.enum(["WAITER", "BARTENDER", "MANAGER"])
    })
});

const updateStaffSchema = z.object({
    params: idParamSchema.shape.params,
    body: z.object({
        name: z.string().min(2).max(100).optional(),
        role: z.enum(["WAITER", "BARTENDER", "MANAGER"]).optional()
    })
});

const updatePasswordSchema = z.object({
    params: idParamSchema.shape.params,
    body: z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(6)
    })
});

const getStaffByIdSchema = idParamSchema;
const deleteStaffSchema = idParamSchema;

module.exports = {
    createStaffSchema,
    updateStaffSchema,
    updatePasswordSchema,
    getStaffByIdSchema,
    deleteStaffSchema
};