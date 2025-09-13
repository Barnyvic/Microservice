import mongoose, { Document, Schema } from 'mongoose';
import type { Transaction as ITransaction } from '@shared/types';
import { TransactionStatus } from '@shared/types';

export interface TransactionHistoryDocument
  extends Omit<ITransaction, '_id'>,
    Document {
  _id: mongoose.Types.ObjectId;
  processedAt: Date;
  messageId?: string;
}

const transactionHistorySchema = new Schema<TransactionHistoryDocument>(
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
    },
    paymentMethod: {
      type: String,
      default: 'demo_payment',
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },
    messageId: {
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
        delete ret.messageId;
        return ret;
      },
    },
    toObject: {
      transform(_doc, ret) {
        delete (ret as any)._id;
        delete (ret as any).__v;
        delete ret.messageId;
        return ret;
      },
    },
  }
);

transactionHistorySchema.index({ transactionId: 1 });
transactionHistorySchema.index({ orderId: 1 });
transactionHistorySchema.index({ customerId: 1 });
transactionHistorySchema.index({ productId: 1 });
transactionHistorySchema.index({ status: 1 });
transactionHistorySchema.index({ processedAt: -1 });
transactionHistorySchema.index({ createdAt: -1 });
transactionHistorySchema.index({ messageId: 1 }, { sparse: true });

transactionHistorySchema.index({ customerId: 1, status: 1 });
transactionHistorySchema.index({ orderId: 1, status: 1 });
transactionHistorySchema.index({ customerId: 1, processedAt: -1 });

transactionHistorySchema.index(
  { messageId: 1 },
  {
    unique: true,
    sparse: true,
    name: 'message_deduplication',
  }
);

export const TransactionHistory = mongoose.model<TransactionHistoryDocument>(
  'TransactionHistory',
  transactionHistorySchema
);
