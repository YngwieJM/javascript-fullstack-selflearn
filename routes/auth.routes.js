const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const validate = require("../middleware/validate.middleware");
const {loginSchema, registerSchema} = require("../validators/auth.validator");
const { authenticate } = require("../middleware/auth.middleware");

router.post("/register", validate(registerSchema), authController.register);
router.post("/login",validate(loginSchema), authController.login);
router.post("/logout", authenticate, authController.logout);
router.get("/me", authenticate, authController.me);

module.exports = router;