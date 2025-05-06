import express from 'express';
import { body, param } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { upload } from '../middleware/upload';
import { UserRole } from '../types';
import * as leaveController from '../controllers/leaveController';

const router = express.Router();

// Get all leave requests (admin & managers only)
router.get(
  '/',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.MANAGER]),
  leaveController.getAllLeaveRequests
);

// Get leave requests by filter (admin & managers only)
router.get(
  '/filter',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.MANAGER]),
  leaveController.getLeaveRequestsByFilter
);

// Get leave requests for a user
router.get(
  '/my-leaves',
  authenticate,
  leaveController.getUserLeaveRequests
);

// Get leave balance for authenticated user
router.get(
  '/my-balance',
  authenticate,
  leaveController.getUserLeaveBalance
);

// Get leave request by ID
router.get(
  '/:id',
  authenticate,
  validate([
    param('id').isMongoId().withMessage('Invalid leave request ID'),
  ]),
  leaveController.getLeaveRequestById
);

// Create new leave request
router.post(
  '/',
  authenticate,
  upload.array('documents', 5),
  validate([
    body('leaveTypeId').isMongoId().withMessage('Invalid leave type ID'),
    body('startDate').isISO8601().withMessage('Invalid start date'),
    body('endDate').isISO8601().withMessage('Invalid end date'),
    body('numberOfDays').isFloat({ min: 0.5 }).withMessage('Number of days must be at least 0.5'),
    body('reason').optional().isString().trim(),
  ]),
  leaveController.createLeaveRequest
);

// Update leave request (only pending requests)
router.put(
  '/:id',
  authenticate,
  validate([
    param('id').isMongoId().withMessage('Invalid leave request ID'),
    body('leaveTypeId').optional().isMongoId().withMessage('Invalid leave type ID'),
    body('startDate').optional().isISO8601().withMessage('Invalid start date'),
    body('endDate').optional().isISO8601().withMessage('Invalid end date'),
    body('numberOfDays').optional().isFloat({ min: 0.5 }).withMessage('Number of days must be at least 0.5'),
    body('reason').optional().isString().trim(),
  ]),
  leaveController.updateLeaveRequest
);

// Cancel leave request
router.post(
  '/:id/cancel',
  authenticate,
  validate([
    param('id').isMongoId().withMessage('Invalid leave request ID'),
  ]),
  leaveController.cancelLeaveRequest
);

// Approve leave request (managers & admin only)
router.post(
  '/:id/approve',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.MANAGER]),
  validate([
    param('id').isMongoId().withMessage('Invalid leave request ID'),
  ]),
  leaveController.approveLeaveRequest
);

// Reject leave request (managers & admin only)
router.post(
  '/:id/reject',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.MANAGER]),
  validate([
    param('id').isMongoId().withMessage('Invalid leave request ID'),
    body('rejectionReason').isString().trim().notEmpty().withMessage('Rejection reason is required'),
  ]),
  leaveController.rejectLeaveRequest
);

// Upload documents for leave request
router.post(
  '/:id/documents',
  authenticate,
  upload.array('documents', 5),
  validate([
    param('id').isMongoId().withMessage('Invalid leave request ID'),
  ]),
  leaveController.uploadLeaveDocuments
);

export default router;