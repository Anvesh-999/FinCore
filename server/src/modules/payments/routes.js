import { Router } from 'express';
import { createPaymentOrder, getPayment, processCheckout, listMerchantPayments, getMerchantStats } from './controller.js';
import { protect, restrictTo } from '../../middleware/auth.js';
import { authenticateMerchantApiKey } from '../../middleware/merchantAuth.js';
import { issueRefund } from '../refunds/controller.js';


const router = Router();

// Server-to-server: Create payment order with API Key authentication
router.post('/', authenticateMerchantApiKey, createPaymentOrder);

// Merchant UI routes: Dashboard listings and stats
router.get('/merchant/list', protect, restrictTo('MERCHANT'), listMerchantPayments);
router.get('/merchant/stats', protect, restrictTo('MERCHANT'), getMerchantStats);

// Customer UI routes: Checkout page details and checkout execution
router.get('/:id', protect, getPayment);
router.post('/:id/checkout', protect, processCheckout);
router.post('/:id/refunds', protect, restrictTo('MERCHANT'), issueRefund);


export default router;
