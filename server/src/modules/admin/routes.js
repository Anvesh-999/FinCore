import { Router } from 'express';
import { getWallets, updateWalletStatus, getTransfers, getLedgerBook } from './controller.js';
import { protect, restrictTo } from '../../middleware/auth.js';

const router = Router();

// Enforce auth and RBAC (Admin or Auditor) for all admin operations
router.use(protect);
router.use(restrictTo('ADMIN', 'AUDITOR'));

// Read operations for both Admin and Auditor
router.get('/wallets', getWallets);
router.get('/transfers', getTransfers);
router.get('/ledger', getLedgerBook);

// Write operations restricted ONLY to Admin
router.post('/wallets/:id/status', restrictTo('ADMIN'), updateWalletStatus);

export default router;
