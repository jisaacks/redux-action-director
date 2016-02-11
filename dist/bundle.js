(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){


//
// Generated on Tue Dec 16 2014 12:13:47 GMT+0100 (CET) by Charlie Robbins, Paolo Fragomeni & the Contributors (Using Codesurgeon).
// Version 1.2.6
//

(function (exports) {

/*
 * browser.js: Browser specific functionality for director.
 *
 * (C) 2011, Charlie Robbins, Paolo Fragomeni, & the Contributors.
 * MIT LICENSE
 *
 */

var dloc = document.location;

function dlocHashEmpty() {
  // Non-IE browsers return '' when the address bar shows '#'; Director's logic
  // assumes both mean empty.
  return dloc.hash === '' || dloc.hash === '#';
}

var listener = {
  mode: 'modern',
  hash: dloc.hash,
  history: false,

  check: function () {
    var h = dloc.hash;
    if (h != this.hash) {
      this.hash = h;
      this.onHashChanged();
    }
  },

  fire: function () {
    if (this.mode === 'modern') {
      this.history === true ? window.onpopstate() : window.onhashchange();
    }
    else {
      this.onHashChanged();
    }
  },

  init: function (fn, history) {
    var self = this;
    this.history = history;

    if (!Router.listeners) {
      Router.listeners = [];
    }

    function onchange(onChangeEvent) {
      for (var i = 0, l = Router.listeners.length; i < l; i++) {
        Router.listeners[i](onChangeEvent);
      }
    }

    //note IE8 is being counted as 'modern' because it has the hashchange event
    if ('onhashchange' in window && (document.documentMode === undefined
      || document.documentMode > 7)) {
      // At least for now HTML5 history is available for 'modern' browsers only
      if (this.history === true) {
        // There is an old bug in Chrome that causes onpopstate to fire even
        // upon initial page load. Since the handler is run manually in init(),
        // this would cause Chrome to run it twise. Currently the only
        // workaround seems to be to set the handler after the initial page load
        // http://code.google.com/p/chromium/issues/detail?id=63040
        setTimeout(function() {
          window.onpopstate = onchange;
        }, 500);
      }
      else {
        window.onhashchange = onchange;
      }
      this.mode = 'modern';
    }
    else {
      //
      // IE support, based on a concept by Erik Arvidson ...
      //
      var frame = document.createElement('iframe');
      frame.id = 'state-frame';
      frame.style.display = 'none';
      document.body.appendChild(frame);
      this.writeFrame('');

      if ('onpropertychange' in document && 'attachEvent' in document) {
        document.attachEvent('onpropertychange', function () {
          if (event.propertyName === 'location') {
            self.check();
          }
        });
      }

      window.setInterval(function () { self.check(); }, 50);

      this.onHashChanged = onchange;
      this.mode = 'legacy';
    }

    Router.listeners.push(fn);

    return this.mode;
  },

  destroy: function (fn) {
    if (!Router || !Router.listeners) {
      return;
    }

    var listeners = Router.listeners;

    for (var i = listeners.length - 1; i >= 0; i--) {
      if (listeners[i] === fn) {
        listeners.splice(i, 1);
      }
    }
  },

  setHash: function (s) {
    // Mozilla always adds an entry to the history
    if (this.mode === 'legacy') {
      this.writeFrame(s);
    }

    if (this.history === true) {
      window.history.pushState({}, document.title, s);
      // Fire an onpopstate event manually since pushing does not obviously
      // trigger the pop event.
      this.fire();
    } else {
      dloc.hash = (s[0] === '/') ? s : '/' + s;
    }
    return this;
  },

  writeFrame: function (s) {
    // IE support...
    var f = document.getElementById('state-frame');
    var d = f.contentDocument || f.contentWindow.document;
    d.open();
    d.write("<script>_hash = '" + s + "'; onload = parent.listener.syncHash;<script>");
    d.close();
  },

  syncHash: function () {
    // IE support...
    var s = this._hash;
    if (s != dloc.hash) {
      dloc.hash = s;
    }
    return this;
  },

  onHashChanged: function () {}
};

var Router = exports.Router = function (routes) {
  if (!(this instanceof Router)) return new Router(routes);

  this.params   = {};
  this.routes   = {};
  this.methods  = ['on', 'once', 'after', 'before'];
  this.scope    = [];
  this._methods = {};

  this._insert = this.insert;
  this.insert = this.insertEx;

  this.historySupport = (window.history != null ? window.history.pushState : null) != null

  this.configure();
  this.mount(routes || {});
};

Router.prototype.init = function (r) {
  var self = this
    , routeTo;
  this.handler = function(onChangeEvent) {
    var newURL = onChangeEvent && onChangeEvent.newURL || window.location.hash;
    var url = self.history === true ? self.getPath() : newURL.replace(/.*#/, '');
    self.dispatch('on', url.charAt(0) === '/' ? url : '/' + url);
  };

  listener.init(this.handler, this.history);

  if (this.history === false) {
    if (dlocHashEmpty() && r) {
      dloc.hash = r;
    } else if (!dlocHashEmpty()) {
      self.dispatch('on', '/' + dloc.hash.replace(/^(#\/|#|\/)/, ''));
    }
  }
  else {
    if (this.convert_hash_in_init) {
      // Use hash as route
      routeTo = dlocHashEmpty() && r ? r : !dlocHashEmpty() ? dloc.hash.replace(/^#/, '') : null;
      if (routeTo) {
        window.history.replaceState({}, document.title, routeTo);
      }
    }
    else {
      // Use canonical url
      routeTo = this.getPath();
    }

    // Router has been initialized, but due to the chrome bug it will not
    // yet actually route HTML5 history state changes. Thus, decide if should route.
    if (routeTo || this.run_in_init === true) {
      this.handler();
    }
  }

  return this;
};

Router.prototype.explode = function () {
  var v = this.history === true ? this.getPath() : dloc.hash;
  if (v.charAt(1) === '/') { v=v.slice(1) }
  return v.slice(1, v.length).split("/");
};

Router.prototype.setRoute = function (i, v, val) {
  var url = this.explode();

  if (typeof i === 'number' && typeof v === 'string') {
    url[i] = v;
  }
  else if (typeof val === 'string') {
    url.splice(i, v, s);
  }
  else {
    url = [i];
  }

  listener.setHash(url.join('/'));
  return url;
};

//
// ### function insertEx(method, path, route, parent)
// #### @method {string} Method to insert the specific `route`.
// #### @path {Array} Parsed path to insert the `route` at.
// #### @route {Array|function} Route handlers to insert.
// #### @parent {Object} **Optional** Parent "routes" to insert into.
// insert a callback that will only occur once per the matched route.
//
Router.prototype.insertEx = function(method, path, route, parent) {
  if (method === "once") {
    method = "on";
    route = function(route) {
      var once = false;
      return function() {
        if (once) return;
        once = true;
        return route.apply(this, arguments);
      };
    }(route);
  }
  return this._insert(method, path, route, parent);
};

Router.prototype.getRoute = function (v) {
  var ret = v;

  if (typeof v === "number") {
    ret = this.explode()[v];
  }
  else if (typeof v === "string"){
    var h = this.explode();
    ret = h.indexOf(v);
  }
  else {
    ret = this.explode();
  }

  return ret;
};

Router.prototype.destroy = function () {
  listener.destroy(this.handler);
  return this;
};

Router.prototype.getPath = function () {
  var path = window.location.pathname;
  if (path.substr(0, 1) !== '/') {
    path = '/' + path;
  }
  return path;
};
function _every(arr, iterator) {
  for (var i = 0; i < arr.length; i += 1) {
    if (iterator(arr[i], i, arr) === false) {
      return;
    }
  }
}

function _flatten(arr) {
  var flat = [];
  for (var i = 0, n = arr.length; i < n; i++) {
    flat = flat.concat(arr[i]);
  }
  return flat;
}

function _asyncEverySeries(arr, iterator, callback) {
  if (!arr.length) {
    return callback();
  }
  var completed = 0;
  (function iterate() {
    iterator(arr[completed], function(err) {
      if (err || err === false) {
        callback(err);
        callback = function() {};
      } else {
        completed += 1;
        if (completed === arr.length) {
          callback();
        } else {
          iterate();
        }
      }
    });
  })();
}

function paramifyString(str, params, mod) {
  mod = str;
  for (var param in params) {
    if (params.hasOwnProperty(param)) {
      mod = params[param](str);
      if (mod !== str) {
        break;
      }
    }
  }
  return mod === str ? "([._a-zA-Z0-9-%()]+)" : mod;
}

function regifyString(str, params) {
  var matches, last = 0, out = "";
  while (matches = str.substr(last).match(/[^\w\d\- %@&]*\*[^\w\d\- %@&]*/)) {
    last = matches.index + matches[0].length;
    matches[0] = matches[0].replace(/^\*/, "([_.()!\\ %@&a-zA-Z0-9-]+)");
    out += str.substr(0, matches.index) + matches[0];
  }
  str = out += str.substr(last);
  var captures = str.match(/:([^\/]+)/ig), capture, length;
  if (captures) {
    length = captures.length;
    for (var i = 0; i < length; i++) {
      capture = captures[i];
      if (capture.slice(0, 2) === "::") {
        str = capture.slice(1);
      } else {
        str = str.replace(capture, paramifyString(capture, params));
      }
    }
  }
  return str;
}

function terminator(routes, delimiter, start, stop) {
  var last = 0, left = 0, right = 0, start = (start || "(").toString(), stop = (stop || ")").toString(), i;
  for (i = 0; i < routes.length; i++) {
    var chunk = routes[i];
    if (chunk.indexOf(start, last) > chunk.indexOf(stop, last) || ~chunk.indexOf(start, last) && !~chunk.indexOf(stop, last) || !~chunk.indexOf(start, last) && ~chunk.indexOf(stop, last)) {
      left = chunk.indexOf(start, last);
      right = chunk.indexOf(stop, last);
      if (~left && !~right || !~left && ~right) {
        var tmp = routes.slice(0, (i || 1) + 1).join(delimiter);
        routes = [ tmp ].concat(routes.slice((i || 1) + 1));
      }
      last = (right > left ? right : left) + 1;
      i = 0;
    } else {
      last = 0;
    }
  }
  return routes;
}

var QUERY_SEPARATOR = /\?.*/;

Router.prototype.configure = function(options) {
  options = options || {};
  for (var i = 0; i < this.methods.length; i++) {
    this._methods[this.methods[i]] = true;
  }
  this.recurse = options.recurse || this.recurse || false;
  this.async = options.async || false;
  this.delimiter = options.delimiter || "/";
  this.strict = typeof options.strict === "undefined" ? true : options.strict;
  this.notfound = options.notfound;
  this.resource = options.resource;
  this.history = options.html5history && this.historySupport || false;
  this.run_in_init = this.history === true && options.run_handler_in_init !== false;
  this.convert_hash_in_init = this.history === true && options.convert_hash_in_init !== false;
  this.every = {
    after: options.after || null,
    before: options.before || null,
    on: options.on || null
  };
  return this;
};

Router.prototype.param = function(token, matcher) {
  if (token[0] !== ":") {
    token = ":" + token;
  }
  var compiled = new RegExp(token, "g");
  this.params[token] = function(str) {
    return str.replace(compiled, matcher.source || matcher);
  };
  return this;
};

Router.prototype.on = Router.prototype.route = function(method, path, route) {
  var self = this;
  if (!route && typeof path == "function") {
    route = path;
    path = method;
    method = "on";
  }
  if (Array.isArray(path)) {
    return path.forEach(function(p) {
      self.on(method, p, route);
    });
  }
  if (path.source) {
    path = path.source.replace(/\\\//ig, "/");
  }
  if (Array.isArray(method)) {
    return method.forEach(function(m) {
      self.on(m.toLowerCase(), path, route);
    });
  }
  path = path.split(new RegExp(this.delimiter));
  path = terminator(path, this.delimiter);
  this.insert(method, this.scope.concat(path), route);
};

Router.prototype.path = function(path, routesFn) {
  var self = this, length = this.scope.length;
  if (path.source) {
    path = path.source.replace(/\\\//ig, "/");
  }
  path = path.split(new RegExp(this.delimiter));
  path = terminator(path, this.delimiter);
  this.scope = this.scope.concat(path);
  routesFn.call(this, this);
  this.scope.splice(length, path.length);
};

Router.prototype.dispatch = function(method, path, callback) {
  var self = this, fns = this.traverse(method, path.replace(QUERY_SEPARATOR, ""), this.routes, ""), invoked = this._invoked, after;
  this._invoked = true;
  if (!fns || fns.length === 0) {
    this.last = [];
    if (typeof this.notfound === "function") {
      this.invoke([ this.notfound ], {
        method: method,
        path: path
      }, callback);
    }
    return false;
  }
  if (this.recurse === "forward") {
    fns = fns.reverse();
  }
  function updateAndInvoke() {
    self.last = fns.after;
    self.invoke(self.runlist(fns), self, callback);
  }
  after = this.every && this.every.after ? [ this.every.after ].concat(this.last) : [ this.last ];
  if (after && after.length > 0 && invoked) {
    if (this.async) {
      this.invoke(after, this, updateAndInvoke);
    } else {
      this.invoke(after, this);
      updateAndInvoke();
    }
    return true;
  }
  updateAndInvoke();
  return true;
};

Router.prototype.invoke = function(fns, thisArg, callback) {
  var self = this;
  var apply;
  if (this.async) {
    apply = function(fn, next) {
      if (Array.isArray(fn)) {
        return _asyncEverySeries(fn, apply, next);
      } else if (typeof fn == "function") {
        fn.apply(thisArg, (fns.captures || []).concat(next));
      }
    };
    _asyncEverySeries(fns, apply, function() {
      if (callback) {
        callback.apply(thisArg, arguments);
      }
    });
  } else {
    apply = function(fn) {
      if (Array.isArray(fn)) {
        return _every(fn, apply);
      } else if (typeof fn === "function") {
        return fn.apply(thisArg, fns.captures || []);
      } else if (typeof fn === "string" && self.resource) {
        self.resource[fn].apply(thisArg, fns.captures || []);
      }
    };
    _every(fns, apply);
  }
};

Router.prototype.traverse = function(method, path, routes, regexp, filter) {
  var fns = [], current, exact, match, next, that;
  function filterRoutes(routes) {
    if (!filter) {
      return routes;
    }
    function deepCopy(source) {
      var result = [];
      for (var i = 0; i < source.length; i++) {
        result[i] = Array.isArray(source[i]) ? deepCopy(source[i]) : source[i];
      }
      return result;
    }
    function applyFilter(fns) {
      for (var i = fns.length - 1; i >= 0; i--) {
        if (Array.isArray(fns[i])) {
          applyFilter(fns[i]);
          if (fns[i].length === 0) {
            fns.splice(i, 1);
          }
        } else {
          if (!filter(fns[i])) {
            fns.splice(i, 1);
          }
        }
      }
    }
    var newRoutes = deepCopy(routes);
    newRoutes.matched = routes.matched;
    newRoutes.captures = routes.captures;
    newRoutes.after = routes.after.filter(filter);
    applyFilter(newRoutes);
    return newRoutes;
  }
  if (path === this.delimiter && routes[method]) {
    next = [ [ routes.before, routes[method] ].filter(Boolean) ];
    next.after = [ routes.after ].filter(Boolean);
    next.matched = true;
    next.captures = [];
    return filterRoutes(next);
  }
  for (var r in routes) {
    if (routes.hasOwnProperty(r) && (!this._methods[r] || this._methods[r] && typeof routes[r] === "object" && !Array.isArray(routes[r]))) {
      current = exact = regexp + this.delimiter + r;
      if (!this.strict) {
        exact += "[" + this.delimiter + "]?";
      }
      match = path.match(new RegExp("^" + exact));
      if (!match) {
        continue;
      }
      if (match[0] && match[0] == path && routes[r][method]) {
        next = [ [ routes[r].before, routes[r][method] ].filter(Boolean) ];
        next.after = [ routes[r].after ].filter(Boolean);
        next.matched = true;
        next.captures = match.slice(1);
        if (this.recurse && routes === this.routes) {
          next.push([ routes.before, routes.on ].filter(Boolean));
          next.after = next.after.concat([ routes.after ].filter(Boolean));
        }
        return filterRoutes(next);
      }
      next = this.traverse(method, path, routes[r], current);
      if (next.matched) {
        if (next.length > 0) {
          fns = fns.concat(next);
        }
        if (this.recurse) {
          fns.push([ routes[r].before, routes[r].on ].filter(Boolean));
          next.after = next.after.concat([ routes[r].after ].filter(Boolean));
          if (routes === this.routes) {
            fns.push([ routes["before"], routes["on"] ].filter(Boolean));
            next.after = next.after.concat([ routes["after"] ].filter(Boolean));
          }
        }
        fns.matched = true;
        fns.captures = next.captures;
        fns.after = next.after;
        return filterRoutes(fns);
      }
    }
  }
  return false;
};

Router.prototype.insert = function(method, path, route, parent) {
  var methodType, parentType, isArray, nested, part;
  path = path.filter(function(p) {
    return p && p.length > 0;
  });
  parent = parent || this.routes;
  part = path.shift();
  if (/\:|\*/.test(part) && !/\\d|\\w/.test(part)) {
    part = regifyString(part, this.params);
  }
  if (path.length > 0) {
    parent[part] = parent[part] || {};
    return this.insert(method, path, route, parent[part]);
  }
  if (!part && !path.length && parent === this.routes) {
    methodType = typeof parent[method];
    switch (methodType) {
     case "function":
      parent[method] = [ parent[method], route ];
      return;
     case "object":
      parent[method].push(route);
      return;
     case "undefined":
      parent[method] = route;
      return;
    }
    return;
  }
  parentType = typeof parent[part];
  isArray = Array.isArray(parent[part]);
  if (parent[part] && !isArray && parentType == "object") {
    methodType = typeof parent[part][method];
    switch (methodType) {
     case "function":
      parent[part][method] = [ parent[part][method], route ];
      return;
     case "object":
      parent[part][method].push(route);
      return;
     case "undefined":
      parent[part][method] = route;
      return;
    }
  } else if (parentType == "undefined") {
    nested = {};
    nested[method] = route;
    parent[part] = nested;
    return;
  }
  throw new Error("Invalid route context: " + parentType);
};



Router.prototype.extend = function(methods) {
  var self = this, len = methods.length, i;
  function extend(method) {
    self._methods[method] = true;
    self[method] = function() {
      var extra = arguments.length === 1 ? [ method, "" ] : [ method ];
      self.on.apply(self, extra.concat(Array.prototype.slice.call(arguments)));
    };
  }
  for (i = 0; i < len; i++) {
    extend(methods[i]);
  }
};

Router.prototype.runlist = function(fns) {
  var runlist = this.every && this.every.before ? [ this.every.before ].concat(_flatten(fns)) : _flatten(fns);
  if (this.every && this.every.on) {
    runlist.push(this.every.on);
  }
  runlist.captures = fns.captures;
  runlist.source = fns.source;
  return runlist;
};

Router.prototype.mount = function(routes, path) {
  if (!routes || typeof routes !== "object" || Array.isArray(routes)) {
    return;
  }
  var self = this;
  path = path || [];
  if (!Array.isArray(path)) {
    path = path.split(self.delimiter);
  }
  function insertOrMount(route, local) {
    var rename = route, parts = route.split(self.delimiter), routeType = typeof routes[route], isRoute = parts[0] === "" || !self._methods[parts[0]], event = isRoute ? "on" : rename;
    if (isRoute) {
      rename = rename.slice((rename.match(new RegExp("^" + self.delimiter)) || [ "" ])[0].length);
      parts.shift();
    }
    if (isRoute && routeType === "object" && !Array.isArray(routes[route])) {
      local = local.concat(parts);
      self.mount(routes[route], local);
      return;
    }
    if (isRoute) {
      local = local.concat(rename.split(self.delimiter));
      local = terminator(local, self.delimiter);
    }
    self.insert(event, local, routes[route]);
  }
  for (var route in routes) {
    if (routes.hasOwnProperty(route)) {
      insertOrMount(route, path.slice(0));
    }
  }
};



}(typeof exports === "object" ? exports : window));
},{}],2:[function(require,module,exports){
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

},{"director":1}]},{},[2])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3Vzci9sb2NhbC9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIm5vZGVfbW9kdWxlcy9kaXJlY3Rvci9idWlsZC9kaXJlY3Rvci5qcyIsInNyYy9pbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7UUNyc0JnQjs7OztBQWJoQixJQUFJLG9CQUFKOztBQUVBLElBQU0sT0FBTyxTQUFQLElBQU87U0FBVztXQUFhLFNBQVMsbUNBQVQ7R0FBYjtDQUFYOztBQUViLElBQU0sWUFBWSxTQUFaLFNBQVksU0FBVTtBQUMxQixNQUFJLFNBQVMsRUFBVCxDQURzQjtBQUUxQixTQUFPLElBQVAsQ0FBWSxNQUFaLEVBQW9CLE9BQXBCLENBQTRCLGlCQUFTO0FBQ25DLFFBQUksVUFBVSxPQUFPLEtBQVAsQ0FBVixDQUQrQjtBQUVuQyxXQUFPLEtBQVAsSUFBZ0IsS0FBSyxPQUFMLENBQWhCLENBRm1DO0dBQVQsQ0FBNUIsQ0FGMEI7QUFNMUIsU0FBTyxNQUFQLENBTjBCO0NBQVY7O0FBU1gsU0FBUyxZQUFULENBQXNCLEtBQXRCLEVBQTZCLE1BQTdCLEVBQXFDO0FBQzFDLGFBQVcsTUFBTSxRQUFOLENBRCtCO0FBRTFDLE1BQUksU0FBUyxzQkFBTyxVQUFVLE1BQVYsQ0FBUCxDQUFULENBRnNDO0FBRzFDLFNBQU8sSUFBUCxHQUgwQztBQUkxQyxTQUFPLE1BQVAsQ0FKMEM7Q0FBckMiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXG5cbi8vXG4vLyBHZW5lcmF0ZWQgb24gVHVlIERlYyAxNiAyMDE0IDEyOjEzOjQ3IEdNVCswMTAwIChDRVQpIGJ5IENoYXJsaWUgUm9iYmlucywgUGFvbG8gRnJhZ29tZW5pICYgdGhlIENvbnRyaWJ1dG9ycyAoVXNpbmcgQ29kZXN1cmdlb24pLlxuLy8gVmVyc2lvbiAxLjIuNlxuLy9cblxuKGZ1bmN0aW9uIChleHBvcnRzKSB7XG5cbi8qXG4gKiBicm93c2VyLmpzOiBCcm93c2VyIHNwZWNpZmljIGZ1bmN0aW9uYWxpdHkgZm9yIGRpcmVjdG9yLlxuICpcbiAqIChDKSAyMDExLCBDaGFybGllIFJvYmJpbnMsIFBhb2xvIEZyYWdvbWVuaSwgJiB0aGUgQ29udHJpYnV0b3JzLlxuICogTUlUIExJQ0VOU0VcbiAqXG4gKi9cblxudmFyIGRsb2MgPSBkb2N1bWVudC5sb2NhdGlvbjtcblxuZnVuY3Rpb24gZGxvY0hhc2hFbXB0eSgpIHtcbiAgLy8gTm9uLUlFIGJyb3dzZXJzIHJldHVybiAnJyB3aGVuIHRoZSBhZGRyZXNzIGJhciBzaG93cyAnIyc7IERpcmVjdG9yJ3MgbG9naWNcbiAgLy8gYXNzdW1lcyBib3RoIG1lYW4gZW1wdHkuXG4gIHJldHVybiBkbG9jLmhhc2ggPT09ICcnIHx8IGRsb2MuaGFzaCA9PT0gJyMnO1xufVxuXG52YXIgbGlzdGVuZXIgPSB7XG4gIG1vZGU6ICdtb2Rlcm4nLFxuICBoYXNoOiBkbG9jLmhhc2gsXG4gIGhpc3Rvcnk6IGZhbHNlLFxuXG4gIGNoZWNrOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGggPSBkbG9jLmhhc2g7XG4gICAgaWYgKGggIT0gdGhpcy5oYXNoKSB7XG4gICAgICB0aGlzLmhhc2ggPSBoO1xuICAgICAgdGhpcy5vbkhhc2hDaGFuZ2VkKCk7XG4gICAgfVxuICB9LFxuXG4gIGZpcmU6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5tb2RlID09PSAnbW9kZXJuJykge1xuICAgICAgdGhpcy5oaXN0b3J5ID09PSB0cnVlID8gd2luZG93Lm9ucG9wc3RhdGUoKSA6IHdpbmRvdy5vbmhhc2hjaGFuZ2UoKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICB0aGlzLm9uSGFzaENoYW5nZWQoKTtcbiAgICB9XG4gIH0sXG5cbiAgaW5pdDogZnVuY3Rpb24gKGZuLCBoaXN0b3J5KSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHRoaXMuaGlzdG9yeSA9IGhpc3Rvcnk7XG5cbiAgICBpZiAoIVJvdXRlci5saXN0ZW5lcnMpIHtcbiAgICAgIFJvdXRlci5saXN0ZW5lcnMgPSBbXTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbmNoYW5nZShvbkNoYW5nZUV2ZW50KSB7XG4gICAgICBmb3IgKHZhciBpID0gMCwgbCA9IFJvdXRlci5saXN0ZW5lcnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIFJvdXRlci5saXN0ZW5lcnNbaV0ob25DaGFuZ2VFdmVudCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy9ub3RlIElFOCBpcyBiZWluZyBjb3VudGVkIGFzICdtb2Rlcm4nIGJlY2F1c2UgaXQgaGFzIHRoZSBoYXNoY2hhbmdlIGV2ZW50XG4gICAgaWYgKCdvbmhhc2hjaGFuZ2UnIGluIHdpbmRvdyAmJiAoZG9jdW1lbnQuZG9jdW1lbnRNb2RlID09PSB1bmRlZmluZWRcbiAgICAgIHx8IGRvY3VtZW50LmRvY3VtZW50TW9kZSA+IDcpKSB7XG4gICAgICAvLyBBdCBsZWFzdCBmb3Igbm93IEhUTUw1IGhpc3RvcnkgaXMgYXZhaWxhYmxlIGZvciAnbW9kZXJuJyBicm93c2VycyBvbmx5XG4gICAgICBpZiAodGhpcy5oaXN0b3J5ID09PSB0cnVlKSB7XG4gICAgICAgIC8vIFRoZXJlIGlzIGFuIG9sZCBidWcgaW4gQ2hyb21lIHRoYXQgY2F1c2VzIG9ucG9wc3RhdGUgdG8gZmlyZSBldmVuXG4gICAgICAgIC8vIHVwb24gaW5pdGlhbCBwYWdlIGxvYWQuIFNpbmNlIHRoZSBoYW5kbGVyIGlzIHJ1biBtYW51YWxseSBpbiBpbml0KCksXG4gICAgICAgIC8vIHRoaXMgd291bGQgY2F1c2UgQ2hyb21lIHRvIHJ1biBpdCB0d2lzZS4gQ3VycmVudGx5IHRoZSBvbmx5XG4gICAgICAgIC8vIHdvcmthcm91bmQgc2VlbXMgdG8gYmUgdG8gc2V0IHRoZSBoYW5kbGVyIGFmdGVyIHRoZSBpbml0aWFsIHBhZ2UgbG9hZFxuICAgICAgICAvLyBodHRwOi8vY29kZS5nb29nbGUuY29tL3AvY2hyb21pdW0vaXNzdWVzL2RldGFpbD9pZD02MzA0MFxuICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHdpbmRvdy5vbnBvcHN0YXRlID0gb25jaGFuZ2U7XG4gICAgICAgIH0sIDUwMCk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgd2luZG93Lm9uaGFzaGNoYW5nZSA9IG9uY2hhbmdlO1xuICAgICAgfVxuICAgICAgdGhpcy5tb2RlID0gJ21vZGVybic7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgLy9cbiAgICAgIC8vIElFIHN1cHBvcnQsIGJhc2VkIG9uIGEgY29uY2VwdCBieSBFcmlrIEFydmlkc29uIC4uLlxuICAgICAgLy9cbiAgICAgIHZhciBmcmFtZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lmcmFtZScpO1xuICAgICAgZnJhbWUuaWQgPSAnc3RhdGUtZnJhbWUnO1xuICAgICAgZnJhbWUuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZnJhbWUpO1xuICAgICAgdGhpcy53cml0ZUZyYW1lKCcnKTtcblxuICAgICAgaWYgKCdvbnByb3BlcnR5Y2hhbmdlJyBpbiBkb2N1bWVudCAmJiAnYXR0YWNoRXZlbnQnIGluIGRvY3VtZW50KSB7XG4gICAgICAgIGRvY3VtZW50LmF0dGFjaEV2ZW50KCdvbnByb3BlcnR5Y2hhbmdlJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGlmIChldmVudC5wcm9wZXJ0eU5hbWUgPT09ICdsb2NhdGlvbicpIHtcbiAgICAgICAgICAgIHNlbGYuY2hlY2soKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICB3aW5kb3cuc2V0SW50ZXJ2YWwoZnVuY3Rpb24gKCkgeyBzZWxmLmNoZWNrKCk7IH0sIDUwKTtcblxuICAgICAgdGhpcy5vbkhhc2hDaGFuZ2VkID0gb25jaGFuZ2U7XG4gICAgICB0aGlzLm1vZGUgPSAnbGVnYWN5JztcbiAgICB9XG5cbiAgICBSb3V0ZXIubGlzdGVuZXJzLnB1c2goZm4pO1xuXG4gICAgcmV0dXJuIHRoaXMubW9kZTtcbiAgfSxcblxuICBkZXN0cm95OiBmdW5jdGlvbiAoZm4pIHtcbiAgICBpZiAoIVJvdXRlciB8fCAhUm91dGVyLmxpc3RlbmVycykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBsaXN0ZW5lcnMgPSBSb3V0ZXIubGlzdGVuZXJzO1xuXG4gICAgZm9yICh2YXIgaSA9IGxpc3RlbmVycy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgaWYgKGxpc3RlbmVyc1tpXSA9PT0gZm4pIHtcbiAgICAgICAgbGlzdGVuZXJzLnNwbGljZShpLCAxKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgc2V0SGFzaDogZnVuY3Rpb24gKHMpIHtcbiAgICAvLyBNb3ppbGxhIGFsd2F5cyBhZGRzIGFuIGVudHJ5IHRvIHRoZSBoaXN0b3J5XG4gICAgaWYgKHRoaXMubW9kZSA9PT0gJ2xlZ2FjeScpIHtcbiAgICAgIHRoaXMud3JpdGVGcmFtZShzKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5oaXN0b3J5ID09PSB0cnVlKSB7XG4gICAgICB3aW5kb3cuaGlzdG9yeS5wdXNoU3RhdGUoe30sIGRvY3VtZW50LnRpdGxlLCBzKTtcbiAgICAgIC8vIEZpcmUgYW4gb25wb3BzdGF0ZSBldmVudCBtYW51YWxseSBzaW5jZSBwdXNoaW5nIGRvZXMgbm90IG9idmlvdXNseVxuICAgICAgLy8gdHJpZ2dlciB0aGUgcG9wIGV2ZW50LlxuICAgICAgdGhpcy5maXJlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRsb2MuaGFzaCA9IChzWzBdID09PSAnLycpID8gcyA6ICcvJyArIHM7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIHdyaXRlRnJhbWU6IGZ1bmN0aW9uIChzKSB7XG4gICAgLy8gSUUgc3VwcG9ydC4uLlxuICAgIHZhciBmID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3N0YXRlLWZyYW1lJyk7XG4gICAgdmFyIGQgPSBmLmNvbnRlbnREb2N1bWVudCB8fCBmLmNvbnRlbnRXaW5kb3cuZG9jdW1lbnQ7XG4gICAgZC5vcGVuKCk7XG4gICAgZC53cml0ZShcIjxzY3JpcHQ+X2hhc2ggPSAnXCIgKyBzICsgXCInOyBvbmxvYWQgPSBwYXJlbnQubGlzdGVuZXIuc3luY0hhc2g7PHNjcmlwdD5cIik7XG4gICAgZC5jbG9zZSgpO1xuICB9LFxuXG4gIHN5bmNIYXNoOiBmdW5jdGlvbiAoKSB7XG4gICAgLy8gSUUgc3VwcG9ydC4uLlxuICAgIHZhciBzID0gdGhpcy5faGFzaDtcbiAgICBpZiAocyAhPSBkbG9jLmhhc2gpIHtcbiAgICAgIGRsb2MuaGFzaCA9IHM7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIG9uSGFzaENoYW5nZWQ6IGZ1bmN0aW9uICgpIHt9XG59O1xuXG52YXIgUm91dGVyID0gZXhwb3J0cy5Sb3V0ZXIgPSBmdW5jdGlvbiAocm91dGVzKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBSb3V0ZXIpKSByZXR1cm4gbmV3IFJvdXRlcihyb3V0ZXMpO1xuXG4gIHRoaXMucGFyYW1zICAgPSB7fTtcbiAgdGhpcy5yb3V0ZXMgICA9IHt9O1xuICB0aGlzLm1ldGhvZHMgID0gWydvbicsICdvbmNlJywgJ2FmdGVyJywgJ2JlZm9yZSddO1xuICB0aGlzLnNjb3BlICAgID0gW107XG4gIHRoaXMuX21ldGhvZHMgPSB7fTtcblxuICB0aGlzLl9pbnNlcnQgPSB0aGlzLmluc2VydDtcbiAgdGhpcy5pbnNlcnQgPSB0aGlzLmluc2VydEV4O1xuXG4gIHRoaXMuaGlzdG9yeVN1cHBvcnQgPSAod2luZG93Lmhpc3RvcnkgIT0gbnVsbCA/IHdpbmRvdy5oaXN0b3J5LnB1c2hTdGF0ZSA6IG51bGwpICE9IG51bGxcblxuICB0aGlzLmNvbmZpZ3VyZSgpO1xuICB0aGlzLm1vdW50KHJvdXRlcyB8fCB7fSk7XG59O1xuXG5Sb3V0ZXIucHJvdG90eXBlLmluaXQgPSBmdW5jdGlvbiAocikge1xuICB2YXIgc2VsZiA9IHRoaXNcbiAgICAsIHJvdXRlVG87XG4gIHRoaXMuaGFuZGxlciA9IGZ1bmN0aW9uKG9uQ2hhbmdlRXZlbnQpIHtcbiAgICB2YXIgbmV3VVJMID0gb25DaGFuZ2VFdmVudCAmJiBvbkNoYW5nZUV2ZW50Lm5ld1VSTCB8fCB3aW5kb3cubG9jYXRpb24uaGFzaDtcbiAgICB2YXIgdXJsID0gc2VsZi5oaXN0b3J5ID09PSB0cnVlID8gc2VsZi5nZXRQYXRoKCkgOiBuZXdVUkwucmVwbGFjZSgvLiojLywgJycpO1xuICAgIHNlbGYuZGlzcGF0Y2goJ29uJywgdXJsLmNoYXJBdCgwKSA9PT0gJy8nID8gdXJsIDogJy8nICsgdXJsKTtcbiAgfTtcblxuICBsaXN0ZW5lci5pbml0KHRoaXMuaGFuZGxlciwgdGhpcy5oaXN0b3J5KTtcblxuICBpZiAodGhpcy5oaXN0b3J5ID09PSBmYWxzZSkge1xuICAgIGlmIChkbG9jSGFzaEVtcHR5KCkgJiYgcikge1xuICAgICAgZGxvYy5oYXNoID0gcjtcbiAgICB9IGVsc2UgaWYgKCFkbG9jSGFzaEVtcHR5KCkpIHtcbiAgICAgIHNlbGYuZGlzcGF0Y2goJ29uJywgJy8nICsgZGxvYy5oYXNoLnJlcGxhY2UoL14oI1xcL3wjfFxcLykvLCAnJykpO1xuICAgIH1cbiAgfVxuICBlbHNlIHtcbiAgICBpZiAodGhpcy5jb252ZXJ0X2hhc2hfaW5faW5pdCkge1xuICAgICAgLy8gVXNlIGhhc2ggYXMgcm91dGVcbiAgICAgIHJvdXRlVG8gPSBkbG9jSGFzaEVtcHR5KCkgJiYgciA/IHIgOiAhZGxvY0hhc2hFbXB0eSgpID8gZGxvYy5oYXNoLnJlcGxhY2UoL14jLywgJycpIDogbnVsbDtcbiAgICAgIGlmIChyb3V0ZVRvKSB7XG4gICAgICAgIHdpbmRvdy5oaXN0b3J5LnJlcGxhY2VTdGF0ZSh7fSwgZG9jdW1lbnQudGl0bGUsIHJvdXRlVG8pO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIC8vIFVzZSBjYW5vbmljYWwgdXJsXG4gICAgICByb3V0ZVRvID0gdGhpcy5nZXRQYXRoKCk7XG4gICAgfVxuXG4gICAgLy8gUm91dGVyIGhhcyBiZWVuIGluaXRpYWxpemVkLCBidXQgZHVlIHRvIHRoZSBjaHJvbWUgYnVnIGl0IHdpbGwgbm90XG4gICAgLy8geWV0IGFjdHVhbGx5IHJvdXRlIEhUTUw1IGhpc3Rvcnkgc3RhdGUgY2hhbmdlcy4gVGh1cywgZGVjaWRlIGlmIHNob3VsZCByb3V0ZS5cbiAgICBpZiAocm91dGVUbyB8fCB0aGlzLnJ1bl9pbl9pbml0ID09PSB0cnVlKSB7XG4gICAgICB0aGlzLmhhbmRsZXIoKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cblJvdXRlci5wcm90b3R5cGUuZXhwbG9kZSA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHYgPSB0aGlzLmhpc3RvcnkgPT09IHRydWUgPyB0aGlzLmdldFBhdGgoKSA6IGRsb2MuaGFzaDtcbiAgaWYgKHYuY2hhckF0KDEpID09PSAnLycpIHsgdj12LnNsaWNlKDEpIH1cbiAgcmV0dXJuIHYuc2xpY2UoMSwgdi5sZW5ndGgpLnNwbGl0KFwiL1wiKTtcbn07XG5cblJvdXRlci5wcm90b3R5cGUuc2V0Um91dGUgPSBmdW5jdGlvbiAoaSwgdiwgdmFsKSB7XG4gIHZhciB1cmwgPSB0aGlzLmV4cGxvZGUoKTtcblxuICBpZiAodHlwZW9mIGkgPT09ICdudW1iZXInICYmIHR5cGVvZiB2ID09PSAnc3RyaW5nJykge1xuICAgIHVybFtpXSA9IHY7XG4gIH1cbiAgZWxzZSBpZiAodHlwZW9mIHZhbCA9PT0gJ3N0cmluZycpIHtcbiAgICB1cmwuc3BsaWNlKGksIHYsIHMpO1xuICB9XG4gIGVsc2Uge1xuICAgIHVybCA9IFtpXTtcbiAgfVxuXG4gIGxpc3RlbmVyLnNldEhhc2godXJsLmpvaW4oJy8nKSk7XG4gIHJldHVybiB1cmw7XG59O1xuXG4vL1xuLy8gIyMjIGZ1bmN0aW9uIGluc2VydEV4KG1ldGhvZCwgcGF0aCwgcm91dGUsIHBhcmVudClcbi8vICMjIyMgQG1ldGhvZCB7c3RyaW5nfSBNZXRob2QgdG8gaW5zZXJ0IHRoZSBzcGVjaWZpYyBgcm91dGVgLlxuLy8gIyMjIyBAcGF0aCB7QXJyYXl9IFBhcnNlZCBwYXRoIHRvIGluc2VydCB0aGUgYHJvdXRlYCBhdC5cbi8vICMjIyMgQHJvdXRlIHtBcnJheXxmdW5jdGlvbn0gUm91dGUgaGFuZGxlcnMgdG8gaW5zZXJ0LlxuLy8gIyMjIyBAcGFyZW50IHtPYmplY3R9ICoqT3B0aW9uYWwqKiBQYXJlbnQgXCJyb3V0ZXNcIiB0byBpbnNlcnQgaW50by5cbi8vIGluc2VydCBhIGNhbGxiYWNrIHRoYXQgd2lsbCBvbmx5IG9jY3VyIG9uY2UgcGVyIHRoZSBtYXRjaGVkIHJvdXRlLlxuLy9cblJvdXRlci5wcm90b3R5cGUuaW5zZXJ0RXggPSBmdW5jdGlvbihtZXRob2QsIHBhdGgsIHJvdXRlLCBwYXJlbnQpIHtcbiAgaWYgKG1ldGhvZCA9PT0gXCJvbmNlXCIpIHtcbiAgICBtZXRob2QgPSBcIm9uXCI7XG4gICAgcm91dGUgPSBmdW5jdGlvbihyb3V0ZSkge1xuICAgICAgdmFyIG9uY2UgPSBmYWxzZTtcbiAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKG9uY2UpIHJldHVybjtcbiAgICAgICAgb25jZSA9IHRydWU7XG4gICAgICAgIHJldHVybiByb3V0ZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgfTtcbiAgICB9KHJvdXRlKTtcbiAgfVxuICByZXR1cm4gdGhpcy5faW5zZXJ0KG1ldGhvZCwgcGF0aCwgcm91dGUsIHBhcmVudCk7XG59O1xuXG5Sb3V0ZXIucHJvdG90eXBlLmdldFJvdXRlID0gZnVuY3Rpb24gKHYpIHtcbiAgdmFyIHJldCA9IHY7XG5cbiAgaWYgKHR5cGVvZiB2ID09PSBcIm51bWJlclwiKSB7XG4gICAgcmV0ID0gdGhpcy5leHBsb2RlKClbdl07XG4gIH1cbiAgZWxzZSBpZiAodHlwZW9mIHYgPT09IFwic3RyaW5nXCIpe1xuICAgIHZhciBoID0gdGhpcy5leHBsb2RlKCk7XG4gICAgcmV0ID0gaC5pbmRleE9mKHYpO1xuICB9XG4gIGVsc2Uge1xuICAgIHJldCA9IHRoaXMuZXhwbG9kZSgpO1xuICB9XG5cbiAgcmV0dXJuIHJldDtcbn07XG5cblJvdXRlci5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcbiAgbGlzdGVuZXIuZGVzdHJveSh0aGlzLmhhbmRsZXIpO1xuICByZXR1cm4gdGhpcztcbn07XG5cblJvdXRlci5wcm90b3R5cGUuZ2V0UGF0aCA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHBhdGggPSB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWU7XG4gIGlmIChwYXRoLnN1YnN0cigwLCAxKSAhPT0gJy8nKSB7XG4gICAgcGF0aCA9ICcvJyArIHBhdGg7XG4gIH1cbiAgcmV0dXJuIHBhdGg7XG59O1xuZnVuY3Rpb24gX2V2ZXJ5KGFyciwgaXRlcmF0b3IpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnIubGVuZ3RoOyBpICs9IDEpIHtcbiAgICBpZiAoaXRlcmF0b3IoYXJyW2ldLCBpLCBhcnIpID09PSBmYWxzZSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBfZmxhdHRlbihhcnIpIHtcbiAgdmFyIGZsYXQgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDAsIG4gPSBhcnIubGVuZ3RoOyBpIDwgbjsgaSsrKSB7XG4gICAgZmxhdCA9IGZsYXQuY29uY2F0KGFycltpXSk7XG4gIH1cbiAgcmV0dXJuIGZsYXQ7XG59XG5cbmZ1bmN0aW9uIF9hc3luY0V2ZXJ5U2VyaWVzKGFyciwgaXRlcmF0b3IsIGNhbGxiYWNrKSB7XG4gIGlmICghYXJyLmxlbmd0aCkge1xuICAgIHJldHVybiBjYWxsYmFjaygpO1xuICB9XG4gIHZhciBjb21wbGV0ZWQgPSAwO1xuICAoZnVuY3Rpb24gaXRlcmF0ZSgpIHtcbiAgICBpdGVyYXRvcihhcnJbY29tcGxldGVkXSwgZnVuY3Rpb24oZXJyKSB7XG4gICAgICBpZiAoZXJyIHx8IGVyciA9PT0gZmFsc2UpIHtcbiAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgY2FsbGJhY2sgPSBmdW5jdGlvbigpIHt9O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29tcGxldGVkICs9IDE7XG4gICAgICAgIGlmIChjb21wbGV0ZWQgPT09IGFyci5sZW5ndGgpIHtcbiAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGl0ZXJhdGUoKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICB9KSgpO1xufVxuXG5mdW5jdGlvbiBwYXJhbWlmeVN0cmluZyhzdHIsIHBhcmFtcywgbW9kKSB7XG4gIG1vZCA9IHN0cjtcbiAgZm9yICh2YXIgcGFyYW0gaW4gcGFyYW1zKSB7XG4gICAgaWYgKHBhcmFtcy5oYXNPd25Qcm9wZXJ0eShwYXJhbSkpIHtcbiAgICAgIG1vZCA9IHBhcmFtc1twYXJhbV0oc3RyKTtcbiAgICAgIGlmIChtb2QgIT09IHN0cikge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIG1vZCA9PT0gc3RyID8gXCIoWy5fYS16QS1aMC05LSUoKV0rKVwiIDogbW9kO1xufVxuXG5mdW5jdGlvbiByZWdpZnlTdHJpbmcoc3RyLCBwYXJhbXMpIHtcbiAgdmFyIG1hdGNoZXMsIGxhc3QgPSAwLCBvdXQgPSBcIlwiO1xuICB3aGlsZSAobWF0Y2hlcyA9IHN0ci5zdWJzdHIobGFzdCkubWF0Y2goL1teXFx3XFxkXFwtICVAJl0qXFwqW15cXHdcXGRcXC0gJUAmXSovKSkge1xuICAgIGxhc3QgPSBtYXRjaGVzLmluZGV4ICsgbWF0Y2hlc1swXS5sZW5ndGg7XG4gICAgbWF0Y2hlc1swXSA9IG1hdGNoZXNbMF0ucmVwbGFjZSgvXlxcKi8sIFwiKFtfLigpIVxcXFwgJUAmYS16QS1aMC05LV0rKVwiKTtcbiAgICBvdXQgKz0gc3RyLnN1YnN0cigwLCBtYXRjaGVzLmluZGV4KSArIG1hdGNoZXNbMF07XG4gIH1cbiAgc3RyID0gb3V0ICs9IHN0ci5zdWJzdHIobGFzdCk7XG4gIHZhciBjYXB0dXJlcyA9IHN0ci5tYXRjaCgvOihbXlxcL10rKS9pZyksIGNhcHR1cmUsIGxlbmd0aDtcbiAgaWYgKGNhcHR1cmVzKSB7XG4gICAgbGVuZ3RoID0gY2FwdHVyZXMubGVuZ3RoO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIGNhcHR1cmUgPSBjYXB0dXJlc1tpXTtcbiAgICAgIGlmIChjYXB0dXJlLnNsaWNlKDAsIDIpID09PSBcIjo6XCIpIHtcbiAgICAgICAgc3RyID0gY2FwdHVyZS5zbGljZSgxKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0ciA9IHN0ci5yZXBsYWNlKGNhcHR1cmUsIHBhcmFtaWZ5U3RyaW5nKGNhcHR1cmUsIHBhcmFtcykpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gc3RyO1xufVxuXG5mdW5jdGlvbiB0ZXJtaW5hdG9yKHJvdXRlcywgZGVsaW1pdGVyLCBzdGFydCwgc3RvcCkge1xuICB2YXIgbGFzdCA9IDAsIGxlZnQgPSAwLCByaWdodCA9IDAsIHN0YXJ0ID0gKHN0YXJ0IHx8IFwiKFwiKS50b1N0cmluZygpLCBzdG9wID0gKHN0b3AgfHwgXCIpXCIpLnRvU3RyaW5nKCksIGk7XG4gIGZvciAoaSA9IDA7IGkgPCByb3V0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgY2h1bmsgPSByb3V0ZXNbaV07XG4gICAgaWYgKGNodW5rLmluZGV4T2Yoc3RhcnQsIGxhc3QpID4gY2h1bmsuaW5kZXhPZihzdG9wLCBsYXN0KSB8fCB+Y2h1bmsuaW5kZXhPZihzdGFydCwgbGFzdCkgJiYgIX5jaHVuay5pbmRleE9mKHN0b3AsIGxhc3QpIHx8ICF+Y2h1bmsuaW5kZXhPZihzdGFydCwgbGFzdCkgJiYgfmNodW5rLmluZGV4T2Yoc3RvcCwgbGFzdCkpIHtcbiAgICAgIGxlZnQgPSBjaHVuay5pbmRleE9mKHN0YXJ0LCBsYXN0KTtcbiAgICAgIHJpZ2h0ID0gY2h1bmsuaW5kZXhPZihzdG9wLCBsYXN0KTtcbiAgICAgIGlmICh+bGVmdCAmJiAhfnJpZ2h0IHx8ICF+bGVmdCAmJiB+cmlnaHQpIHtcbiAgICAgICAgdmFyIHRtcCA9IHJvdXRlcy5zbGljZSgwLCAoaSB8fCAxKSArIDEpLmpvaW4oZGVsaW1pdGVyKTtcbiAgICAgICAgcm91dGVzID0gWyB0bXAgXS5jb25jYXQocm91dGVzLnNsaWNlKChpIHx8IDEpICsgMSkpO1xuICAgICAgfVxuICAgICAgbGFzdCA9IChyaWdodCA+IGxlZnQgPyByaWdodCA6IGxlZnQpICsgMTtcbiAgICAgIGkgPSAwO1xuICAgIH0gZWxzZSB7XG4gICAgICBsYXN0ID0gMDtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJvdXRlcztcbn1cblxudmFyIFFVRVJZX1NFUEFSQVRPUiA9IC9cXD8uKi87XG5cblJvdXRlci5wcm90b3R5cGUuY29uZmlndXJlID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLm1ldGhvZHMubGVuZ3RoOyBpKyspIHtcbiAgICB0aGlzLl9tZXRob2RzW3RoaXMubWV0aG9kc1tpXV0gPSB0cnVlO1xuICB9XG4gIHRoaXMucmVjdXJzZSA9IG9wdGlvbnMucmVjdXJzZSB8fCB0aGlzLnJlY3Vyc2UgfHwgZmFsc2U7XG4gIHRoaXMuYXN5bmMgPSBvcHRpb25zLmFzeW5jIHx8IGZhbHNlO1xuICB0aGlzLmRlbGltaXRlciA9IG9wdGlvbnMuZGVsaW1pdGVyIHx8IFwiL1wiO1xuICB0aGlzLnN0cmljdCA9IHR5cGVvZiBvcHRpb25zLnN0cmljdCA9PT0gXCJ1bmRlZmluZWRcIiA/IHRydWUgOiBvcHRpb25zLnN0cmljdDtcbiAgdGhpcy5ub3Rmb3VuZCA9IG9wdGlvbnMubm90Zm91bmQ7XG4gIHRoaXMucmVzb3VyY2UgPSBvcHRpb25zLnJlc291cmNlO1xuICB0aGlzLmhpc3RvcnkgPSBvcHRpb25zLmh0bWw1aGlzdG9yeSAmJiB0aGlzLmhpc3RvcnlTdXBwb3J0IHx8IGZhbHNlO1xuICB0aGlzLnJ1bl9pbl9pbml0ID0gdGhpcy5oaXN0b3J5ID09PSB0cnVlICYmIG9wdGlvbnMucnVuX2hhbmRsZXJfaW5faW5pdCAhPT0gZmFsc2U7XG4gIHRoaXMuY29udmVydF9oYXNoX2luX2luaXQgPSB0aGlzLmhpc3RvcnkgPT09IHRydWUgJiYgb3B0aW9ucy5jb252ZXJ0X2hhc2hfaW5faW5pdCAhPT0gZmFsc2U7XG4gIHRoaXMuZXZlcnkgPSB7XG4gICAgYWZ0ZXI6IG9wdGlvbnMuYWZ0ZXIgfHwgbnVsbCxcbiAgICBiZWZvcmU6IG9wdGlvbnMuYmVmb3JlIHx8IG51bGwsXG4gICAgb246IG9wdGlvbnMub24gfHwgbnVsbFxuICB9O1xuICByZXR1cm4gdGhpcztcbn07XG5cblJvdXRlci5wcm90b3R5cGUucGFyYW0gPSBmdW5jdGlvbih0b2tlbiwgbWF0Y2hlcikge1xuICBpZiAodG9rZW5bMF0gIT09IFwiOlwiKSB7XG4gICAgdG9rZW4gPSBcIjpcIiArIHRva2VuO1xuICB9XG4gIHZhciBjb21waWxlZCA9IG5ldyBSZWdFeHAodG9rZW4sIFwiZ1wiKTtcbiAgdGhpcy5wYXJhbXNbdG9rZW5dID0gZnVuY3Rpb24oc3RyKSB7XG4gICAgcmV0dXJuIHN0ci5yZXBsYWNlKGNvbXBpbGVkLCBtYXRjaGVyLnNvdXJjZSB8fCBtYXRjaGVyKTtcbiAgfTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5Sb3V0ZXIucHJvdG90eXBlLm9uID0gUm91dGVyLnByb3RvdHlwZS5yb3V0ZSA9IGZ1bmN0aW9uKG1ldGhvZCwgcGF0aCwgcm91dGUpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBpZiAoIXJvdXRlICYmIHR5cGVvZiBwYXRoID09IFwiZnVuY3Rpb25cIikge1xuICAgIHJvdXRlID0gcGF0aDtcbiAgICBwYXRoID0gbWV0aG9kO1xuICAgIG1ldGhvZCA9IFwib25cIjtcbiAgfVxuICBpZiAoQXJyYXkuaXNBcnJheShwYXRoKSkge1xuICAgIHJldHVybiBwYXRoLmZvckVhY2goZnVuY3Rpb24ocCkge1xuICAgICAgc2VsZi5vbihtZXRob2QsIHAsIHJvdXRlKTtcbiAgICB9KTtcbiAgfVxuICBpZiAocGF0aC5zb3VyY2UpIHtcbiAgICBwYXRoID0gcGF0aC5zb3VyY2UucmVwbGFjZSgvXFxcXFxcLy9pZywgXCIvXCIpO1xuICB9XG4gIGlmIChBcnJheS5pc0FycmF5KG1ldGhvZCkpIHtcbiAgICByZXR1cm4gbWV0aG9kLmZvckVhY2goZnVuY3Rpb24obSkge1xuICAgICAgc2VsZi5vbihtLnRvTG93ZXJDYXNlKCksIHBhdGgsIHJvdXRlKTtcbiAgICB9KTtcbiAgfVxuICBwYXRoID0gcGF0aC5zcGxpdChuZXcgUmVnRXhwKHRoaXMuZGVsaW1pdGVyKSk7XG4gIHBhdGggPSB0ZXJtaW5hdG9yKHBhdGgsIHRoaXMuZGVsaW1pdGVyKTtcbiAgdGhpcy5pbnNlcnQobWV0aG9kLCB0aGlzLnNjb3BlLmNvbmNhdChwYXRoKSwgcm91dGUpO1xufTtcblxuUm91dGVyLnByb3RvdHlwZS5wYXRoID0gZnVuY3Rpb24ocGF0aCwgcm91dGVzRm4pIHtcbiAgdmFyIHNlbGYgPSB0aGlzLCBsZW5ndGggPSB0aGlzLnNjb3BlLmxlbmd0aDtcbiAgaWYgKHBhdGguc291cmNlKSB7XG4gICAgcGF0aCA9IHBhdGguc291cmNlLnJlcGxhY2UoL1xcXFxcXC8vaWcsIFwiL1wiKTtcbiAgfVxuICBwYXRoID0gcGF0aC5zcGxpdChuZXcgUmVnRXhwKHRoaXMuZGVsaW1pdGVyKSk7XG4gIHBhdGggPSB0ZXJtaW5hdG9yKHBhdGgsIHRoaXMuZGVsaW1pdGVyKTtcbiAgdGhpcy5zY29wZSA9IHRoaXMuc2NvcGUuY29uY2F0KHBhdGgpO1xuICByb3V0ZXNGbi5jYWxsKHRoaXMsIHRoaXMpO1xuICB0aGlzLnNjb3BlLnNwbGljZShsZW5ndGgsIHBhdGgubGVuZ3RoKTtcbn07XG5cblJvdXRlci5wcm90b3R5cGUuZGlzcGF0Y2ggPSBmdW5jdGlvbihtZXRob2QsIHBhdGgsIGNhbGxiYWNrKSB7XG4gIHZhciBzZWxmID0gdGhpcywgZm5zID0gdGhpcy50cmF2ZXJzZShtZXRob2QsIHBhdGgucmVwbGFjZShRVUVSWV9TRVBBUkFUT1IsIFwiXCIpLCB0aGlzLnJvdXRlcywgXCJcIiksIGludm9rZWQgPSB0aGlzLl9pbnZva2VkLCBhZnRlcjtcbiAgdGhpcy5faW52b2tlZCA9IHRydWU7XG4gIGlmICghZm5zIHx8IGZucy5sZW5ndGggPT09IDApIHtcbiAgICB0aGlzLmxhc3QgPSBbXTtcbiAgICBpZiAodHlwZW9mIHRoaXMubm90Zm91bmQgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgdGhpcy5pbnZva2UoWyB0aGlzLm5vdGZvdW5kIF0sIHtcbiAgICAgICAgbWV0aG9kOiBtZXRob2QsXG4gICAgICAgIHBhdGg6IHBhdGhcbiAgICAgIH0sIGNhbGxiYWNrKTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmICh0aGlzLnJlY3Vyc2UgPT09IFwiZm9yd2FyZFwiKSB7XG4gICAgZm5zID0gZm5zLnJldmVyc2UoKTtcbiAgfVxuICBmdW5jdGlvbiB1cGRhdGVBbmRJbnZva2UoKSB7XG4gICAgc2VsZi5sYXN0ID0gZm5zLmFmdGVyO1xuICAgIHNlbGYuaW52b2tlKHNlbGYucnVubGlzdChmbnMpLCBzZWxmLCBjYWxsYmFjayk7XG4gIH1cbiAgYWZ0ZXIgPSB0aGlzLmV2ZXJ5ICYmIHRoaXMuZXZlcnkuYWZ0ZXIgPyBbIHRoaXMuZXZlcnkuYWZ0ZXIgXS5jb25jYXQodGhpcy5sYXN0KSA6IFsgdGhpcy5sYXN0IF07XG4gIGlmIChhZnRlciAmJiBhZnRlci5sZW5ndGggPiAwICYmIGludm9rZWQpIHtcbiAgICBpZiAodGhpcy5hc3luYykge1xuICAgICAgdGhpcy5pbnZva2UoYWZ0ZXIsIHRoaXMsIHVwZGF0ZUFuZEludm9rZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuaW52b2tlKGFmdGVyLCB0aGlzKTtcbiAgICAgIHVwZGF0ZUFuZEludm9rZSgpO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICB1cGRhdGVBbmRJbnZva2UoKTtcbiAgcmV0dXJuIHRydWU7XG59O1xuXG5Sb3V0ZXIucHJvdG90eXBlLmludm9rZSA9IGZ1bmN0aW9uKGZucywgdGhpc0FyZywgY2FsbGJhY2spIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgYXBwbHk7XG4gIGlmICh0aGlzLmFzeW5jKSB7XG4gICAgYXBwbHkgPSBmdW5jdGlvbihmbiwgbmV4dCkge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZm4pKSB7XG4gICAgICAgIHJldHVybiBfYXN5bmNFdmVyeVNlcmllcyhmbiwgYXBwbHksIG5leHQpO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgZm4gPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIGZuLmFwcGx5KHRoaXNBcmcsIChmbnMuY2FwdHVyZXMgfHwgW10pLmNvbmNhdChuZXh0KSk7XG4gICAgICB9XG4gICAgfTtcbiAgICBfYXN5bmNFdmVyeVNlcmllcyhmbnMsIGFwcGx5LCBmdW5jdGlvbigpIHtcbiAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjay5hcHBseSh0aGlzQXJnLCBhcmd1bWVudHMpO1xuICAgICAgfVxuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIGFwcGx5ID0gZnVuY3Rpb24oZm4pIHtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KGZuKSkge1xuICAgICAgICByZXR1cm4gX2V2ZXJ5KGZuLCBhcHBseSk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBmbiA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIHJldHVybiBmbi5hcHBseSh0aGlzQXJnLCBmbnMuY2FwdHVyZXMgfHwgW10pO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgZm4gPT09IFwic3RyaW5nXCIgJiYgc2VsZi5yZXNvdXJjZSkge1xuICAgICAgICBzZWxmLnJlc291cmNlW2ZuXS5hcHBseSh0aGlzQXJnLCBmbnMuY2FwdHVyZXMgfHwgW10pO1xuICAgICAgfVxuICAgIH07XG4gICAgX2V2ZXJ5KGZucywgYXBwbHkpO1xuICB9XG59O1xuXG5Sb3V0ZXIucHJvdG90eXBlLnRyYXZlcnNlID0gZnVuY3Rpb24obWV0aG9kLCBwYXRoLCByb3V0ZXMsIHJlZ2V4cCwgZmlsdGVyKSB7XG4gIHZhciBmbnMgPSBbXSwgY3VycmVudCwgZXhhY3QsIG1hdGNoLCBuZXh0LCB0aGF0O1xuICBmdW5jdGlvbiBmaWx0ZXJSb3V0ZXMocm91dGVzKSB7XG4gICAgaWYgKCFmaWx0ZXIpIHtcbiAgICAgIHJldHVybiByb3V0ZXM7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGRlZXBDb3B5KHNvdXJjZSkge1xuICAgICAgdmFyIHJlc3VsdCA9IFtdO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzb3VyY2UubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgcmVzdWx0W2ldID0gQXJyYXkuaXNBcnJheShzb3VyY2VbaV0pID8gZGVlcENvcHkoc291cmNlW2ldKSA6IHNvdXJjZVtpXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGFwcGx5RmlsdGVyKGZucykge1xuICAgICAgZm9yICh2YXIgaSA9IGZucy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShmbnNbaV0pKSB7XG4gICAgICAgICAgYXBwbHlGaWx0ZXIoZm5zW2ldKTtcbiAgICAgICAgICBpZiAoZm5zW2ldLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgZm5zLnNwbGljZShpLCAxKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKCFmaWx0ZXIoZm5zW2ldKSkge1xuICAgICAgICAgICAgZm5zLnNwbGljZShpLCAxKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdmFyIG5ld1JvdXRlcyA9IGRlZXBDb3B5KHJvdXRlcyk7XG4gICAgbmV3Um91dGVzLm1hdGNoZWQgPSByb3V0ZXMubWF0Y2hlZDtcbiAgICBuZXdSb3V0ZXMuY2FwdHVyZXMgPSByb3V0ZXMuY2FwdHVyZXM7XG4gICAgbmV3Um91dGVzLmFmdGVyID0gcm91dGVzLmFmdGVyLmZpbHRlcihmaWx0ZXIpO1xuICAgIGFwcGx5RmlsdGVyKG5ld1JvdXRlcyk7XG4gICAgcmV0dXJuIG5ld1JvdXRlcztcbiAgfVxuICBpZiAocGF0aCA9PT0gdGhpcy5kZWxpbWl0ZXIgJiYgcm91dGVzW21ldGhvZF0pIHtcbiAgICBuZXh0ID0gWyBbIHJvdXRlcy5iZWZvcmUsIHJvdXRlc1ttZXRob2RdIF0uZmlsdGVyKEJvb2xlYW4pIF07XG4gICAgbmV4dC5hZnRlciA9IFsgcm91dGVzLmFmdGVyIF0uZmlsdGVyKEJvb2xlYW4pO1xuICAgIG5leHQubWF0Y2hlZCA9IHRydWU7XG4gICAgbmV4dC5jYXB0dXJlcyA9IFtdO1xuICAgIHJldHVybiBmaWx0ZXJSb3V0ZXMobmV4dCk7XG4gIH1cbiAgZm9yICh2YXIgciBpbiByb3V0ZXMpIHtcbiAgICBpZiAocm91dGVzLmhhc093blByb3BlcnR5KHIpICYmICghdGhpcy5fbWV0aG9kc1tyXSB8fCB0aGlzLl9tZXRob2RzW3JdICYmIHR5cGVvZiByb3V0ZXNbcl0gPT09IFwib2JqZWN0XCIgJiYgIUFycmF5LmlzQXJyYXkocm91dGVzW3JdKSkpIHtcbiAgICAgIGN1cnJlbnQgPSBleGFjdCA9IHJlZ2V4cCArIHRoaXMuZGVsaW1pdGVyICsgcjtcbiAgICAgIGlmICghdGhpcy5zdHJpY3QpIHtcbiAgICAgICAgZXhhY3QgKz0gXCJbXCIgKyB0aGlzLmRlbGltaXRlciArIFwiXT9cIjtcbiAgICAgIH1cbiAgICAgIG1hdGNoID0gcGF0aC5tYXRjaChuZXcgUmVnRXhwKFwiXlwiICsgZXhhY3QpKTtcbiAgICAgIGlmICghbWF0Y2gpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBpZiAobWF0Y2hbMF0gJiYgbWF0Y2hbMF0gPT0gcGF0aCAmJiByb3V0ZXNbcl1bbWV0aG9kXSkge1xuICAgICAgICBuZXh0ID0gWyBbIHJvdXRlc1tyXS5iZWZvcmUsIHJvdXRlc1tyXVttZXRob2RdIF0uZmlsdGVyKEJvb2xlYW4pIF07XG4gICAgICAgIG5leHQuYWZ0ZXIgPSBbIHJvdXRlc1tyXS5hZnRlciBdLmZpbHRlcihCb29sZWFuKTtcbiAgICAgICAgbmV4dC5tYXRjaGVkID0gdHJ1ZTtcbiAgICAgICAgbmV4dC5jYXB0dXJlcyA9IG1hdGNoLnNsaWNlKDEpO1xuICAgICAgICBpZiAodGhpcy5yZWN1cnNlICYmIHJvdXRlcyA9PT0gdGhpcy5yb3V0ZXMpIHtcbiAgICAgICAgICBuZXh0LnB1c2goWyByb3V0ZXMuYmVmb3JlLCByb3V0ZXMub24gXS5maWx0ZXIoQm9vbGVhbikpO1xuICAgICAgICAgIG5leHQuYWZ0ZXIgPSBuZXh0LmFmdGVyLmNvbmNhdChbIHJvdXRlcy5hZnRlciBdLmZpbHRlcihCb29sZWFuKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZpbHRlclJvdXRlcyhuZXh0KTtcbiAgICAgIH1cbiAgICAgIG5leHQgPSB0aGlzLnRyYXZlcnNlKG1ldGhvZCwgcGF0aCwgcm91dGVzW3JdLCBjdXJyZW50KTtcbiAgICAgIGlmIChuZXh0Lm1hdGNoZWQpIHtcbiAgICAgICAgaWYgKG5leHQubGVuZ3RoID4gMCkge1xuICAgICAgICAgIGZucyA9IGZucy5jb25jYXQobmV4dCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMucmVjdXJzZSkge1xuICAgICAgICAgIGZucy5wdXNoKFsgcm91dGVzW3JdLmJlZm9yZSwgcm91dGVzW3JdLm9uIF0uZmlsdGVyKEJvb2xlYW4pKTtcbiAgICAgICAgICBuZXh0LmFmdGVyID0gbmV4dC5hZnRlci5jb25jYXQoWyByb3V0ZXNbcl0uYWZ0ZXIgXS5maWx0ZXIoQm9vbGVhbikpO1xuICAgICAgICAgIGlmIChyb3V0ZXMgPT09IHRoaXMucm91dGVzKSB7XG4gICAgICAgICAgICBmbnMucHVzaChbIHJvdXRlc1tcImJlZm9yZVwiXSwgcm91dGVzW1wib25cIl0gXS5maWx0ZXIoQm9vbGVhbikpO1xuICAgICAgICAgICAgbmV4dC5hZnRlciA9IG5leHQuYWZ0ZXIuY29uY2F0KFsgcm91dGVzW1wiYWZ0ZXJcIl0gXS5maWx0ZXIoQm9vbGVhbikpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBmbnMubWF0Y2hlZCA9IHRydWU7XG4gICAgICAgIGZucy5jYXB0dXJlcyA9IG5leHQuY2FwdHVyZXM7XG4gICAgICAgIGZucy5hZnRlciA9IG5leHQuYWZ0ZXI7XG4gICAgICAgIHJldHVybiBmaWx0ZXJSb3V0ZXMoZm5zKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufTtcblxuUm91dGVyLnByb3RvdHlwZS5pbnNlcnQgPSBmdW5jdGlvbihtZXRob2QsIHBhdGgsIHJvdXRlLCBwYXJlbnQpIHtcbiAgdmFyIG1ldGhvZFR5cGUsIHBhcmVudFR5cGUsIGlzQXJyYXksIG5lc3RlZCwgcGFydDtcbiAgcGF0aCA9IHBhdGguZmlsdGVyKGZ1bmN0aW9uKHApIHtcbiAgICByZXR1cm4gcCAmJiBwLmxlbmd0aCA+IDA7XG4gIH0pO1xuICBwYXJlbnQgPSBwYXJlbnQgfHwgdGhpcy5yb3V0ZXM7XG4gIHBhcnQgPSBwYXRoLnNoaWZ0KCk7XG4gIGlmICgvXFw6fFxcKi8udGVzdChwYXJ0KSAmJiAhL1xcXFxkfFxcXFx3Ly50ZXN0KHBhcnQpKSB7XG4gICAgcGFydCA9IHJlZ2lmeVN0cmluZyhwYXJ0LCB0aGlzLnBhcmFtcyk7XG4gIH1cbiAgaWYgKHBhdGgubGVuZ3RoID4gMCkge1xuICAgIHBhcmVudFtwYXJ0XSA9IHBhcmVudFtwYXJ0XSB8fCB7fTtcbiAgICByZXR1cm4gdGhpcy5pbnNlcnQobWV0aG9kLCBwYXRoLCByb3V0ZSwgcGFyZW50W3BhcnRdKTtcbiAgfVxuICBpZiAoIXBhcnQgJiYgIXBhdGgubGVuZ3RoICYmIHBhcmVudCA9PT0gdGhpcy5yb3V0ZXMpIHtcbiAgICBtZXRob2RUeXBlID0gdHlwZW9mIHBhcmVudFttZXRob2RdO1xuICAgIHN3aXRjaCAobWV0aG9kVHlwZSkge1xuICAgICBjYXNlIFwiZnVuY3Rpb25cIjpcbiAgICAgIHBhcmVudFttZXRob2RdID0gWyBwYXJlbnRbbWV0aG9kXSwgcm91dGUgXTtcbiAgICAgIHJldHVybjtcbiAgICAgY2FzZSBcIm9iamVjdFwiOlxuICAgICAgcGFyZW50W21ldGhvZF0ucHVzaChyb3V0ZSk7XG4gICAgICByZXR1cm47XG4gICAgIGNhc2UgXCJ1bmRlZmluZWRcIjpcbiAgICAgIHBhcmVudFttZXRob2RdID0gcm91dGU7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHJldHVybjtcbiAgfVxuICBwYXJlbnRUeXBlID0gdHlwZW9mIHBhcmVudFtwYXJ0XTtcbiAgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkocGFyZW50W3BhcnRdKTtcbiAgaWYgKHBhcmVudFtwYXJ0XSAmJiAhaXNBcnJheSAmJiBwYXJlbnRUeXBlID09IFwib2JqZWN0XCIpIHtcbiAgICBtZXRob2RUeXBlID0gdHlwZW9mIHBhcmVudFtwYXJ0XVttZXRob2RdO1xuICAgIHN3aXRjaCAobWV0aG9kVHlwZSkge1xuICAgICBjYXNlIFwiZnVuY3Rpb25cIjpcbiAgICAgIHBhcmVudFtwYXJ0XVttZXRob2RdID0gWyBwYXJlbnRbcGFydF1bbWV0aG9kXSwgcm91dGUgXTtcbiAgICAgIHJldHVybjtcbiAgICAgY2FzZSBcIm9iamVjdFwiOlxuICAgICAgcGFyZW50W3BhcnRdW21ldGhvZF0ucHVzaChyb3V0ZSk7XG4gICAgICByZXR1cm47XG4gICAgIGNhc2UgXCJ1bmRlZmluZWRcIjpcbiAgICAgIHBhcmVudFtwYXJ0XVttZXRob2RdID0gcm91dGU7XG4gICAgICByZXR1cm47XG4gICAgfVxuICB9IGVsc2UgaWYgKHBhcmVudFR5cGUgPT0gXCJ1bmRlZmluZWRcIikge1xuICAgIG5lc3RlZCA9IHt9O1xuICAgIG5lc3RlZFttZXRob2RdID0gcm91dGU7XG4gICAgcGFyZW50W3BhcnRdID0gbmVzdGVkO1xuICAgIHJldHVybjtcbiAgfVxuICB0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIHJvdXRlIGNvbnRleHQ6IFwiICsgcGFyZW50VHlwZSk7XG59O1xuXG5cblxuUm91dGVyLnByb3RvdHlwZS5leHRlbmQgPSBmdW5jdGlvbihtZXRob2RzKSB7XG4gIHZhciBzZWxmID0gdGhpcywgbGVuID0gbWV0aG9kcy5sZW5ndGgsIGk7XG4gIGZ1bmN0aW9uIGV4dGVuZChtZXRob2QpIHtcbiAgICBzZWxmLl9tZXRob2RzW21ldGhvZF0gPSB0cnVlO1xuICAgIHNlbGZbbWV0aG9kXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGV4dHJhID0gYXJndW1lbnRzLmxlbmd0aCA9PT0gMSA/IFsgbWV0aG9kLCBcIlwiIF0gOiBbIG1ldGhvZCBdO1xuICAgICAgc2VsZi5vbi5hcHBseShzZWxmLCBleHRyYS5jb25jYXQoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKSkpO1xuICAgIH07XG4gIH1cbiAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgZXh0ZW5kKG1ldGhvZHNbaV0pO1xuICB9XG59O1xuXG5Sb3V0ZXIucHJvdG90eXBlLnJ1bmxpc3QgPSBmdW5jdGlvbihmbnMpIHtcbiAgdmFyIHJ1bmxpc3QgPSB0aGlzLmV2ZXJ5ICYmIHRoaXMuZXZlcnkuYmVmb3JlID8gWyB0aGlzLmV2ZXJ5LmJlZm9yZSBdLmNvbmNhdChfZmxhdHRlbihmbnMpKSA6IF9mbGF0dGVuKGZucyk7XG4gIGlmICh0aGlzLmV2ZXJ5ICYmIHRoaXMuZXZlcnkub24pIHtcbiAgICBydW5saXN0LnB1c2godGhpcy5ldmVyeS5vbik7XG4gIH1cbiAgcnVubGlzdC5jYXB0dXJlcyA9IGZucy5jYXB0dXJlcztcbiAgcnVubGlzdC5zb3VyY2UgPSBmbnMuc291cmNlO1xuICByZXR1cm4gcnVubGlzdDtcbn07XG5cblJvdXRlci5wcm90b3R5cGUubW91bnQgPSBmdW5jdGlvbihyb3V0ZXMsIHBhdGgpIHtcbiAgaWYgKCFyb3V0ZXMgfHwgdHlwZW9mIHJvdXRlcyAhPT0gXCJvYmplY3RcIiB8fCBBcnJheS5pc0FycmF5KHJvdXRlcykpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBwYXRoID0gcGF0aCB8fCBbXTtcbiAgaWYgKCFBcnJheS5pc0FycmF5KHBhdGgpKSB7XG4gICAgcGF0aCA9IHBhdGguc3BsaXQoc2VsZi5kZWxpbWl0ZXIpO1xuICB9XG4gIGZ1bmN0aW9uIGluc2VydE9yTW91bnQocm91dGUsIGxvY2FsKSB7XG4gICAgdmFyIHJlbmFtZSA9IHJvdXRlLCBwYXJ0cyA9IHJvdXRlLnNwbGl0KHNlbGYuZGVsaW1pdGVyKSwgcm91dGVUeXBlID0gdHlwZW9mIHJvdXRlc1tyb3V0ZV0sIGlzUm91dGUgPSBwYXJ0c1swXSA9PT0gXCJcIiB8fCAhc2VsZi5fbWV0aG9kc1twYXJ0c1swXV0sIGV2ZW50ID0gaXNSb3V0ZSA/IFwib25cIiA6IHJlbmFtZTtcbiAgICBpZiAoaXNSb3V0ZSkge1xuICAgICAgcmVuYW1lID0gcmVuYW1lLnNsaWNlKChyZW5hbWUubWF0Y2gobmV3IFJlZ0V4cChcIl5cIiArIHNlbGYuZGVsaW1pdGVyKSkgfHwgWyBcIlwiIF0pWzBdLmxlbmd0aCk7XG4gICAgICBwYXJ0cy5zaGlmdCgpO1xuICAgIH1cbiAgICBpZiAoaXNSb3V0ZSAmJiByb3V0ZVR5cGUgPT09IFwib2JqZWN0XCIgJiYgIUFycmF5LmlzQXJyYXkocm91dGVzW3JvdXRlXSkpIHtcbiAgICAgIGxvY2FsID0gbG9jYWwuY29uY2F0KHBhcnRzKTtcbiAgICAgIHNlbGYubW91bnQocm91dGVzW3JvdXRlXSwgbG9jYWwpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoaXNSb3V0ZSkge1xuICAgICAgbG9jYWwgPSBsb2NhbC5jb25jYXQocmVuYW1lLnNwbGl0KHNlbGYuZGVsaW1pdGVyKSk7XG4gICAgICBsb2NhbCA9IHRlcm1pbmF0b3IobG9jYWwsIHNlbGYuZGVsaW1pdGVyKTtcbiAgICB9XG4gICAgc2VsZi5pbnNlcnQoZXZlbnQsIGxvY2FsLCByb3V0ZXNbcm91dGVdKTtcbiAgfVxuICBmb3IgKHZhciByb3V0ZSBpbiByb3V0ZXMpIHtcbiAgICBpZiAocm91dGVzLmhhc093blByb3BlcnR5KHJvdXRlKSkge1xuICAgICAgaW5zZXJ0T3JNb3VudChyb3V0ZSwgcGF0aC5zbGljZSgwKSk7XG4gICAgfVxuICB9XG59O1xuXG5cblxufSh0eXBlb2YgZXhwb3J0cyA9PT0gXCJvYmplY3RcIiA/IGV4cG9ydHMgOiB3aW5kb3cpKTsiLCJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tICdkaXJlY3Rvcic7XG5cbmxldCBkaXNwYXRjaDtcblxuY29uc3QgZW1pdCA9IGNyZWF0b3IgPT4gKC4uLmFyZ3MpID0+IGRpc3BhdGNoKGNyZWF0b3IoLi4uYXJncykpO1xuXG5jb25zdCBtYXBSb3V0ZXMgPSByb3V0ZXMgPT4ge1xuICBsZXQgbWFwcGVkID0ge307XG4gIE9iamVjdC5rZXlzKHJvdXRlcykuZm9yRWFjaChyb3V0ZSA9PiB7XG4gICAgbGV0IGNyZWF0b3IgPSByb3V0ZXNbcm91dGVdO1xuICAgIG1hcHBlZFtyb3V0ZV0gPSBlbWl0KGNyZWF0b3IpO1xuICB9KTtcbiAgcmV0dXJuIG1hcHBlZDtcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVSb3V0ZXIoc3RvcmUsIHJvdXRlcykge1xuICBkaXNwYXRjaCA9IHN0b3JlLmRpc3BhdGNoO1xuICBsZXQgcm91dGVyID0gUm91dGVyKG1hcFJvdXRlcyhyb3V0ZXMpKTtcbiAgcm91dGVyLmluaXQoKTtcbiAgcmV0dXJuIHJvdXRlcjtcbn1cbiJdfQ==
