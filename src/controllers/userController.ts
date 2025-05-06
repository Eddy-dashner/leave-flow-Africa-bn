import { Request, Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/User';
import LeaveBalance from '../models/LeaveBalance';
import { UserRole } from '../types';

// Get all users (for admin & managers)
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.find()
      .select('-__v')
      .sort({ lastName: 1, firstName: 1 });
    
    res.status(200).json(users);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Get user by ID
export const getUserById = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id).select('-__v');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(200).json(user);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Get users by department
export const getUsersByDepartment = async (req: Request, res: Response) => {
  try {
    const { department } = req.params;
    
    const users = await User.find({ department })
      .select('-__v')
      .sort({ lastName: 1, firstName: 1 });
    
    res.status(200).json(users);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Get user's team members (for managers)
export const getTeamMembers = async (req: Request, res: Response) => {
  try {
    const { managerId } = req.params;
    
    // Check if the manager ID matches the authenticated user if not admin
    if (req.user?.role !== UserRole.ADMIN && req.user?.id !== managerId) {
      return res.status(403).json({ message: 'Not authorized to view this team' });
    }
    
    const teamMembers = await User.find({ managerId })
      .select('-__v')
      .sort({ lastName: 1, firstName: 1 });
    
    res.status(200).json(teamMembers);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Update user profile
export const updateUserProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { firstName, lastName, department } = req.body;
    
    const updatedFields: any = {};
    if (firstName) updatedFields.firstName = firstName;
    if (lastName) updatedFields.lastName = lastName;
    if (department) updatedFields.department = department;
    
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updatedFields },
      { new: true }
    ).select('-__v');
    
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(200).json(updatedUser);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Admin endpoint to adjust leave balance for a user
export const adjustLeaveBalance = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { id: userId } = req.params;
    const { leaveTypeId, days, reason } = req.body;
    const adminId = req.user?.id;
    
    // Validate input
    if (!leaveTypeId || !days || !reason) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Leave type, days, and reason are required' });
    }
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Find or create leave balance
    const currentYear = new Date().getFullYear();
    let leaveBalance = await LeaveBalance.findOne({
      userId,
      leaveTypeId,
      year: currentYear,
    });
    
    if (!leaveBalance) {
      leaveBalance = new LeaveBalance({
        userId,
        leaveTypeId,
        year: currentYear,
        totalDays: 0,
        usedDays: 0,
        pendingDays: 0,
        adjustments: [],
        carryOver: 0,
      });
    }
    
    // Add adjustment
    leaveBalance.adjustments.push({
      days,
      reason,
      adjustedBy: new mongoose.Types.ObjectId(adminId!),
      adjustedAt: new Date(),
    });
    
    // Update total days
    leaveBalance.totalDays += days;
    
    // Save the updated balance
    await leaveBalance.save({ session });
    
    await session.commitTransaction();
    session.endSession();
    
    // Get updated balance with populated data
    const updatedBalance = await LeaveBalance.findById(leaveBalance._id)
      .populate('leaveTypeId', 'name code')
      .populate('adjustments.adjustedBy', 'firstName lastName email');
    
    res.status(200).json({
      message: 'Leave balance adjusted successfully',
      leaveBalance: updatedBalance,
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: error.message });
  }
};