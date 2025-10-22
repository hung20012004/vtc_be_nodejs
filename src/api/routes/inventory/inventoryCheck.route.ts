import express from 'express';
import { protect, authorize } from '../../middlewares/auth.middleware';
import * as CheckController from '../../controllers/inventory/inventoryCheck.controller'; 

const router = express.Router();
router.use(protect);
router.use(authorize('manage-inventory'));

router.get('/', CheckController.getAllChecks);
router.post('/', CheckController.startNewCheck);
router.get('/:checkId', CheckController.getCheckById);
router.delete('/:checkId', CheckController.deleteCheck);
router.post('/:checkId/items', CheckController.addItemToCheck);
router.patch('/:checkId/items/:itemId', CheckController.updateItemInCheck);
router.delete('/:checkId/items/:itemId', CheckController.removeItemFromCheck);
router.post('/:checkId/complete', CheckController.completeCheck);

export default router;