import test from 'ava';
const axios = require('axios');
import FormData from 'formdata-node';

const Szelmostwo = require('..');
const { ok } = require('../response.js');

const app = new Szelmostwo();
app.get('/', _ => 'Hello, World');
app.get('/json', _ => ok({ hello: 'world' }));
app.get('/name/:name', ({ params }) => ok({ hello: params.name }));
app.post('/bim', request => `POST: ${request.params.name}`);
app.post('/upload', async request => `File Upload:`);

app.listen(3000);

const perform = axios.create({
  baseURL: 'http://localhost:3000'
});

test('returns string', async t => {
  const response = await perform.get('/');
  t.is(response.status, 200);
  t.is(response.data, 'Hello, World');
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

test('receives POST data', async t => {
  const response = await perform.post('/bim', {
    name: 'Zaiste'
  });
  t.is(response.status, 200);
  t.is(response.data, 'POST: Zaiste');
});

// TODO
test('receives file upload', async t => {
  const fd = new FormData();

  fd.append('file', 'This is my upload', 'foo.csv');

  const options = {
    headers: fd.headers
  };

  const response = await perform.post('/upload', fd.stream, options);
  t.is(response.status, 200);
});

// const { join } = require('path');

// const Szelmostwo = require('./');
// const { serve } = require('./middleware');

// const cwd = process.cwd();

// const app = new Szelmostwo();
// app.use(serve(join(cwd, 'static')));

// app.get('/', _ => 'Hello Szelmostwo');
// app.listen(5544);
