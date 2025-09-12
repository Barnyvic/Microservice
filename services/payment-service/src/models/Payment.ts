import mongoose, { Document, Schema } from 'mongoose';
import type {
  Transaction as ITransaction,
  TransactionStatus,
} from '@shared/types';

export interface PaymentDocument extends Omit<ITransaction, '_id'>, Document {
  _id: mongoose.Types.ObjectId;
  idempotencyKey?: string; // For idempotency support
}

const paymentSchema = new Schema<PaymentDocument>(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      maxlength: 50,
    },
    orderId: {
      type: String,
      required: true,
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
    amount: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Amount must be an integer (in cents)',
      },
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(TransactionStatus),
      default: TransactionStatus.PENDING,
      index: true,
    },
    paymentMethod: {
      type: String,
      default: 'demo_payment',
    },
    idempotencyKey: {
      type: String,
      index: true,
      sparse: true, // Allow multiple null values
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret._id;
        delete ret.__v;
        delete ret.idempotencyKey; // Don't expose in API responses
        return ret;
      },
    },
    toObject: {
      transform(_doc, ret) {
        delete ret._id;
        delete ret.__v;
        delete ret.idempotencyKey; // Don't expose in API responses
        return ret;
      },
    },
  }
);

// Indexes for better query performance
paymentSchema.index({ transactionId: 1 });
paymentSchema.index({ orderId: 1 });
paymentSchema.index({ customerId: 1 });
paymentSchema.index({ productId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ idempotencyKey: 1 }, { sparse: true });

// Compound indexes for common queries
paymentSchema.index({ customerId: 1, status: 1 });
paymentSchema.index({ orderId: 1, status: 1 });

// Idempotency: Ensure uniqueness of idempotencyKey when provided
paymentSchema.index(
  { idempotencyKey: 1 },
  {
    unique: true,
    sparse: true,
    name: 'idempotency_unique',
  }
);

// Pre-save middleware to generate transactionId if not provided
paymentSchema.pre('save', function (next) {
  if (!this.transactionId) {
    this.transactionId = `txn_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }
  next();
});

export const Payment = mongoose.model<PaymentDocument>(
  'Payment',
  paymentSchema
);



