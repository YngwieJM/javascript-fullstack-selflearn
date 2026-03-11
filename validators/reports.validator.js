const { z } = require("zod");

const dataQuerySchema = z.object({
    query: z.object({
        star_date: z.string().date().optional(),
        end_dat: z.string().date().optional()
    })
});

module.exports = {
    dataQuerySchema
};