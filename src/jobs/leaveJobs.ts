import mongoose from 'mongoose';
import LeaveBalance from '../models/LeaveBalance';
import LeaveType from '../models/LeaveType';
import User from '../models/User';

// Process monthly leave accrual for all users (runs on the 1st of each month)
export const processMonthlyLeaveAccrual = async () => {
  console.log('Running monthly leave accrual job');
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const currentYear = new Date().getFullYear();
    
    // Get all active leave types that accrue monthly
    const leaveTypes = await LeaveType.find({
      active: true,
      accruesMonthly: true,
    });
    
    // Get all users
    const users = await User.find({});
    
    // Process each user
    for (const user of users) {
      for (const leaveType of leaveTypes) {
        // Only PTO (Personal Time Off) accrues at the standard rate
        if (leaveType.code !== 'PTO') continue;
        
        // Calculate monthly accrual (1.66 days/month for 20 days/year)
        const monthlyAccrual = leaveType.defaultDaysPerYear / 12;
        
        // Find or create leave balance record for this user, leave type, and year
        let leaveBalance = await LeaveBalance.findOne({
          userId: user._id,
          leaveTypeId: leaveType._id,
          year: currentYear,
        });
        
        if (!leaveBalance) {
          // Create new balance record
          leaveBalance = new LeaveBalance({
            userId: user._id,
            leaveTypeId: leaveType._id,
            year: currentYear,
            totalDays: monthlyAccrual,
            usedDays: 0,
            pendingDays: 0,
            adjustments: [{
              days: monthlyAccrual,
              reason: `Monthly accrual for ${new Date().toLocaleString('default', { month: 'long' })}`,
              adjustedBy: user._id, // System adjustment
              adjustedAt: new Date(),
            }],
            carryOver: 0,
          });
        } else {
          // Update existing balance
          leaveBalance.totalDays += monthlyAccrual;
          leaveBalance.adjustments.push({
            days: monthlyAccrual,
            reason: `Monthly accrual for ${new Date().toLocaleString('default', { month: 'long' })}`,
            adjustedBy: user._id, // System adjustment
            adjustedAt: new Date(),
          });
        }
        
        await leaveBalance.save({ session });
      }
    }
    
    await session.commitTransaction();
    console.log('Monthly leave accrual processed successfully');
  } catch (error) {
    await session.abortTransaction();
    console.error('Error processing monthly leave accrual:', error);
  } finally {
    session.endSession();
  }
};

// Process year-end leave carryover (runs on January 1st)
export const processYearEndCarryover = async () => {
  console.log('Running year-end carryover job');
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const previousYear = new Date().getFullYear() - 1;
    const currentYear = new Date().getFullYear();
    
    // Set expiry date for carried over leave (January 31st)
    const expiryDate = new Date(currentYear, 0, 31); // January 31st
    
    // Get all active leave types
    const leaveTypes = await LeaveType.find({ active: true });
    
    // Get all users
    const users = await User.find({});
    
    // Process each user
    for (const user of users) {
      for (const leaveType of leaveTypes) {
        // Only PTO is eligible for carryover
        if (leaveType.code !== 'PTO') continue;
        
        // Find previous year's balance
        const previousYearBalance = await LeaveBalance.findOne({
          userId: user._id,
          leaveTypeId: leaveType._id,
          year: previousYear,
        });
        
        if (!previousYearBalance) continue;
        
        // Calculate remaining days
        const remainingDays = previousYearBalance.totalDays - previousYearBalance.usedDays;
        
        // Apply carryover limit (max 5 days)
        const carryOverDays = Math.min(remainingDays, 5);
        
        if (carryOverDays <= 0) continue;
        
        // Find or create current year's balance
        let currentYearBalance = await LeaveBalance.findOne({
          userId: user._id,
          leaveTypeId: leaveType._id,
          year: currentYear,
        });
        
        if (!currentYearBalance) {
          // Create new balance with carryover
          currentYearBalance = new LeaveBalance({
            userId: user._id,
            leaveTypeId: leaveType._id,
            year: currentYear,
            totalDays: carryOverDays,
            usedDays: 0,
            pendingDays: 0,
            adjustments: [{
              days: carryOverDays,
              reason: `Carryover from ${previousYear}`,
              adjustedBy: user._id, // System adjustment
              adjustedAt: new Date(),
            }],
            carryOver: carryOverDays,
            expiryDate,
          });
        } else {
          // Update existing balance with carryover
          currentYearBalance.totalDays += carryOverDays;
          currentYearBalance.carryOver = carryOverDays;
          currentYearBalance.expiryDate = expiryDate;
          currentYearBalance.adjustments.push({
            days: carryOverDays,
            reason: `Carryover from ${previousYear}`,
            adjustedBy: user._id, // System adjustment
            adjustedAt: new Date(),
          });
        }
        
        await currentYearBalance.save({ session });
        
        // Update previous year's balance to mark carryover
        previousYearBalance.carryOver = carryOverDays;
        await previousYearBalance.save({ session });
      }
    }
    
    await session.commitTransaction();
    console.log('Year-end carryover processed successfully');
  } catch (error) {
    await session.abortTransaction();
    console.error('Error processing year-end carryover:', error);
  } finally {
    session.endSession();
  }
};

// Process carryover expiry (runs on February 1st)
export const processCarryoverExpiry = async () => {
  console.log('Running carryover expiry job');
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const currentYear = new Date().getFullYear();
    const today = new Date();
    
    // Find all balances with carryover and expiry date in the past
    const balancesToUpdate = await LeaveBalance.find({
      year: currentYear,
      carryOver: { $gt: 0 },
      expiryDate: { $lt: today },
    });
    
    for (const balance of balancesToUpdate) {
      // Subtract carryover days from the total
      balance.totalDays -= balance.carryOver;
      
      // Add adjustment to record the expiry
      balance.adjustments.push({
        days: -balance.carryOver,
        reason: `Expired carryover days from previous year`,
        adjustedBy: balance.userId, // System adjustment
        adjustedAt: new Date(),
      });
      
      // Reset carryover
      balance.carryOver = 0;
      balance.expiryDate = undefined;
      
      await balance.save({ session });
    }
    
    await session.commitTransaction();
    console.log(`Carryover expiry processed for ${balancesToUpdate.length} records`);
  } catch (error) {
    await session.abortTransaction();
    console.error('Error processing carryover expiry:', error);
  } finally {
    session.endSession();
  }
};