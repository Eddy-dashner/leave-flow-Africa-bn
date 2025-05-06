export enum LeaveStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled'
}

export enum LeaveType {
  PTO = 'pto',
  SICK = 'sick',
  COMPASSIONATE = 'compassionate',
  MATERNITY = 'maternity',
  PATERNITY = 'paternity',
  UNPAID = 'unpaid',
  OTHER = 'other'
}

export enum UserRole {
  STAFF = 'staff',
  MANAGER = 'manager',
  ADMIN = 'admin'
}

export interface IUser {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  department: string;
  profilePicture?: string;
  managerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILeaveType {
  _id: string;
  name: string;
  code: string;
  description?: string;
  requiresDocumentation: boolean;
  defaultDaysPerYear: number;
  accruesMonthly: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILeaveBalance {
  _id: string;
  userId: string;
  leaveTypeId: string;
  year: number;
  totalDays: number;
  usedDays: number;
  pendingDays: number;
  adjustments: ILeaveAdjustment[];
  carryOver: number;
  expiryDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILeaveAdjustment {
  days: number;
  reason: string;
  adjustedBy: string;
  adjustedAt: Date;
}

export interface ILeaveRequest {
  _id: string;
  userId: string;
  leaveTypeId: string;
  startDate: Date;
  endDate: Date;
  numberOfDays: number;
  reason?: string;
  status: LeaveStatus;
  documentUrls?: string[];
  approvedBy?: string;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IHoliday {
  _id: string;
  name: string;
  date: Date;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}