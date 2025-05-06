import { Request, Response } from "express";
import mongoose from "mongoose";
import LeaveRequest, { LeaveRequestDocument } from "../models/LeaveRequest";
import LeaveBalance from "../models/LeaveBalance";
import LeaveType from "../models/LeaveType";
import User from "../models/User";
import { LeaveStatus } from "../types";

// Get all leave requests (for admin & managers)
export const getAllLeaveRequests = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const leaveRequests = await LeaveRequest.find()
      .populate("userId", "firstName lastName email profilePicture")
      .populate("leaveTypeId", "name code")
      .populate("approvedBy", "firstName lastName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await LeaveRequest.countDocuments();

    res.status(200).json({
      leaveRequests,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Get leave requests by filter
export const getLeaveRequestsByFilter = async (req: Request, res: Response) => {
  try {
    const { userId, leaveTypeId, status, startDate, endDate, department } =
      req.query;

    const query: any = {};

    if (userId) query.userId = new mongoose.Types.ObjectId(userId as string);
    if (leaveTypeId)
      query.leaveTypeId = new mongoose.Types.ObjectId(leaveTypeId as string);
    if (status) query.status = status;

    if (startDate || endDate) {
      query.startDate = {};
      if (startDate) query.startDate.$gte = new Date(startDate as string);
      if (endDate) query.endDate = { $lte: new Date(endDate as string) };
    }

    // If department is specified, first get users from that department
    if (department) {
      const users = await User.find({ department }).select("_id");
      const userIds = users.map((user) => user._id);
      query.userId = { $in: userIds };
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const leaveRequests = await LeaveRequest.find(query)
      .populate("userId", "firstName lastName email profilePicture")
      .populate("leaveTypeId", "name code")
      .populate("approvedBy", "firstName lastName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await LeaveRequest.countDocuments(query);

    res.status(200).json({
      leaveRequests,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Get leave requests for authenticated user
export const getUserLeaveRequests = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const leaveRequests = await LeaveRequest.find({ userId })
      .populate("leaveTypeId", "name code")
      .populate("approvedBy", "firstName lastName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await LeaveRequest.countDocuments({ userId });

    res.status(200).json({
      leaveRequests,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Get leave balance for authenticated user
export const getUserLeaveBalance = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const currentYear = new Date().getFullYear();

    // Get all active leave types
    const leaveTypes = await LeaveType.find({ active: true });

    // Get leave balances for the user
    const leaveBalances = await LeaveBalance.find({
      userId,
      year: currentYear,
    }).populate("leaveTypeId", "name code");

    // Prepare the response with proper structure
    const formattedBalances = leaveTypes.map((leaveType) => {
      const balance = leaveBalances.find(
        (b) => b.leaveTypeId.toString() === leaveType._id.toString()
      );

      return {
        leaveType: {
          _id: leaveType._id,
          name: leaveType.name,
          code: leaveType.code,
        },
        balance: balance
          ? {
              total: balance.totalDays,
              used: balance.usedDays,
              pending: balance.pendingDays,
              available:
                balance.totalDays - balance.usedDays - balance.pendingDays,
              carryOver: balance.carryOver,
            }
          : {
              total: 0,
              used: 0,
              pending: 0,
              available: 0,
              carryOver: 0,
            },
      };
    });

    res.status(200).json(formattedBalances);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Get leave request by ID
export const getLeaveRequestById = async (req: Request, res: Response) => {
  try {
    const leaveRequest = await LeaveRequest.findById(req.params.id)
      .populate("userId", "firstName lastName email profilePicture")
      .populate("leaveTypeId", "name code requiresDocumentation")
      .populate("approvedBy", "firstName lastName");

    if (!leaveRequest) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    // Check if the user is authorized to view this leave request
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Only the owner, admin, or the user's manager can view the leave request
    if (
      leaveRequest.userId.toString() !== userId &&
      userRole !== "admin" &&
      userRole !== "manager"
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to view this leave request" });
    }

    res.status(200).json(leaveRequest);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Create new leave request
export const createLeaveRequest = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { leaveTypeId, startDate, endDate, numberOfDays, reason } = req.body;
    const userId = req.user?.id;

    // Check if the leave type requires documentation
    const leaveType = await LeaveType.findById(leaveTypeId);
    if (!leaveType) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Leave type not found" });
    }

    // If documentation is required, check if files were uploaded
    if (
      leaveType.requiresDocumentation &&
      (!req.files || (req.files as Express.Multer.File[]).length === 0)
    ) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Supporting documents are required for this leave type",
      });
    }

    // Check leave balance
    const currentYear = new Date().getFullYear();
    let leaveBalance = await LeaveBalance.findOne({
      userId,
      leaveTypeId,
      year: currentYear,
    });

    // If no balance record exists, create one
    if (!leaveBalance) {
      leaveBalance = new LeaveBalance({
        userId,
        leaveTypeId,
        year: currentYear,
        totalDays: leaveType.defaultDaysPerYear,
        usedDays: 0,
        pendingDays: 0,
        adjustments: [],
        carryOver: 0,
      });
      await leaveBalance.save({ session });
    }

    // Check if user has enough leave balance
    const availableDays =
      leaveBalance.totalDays - leaveBalance.usedDays - leaveBalance.pendingDays;
    if (numberOfDays > availableDays) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Insufficient leave balance",
        available: availableDays,
        requested: numberOfDays,
      });
    }

    // Process uploaded files
    const documentUrls: string[] = [];
    if (req.files && (req.files as Express.Multer.File[]).length > 0) {
      (req.files as Express.Multer.File[]).forEach((file) => {
        documentUrls.push(`/uploads/${file.filename}`);
      });
    }

    // Create new leave request
    const newLeaveRequest = new LeaveRequest({
      userId,
      leaveTypeId,
      startDate,
      endDate,
      numberOfDays,
      reason,
      status: LeaveStatus.PENDING,
      documentUrls,
    });

    await newLeaveRequest.save({ session });

    // Update leave balance - add to pending days
    leaveBalance.pendingDays += numberOfDays;
    await leaveBalance.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Populate the response
    const populatedLeaveRequest = await LeaveRequest.findById(
      newLeaveRequest._id
    )
      .populate("leaveTypeId", "name code")
      .populate("userId", "firstName lastName email");

    res.status(201).json(populatedLeaveRequest);
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: error.message });
  }
};

// Update leave request (only if it's still pending)
export const updateLeaveRequest = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { leaveTypeId, startDate, endDate, numberOfDays, reason } = req.body;
    const userId = req.user?.id;

    // Find the leave request
    const leaveRequest = await LeaveRequest.findById(req.params.id);

    if (!leaveRequest) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Leave request not found" });
    }

    // Check if user is authorized to update this request
    if (leaveRequest.userId.toString() !== userId) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(403)
        .json({ message: "Not authorized to update this leave request" });
    }

    // Check if the request is in a pending state
    if (leaveRequest.status !== LeaveStatus.PENDING) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "Only pending leave requests can be updated" });
    }

    // If changing leave type or days, check balance
    if (
      (leaveTypeId && leaveTypeId !== leaveRequest.leaveTypeId.toString()) ||
      (numberOfDays && numberOfDays !== leaveRequest.numberOfDays)
    ) {
      const targetLeaveTypeId = leaveTypeId || leaveRequest.leaveTypeId;
      const daysToRequest = numberOfDays || leaveRequest.numberOfDays;

      const currentYear = new Date().getFullYear();
      const leaveBalance = await LeaveBalance.findOne({
        userId,
        leaveTypeId: targetLeaveTypeId,
        year: currentYear,
      });

      if (!leaveBalance) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(400)
          .json({ message: "No leave balance found for this leave type" });
      }

      // Calculate available days, adding back the current pending days of this request
      let availableDays =
        leaveBalance.totalDays -
        leaveBalance.usedDays -
        leaveBalance.pendingDays;
      if (
        targetLeaveTypeId.toString() === leaveRequest.leaveTypeId.toString()
      ) {
        availableDays += leaveRequest.numberOfDays;
      }

      if (daysToRequest > availableDays) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          message: "Insufficient leave balance",
          available: availableDays,
          requested: daysToRequest,
        });
      }

      // If changing leave type, update balances for both types
      if (leaveTypeId && leaveTypeId !== leaveRequest.leaveTypeId.toString()) {
        // Remove from old leave type
        const oldLeaveBalance = await LeaveBalance.findOne({
          userId,
          leaveTypeId: leaveRequest.leaveTypeId,
          year: currentYear,
        });

        if (oldLeaveBalance) {
          oldLeaveBalance.pendingDays -= leaveRequest.numberOfDays;
          await oldLeaveBalance.save({ session });
        }

        // Add to new leave type
        leaveBalance.pendingDays += daysToRequest;
        await leaveBalance.save({ session });
      } else {
        // Update days for the same leave type
        leaveBalance.pendingDays =
          leaveBalance.pendingDays - leaveRequest.numberOfDays + daysToRequest;
        await leaveBalance.save({ session });
      }
    }

    // Update the leave request
    const updatedFields: Partial<LeaveRequestDocument> = {};

    if (leaveTypeId)
      updatedFields.leaveTypeId = new mongoose.Types.ObjectId(leaveTypeId);
    if (startDate) updatedFields.startDate = new Date(startDate);
    if (endDate) updatedFields.endDate = new Date(endDate);
    if (numberOfDays) updatedFields.numberOfDays = numberOfDays;
    if (reason !== undefined) updatedFields.reason = reason;

    const updatedLeaveRequest = await LeaveRequest.findByIdAndUpdate(
      req.params.id,
      { $set: updatedFields },
      { new: true, session }
    ).populate("leaveTypeId", "name code");

    await session.commitTransaction();
    session.endSession();

    res.status(200).json(updatedLeaveRequest);
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: error.message });
  }
};

// Cancel leave request
export const cancelLeaveRequest = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user?.id;

    // Find the leave request
    const leaveRequest = await LeaveRequest.findById(req.params.id);

    if (!leaveRequest) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Leave request not found" });
    }

    // Check if user is authorized to cancel this request
    if (
      leaveRequest.userId.toString() !== userId &&
      req.user?.role !== "admin"
    ) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(403)
        .json({ message: "Not authorized to cancel this leave request" });
    }

    // Check if the request can be cancelled
    if (leaveRequest.status === LeaveStatus.CANCELLED) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "Leave request is already cancelled" });
    }

    // Update leave balance based on current status
    const currentYear = new Date().getFullYear();
    const leaveBalance = await LeaveBalance.findOne({
      userId: leaveRequest.userId,
      leaveTypeId: leaveRequest.leaveTypeId,
      year: currentYear,
    });

    if (leaveBalance) {
      if (leaveRequest.status === LeaveStatus.PENDING) {
        // If pending, reduce pending days
        leaveBalance.pendingDays -= leaveRequest.numberOfDays;
      } else if (leaveRequest.status === LeaveStatus.APPROVED) {
        // If approved, reduce used days
        leaveBalance.usedDays -= leaveRequest.numberOfDays;
      }

      await leaveBalance.save({ session });
    }

    // Update the leave request status
    leaveRequest.status = LeaveStatus.CANCELLED;
    await leaveRequest.save({ session });

    await session.commitTransaction();
    session.endSession();

    res
      .status(200)
      .json({ message: "Leave request cancelled successfully", leaveRequest });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: error.message });
  }
};

// Approve leave request (managers & admin only)
export const approveLeaveRequest = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const approverId = req.user?.id;

    // Find the leave request
    const leaveRequest = await LeaveRequest.findById(req.params.id);

    if (!leaveRequest) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Leave request not found" });
    }

    // Check if the request is in a pending state
    if (leaveRequest.status !== LeaveStatus.PENDING) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "Only pending leave requests can be approved" });
    }

    // If manager, check if user is in their team
    if (req.user?.role === "manager") {
      const requestingUser = await User.findById(leaveRequest.userId);

      if (
        !requestingUser ||
        requestingUser.managerId?.toString() !== approverId
      ) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(403)
          .json({ message: "Not authorized to approve this leave request" });
      }
    }

    // Update leave balance
    const currentYear = new Date().getFullYear();
    const leaveBalance = await LeaveBalance.findOne({
      userId: leaveRequest.userId,
      leaveTypeId: leaveRequest.leaveTypeId,
      year: currentYear,
    });

    if (leaveBalance) {
      leaveBalance.pendingDays -= leaveRequest.numberOfDays;
      leaveBalance.usedDays += leaveRequest.numberOfDays;
      await leaveBalance.save({ session });
    }

    // Update the leave request
    leaveRequest.status = LeaveStatus.APPROVED;
    leaveRequest.approvedBy = new mongoose.Types.ObjectId(approverId);
    await leaveRequest.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Populate the response
    const populatedLeaveRequest = await LeaveRequest.findById(leaveRequest._id)
      .populate("userId", "firstName lastName email")
      .populate("leaveTypeId", "name code")
      .populate("approvedBy", "firstName lastName");

    res.status(200).json({
      message: "Leave request approved successfully",
      leaveRequest: populatedLeaveRequest,
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: error.message });
  }
};

// Reject leave request (managers & admin only)
export const rejectLeaveRequest = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { rejectionReason } = req.body;
    const userId = req.user?.id;

    // Find the leave request
    const leaveRequest = await LeaveRequest.findById(req.params.id);

    if (!leaveRequest) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Leave request not found" });
    }

    // Check if the request is in a pending state
    if (leaveRequest.status !== LeaveStatus.PENDING) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "Only pending leave requests can be rejected" });
    }

    // If manager, check if user is in their team
    if (req.user?.role === "manager") {
      const requestingUser = await User.findById(leaveRequest.userId);

      if (!requestingUser || requestingUser.managerId?.toString() !== userId) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(403)
          .json({ message: "Not authorized to reject this leave request" });
      }
    }

    // Update leave balance
    const currentYear = new Date().getFullYear();
    const leaveBalance = await LeaveBalance.findOne({
      userId: leaveRequest.userId,
      leaveTypeId: leaveRequest.leaveTypeId,
      year: currentYear,
    });

    if (leaveBalance) {
      leaveBalance.pendingDays -= leaveRequest.numberOfDays;
      await leaveBalance.save({ session });
    }

    // Update the leave request
    leaveRequest.status = LeaveStatus.REJECTED;
    leaveRequest.rejectionReason = rejectionReason;
    leaveRequest.approvedBy = new mongoose.Types.ObjectId(userId);
    await leaveRequest.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Populate the response
    const populatedLeaveRequest = await LeaveRequest.findById(leaveRequest._id)
      .populate("userId", "firstName lastName email")
      .populate("leaveTypeId", "name code")
      .populate("approvedBy", "firstName lastName");

    res.status(200).json({
      message: "Leave request rejected",
      leaveRequest: populatedLeaveRequest,
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: error.message });
  }
};

// Upload documents for leave request
export const uploadLeaveDocuments = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    // Find the leave request
    const leaveRequest = await LeaveRequest.findById(req.params.id);

    if (!leaveRequest) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    // Check if user is authorized to update this request
    if (leaveRequest.userId.toString() !== userId) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this leave request" });
    }

    // Process uploaded files
    if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const documentUrls: string[] = [];
    (req.files as Express.Multer.File[]).forEach((file) => {
      documentUrls.push(`/uploads/${file.filename}`);
    });

    // Update the leave request
    const updatedLeaveRequest = await LeaveRequest.findByIdAndUpdate(
      req.params.id,
      { $push: { documentUrls: { $each: documentUrls } } },
      { new: true }
    );

    res.status(200).json({
      message: "Documents uploaded successfully",
      documentUrls,
      leaveRequest: updatedLeaveRequest,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
