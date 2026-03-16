const express = require("express");
const session = require("express-session");
const { errorHandler } = require("../../middleware/error.middleware");
const { formatDateResponse } = require("../../middleware/response-date-format.middleware");

function createRouteTestApp(mountPath, router) {
  const app = express();

  app.use(express.json());
  app.use(
    session({
      secret: "test-session-secret",
      resave: false,
      saveUninitialized: false
    })
  );

  // Test-only helper endpoint to simulate authenticated session users.
  app.post("/__test/session", (req, res) => {
    req.session.user = req.body;
    req.session.save(() => res.status(200).json({ message: "SESSION_SET" }));
  });

  app.use(formatDateResponse);
  app.use(mountPath, router);
  app.use(errorHandler);

  return app;
}

module.exports = { createRouteTestApp };

