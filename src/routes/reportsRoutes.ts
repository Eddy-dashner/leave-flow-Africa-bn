import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '../types';
import * as reportsController from '../controllers/reportsController';

const router = express.Router();

// Get leave usage report (admin only)
router.get(
  '/leave-usage',
  authenticate,
  authorize([UserRole.ADMIN]),
  reportsController.getLeaveUsageReport
);

// Get leave balance report (admin only)
router.get(
  '/leave-balance',
  authenticate,
  authorize([UserRole.ADMIN]),
  reportsController.getLeaveBalanceReport
);

// Get department leave report (admin & managers)
router.get(
  '/department',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.MANAGER]),
  reportsController.getDepartmentLeaveReport
);

// Export leave data to CSV (admin only)
router.get(
  '/export/leaves',
  authenticate,
  authorize([UserRole.ADMIN]),
  reportsController.exportLeavesToCSV
);

// Export leave balance data to CSV (admin only)
router.get(
  '/export/balances',
  authenticate,
  authorize([UserRole.ADMIN]),
  reportsController.exportLeaveBalancesToCSV
);

export default router;