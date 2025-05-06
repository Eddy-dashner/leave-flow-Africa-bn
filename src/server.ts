import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import mongoose from 'mongoose';
import path from 'path';
import cron from 'node-cron';

// Import routes
import leaveRoutes from './routes/leaveRoutes';
import userRoutes from './routes/userRoutes';
import leaveTypeRoutes from './routes/leaveTypeRoutes';
import reportsRoutes from './routes/reportsRoutes';
import calendarRoutes from './routes/calendarRoutes';

// Import cron jobs
import { processMonthlyLeaveAccrual, processYearEndCarryover } from './jobs/leaveJobs';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/leaves', leaveRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leave-types', leaveTypeRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/calendar', calendarRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Leave Management Service is running' });
});

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI as string)
  .then(() => {
    console.log('Connected to MongoDB');
    
    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
    
    // Setup cron jobs
    // Run monthly leave accrual on the 1st of every month at 00:01
    cron.schedule('1 0 1 * *', processMonthlyLeaveAccrual);
    
    // Run year-end carryover on January 1st at 00:01
    cron.schedule('1 0 1 1 *', processYearEndCarryover);
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
  });

export default app;