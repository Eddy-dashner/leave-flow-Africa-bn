import { Request, Response } from 'express';
import LeaveType from '../models/LeaveType';

// Get all leave types
export const getAllLeaveTypes = async (req: Request, res: Response) => {
  try {
    const leaveTypes = await LeaveType.find().sort({ name: 1 });
    res.status(200).json(leaveTypes);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Get active leave types
export const getActiveLeaveTypes = async (req: Request, res: Response) => {
  try {
    const leaveTypes = await LeaveType.find({ active: true }).sort({ name: 1 });
    res.status(200).json(leaveTypes);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Get leave type by ID
export const getLeaveTypeById = async (req: Request, res: Response) => {
  try {
    const leaveType = await LeaveType.findById(req.params.id);
    
    if (!leaveType) {
      return res.status(404).json({ message: 'Leave type not found' });
    }
    
    res.status(200).json(leaveType);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Create new leave type (admin only)
export const createLeaveType = async (req: Request, res: Response) => {
  try {
    const {
      name,
      code,
      description,
      requiresDocumentation,
      defaultDaysPerYear,
      accruesMonthly,
      active,
    } = req.body;
    
    // Check if leave type with the same code already exists
    const existingLeaveType = await LeaveType.findOne({ code: code.toUpperCase() });
    if (existingLeaveType) {
      return res.status(400).json({ message: 'Leave type with this code already exists' });
    }
    
    const newLeaveType = new LeaveType({
      name,
      code: code.toUpperCase(),
      description,
      requiresDocumentation,
      defaultDaysPerYear,
      accruesMonthly,
      active: active !== undefined ? active : true,
    });
    
    const savedLeaveType = await newLeaveType.save();
    res.status(201).json(savedLeaveType);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Update leave type (admin only)
export const updateLeaveType = async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      requiresDocumentation,
      defaultDaysPerYear,
      accruesMonthly,
      active,
    } = req.body;
    
    const updatedFields: any = {};
    
    if (name !== undefined) updatedFields.name = name;
    if (description !== undefined) updatedFields.description = description;
    if (requiresDocumentation !== undefined) updatedFields.requiresDocumentation = requiresDocumentation;
    if (defaultDaysPerYear !== undefined) updatedFields.defaultDaysPerYear = defaultDaysPerYear;
    if (accruesMonthly !== undefined) updatedFields.accruesMonthly = accruesMonthly;
    if (active !== undefined) updatedFields.active = active;
    
    const updatedLeaveType = await LeaveType.findByIdAndUpdate(
      req.params.id,
      { $set: updatedFields },
      { new: true }
    );
    
    if (!updatedLeaveType) {
      return res.status(404).json({ message: 'Leave type not found' });
    }
    
    res.status(200).json(updatedLeaveType);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Deactivate leave type (admin only)
export const deactivateLeaveType = async (req: Request, res: Response) => {
  try {
    const updatedLeaveType = await LeaveType.findByIdAndUpdate(
      req.params.id,
      { $set: { active: false } },
      { new: true }
    );
    
    if (!updatedLeaveType) {
      return res.status(404).json({ message: 'Leave type not found' });
    }
    
    res.status(200).json({
      message: 'Leave type deactivated successfully',
      leaveType: updatedLeaveType,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};