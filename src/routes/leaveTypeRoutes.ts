import express from 'express';
import { body, param } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { UserRole } from '../types';
import * as leaveTypeController from '../controllers/leaveTypeController';

const router = express.Router();

// Get all leave types (accessible to all authenticated users)
router.get(
  '/',
  authenticate,
  leaveTypeController.getAllLeaveTypes
);

// Get active leave types (accessible to all authenticated users)
router.get(
  '/active',
  authenticate,
  leaveTypeController.getActiveLeaveTypes
);

// Get leave type by ID
router.get(
  '/:id',
  authenticate,
  validate([
    param('id').isMongoId().withMessage('Invalid leave type ID'),
  ]),
  leaveTypeController.getLeaveTypeById
);

// Create new leave type (admin only)
router.post(
  '/',
  authenticate,
  authorize([UserRole.ADMIN]),
  validate([
    body('name').isString().trim().notEmpty().withMessage('Name is required'),
    body('code').isString().trim().notEmpty().withMessage('Code is required').isLength({ max: 10 }),
    body('description').optional().isString().trim(),
    body('requiresDocumentation').isBoolean(),
    body('defaultDaysPerYear').isInt({ min: 0 }),
    body('accruesMonthly').isBoolean(),
    body('active').optional().isBoolean(),
  ]),
  leaveTypeController.createLeaveType
);

// Update leave type (admin only)
router.put(
  '/:id',
  authenticate,
  authorize([UserRole.ADMIN]),
  validate([
    param('id').isMongoId().withMessage('Invalid leave type ID'),
    body('name').optional().isString().trim().notEmpty().withMessage('Name is required'),
    body('description').optional().isString().trim(),
    body('requiresDocumentation').optional().isBoolean(),
    body('defaultDaysPerYear').optional().isInt({ min: 0 }),
    body('accruesMonthly').optional().isBoolean(),
    body('active').optional().isBoolean(),
  ]),
  leaveTypeController.updateLeaveType
);

// Deactivate leave type (admin only)
router.delete(
  '/:id',
  authenticate,
  authorize([UserRole.ADMIN]),
  validate([
    param('id').isMongoId().withMessage('Invalid leave type ID'),
  ]),
  leaveTypeController.deactivateLeaveType
);

export default router;