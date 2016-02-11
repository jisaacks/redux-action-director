# Redux Action Director

A simple library to map routes to redux action creators.

### Why?

First, I think [react-router](https://github.com/rackt/react-router) is awesome. However, when using the combination of react-router with redux and needing to fetch data based on route params and store that data in redux it can get a little hairy. This is a scenario they are still trying to figure out the best way to handle. Until then, this is a simple solution. It does not offer all the power of react-router and is not intended to. It simply provides an easy way to have routes trigger action creators.

It is actually a tiny wrapper around [director](https://github.com/flatiron/director) that allows you to specify the action creators and it will dispatch them instead of just invoking them.

### Usage

```javascript
import { createRouter } from './redux-action-director';
import { fetchPost } from './actions';
import store from './store';

export default createRouter(store, {
  "/posts/:id": fetchPost
});
```
