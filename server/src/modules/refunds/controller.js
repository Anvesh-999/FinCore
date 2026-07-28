import refundService from './service.js';

export const issueRefund = async (req, res, next) => {
  try {
    const { id: paymentId } = req.params;
    const { amount, description } = req.body;
    const refund = await refundService.createRefund({
      paymentId,
      amount,
      description,
      merchantId: req.user.id
    });

    res.status(201).json({
      success: true,
      data: refund,
    });
  } catch (err) {
    next(err);
  }
};

export const listMerchantRefunds = async (req, res, next) => {
  try {
    const refunds = await refundService.getMerchantRefunds(req.user.id);
    res.status(200).json({
      success: true,
      data: refunds,
    });
  } catch (err) {
    next(err);
  }
};

export const getRefund = async (req, res, next) => {
  try {
    const { id } = req.params;
    const refund = await refundService.getRefund(id);
    res.status(200).json({
      success: true,
      data: refund,
    });
  } catch (err) {
    next(err);
  }
};

