import mongoose, { Document, Schema } from 'mongoose';
import { Transaction as ITransaction, TransactionStatus } from '@shared/types';

export interface PaymentDocument extends Omit<ITransaction, '_id'>, Document {
  _id: mongoose.Types.ObjectId;
  idempotencyKey?: string;
}

const paymentSchema = new Schema<PaymentDocument>(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
      maxlength: 50,
    },
    orderId: {
      type: String,
      required: true,
      maxlength: 50,
    },
    customerId: {
      type: String,
      required: true,
      maxlength: 50,
    },
    productId: {
      type: String,
      required: true,
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
    },
    paymentMethod: {
      type: String,
      default: 'demo_payment',
    },
    idempotencyKey: {
      type: String,
      sparse: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete (ret as any)._id;
        delete (ret as any).__v;
        delete (ret as any).idempotencyKey;
      },
    },
    toObject: {
      transform(_doc, ret) {
        delete (ret as any)._id;
        delete (ret as any).__v;
        delete (ret as any).idempotencyKey;
      },
    },
  }
);

paymentSchema.index({ transactionId: 1 });
paymentSchema.index({ orderId: 1 });
paymentSchema.index({ customerId: 1 });
paymentSchema.index({ productId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ idempotencyKey: 1 }, { sparse: true });

paymentSchema.index({ customerId: 1, status: 1 });
paymentSchema.index({ orderId: 1, status: 1 });

paymentSchema.index(
  { idempotencyKey: 1 },
  {
    unique: true,
    sparse: true,
    name: 'idempotency_unique',
  }
);

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
