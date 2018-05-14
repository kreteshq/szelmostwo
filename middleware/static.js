// Copyright 2018 Zaiste & contributors. All rights reserved.
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

const debug = require('debug')('huncwot:static');

const fs = require('fs').promises;
const fso = require('fs');

const Promise = require('bluebird');
const path = require('path');
const assert = require('assert');
const mime = require('mime-types');

const static = (root, opts = { index: 'index.html' }) => {
  assert(root, 'you need to specify `root` directory');
  debug('"%s" %j', root, opts);

  return async (ctx, next) => {
    debug('"%s" -> %s', ctx.request.method, ctx.request.url);
    if (ctx.request.method === 'HEAD' || ctx.request.method == 'GET') {
      try {
        let file = path.join(root, ctx.request.url);
        let stats = await fs.stat(file);

        if (stats.isDirectory()) {
          file = path.join(file, opts.index);
          stats = await fs.stat(file);
        }

        let type = path.extname(file);

        return {
          statusCode: 200,
          headers: {
            'Content-Type': mime.lookup(type) || 'application/octet-stream',
            'Content-Length': stats.size
          },
          body: fso.createReadStream(file)
        };
      } catch (error) {
        return next();
      }
    } else {
      return next();
    }
  };
};

module.exports = static;
