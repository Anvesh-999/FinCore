import adminService from './service.js';
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
