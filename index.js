var async = require("async"),
    express = require("express"),
    http_error = require("http-error");

var createApp = exports.createApp = function createApp(options) {
  options = options || {};

  var passports = options.passports;

  var oldCreateInstance = passports._createInstance;

  passports._createInstance = function _createInstance(options, cb) {
    return oldCreateInstance.call(passports, options, function(err, instance) {
      return async.applyEach(passports._createInstanceHandlers || [], instance, options, function(err) {
        if (err) {
          return cb(err);
        }

        return cb(null, instance);
      });
    });
  };

  var app = express();

  if (options.strategies) {
    for (var k in options.strategies) {
      app.use("/" + k, options.strategies[k]);
    }
  }

  if (!options.defaultStrategy) {
    options.defaultStrategy = Object.keys(options.strategies).shift();
  }

  if (!options.loginRedirect) {
    options.loginRedirect = [
      "..",
      "..",
      options.defaultStrategy,
      (options.strategies[options.defaultStrategy]._auth_login || "").replace(/^\//, ""),
    ].join("/");
  }

  if (!options.logoutRedirect) {
    options.logoutRedirect = "/";
  }

  if (!options.mountedAt) {
    options.mountedAt = "/";
  }

  app.ensureLogin = function ensureLogin(req, res, next) {
    if (req.user) {
      return next();
    }

    req.session.redirectTo = req.url;

    var mountedAt = options.mountedAt;
    if (typeof mountedAt === "function") {
      mountedAt = mountedAt.call(null, req);
    }

    return res.redirect(mountedAt + "/-/login");
  };

  app.get("/-/login", function(req, res, next) {
    req.logout();

    var loginRedirect = options.loginRedirect;

    if (typeof loginRedirect === "function") {
      loginRedirect = loginRedirect.call(null, req);
    }

    return res.redirect(loginRedirect);
  });

  app.get("/-/logout", function(req, res, next) {
    req.logout();

    var logoutRedirect = options.logoutRedirect;

    if (typeof logoutRedirect === "function") {
      logoutRedirect = logoutRedirect.call(null, req);
    }

    return res.redirect(logoutRedirect);
  });

  app.get("/-/failure", function(req, res, next) {
    return next(new http_error.Unauthorized());
  });

  app.get("/-/success", function(req, res, next) {
    var redirectTo = req.session.redirectTo || "/";

    delete req.session.redirectTo;

    return res.redirect(redirectTo);
  });

  return app;
};
