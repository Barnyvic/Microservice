import mongoose, { Schema } from 'mongoose';
import type { Customer as ICustomer, Address } from '@shared/types';

export interface CustomerDocument extends Omit<ICustomer, '_id'> {
  _id: any;
}

const addressSchema = new Schema<Address>(
  {
    street: { type: String, required: true, maxlength: 100 },
    city: { type: String, required: true, maxlength: 50 },
    state: { type: String, required: true, maxlength: 50 },
    zipCode: { type: String, required: true, maxlength: 20 },
    country: { type: String, required: true, maxlength: 50 },
  },
  { _id: false }
);

const customerSchema = new Schema<CustomerDocument>(
  {
    customerId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      maxlength: 50,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      match: [/^\+?[\d\s\-\(\)]+$/, 'Please enter a valid phone number'],
    },
    address: {
      type: addressSchema,
      required: true,
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

customerSchema.index({ 'address.city': 1 });
customerSchema.index({ 'address.state': 1 });
customerSchema.index({ createdAt: -1 });

customerSchema.pre('save', function (this: any, next) {
  if (!this.customerId) {
    this.customerId = `cust_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }
  next();
});

export const Customer = mongoose.model<CustomerDocument>(
  'Customer',
  customerSchema
);
