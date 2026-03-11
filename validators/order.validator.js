const { z } = require("zod");
const { idParamSchema } = require("./common.validator");

const orderIdParam = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "Order id must be a number")
  })
});

const orderItemParam = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "Order item id must be a number"),
    itemId: z.string().regex(/^\d+$/, "Menu item id must be a number")
  })
})


const createOrderSchema = z.object({
  body: z.object({
    table_id: z.number().int().positive(),
    staff_id: z.number().int().positive().optional()
  })
});

const addItemSchema = z.object({
  params: orderIdParam.shape.params,
  body: z.object({
    menu_item_id: z.number().int().positive(),
    quantity: z.number().int().positive()
  })
});

const getOrderSchema = z.object({
  query: z.object({
    status: z.enum(["OPEN", "CLOSED"]).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional()
  })
});

const deleteItemSchema = orderItemParam;

const closeOrderSchema = orderIdParam;

module.exports = {
  createOrderSchema,
  getOrderByIdSchema: orderIdParam,
  addItemSchema,
  deleteItemSchema,
  closeOrderSchema,
  deleteOrderSchema: idParamSchema,
  getOrderSchema
};
