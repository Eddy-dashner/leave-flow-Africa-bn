import express from 'express';
import { param } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { UserRole } from '../types';
import * as userController from '../controllers/userController';

const router = express.Router();

// Fetch users for leave management
router.get(
  '/',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.MANAGER]),
  userController.getAllUsers
);

// Get user by ID
router.get(
  '/:id',
  authenticate,
  validate([
    param('id').isMongoId().withMessage('Invalid user ID'),
  ]),
  userController.getUserById
);

// Get users by department
router.get(
  '/department/:department',
  authenticate,
  userController.getUsersByDepartment
);

// Get user's team members (for managers)
router.get(
  '/team/:managerId',
  authenticate,
  validate([
    param('managerId').isMongoId().withMessage('Invalid manager ID'),
  ]),
  userController.getTeamMembers
);

// Update user profile
router.put(
  '/profile',
  authenticate,
  userController.updateUserProfile
);

// Admin endpoint to adjust leave balance for a user
router.post(
  '/:id/adjust-leave',
  authenticate,
  authorize([UserRole.ADMIN]),
  userController.adjustLeaveBalance
);

export default router;