import { Request, Response } from 'express';
import mongoose from 'mongoose';
import LeaveRequest from '../models/LeaveRequest';
import LeaveBalance from '../models/LeaveBalance';
import LeaveType from '../models/LeaveType';
import User from '../models/User';
import { LeaveStatus } from '../types';

// Get leave usage report
export const getLeaveUsageReport = async (req: Request, res: Response) => {
  try {
    const { year = new Date().getFullYear(), month, leaveTypeId, department } = req.query;
    
    const match: any = {};
    if (year) match.year = parseInt(year as string);
    
    // Aggregate leave usage by leave type
    const pipeline: any[] = [
      {
        $match: {
          status: LeaveStatus.APPROVED,
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $lookup: {
          from: 'leavetypes',
          localField: 'leaveTypeId',
          foreignField: '_id',
          as: 'leaveType',
        },
      },
      {
        $unwind: '$user',
      },
      {
        $unwind: '$leaveType',
      },
    ];
    
    // Add filters
    if (month) {
      const monthNumber = parseInt(month as string);
      pipeline.push({
        $match: {
          $expr: {
            $eq: [{ $month: '$startDate' }, monthNumber],
          },
        },
      });
    }
    
    if (year) {
      pipeline.push({
        $match: {
          $expr: {
            $eq: [{ $year: '$startDate' }, parseInt(year as string)],
          },
        },
      });
    }
    
    if (leaveTypeId) {
      pipeline.push({
        $match: {
          'leaveTypeId': new mongoose.Types.ObjectId(leaveTypeId as string),
        },
      });
    }
    
    if (department) {
      pipeline.push({
        $match: {
          'user.department': department,
        },
      });
    }
    
    // Group by leave type
    pipeline.push(
      {
        $group: {
          _id: {
            leaveTypeId: '$leaveTypeId',
            leaveTypeName: '$leaveType.name',
            leaveTypeCode: '$leaveType.code',
          },
          totalDays: { $sum: '$numberOfDays' },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          leaveTypeId: '$_id.leaveTypeId',
          leaveTypeName: '$_id.leaveTypeName',
          leaveTypeCode: '$_id.leaveTypeCode',
          totalDays: 1,
          count: 1,
        },
      },
      {
        $sort: { leaveTypeName: 1 },
      }
    );
    
    const leaveUsageByType = await LeaveRequest.aggregate(pipeline);
    
    // Calculate overall totals
    const totalDays = leaveUsageByType.reduce((sum, item) => sum + item.totalDays, 0);
    const totalRequests = leaveUsageByType.reduce((sum, item) => sum + item.count, 0);
    
    res.status(200).json({
      summary: {
        totalDays,
        totalRequests,
      },
      leaveUsageByType,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Get leave balance report
export const getLeaveBalanceReport = async (req: Request, res: Response) => {
  try {
    const { year = new Date().getFullYear(), department } = req.query;
    
    // Define the base pipeline
    const pipeline: any[] = [
      {
        $match: {
          year: parseInt(year as string),
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $lookup: {
          from: 'leavetypes',
          localField: 'leaveTypeId',
          foreignField: '_id',
          as: 'leaveType',
        },
      },
      {
        $unwind: '$user',
      },
      {
        $unwind: '$leaveType',
      },
    ];
    
    // Add department filter if provided
    if (department) {
      pipeline.push({
        $match: {
          'user.department': department,
        },
      });
    }
    
    // Group by user
    pipeline.push(
      {
        $group: {
          _id: {
            userId: '$userId',
            firstName: '$user.firstName',
            lastName: '$user.lastName',
            department: '$user.department',
            leaveTypeId: '$leaveTypeId',
            leaveTypeName: '$leaveType.name',
            leaveTypeCode: '$leaveType.code',
          },
          totalDays: { $first: '$totalDays' },
          usedDays: { $first: '$usedDays' },
          pendingDays: { $first: '$pendingDays' },
          availableDays: { 
            $first: { 
              $subtract: [
                '$totalDays', 
                { $add: ['$usedDays', '$pendingDays'] }
              ]
            }
          },
          carryOver: { $first: '$carryOver' },
        },
      },
      {
        $project: {
          _id: 0,
          userId: '$_id.userId',
          firstName: '$_id.firstName',
          lastName: '$_id.lastName',
          department: '$_id.department',
          leaveTypeId: '$_id.leaveTypeId',
          leaveTypeName: '$_id.leaveTypeName',
          leaveTypeCode: '$_id.leaveTypeCode',
          totalDays: 1,
          usedDays: 1,
          pendingDays: 1,
          availableDays: 1,
          carryOver: 1,
        },
      },
      {
        $sort: { lastName: 1, firstName: 1, leaveTypeName: 1 },
      }
    );
    
    const balanceReport = await LeaveBalance.aggregate(pipeline);
    
    // Group the results by user
    const groupedByUser: any = {};
    balanceReport.forEach(record => {
      const userId = record.userId.toString();
      
      if (!groupedByUser[userId]) {
        groupedByUser[userId] = {
          userId: record.userId,
          firstName: record.firstName,
          lastName: record.lastName,
          department: record.department,
          balances: [],
        };
      }
      
      groupedByUser[userId].balances.push({
        leaveTypeId: record.leaveTypeId,
        leaveTypeName: record.leaveTypeName,
        leaveTypeCode: record.leaveTypeCode,
        totalDays: record.totalDays,
        usedDays: record.usedDays,
        pendingDays: record.pendingDays,
        availableDays: record.availableDays,
        carryOver: record.carryOver,
      });
    });
    
    const result = Object.values(groupedByUser);
    
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Get department leave report
export const getDepartmentLeaveReport = async (req: Request, res: Response) => {
  try {
    const { department } = req.query;
    
    // If user is a manager, they can only view their department
    if (req.user?.role === 'manager' && !department) {
      const manager = await User.findById(req.user.id);
      if (manager) {
        req.query.department = manager.department;
      }
    }
    
    // Define the base pipeline
    const pipeline: any[] = [
      {
        $match: {
          status: LeaveStatus.APPROVED,
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: '$user',
      },
    ];
    
    // Add department filter if provided
    if (department) {
      pipeline.push({
        $match: {
          'user.department': department,
        },
      });
    }
    
    // Group by department
    pipeline.push(
      {
        $group: {
          _id: '$user.department',
          totalRequests: { $sum: 1 },
          totalDays: { $sum: '$numberOfDays' },
          uniqueUsers: { $addToSet: '$userId' },
        },
      },
      {
        $project: {
          _id: 0,
          department: '$_id',
          totalRequests: 1,
          totalDays: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
        },
      },
      {
        $sort: { department: 1 },
      }
    );
    
    const departmentReport = await LeaveRequest.aggregate(pipeline);
    
    res.status(200).json(departmentReport);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Helper function to convert data to CSV
const convertToCSV = (data: any[], fields: string[]) => {
  // Create header row
  const header = fields.join(',');
  
  // Create data rows
  const rows = data.map(item => {
    return fields.map(field => {
      const value = field.split('.').reduce((obj, key) => obj?.[key], item);
      
      // Handle strings with commas by wrapping in quotes
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value}"`;
      }
      
      return value ?? '';
    }).join(',');
  });
  
  return [header, ...rows].join('\n');
};

// Export leave data to CSV
export const exportLeavesToCSV = async (req: Request, res: Response) => {
  try {
    const { year = new Date().getFullYear(), status } = req.query;
    
    const match: any = {};
    if (year) {
      match.$expr = {
        $eq: [{ $year: '$startDate' }, parseInt(year as string)],
      };
    }
    
    if (status) {
      match.status = status;
    }
    
    const leaveRequests = await LeaveRequest.find(match)
      .populate('userId', 'firstName lastName email department')
      .populate('leaveTypeId', 'name code')
      .populate('approvedBy', 'firstName lastName')
      .sort({ startDate: -1 });
    
    // Transform data for CSV export
    const csvData = leaveRequests.map(leave => ({
      id: leave._id,
      employeeName: `${leave.userId.firstName} ${leave.userId.lastName}`,
      email: leave.userId.email,
      department: leave.userId.department,
      leaveType: leave.leaveTypeId.name,
      startDate: leave.startDate.toISOString().split('T')[0],
      endDate: leave.endDate.toISOString().split('T')[0],
      days: leave.numberOfDays,
      status: leave.status,
      reason: leave.reason || '',
      approvedBy: leave.approvedBy ? `${leave.approvedBy.firstName} ${leave.approvedBy.lastName}` : '',
      submittedOn: leave.createdAt.toISOString().split('T')[0],
    }));
    
    const fields = [
      'id', 
      'employeeName', 
      'email', 
      'department', 
      'leaveType', 
      'startDate', 
      'endDate', 
      'days', 
      'status', 
      'reason', 
      'approvedBy', 
      'submittedOn'
    ];
    
    const csv = convertToCSV(csvData, fields);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="leave_report_${year}.csv"`);
    res.status(200).send(csv);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Export leave balance data to CSV
export const exportLeaveBalancesToCSV = async (req: Request, res: Response) => {
  try {
    const { year = new Date().getFullYear() } = req.query;
    
    const leaveBalances = await LeaveBalance.find({ year: parseInt(year as string) })
      .populate('userId', 'firstName lastName email department')
      .populate('leaveTypeId', 'name code')
      .sort({ 'userId.lastName': 1, 'userId.firstName': 1 });
    
    // Transform data for CSV export
    const csvData = leaveBalances.map(balance => ({
      id: balance._id,
      employeeName: `${balance.userId.firstName} ${balance.userId.lastName}`,
      email: balance.userId.email,
      department: balance.userId.department,
      leaveType: balance.leaveTypeId.name,
      leaveCode: balance.leaveTypeId.code,
      totalDays: balance.totalDays,
      usedDays: balance.usedDays,
      pendingDays: balance.pendingDays,
      availableDays: balance.totalDays - balance.usedDays - balance.pendingDays,
      carryOver: balance.carryOver,
    }));
    
    const fields = [
      'id', 
      'employeeName', 
      'email', 
      'department', 
      'leaveType', 
      'leaveCode', 
      'totalDays', 
      'usedDays', 
      'pendingDays', 
      'availableDays',
      'carryOver'
    ];
    
    const csv = convertToCSV(csvData, fields);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="leave_balance_report_${year}.csv"`);
    res.status(200).send(csv);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};