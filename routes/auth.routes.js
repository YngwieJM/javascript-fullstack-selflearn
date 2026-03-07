const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const validate = require("../middleware/validate.middleware");
const {loginSchema, registerSchema} = require("../validators/auth.validator");

router.post("/register", validate(registerSchema), authController.register);
router.post("/login",validate(loginSchema), authController.login);

module.exports = router;