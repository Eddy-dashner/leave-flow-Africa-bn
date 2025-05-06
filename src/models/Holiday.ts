import mongoose, { Schema, Document } from 'mongoose';
import { IHoliday } from '../types';

export interface HolidayDocument extends IHoliday, Document {}

const HolidaySchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<HolidayDocument>('Holiday', HolidaySchema);