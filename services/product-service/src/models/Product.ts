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
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform(_doc, ret) {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes for better query performance
productSchema.index({ productId: 1 });
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ price: 1 });
productSchema.index({ stock: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ createdAt: -1 });

// Compound indexes for common queries
productSchema.index({ category: 1, brand: 1 });
productSchema.index({ category: 1, price: 1 });
productSchema.index({ isActive: 1, stock: 1 });

// Pre-save middleware to generate productId if not provided
productSchema.pre('save', function (next) {
  if (!this.productId) {
    this.productId = `prod_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }
  next();
});

// Method to check if product is available
productSchema.methods.isAvailable = function (quantity = 1): boolean {
  return this.isActive && this.stock >= quantity;
};

// Method to reserve stock
productSchema.methods.reserveStock = async function (
  quantity: number
): Promise<boolean> {
  if (!this.isAvailable(quantity)) {
    return false;
  }

  const result = await this.constructor.updateOne(
    {
      _id: this._id,
      stock: { $gte: quantity },
      isActive: true,
    },
    { $inc: { stock: -quantity } }
  );

  return result.modifiedCount === 1;
};

// Method to release reserved stock
productSchema.methods.releaseStock = async function (
  quantity: number
): Promise<void> {
  await this.constructor.updateOne(
    { _id: this._id },
    { $inc: { stock: quantity } }
  );
};

export const Product = mongoose.model<ProductDocument>(
  'Product',
  productSchema
);




