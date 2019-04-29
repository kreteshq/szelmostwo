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

const { parse } = require('querystring');

const http = require('uWebSockets.js');
const Stream = require('stream');
const querystring = require('querystring');
const Busboy = require('busboy');

const pp = console.log.bind(console);

const isObject = _ => !!_ && _.constructor === Object;
const compose = (...functions) => args =>
  functions.reduceRight((arg, fn) => fn(arg), args);

const parseCookies = (cookieHeader = '') => {
  const cookies = cookieHeader.split(/; */);
  const decode = decodeURIComponent;

  if (cookies[0] === '') return {};

  const result = {};
  for (let cookie of cookies) {
    const isKeyValue = cookie.includes('=');

    if (!isKeyValue) {
      result[cookie.trim()] = true;
      continue;
    }

    let [key, value] = cookie.split('=');

    key.trim();
    value.trim();

    if ('"' === value[0]) value = value.slice(1, -1);

    try {
      value = decode(value);
    } catch (error) {
      // neglect
    }

    result[key] = value;
  }

  return result;
};

const parseBody = response => {
  let chunks;
  return new Promise((resolve, reject) => {
    response.onData((ab, isLast) => {
      let chunk = Buffer.from(ab);
      chunks = chunks ? Buffer.concat([chunks, chunk]) : Buffer.concat([chunk]);
      if (isLast) {
        try {
          resolve(chunks);
        } catch (error) {
          resolve({});
        }
      }
    });
  });
};

const onFinished = (response, stream) => {
  if (response.id == -1) {
    console.log('onFinished called twice for the same response');
  } else {
    stream.destroy();
  }

  response.id = -1;
};

const toArrayBuffer = buffer =>
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

const pipeStreamOverResponse = (response, stream, size) => {
  stream
    .on('data', chunk => {
      const ab = toArrayBuffer(chunk);
      let lastOffset = response.getWriteOffset();

      let [ok, done] = response.tryEnd(ab, size);

      if (done) {
        onFinished(response, stream);
      } else if (!ok) {
        stream.pause();

        response.ab = ab;
        response.abOffset = lastOffset;

        response.onWritable(offset => {
          let [ok, done] = response.tryEnd(
            response.ab.slice(offset - response.abOffset),
            size
          );

          if (done) {
            onFinished(response, stream);
          } else if (ok) {
            stream.resume();
          }

          return ok;
        });
      }
    })
    .on('error', () => {
      console.log('Unhandled stream error');
    });

  response.onAborted(() => {
    onFinished(response, stream);
  });
};

const toUWS = handler => async (response, request) => {
  response.onAborted(() => {
    response.aborted = true;
  });

  try {
    const context = {
      _: { request, response },
      params: {},
      headers: {}
    };

    const result = await handler(context);

    response.end(result);
  } catch (error) {
    response.writeStatus('500 Internal Server Error');
    response.end(error.message);
  }
};

const pre = order => next => async context => {
  let { _ } = context;

  const headers = {};
  _.request.forEach((k, v) => {
    headers[k] = v;
  });
  context.headers = headers;

  context.cookies = parseCookies(headers.cookie);
  context.method = _.request.getMethod();
  context.url = _.request.getUrl();
  context.queryparams = _.request.getQuery().substring(1);

  const path = context.url;
  const queryparams = context.queryparams;
  const query = parse(queryparams);

  // TODO Ugly Hack, This should be available via uWebSocket.js
  let params = {};
  let paramIndex = 0;
  let paramValue = _.request.getParameter(0);
  while (paramValue !== '') {
    params[order[paramIndex]] = paramValue;
    paramIndex++;
    paramValue = _.request.getParameter(paramIndex);
  }

  context.params = { ...query, ...params };

  const buffer = await parseBody(_.response);

  if (buffer.length > 0) {
    const contentType = headers['content-type'].split(';')[0];

    switch (contentType) {
      case 'application/x-www-form-urlencoded':
        const { params } = context;
        const form = querystring.parse(buffer.toString());
        context.params = { ...params, ...form };
        break;
      case 'application/json':
        const body = JSON.parse(buffer);
        if (isObject(body)) {
          const { params } = context;
          context.params = { ...params, ...body };
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
          const { params } = context;
          context.params = { ...params, [fieldname]: val };
        });
        busboy.end(buffer);

        await new Promise(resolve => busboy.on('finish', resolve));

        break;
      default:
    }
  }

  return next(context);
};

const post = next => {
  return async context => {
    const result = await next(context);

    let { _ } = context;
    const response = _.response;

    let {
      body = '',
      headers = {},
      type,
      encoding,
      status = '200 OK',
      additional
    } = result;

    if (typeof result === 'string' || result instanceof Stream) {
      body = result;
    }

    response.writeStatus(status);

    if (encoding) response.writeHeader('Content-Encoding', encoding);

    for (var key in headers) {
      response.writeHeader(key, headers[key]);
    }

    if (Buffer.isBuffer(body)) {
      response.writeHeader('Content-Type', type || 'application/octet-stream');
      response.writeHeader('Content-Length', body.length);
      return body;
    }

    if (body instanceof Stream) {
      // TODO Another ugly hack, yuck!
      if (additional.size)
        pipeStreamOverResponse(response, body, additional.size);
      return;
    }

    if (typeof body === 'object' || typeof body === 'number') {
      response.writeHeader('Content-Type', 'application/json');
      return JSON.stringify(body);
    }

    // If nothing else matches, return it as plain text
    response.writeHeader('Content-Type', type || 'text/plain');
    return body;
  };
};

class Szelmostwo {
  constructor() {
    this.routes = {
      get: {},
      post: {},
      put: {},
      patch: {},
      del: {}
    };
  }

  listen() {
    const server = http.App({});

    for (let [method, route] of Object.entries(this.routes)) {
      for (let [path, handler] of Object.entries(route)) {
        server[method](path, handler);
      }
    }

    server.any('/*', response => {
      response.writeStatus('404 Not Found');
      response.end('');
    });

    const [port = 5544, fn = () => {}] = arguments;

    return server.listen(port, fn);
  }

  get(path, ...func) {
    this.route('get', path, ...func);
  }

  post(path, ...func) {
    this.route('post', path, ...func);
  }

  put(path, ...func) {
    this.route('put', path, ...func);
  }

  patch(path, ...func) {
    this.route('patch', path, ...func);
  }

  delete(path, ...func) {
    this.route('del', path, ...func);
  }

  route(method, path, ...fns) {
    const order = (path.match(/:\w+/g) || []).map(_ => _.substring(1));

    const [func] = fns.splice(-1, 1);
    const handler =
      fns.length === 0
        ? compose(post, pre(order))(func)
        : compose(post, pre(order), ...fns)(func);

    this.routes[method][path] = toUWS(handler);
  }
}

module.exports = Szelmostwo;
