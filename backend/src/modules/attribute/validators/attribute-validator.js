const { z } = require('zod');
const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(1000).optional(),
  type: z.enum(['select', 'color', 'size', 'text']).optional(),
  isRequired: z.boolean().optional(),
  sortOrder: z.number().int().min(0).default(0),
});
const updateGroupSchema = createGroupSchema.partial().extend({ isActive: z.boolean().optional() });
const addValueSchema = z.object({
  name: z.string().trim().min(1).max(255),
  value: z.string().trim().max(255).optional(),
  colorCode: z.string().trim().max(50).optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  priceAdjustment: z.number().optional(),
  sortOrder: z.number().int().min(0).default(0),
  affectsName: z.boolean().default(false),
  nameTemplate: z.string().trim().max(500).optional(),
});
const previewNameSchema = z.object({
  baseName: z.string().trim().min(1),
  selectedAttributes: z.array(z.union([z.number(), z.string()])).default([]),
  separator: z.string().max(10).default(' '),
  includeDetails: z.boolean().default(false),
});
module.exports = { createGroupSchema, updateGroupSchema, addValueSchema, previewNameSchema };
