import { Router } from 'express';
import { protect, restrictTo } from '../../middleware/auth.js';
import {
  registerEndpoint,
  listEndpoints,
  updateEndpointStatus,
  removeEndpoint,
  rotateSigningSecret,
  listDeliveries,
  retryDeliveryAttempt
} from './controller.js';

const router = Router();

// Protect all routes and restrict ONLY to merchants
router.use(protect);
router.use(restrictTo('MERCHANT'));

router.post('/endpoints', registerEndpoint);
router.get('/endpoints', listEndpoints);
router.put('/endpoints/:id', updateEndpointStatus);
router.delete('/endpoints/:id', removeEndpoint);
router.post('/endpoints/:id/rotate', rotateSigningSecret);

router.get('/deliveries', listDeliveries);
router.post('/deliveries/:id/retry', retryDeliveryAttempt);

export default router;
