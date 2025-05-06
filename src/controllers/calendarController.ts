import { Request, Response } from 'express';
import LeaveRequest from '../models/LeaveRequest';
import Holiday from '../models/Holiday';
import User from '../models/User';
import { LeaveStatus } from '../types';

// Get team calendar (all on-leave team members)
export const getTeamCalendar = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    // Get user's department
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const { startDate, endDate } = req.query;
    const dateFilter: any = {};
    
    if (startDate) {
      dateFilter.endDate = { $gte: new Date(startDate as string) };
    } else {
      // Default to current month if no dates specified
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter.endDate = { $gte: firstDay };
    }
    
    if (endDate) {
      if (!dateFilter.startDate) dateFilter.startDate = {};
      dateFilter.startDate.$lte = new Date(endDate as string);
    }
    
    // Get users from the same department who are on approved leave
    const teamMembersOnLeave = await LeaveRequest.find({
      ...dateFilter,
      status: LeaveStatus.APPROVED,
    })
      .populate({
        path: 'userId',
        match: { department: user.department },
        select: 'firstName lastName profilePicture department',
      })
      .populate('leaveTypeId', 'name code')
      .sort({ startDate: 1 });
    
    // Filter out null user entries (happens when the populated field doesn't match)
    const filteredResults = teamMembersOnLeave.filter(leave => leave.userId != null);
    
    res.status(200).json(filteredResults);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Get department calendar
export const getDepartmentCalendar = async (req: Request, res: Response) => {
  try {
    const { department } = req.params;
    const { startDate, endDate } = req.query;
    
    const dateFilter: any = {};
    
    if (startDate) {
      dateFilter.endDate = { $gte: new Date(startDate as string) };
    } else {
      // Default to current month if no dates specified
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter.endDate = { $gte: firstDay };
    }
    
    if (endDate) {
      if (!dateFilter.startDate) dateFilter.startDate = {};
      dateFilter.startDate.$lte = new Date(endDate as string);
    }
    
    // Get users from the specified department
    const usersInDepartment = await User.find({ department }).select('_id');
    const userIds = usersInDepartment.map(user => user._id);
    
    // Get approved leaves for those users
    const departmentOnLeave = await LeaveRequest.find({
      ...dateFilter,
      userId: { $in: userIds },
      status: LeaveStatus.APPROVED,
    })
      .populate('userId', 'firstName lastName profilePicture department')
      .populate('leaveTypeId', 'name code')
      .sort({ startDate: 1 });
    
    res.status(200).json(departmentOnLeave);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Get all holidays
export const getAllHolidays = async (req: Request, res: Response) => {
  try {
    const { year } = req.query;
    
    const query: any = {};
    if (year) {
      const yearNumber = parseInt(year as string);
      query.date = {
        $gte: new Date(yearNumber, 0, 1),
        $lt: new Date(yearNumber + 1, 0, 1),
      };
    }
    
    const holidays = await Holiday.find(query).sort({ date: 1 });
    res.status(200).json(holidays);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Create new holiday (admin only)
export const createHoliday = async (req: Request, res: Response) => {
  try {
    const { name, date, description } = req.body;
    
    const newHoliday = new Holiday({
      name,
      date: new Date(date),
      description,
    });
    
    const savedHoliday = await newHoliday.save();
    res.status(201).json(savedHoliday);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Update holiday (admin only)
export const updateHoliday = async (req: Request, res: Response) => {
  try {
    const { name, date, description } = req.body;
    
    const updateFields: any = {};
    if (name) updateFields.name = name;
    if (date) updateFields.date = new Date(date);
    if (description !== undefined) updateFields.description = description;
    
    const updatedHoliday = await Holiday.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true }
    );
    
    if (!updatedHoliday) {
      return res.status(404).json({ message: 'Holiday not found' });
    }
    
    res.status(200).json(updatedHoliday);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Delete holiday (admin only)
export const deleteHoliday = async (req: Request, res: Response) => {
  try {
    const deletedHoliday = await Holiday.findByIdAndDelete(req.params.id);
    
    if (!deletedHoliday) {
      return res.status(404).json({ message: 'Holiday not found' });
    }
    
    res.status(200).json({ message: 'Holiday deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};