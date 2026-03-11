const { z } = require("zod");

const idParam = z.object({
    params: z.object({
        id: z.string().regex(/^\d+$/)
    })
});

const createTableSchema = z.object({
    body: z.object({
        table_number: z.string().min(2).max(20),
        capacity: z.number().int().positive()
    })
});

const updateTableSchema = z.object({
    params: idParam.shape.params,
    body: z.object({
        table_number: z.string().min(2).max(20).optional(),
        capacity: z.number().int().positive().optional()
    }).refine(data => data.table_number || data.capacity, {
        message: "At least one field must be provided"
    }
)
});

const getTableByIdSchema = idParam;

const deleteTableSchema = idParam;

module.exports = {
    createTableSchema,
    updateTableSchema,
    getTableByIdSchema,
    deleteTableSchema
};