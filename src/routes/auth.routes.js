const router = require('express').Router();
const { body } = require('express-validator');
const { register, login, me } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/error');

router.post('/register',
  [body('name').trim().notEmpty(), body('email').isEmail().normalizeEmail(), body('password').isLength({ min: 8 })],
  validate, register
);
router.post('/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  validate, login
);
router.get('/me', authenticate, me);
module.exports = router;
