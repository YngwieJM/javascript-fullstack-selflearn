const { z } = require("zod");

const createStaffSchema = z.object({
    body: z.object({
        name: z.string().min(2).max(100),
        email: z.string().email(),
        password: z.string().min(6),
        role: z.enum(["WAITER", "BARTENDER", "MANAGER"])
    })
});

const updateStaffSchema = z.object({
    params: z.object({
        id: z.string().regex(/^\d+$/)
    }),
    body: z.object({
        name: z.string().min(2).max(100).optional(),
        role: z.enum(["WAITER", "BARTENDER", "MANAGER"]).optional()
    })
});

const updatePasswordSchema = z.object({
    params: z.object({
        id: z.string().regex(/^\d+$/)
    }),
    body: z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(6)
    })
});

module.exports = {
    createStaffSchema,
    updateStaffSchema,
    updatePasswordSchema
};