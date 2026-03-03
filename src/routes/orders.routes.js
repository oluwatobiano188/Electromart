const router = require('express').Router();
const { myOrders, getOrder, allOrders, updateStatus } = require('../controllers/orders.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate);
router.get('/', myOrders);
router.get('/:id', getOrder);
router.get('/admin/all', requireAdmin, allOrders);
router.patch('/:id/status', requireAdmin, updateStatus);
module.exports = router;
