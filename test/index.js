import test from 'ava';
const axios = require('axios');

const Szelmostwo = require('..');

const identity = next => next;
const append = next => async request => `Hello: ${await next(request)}`;

const app = new Szelmostwo();

app.get('/', _ => 'Hello, World');
app.get('/json', _ => ({
  status: '200 OK',
  headers: {},
  body: { hello: 'world' }
}));
app.get('/name/:name', ({ params }) => ({
  status: '200 OK',
  headers: {},
  body: { hello: params.name }
}));
app.get('/empty', _ => '');
app.get('/unauthorized', _ => ({ status: '401 Unauthorized' }));
app.get('/error', _ => ({ status: '500 Internal Server Error' }));
app.get('/read-cookies', ({ cookies }) => `Got Cookie: ${cookies.session}`);

app.post('/bim', request => `POST: ${request.params.name}`);
app.post('/upload', async request => `File Upload:`);

app.get('/compose1', identity, _ => 'Compose 1');
app.get('/compose2', append, _ => 'Compose 2');

app.listen(3000);

const perform = axios.create({
  baseURL: 'http://localhost:3000'
});

test('returns string', async t => {
  const response = await perform.get('/');
  t.is(response.status, 200);
  t.is(response.data, 'Hello, World');
});

test('returns empty body', async t => {
  const { status, data } = await perform.get('/empty');
  t.is(status, 200);
  t.is(data, '');
});

test('returns sent cookie', async t => {
  const { status, data } = await perform.get('/read-cookies', {
    headers: {
      Cookie: 'session=mysession123; foo=bar'
    }
  });
  t.is(status, 200);
  t.is(data, 'Got Cookie: mysession123');
});

test('returns unauthorized response', async t => {
  try {
    await perform.get('/unauthorized');
  } catch ({
    response: { status, data }
  }) {
    t.is(status, 401);
    t.is(data, '');
  }
});

test('handles error response', async t => {
  try {
    await perform.get('/error');
  } catch ({
    response: { status, data }
  }) {
    t.is(status, 500);
    t.is(data, '');
  }
});

test('compose works & returns string', async t => {
  const response = await perform.get('/compose1');
  t.is(response.status, 200);
  t.is(response.data, 'Compose 1');
});

test('compose works & appends string', async t => {
  const response = await perform.get('/compose2');
  t.is(response.status, 200);
  t.is(response.data, 'Hello: Compose 2');
});

test('returns json', async t => {
  const response = await perform.get('/json');
  t.is(response.status, 200);
  t.deepEqual(response.data, { hello: 'world' });
});

test('returns param', async t => {
  const response = await perform.get('/name/zaiste');
  t.is(response.status, 200);
  t.deepEqual(response.data, { hello: 'zaiste' });
});

test('receives POST data as JSON', async t => {
  const response = await perform.post('/bim', {
    name: 'Zaiste'
  });
  t.is(response.status, 200);
  t.is(response.data, 'POST: Zaiste');
});

const querystring = require('querystring');

test('receives POST data as Form', async t => {
  const response = await perform.post(
    '/bim',
    querystring.stringify({ name: 'Zaiste' })
  );
  t.is(response.status, 200);
  t.is(response.data, 'POST: Zaiste');
});

// TODO
// test('receives file upload', async t => {
//   const fd = new FormData();

//   fd.append('file', 'This is my upload', 'foo.csv');

//   const options = {
//     headers: fd.headers
//   };

//   const response = await perform.post('/upload', fd.stream, options);
//   t.is(response.status, 200);
// });

// const { join } = require('path');

// const Szelmostwo = require('./');
// const { serve } = require('./middleware');

// const cwd = process.cwd();

// const app = new Szelmostwo();
// app.use(serve(join(cwd, 'static')));

// app.get('/', _ => 'Hello Szelmostwo');
// app.listen(5544);
