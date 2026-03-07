const { z } = require("zod");

const loginSchema = z.object({
    body: z.object({
        email: z.string().email(),
        password: z.string().min(6)
    })
});

const registerSchema = z.object({
    body: z.object({
        name: z.string().min(2).max(100),
        email: z.string().email(),
        password: z.string().min(6),
        role: z.enum(["WAITER", "BARTENDER"])
    })
});

module.exports = {
    loginSchema,
    registerSchema
};