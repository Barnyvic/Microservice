import mongoose, { Document, Schema } from 'mongoose';
import type { Product as IProduct, Dimensions } from '@shared/types';

export interface ProductDocument extends Omit<IProduct, '_id'>, Document {
  _id: mongoose.Types.ObjectId;
}

const dimensionsSchema = new Schema<Dimensions>(
  {
    length: { type: Number, required: true, min: 0 },
    width: { type: Number, required: true, min: 0 },
    height: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const productSchema = new Schema<ProductDocument>(
  {
    productId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      maxlength: 50,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      index: 'text',
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
      index: 'text',
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Price must be an integer (in cents)',
      },
    },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
      index: true,
    },
    brand: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
      index: true,
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Stock must be an integer',
      },
    },
    specifications: {
      type: Schema.Types.Mixed,
      default: {},
    },
    images: [
      {
        type: String,
        trim: true,
      },
    ],
    weight: {
      type: Number,
      required: true,
      min: 0,
    },
    dimensions: {
      type: dimensionsSchema,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete (ret as any)._id;
        delete (ret as any).__v;
        return ret;
      },
    },
    toObject: {
      transform(_doc, ret) {
        delete (ret as any)._id;
        delete (ret as any).__v;
        return ret;
      },
    },
  }
);

productSchema.index({ productId: 1 });
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ price: 1 });
productSchema.index({ stock: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ createdAt: -1 });

productSchema.index({ category: 1, brand: 1 });
productSchema.index({ category: 1, price: 1 });
productSchema.index({ isActive: 1, stock: 1 });

productSchema.pre('save', function (next) {
  if (!this.productId) {
    this.productId = `prod_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }
  next();
});

productSchema.methods.isAvailable = function (quantity = 1): boolean {
  return this.isActive && this.stock >= quantity;
};

productSchema.methods.reserveStock = async function (
  quantity: number
): Promise<boolean> {
  if (!this.isAvailable(quantity)) {
    return false;
  }

  const result = await (this.constructor as any).updateOne(
    {
      _id: this._id,
      stock: { $gte: quantity },
      isActive: true,
    },
    { $inc: { stock: -quantity } }
  );

  return result.modifiedCount === 1;
};

productSchema.methods.releaseStock = async function (
  quantity: number
): Promise<void> {
  await (this.constructor as any).updateOne(
    { _id: this._id },
    { $inc: { stock: quantity } }
  );
};

export const Product = mongoose.model<ProductDocument>(
  'Product',
  productSchema
);
