import mongoose, { Document, Schema } from 'mongoose';
import type { Order as IOrder, OrderStatus } from '@shared/types';

export interface OrderDocument extends Omit<IOrder, '_id'>, Document {
  _id: mongoose.Types.ObjectId;
}

const orderSchema = new Schema<OrderDocument>(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      maxlength: 50,
    },
    customerId: {
      type: String,
      required: true,
      index: true,
      maxlength: 50,
    },
    productId: {
      type: String,
      required: true,
      index: true,
      maxlength: 50,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: 'Quantity must be an integer',
      },
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Amount must be an integer (in cents)',
      },
    },
    orderStatus: {
      type: String,
      required: true,
      enum: Object.values(OrderStatus),
      default: OrderStatus.PENDING,
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
orderSchema.index({ orderId: 1 });
orderSchema.index({ customerId: 1 });
orderSchema.index({ productId: 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ createdAt: -1 });

// Compound indexes for common queries
orderSchema.index({ customerId: 1, orderStatus: 1 });
orderSchema.index({ customerId: 1, createdAt: -1 });

// Pre-save middleware to generate orderId if not provided
orderSchema.pre('save', function (next) {
  if (!this.orderId) {
    this.orderId = `ord_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }
  next();
});

export const Order = mongoose.model<OrderDocument>('Order', orderSchema);



