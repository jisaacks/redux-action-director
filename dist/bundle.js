'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createRouter = createRouter;

var _director = require('director');

var dispatch = undefined;

var emit = function emit(creator) {
  return function () {
    return dispatch(creator.apply(undefined, arguments));
  };
};

var mapRoutes = function mapRoutes(routes) {
  var mapped = {};
  Object.keys(routes).forEach(function (route) {
    var creator = routes[route];
    mapped[route] = emit(creator);
  });
  return mapped;
};

function createRouter(store, routes) {
  dispatch = store.dispatch;
  var router = (0, _director.Router)(mapRoutes(routes));
  router.init();
  return router;
}

