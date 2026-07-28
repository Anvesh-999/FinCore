import adminService from './service.js';
import paymentService from '../payments/service.js';
import refundService from '../refunds/service.js';
import riskService from '../risk/service.js';
import reconciliationService from '../reconciliation/service.js';
import webhookService from '../webhooks/service.js';
import logger from '../../middleware/logger.js';

export const getWallets = async (req, res, next) => {
  try {
    const wallets = await adminService.getWallets();
    res.status(200).json({
      success: true,
      data: wallets,
    });
  } catch (err) {
    next(err);
  }
};

export const updateWalletStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const wallet = await adminService.updateWalletStatus(id, status);
    logger.info(`Admin updated Wallet ${id} status to: ${status}`);
    res.status(200).json({
      success: true,
      data: wallet,
    });
  } catch (err) {
    next(err);
  }
};

export const getTransfers = async (req, res, next) => {
  try {
    const transfers = await adminService.getTransfers();
    res.status(200).json({
      success: true,
      data: transfers,
    });
  } catch (err) {
    next(err);
  }
};

export const getLedgerBook = async (req, res, next) => {
  try {
    const ledger = await adminService.getLedgerBook();
    res.status(200).json({
      success: true,
      data: ledger,
    });
  } catch (err) {
    next(err);
  }
};

export const getPayments = async (req, res, next) => {
  try {
    const payments = await paymentService.getAllPayments();
    res.status(200).json({
      success: true,
      data: payments,
    });
  } catch (err) {
    next(err);
  }
};

export const getRefunds = async (req, res, next) => {
  try {
    const refunds = await refundService.getAllRefunds();
    res.status(200).json({
      success: true,
      data: refunds,
    });
  } catch (err) {
    next(err);
  }
};

export const getRiskAssessments = async (req, res, next) => {
  try {
    const assessments = await riskService.getAllAssessments();
    res.status(200).json({
      success: true,
      data: assessments,
    });
  } catch (err) {
    next(err);
  }
};

export const getReconciliationRuns = async (req, res, next) => {
  try {
    const runs = await reconciliationService.getRuns();
    res.status(200).json({
      success: true,
      data: runs,
    });
  } catch (err) {
    next(err);
  }
};

export const triggerReconciliationCheck = async (req, res, next) => {
  try {
    const run = await reconciliationService.runConsistencyCheck();
    logger.info(`Admin triggered manual reconciliation check. ID: ${run.id}`);
    res.status(200).json({
      success: true,
      data: run,
    });
  } catch (err) {
    next(err);
  }
};

export const getWebhookDeliveries = async (req, res, next) => {
  try {
    const deliveries = await webhookService.getAllDeliveries();
    res.status(200).json({
      success: true,
      data: deliveries,
    });
  } catch (err) {
    next(err);
  }
};



