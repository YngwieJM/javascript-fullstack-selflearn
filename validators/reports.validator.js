const { z } = require("zod");

const dateRangeQuerySchema = z.object({
    query: z.object({
        start_date: z.string().date().optional(),
        end_date: z.string().date().optional()
    })
});

const hourlySalesQuerySchema = z.object({
    query: z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    })
});

module.exports = {
    dateRangeQuerySchema,
    hourlySalesQuerySchema
};
