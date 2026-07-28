import paymentService from './service.js';

export const createPaymentOrder = async (req, res, next) => {
  try {
    // req.merchantId is set by merchant API auth middleware
    const { amount, currency, reference, metadata, idempotencyKey } = req.body;
    const payment = await paymentService.createPaymentOrder({
      merchantId: req.merchantId,
      amount,
      currency,
      reference,
      metadata,
      idempotencyKey
    });

    res.status(201).json({
      success: true,
      data: payment,
    });
  } catch (err) {
    next(err);
  }
};

export const getPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payment = await paymentService.getPayment(id);
    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (err) {
    next(err);
  }
};

export const processCheckout = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payment = await paymentService.processCheckout(id, req.user.id);
    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (err) {
    next(err);
  }
};

export const listMerchantPayments = async (req, res, next) => {
  try {
    const payments = await paymentService.getMerchantPayments(req.user.id);
    res.status(200).json({
      success: true,
      data: payments,
    });
  } catch (err) {
    next(err);
  }
};

export const getMerchantStats = async (req, res, next) => {
  try {
    const stats = await paymentService.getMerchantStats(req.user.id);
    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (err) {
    next(err);
  }
};
