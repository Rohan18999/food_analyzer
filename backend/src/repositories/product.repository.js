import { Product } from '../db/schemas/product.schema.js';
import { isDatabaseConnected } from '../config/database.js';

export async function createProduct(productData) {
  if (!isDatabaseConnected()) return null;
  return Product.create(productData);
}

export async function findProductById(id) {
  if (!isDatabaseConnected()) return null;
  return Product.findById(id);
}
