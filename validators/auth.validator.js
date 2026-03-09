const { z } = require("zod");

const loginSchema = z.object({
    body: z.object({
        email: z.string().trim().email(),
        password: z.string().trim().min(6)
    })
});

const registerSchema = z.object({
    body: z.object({
        name: z.string().trim().min(2).max(100),
        email: z.string().trim().email(),
        password: z.string().trim().min(6),
        role: z.enum(["WAITER", "BARTENDER"])
    })
});

const forgotPasswordSchema = z.object({
    body: z.object({
        email: z.string().trim().email()    
    })
});

const resetPasswordSchema = z.object({
    body: z.object({
        token: z.string().trim().min(1),
        newPassword: z.string().trim().min(6)
    })
});

module.exports = {
    loginSchema,
    registerSchema,
    forgotPasswordSchema,
    resetPasswordSchema
};
