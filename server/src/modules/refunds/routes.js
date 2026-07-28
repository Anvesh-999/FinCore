import { Router } from 'express';
import { getRefund, listMerchantRefunds } from './controller.js';
import { protect, restrictTo } from '../../middleware/auth.js';

const router = Router();

// Protect all routes to only logged in users
router.use(protect);

// Merchant list endpoint
router.get('/merchant/list', restrictTo('MERCHANT'), listMerchantRefunds);

// Get specific refund (available to admin, auditor, customer, merchant)
router.get('/:id', getRefund);

export default router;
