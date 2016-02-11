import { Router } from 'director';

let dispatch;

const emit = creator => (...args) => dispatch(creator(...args));

const mapRoutes = routes => {
  let mapped = {};
  Object.keys(routes).forEach(route => {
    let creator = routes[route];
    mapped[route] = emit(creator);
  });
  return mapped;
};

export function createRouter(store, routes) {
  dispatch = store.dispatch;
  let router = Router(mapRoutes(routes));
  router.init();
  return router;
}
