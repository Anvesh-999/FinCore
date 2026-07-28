import webhookService from './service.js';

export const registerEndpoint = async (req, res, next) => {
  try {
    const merchantId = req.user.id;
    const { url, events } = req.body;
    const endpoint = await webhookService.createEndpoint(merchantId, { url, events });
    res.status(201).json({
      success: true,
      data: endpoint
    });
  } catch (err) {
    next(err);
  }
};

export const listEndpoints = async (req, res, next) => {
  try {
    const merchantId = req.user.id;
    const endpoints = await webhookService.getEndpoints(merchantId);
    res.status(200).json({
      success: true,
      data: endpoints
    });
  } catch (err) {
    next(err);
  }
};

export const updateEndpointStatus = async (req, res, next) => {
  try {
    const merchantId = req.user.id;
    const { id } = req.params;
    const { url, status, events } = req.body;
    const endpoint = await webhookService.updateEndpoint(merchantId, parseInt(id, 10), { url, status, events });
    res.status(200).json({
      success: true,
      data: endpoint
    });
  } catch (err) {
    next(err);
  }
};

export const removeEndpoint = async (req, res, next) => {
  try {
    const merchantId = req.user.id;
    const { id } = req.params;
    const endpoint = await webhookService.deleteEndpoint(merchantId, parseInt(id, 10));
    res.status(200).json({
      success: true,
      data: endpoint
    });
  } catch (err) {
    next(err);
  }
};

export const rotateSigningSecret = async (req, res, next) => {
  try {
    const merchantId = req.user.id;
    const { id } = req.params;
    const endpoint = await webhookService.rotateSecret(merchantId, parseInt(id, 10));
    res.status(200).json({
      success: true,
      data: endpoint
    });
  } catch (err) {
    next(err);
  }
};

export const listDeliveries = async (req, res, next) => {
  try {
    const merchantId = req.user.id;
    const deliveries = await webhookService.getDeliveries(merchantId);
    res.status(200).json({
      success: true,
      data: deliveries
    });
  } catch (err) {
    next(err);
  }
};

export const retryDeliveryAttempt = async (req, res, next) => {
  try {
    const merchantId = req.user.id;
    const { id } = req.params;
    const result = await webhookService.retryWebhookDelivery(merchantId, id);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};
