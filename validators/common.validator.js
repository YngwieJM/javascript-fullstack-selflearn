const { z } = require("zod");
const idParamSchema = z.object({
    params: z.object({
        id: z.string().regex(/^\d+$/, "ID must be a number")
    })
});

const paginationSchema = z.object({
    query: z.object({
        page: z.coerce.number().int().positive().optional().default(1),
        limit: z.coerce.number().int().positive().max(100).default(10)
    })
});

module.exports = {
    idParamSchema,
    paginationSchema
}