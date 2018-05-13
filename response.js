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

// XXX auto-create those functions?

const ok = (body = '', headers = {}) => ({ statusCode: 200, headers, body });
const created = (body = '', headers = {}) => ({ statusCode: 201, headers, body });
const accepted = (body = '', headers = {}) => ({ statusCode: 202, headers, body });
const noContent = (headers = {}) => ({ statusCode: 204, headers, body: '' });
const notFound = (headers = {}) => ({ statusCode: 404, headers, body: '' });
const redirect = (url, body = 'Redirecting...', statusCode = 302) => ({
  statusCode,
  headers: { Location: url },
  type: 'text/plain',
  body
});
const json = (content, statusCode = 200) => ({ statusCode, body: JSON.stringify(content), type: 'application/json' });
const html = content => ({ statusCode: 200, type: 'text/html', body: content })

module.exports = {
  ok,
  created,
  accepted,
  redirect,
  html,
  json,
  notFound,
  noContent
};
