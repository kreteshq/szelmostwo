# Szelmostwo (pre-alpha)

> Był Witalis maści rudej,
> Niezbyt gruby, niezbyt chudy,
> Miał na prawym oku bielmo
> I był szelmą. Strasznym szelmą!

## Hello Szelmostwo

Save it to a file e.g. `server.js`, run it with `node server.js` and visit the application `https://localhost:5544`.

```js
const Szelmostwo = require('szelmostwo');
const { ok } = require('szelmostwo/response');

const app = new Szelmostwo();

// implicit `return` with a `text/plain` response
app.get('/', _ => 'Hello Szelmostwo')

// explicit `return` with a 200 response of `application/json` type
app.get('/json', _ => {
  return ok({ a: 1, b: 2 });
})

// set your own headers
app.get('/headers', _ => {
  return { body: 'Hello B', statusCode: 201, headers: { 'Authorization': 'PASS' } }
})

// request body is parsed in `params` by default
app.post('/greet', request => {
  return `Hello POST! ${request.params.name}`;
})

app.listen(5544);
```