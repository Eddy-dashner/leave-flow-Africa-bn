import mongoose, { Schema, Document } from 'mongoose';
import { ILeaveType } from '../types';

export interface LeaveTypeDocument extends ILeaveType, Document {}

const LeaveTypeSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    description: {
      type: String,
      trim: true,
    },
    requiresDocumentation: {
      type: Boolean,
      default: false,
    },
    defaultDaysPerYear: {
      type: Number,
      default: 0,
    },
    accruesMonthly: {
      type: Boolean,
      default: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<LeaveTypeDocument>('LeaveType', LeaveTypeSchema);