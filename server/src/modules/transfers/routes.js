import { Router } from 'express';
import { createTransfer, getTransfer } from './controller.js';
import { protect } from '../../middleware/auth.js';
import { idempotency } from '../../middleware/idempotency.js';

const router = Router();

// Protect all transfer routes
router.use(protect);

router.post('/', idempotency, createTransfer);
router.get('/:id', getTransfer);

export default router;
