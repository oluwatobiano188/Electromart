const router = require('express').Router();
const { body } = require('express-validator');
const { createCheckoutSession, handleWebhook, getSession } = require('../controllers/payments.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/error');

router.post('/webhook', handleWebhook);
router.use(authenticate);
router.post('/checkout', [body('shipping_address').isObject()], validate, createCheckoutSession);
router.get('/session/:sessionId', getSession);
module.exports = router;
