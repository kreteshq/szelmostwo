# Szelmostwo (very-alpha)

This is [Huncwot](https://github.com/huncwotjs/huncwot)'s core engine. It is
built on top of [uWebSockets.js](https://github.com/uNetworking/uWebSockets.js).

Key features:

* it provides automatic request payload parsing: JSON/forms submissions, file
  uploads, query params, dynamic routes 
* it supports middleware-like functionality, but on **per-route** basis using a regular
  function composition
* it comes with static file support
* it adds security headers out-of-the-box

It is created for convenience when interfacing with uWebSockets.js. You should
probably use [Huncwot](https://github.com/huncwotjs/huncwot) directly.

> Był Witalis maści rudej,
> Niezbyt gruby, niezbyt chudy,
> Miał na prawym oku bielmo
> I był szelmą. Strasznym szelmą!

## Getting Started 

Save it to a file e.g. `server.js`, run it with `node server.js` and visit the application `https://localhost:5544`.

```js
const Szelmostwo = require('szelmostwo');

const app = new Szelmostwo();

// implicit `return` with a `text/plain` response
app.get('/', _ => 'Hello Szelmostwo')

// explicit `return` with a 200 response of `application/json` type
app.get('/json', _ => {
  return ({ status: '200 OK', body: { a: 1, b: 2 } });
})

// set your own headers
app.get('/headers', _ => {
  return { body: 'Niezbyt gruby, Niezbyt chudy', status: '201 Created', headers: { 'Authorization': 'PASS' } }
})

// request body is parsed in `params` by default
app.post('/greet', request => {
  return `Hello POST! ${request.params.name}`;
})

app.listen(5544);
```
