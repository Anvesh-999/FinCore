import transferService from './service.js';

export const createTransfer = async (req, res, next) => {
  try {
    const { amount, recipientEmail, description } = req.body;
    const idempotencyKey = req.headers['idempotency-key'] || null;

    const result = await transferService.createTransfer({
      senderUserId: req.user.id,
      recipientEmail,
      amount,
      description,
      idempotencyKey,
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const getTransfer = async (req, res, next) => {
  try {
    const transfer = await transferService.getTransferById(req.params.id);
    res.status(200).json({
      success: true,
      data: transfer,
    });
  } catch (err) {
    next(err);
  }
};
