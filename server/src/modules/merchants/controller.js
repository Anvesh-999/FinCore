import merchantService from './service.js';

export const getProfile = async (req, res, next) => {
  try {
    const profile = await merchantService.getMerchantByUserId(req.user.id);
    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (err) {
    next(err);
  }
};

export const createKey = async (req, res, next) => {
  try {
    const keyData = await merchantService.generateApiKey(req.user.id);
    res.status(201).json({
      success: true,
      data: keyData,
    });
  } catch (err) {
    next(err);
  }
};

export const listKeys = async (req, res, next) => {
  try {
    const keys = await merchantService.listApiKeys(req.user.id);
    res.status(200).json({
      success: true,
      data: keys,
    });
  } catch (err) {
    next(err);
  }
};

export const revokeKey = async (req, res, next) => {
  try {
    const { id } = req.params;
    await merchantService.revokeApiKey(id, req.user.id);
    res.status(200).json({
      success: true,
      data: { message: 'API key revoked successfully' },
    });
  } catch (err) {
    next(err);
  }
};
