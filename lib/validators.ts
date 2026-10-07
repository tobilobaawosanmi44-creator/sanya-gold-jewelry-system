import { z } from 'zod';

export const customerSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short'),
  phone: z.string().trim().min(7, 'Enter a valid phone number'),
  email: z.string().trim().email('Enter a valid email address').optional().or(z.literal('')),
  address: z.string().trim().optional(),
});

export const productSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short'),
  sku: z.string().trim().min(2, 'SKU is too short'),
  category: z.string().trim().min(1, 'Choose a category'),
  description: z.string().trim().optional(),
  // Reference price only (optional). Gold prices move, so the real price is typed on every receipt.
  price: z.coerce.number().min(0, 'Price cannot be negative').default(0),
  stockQty: z.coerce.number().int().min(0, 'Stock cannot be negative'),
});
