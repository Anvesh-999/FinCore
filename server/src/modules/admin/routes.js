import { Router } from 'express';
import { getWallets, updateWalletStatus, getTransfers, getLedgerBook, getPayments, getRefunds, getRiskAssessments, getReconciliationRuns, triggerReconciliationCheck, getWebhookDeliveries } from './controller.js';
import { protect, restrictTo } from '../../middleware/auth.js';

const router = Router();

// Enforce auth and RBAC (Admin or Auditor) for all admin operations
router.use(protect);
router.use(restrictTo('ADMIN', 'AUDITOR'));

// Read operations for both Admin and Auditor
router.get('/wallets', getWallets);
router.get('/transfers', getTransfers);
router.get('/ledger', getLedgerBook);
router.get('/payments', getPayments);
router.get('/refunds', getRefunds);
router.get('/risk/assessments', getRiskAssessments);
router.get('/reconciliation/runs', getReconciliationRuns);
router.get('/webhooks', getWebhookDeliveries);

// Write operations restricted ONLY to Admin
router.post('/wallets/:id/status', restrictTo('ADMIN'), updateWalletStatus);
router.post('/reconciliation/check', restrictTo('ADMIN'), triggerReconciliationCheck);

export default router;
