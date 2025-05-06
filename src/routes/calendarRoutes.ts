import express from 'express';
import { body, param } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { UserRole } from '../types';
import * as calendarController from '../controllers/calendarController';

const router = express.Router();

// Get team calendar (all authenticated users)
router.get(
  '/team',
  authenticate,
  calendarController.getTeamCalendar
);

// Get department calendar
router.get(
  '/department/:department',
  authenticate,
  validate([
    param('department').isString().trim().notEmpty().withMessage('Department is required'),
  ]),
  calendarController.getDepartmentCalendar
);

// Get all holidays
router.get(
  '/holidays',
  authenticate,
  calendarController.getAllHolidays
);

// Create new holiday (admin only)
router.post(
  '/holidays',
  authenticate,
  authorize([UserRole.ADMIN]),
  validate([
    body('name').isString().trim().notEmpty().withMessage('Name is required'),
    body('date').isISO8601().withMessage('Invalid date'),
    body('description').optional().isString().trim(),
  ]),
  calendarController.createHoliday
);

// Update holiday (admin only)
router.put(
  '/holidays/:id',
  authenticate,
  authorize([UserRole.ADMIN]),
  validate([
    param('id').isMongoId().withMessage('Invalid holiday ID'),
    body('name').optional().isString().trim().notEmpty().withMessage('Name is required'),
    body('date').optional().isISO8601().withMessage('Invalid date'),
    body('description').optional().isString().trim(),
  ]),
  calendarController.updateHoliday
);

// Delete holiday (admin only)
router.delete(
  '/holidays/:id',
  authenticate,
  authorize([UserRole.ADMIN]),
  validate([
    param('id').isMongoId().withMessage('Invalid holiday ID'),
  ]),
  calendarController.deleteHoliday
);

export default router;