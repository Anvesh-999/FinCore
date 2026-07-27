import walletService from './service.js';

export const getWallet = async (req, res, next) => {
  try {
    const wallet = await walletService.getWalletByUserId(req.user.id);
    res.status(200).json({
      success: true,
      data: wallet,
    });
  } catch (err) {
    next(err);
  }
};

export const getWalletTransactions = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = parseInt(req.query.offset, 10) || 0;
    
    const transactions = await walletService.getTransactions(req.user.id, limit, offset);
    res.status(200).json({
      success: true,
      data: transactions,
    });
  } catch (err) {
    next(err);
  }
};
