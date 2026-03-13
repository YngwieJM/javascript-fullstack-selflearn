const { z } = require("zod");

const dataQuerySchema = z.object({
    query: z.object({
        star_date: z.string().date().optional(),
        end_dat: z.string().date().optional()
    })
});

const hourlySalesQuerySchema = z.object({
    query: z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    })
});

module.exports = {
    dataQuerySchema,
    hourlySalesQuerySchema
};
