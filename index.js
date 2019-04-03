// Copyright 2019 Zaiste & contributors. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const { parse } = require('url');
const http = require('http');
const Emitter = require('events');
const Stream = require('stream');
const querystring = require('querystring');
const Busboy = require('busboy');
const Router = require('trek-router');

const pp = console.log.bind(console);

const isObject = _ => !!_ && _.constructor === Object;

class Szelmostwo extends Emitter {
  constructor() {
    super();
    this.middlewareList = new Middleware();
    this.router = new Router();
  }

  listen() {
    // append 404 handler: it must be put at the end and only once
    // TODO Move to `catch` for pattern matching ?
    this.middlewareList.push(({ response }, next) => {
      response.statusCode = 404;
      response.end();
    });

    const server = http.createServer((request, response) => {
      const context = {
        params: {},
        headers: {},
        request,
        response
      };

      this.middlewareList
        .compose(context)
        .then(result => handle(context, result))
        .catch(error => {
          response.statusCode = 500;
          response.end(error.message);
        });
    });

    return server.listen.apply(server, arguments);
  }

  use(func) {
    if (typeof func !== 'function') {
      throw new TypeError('middleware must be a function');
    }

    this.middlewareList.push(func);

    return this;
  }

  get(path, func) {
    this.use(this.route('GET', path, func));
  }

  post(path, func) {
    this.use(this.route('POST', path, func));
  }

  put(path, func) {
    this.use(this.route('PUT', path, func));
  }

  patch(path, func) {
    this.use(this.route('PATCH', path, func));
  }

  delete(path, func) {
    this.use(this.route('DELETE', path, func));
  }

  route(method, path, func) {
    this.router.add(method, path, func);

    return async (context, next) => {
      const method = context.request.method;
      const { pathname, query } = parse(context.request.url, true);

      const [handler, dynamicRoutes] = this.router.find(method, pathname);

      const params = {};
      for (let r of dynamicRoutes) {
        params[r.name] = r.value;
      }

      if (handler !== undefined) {
        context.params = { ...context.params, ...query, ...params };
        return await handler(context);
      } else {
        return await next();
      }
    };
  }
}

async function streamToString(stream) {
  const chunks = '';

  return new Promise((resolve, reject) => {
    stream.on('data', chunk => (chunks += chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(chunks));
  });
}

const handleRequest = async context => {
  const buffer = await streamToString(context.request);

  if (buffer.length > 0) {
    const headers = context.request.headers;
    const contentType = headers['content-type'].split(';')[0];

    switch (contentType) {
      case 'application/x-www-form-urlencoded':
        Object.assign(context.params, querystring.parse(buffer));
        break;
      case 'application/json':
        const result = JSON.parse(buffer);
        if (isObject(result)) {
          Object.assign(context.params, result);
        }
        break;
      case 'multipart/form-data':
        context.files = {};

        const busboy = new Busboy({ headers });

        busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
          file.on('data', data => {
            context.files = {
              ...context.files,
              [fieldname]: {
                name: filename,
                length: data.length,
                data,
                encoding,
                mimetype
              }
            };
          });
          file.on('end', () => {});
        });
        busboy.on('field', (fieldname, val) => {
          context.params = { ...context.params, [fieldname]: val };
        });
        busboy.end(buffer);

        await new Promise(resolve => busboy.on('finish', resolve));

        break;
      default:
    }
  }
};

const handle = async (context, result = '') => {
  let { request, response } = context;

  let body, headers, type, encoding;

  await handleRequest(context);

  if (typeof result === 'string' || result instanceof Stream) {
    body = result;
  } else {
    body = result.body;
    headers = result.headers;
    type = result.type;
    encoding = result.encoding;
  }

  response.statusCode = result.statusCode || 200;

  const buffer = [];

  for (var key in headers) {
    response.setHeader(key, headers[key]);
  }

  if (encoding) response.setHeader('Content-Encoding', encoding);

  if (Buffer.isBuffer(body)) {
    response.setHeader('Content-Type', type || 'application/octet-stream');
    response.setHeader('Content-Length', body.length);
    response.end(body);
    return;
  }

  if (body instanceof Stream) {
    if (!response.getHeader('Content-Type'))
      response.setHeader('Content-Type', type || 'text/html');

    body.pipe(response);
    return;
  }

  let str = body;

  if (typeof body === 'object' || typeof body === 'number') {
    str = JSON.stringify(body);
    response.setHeader('Content-Type', 'application/json');
  } else {
    if (!response.getHeader('Content-Type'))
      response.setHeader('Content-Type', type || 'text/plain');
  }

  response.setHeader('Content-Length', Buffer.byteLength(str));
  response.end(str);
};

class Middleware extends Array {
  async next(context, last, current, done, called, func) {
    if ((done = current > this.length)) return;

    func = this[current] || last;

    return (
      func &&
      func(context, async () => {
        if (called) throw new Error('next() already called');
        called = true;
        return await this.next(context, last, current + 1);
      })
    );
  }

  async compose(context, last) {
    try {
      return await this.next(context, last, 0);
    } catch (error) {
      return error;
    }
  }
}

module.exports = Szelmostwo;
