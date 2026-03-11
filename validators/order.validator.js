const { z } = require("zod");

const orderIdParam = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "Order id must be a number")
  })
});

const orderItemParam = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "Order id must be a number"),
    itemId: z.string().regex(/^\d+$/, "Item id must be a number")
  })
});

const createOrderSchema = z.object({
  body: z.object({
    table_id: z.number().int().positive(),
    staff_id: z.number().int().positive()
  })
});

const addItemSchema = z.object({
  params: orderIdParam.shape.params,
  body: z.object({
    menu_item_id: z.number().int().positive(),
    quantity: z.number().int().positive()
  })
});

const deleteItemSchema = orderIdParam;

const closeOrderSchema = orderIdParam;

module.exports = {
  createOrderSchema,
  getOrderByIdSchema: orderIdParam,
  addItemSchema,
  deleteItemSchema,
  closeOrderSchema
};