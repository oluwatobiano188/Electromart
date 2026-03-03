const router = require('express').Router();
const { body } = require('express-validator');
const { list, getOne, create, update, remove } = require('../controllers/products.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/error');

router.get('/', list);
router.get('/:slug', getOne);
router.post('/', authenticate, requireAdmin, [body('name').trim().notEmpty(), body('slug').trim().notEmpty(), body('price').isFloat({ min: 0 })], validate, create);
router.patch('/:id', authenticate, requireAdmin, update);
router.delete('/:id', authenticate, requireAdmin, remove);
module.exports = router;
