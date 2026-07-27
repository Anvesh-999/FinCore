import { Router } from 'express';
import { getWallet, getWalletTransactions } from './controller.js';
import { protect } from '../../middleware/auth.js';

const router = Router();

// Protect all wallet endpoints
router.use(protect);

router.get('/', getWallet);
router.get('/transactions', getWalletTransactions);

export default router;
