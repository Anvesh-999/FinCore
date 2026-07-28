import { Router } from 'express';
import { getProfile, createKey, listKeys, revokeKey } from './controller.js';
import { protect, restrictTo } from '../../middleware/auth.js';

const router = Router();

// Protect all routes to only logged-in merchants
router.use(protect);
router.use(restrictTo('MERCHANT'));

router.get('/me', getProfile);
router.post('/api-keys', createKey);
router.get('/api-keys', listKeys);
router.delete('/api-keys/:id', revokeKey);

export default router;
