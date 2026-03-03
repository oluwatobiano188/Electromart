const router = require('express').Router();
const { body } = require('express-validator');
const { getCart, addItem, updateItem, removeItem, clearCart } = require('../controllers/cart.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/error');

router.use(authenticate);
router.get('/', getCart);
router.delete('/', clearCart);
router.post('/', [body('product_id').isUUID(), body('quantity').optional().isInt({ min: 1 })], validate, addItem);
router.patch('/:id', [body('quantity').isInt({ min: 0 })], validate, updateItem);
router.delete('/:id', removeItem);
module.exports = router;
