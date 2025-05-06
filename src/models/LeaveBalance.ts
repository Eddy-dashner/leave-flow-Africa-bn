import mongoose, { Schema, Document } from 'mongoose';
import { ILeaveBalance, ILeaveAdjustment } from '../types';

export interface LeaveBalanceDocument extends ILeaveBalance, Document {}

const LeaveAdjustmentSchema: Schema = new Schema(
  {
    days: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    adjustedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    adjustedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  }
);

const LeaveBalanceSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    leaveTypeId: {
      type: Schema.Types.ObjectId,
      ref: 'LeaveType',
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    totalDays: {
      type: Number,
      default: 0,
    },
    usedDays: {
      type: Number,
      default: 0,
    },
    pendingDays: {
      type: Number,
      default: 0,
    },
    adjustments: [LeaveAdjustmentSchema],
    carryOver: {
      type: Number,
      default: 0,
    },
    expiryDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for unique leave balance per user, leave type and year
LeaveBalanceSchema.index({ userId: 1, leaveTypeId: 1, year: 1 }, { unique: true });

export default mongoose.model<LeaveBalanceDocument>('LeaveBalance', LeaveBalanceSchema);