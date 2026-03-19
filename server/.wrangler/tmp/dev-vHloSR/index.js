var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};

// .wrangler/tmp/bundle-N9UnWY/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// .wrangler/tmp/bundle-N9UnWY/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// node_modules/hono/dist/compose.js
var compose = /* @__PURE__ */ __name((middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
    __name(dispatch, "dispatch");
  };
}, "compose");

// node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// node_modules/hono/dist/utils/body.js
var parseBody = /* @__PURE__ */ __name(async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = request instanceof HonoRequest ? request.raw.headers : request.headers;
  const contentType = headers.get("Content-Type");
  if (contentType?.startsWith("multipart/form-data") || contentType?.startsWith("application/x-www-form-urlencoded")) {
    return parseFormData(request, { all, dot });
  }
  return {};
}, "parseBody");
async function parseFormData(request, options) {
  const formData = await request.formData();
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
__name(parseFormData, "parseFormData");
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
__name(convertFormDataToBodyData, "convertFormDataToBodyData");
var handleParsingAllValues = /* @__PURE__ */ __name((form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
}, "handleParsingAllValues");
var handleParsingNestedValues = /* @__PURE__ */ __name((form, key, value) => {
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
}, "handleParsingNestedValues");

// node_modules/hono/dist/utils/url.js
var splitPath = /* @__PURE__ */ __name((path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
}, "splitPath");
var splitRoutingPath = /* @__PURE__ */ __name((routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
}, "splitRoutingPath");
var extractGroupsFromPath = /* @__PURE__ */ __name((path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
}, "extractGroupsFromPath");
var replaceGroupMarks = /* @__PURE__ */ __name((paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
}, "replaceGroupMarks");
var patternCache = {};
var getPattern = /* @__PURE__ */ __name((label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
}, "getPattern");
var tryDecode = /* @__PURE__ */ __name((str, decoder2) => {
  try {
    return decoder2(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder2(match2);
      } catch {
        return match2;
      }
    });
  }
}, "tryDecode");
var tryDecodeURI = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURI), "tryDecodeURI");
var getPath = /* @__PURE__ */ __name((request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const path = url.slice(start, queryIndex === -1 ? void 0 : queryIndex);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63) {
      break;
    }
  }
  return url.slice(start, i);
}, "getPath");
var getPathNoStrict = /* @__PURE__ */ __name((request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
}, "getPathNoStrict");
var mergePath = /* @__PURE__ */ __name((base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
}, "mergePath");
var checkOptionalParameter = /* @__PURE__ */ __name((path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (/\?/.test(segment)) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.replace("?", "");
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
}, "checkOptionalParameter");
var _decodeURI = /* @__PURE__ */ __name((value) => {
  if (!/[%+]/.test(value)) {
    return value;
  }
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return value.indexOf("%") !== -1 ? tryDecode(value, decodeURIComponent_) : value;
}, "_decodeURI");
var _getQueryParam = /* @__PURE__ */ __name((url, key, multiple) => {
  let encoded;
  if (!multiple && key && !/[%+]/.test(key)) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = {};
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
}, "_getQueryParam");
var getQueryParam = _getQueryParam;
var getQueryParams = /* @__PURE__ */ __name((url, key) => {
  return _getQueryParam(url, key, true);
}, "getQueryParams");
var decodeURIComponent_ = decodeURIComponent;

// node_modules/hono/dist/request.js
var tryDecodeURIComponent = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURIComponent_), "tryDecodeURIComponent");
var HonoRequest = /* @__PURE__ */ __name(class {
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
    this.#validatedData = {};
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && /\%/.test(param) ? tryDecodeURIComponent(param) : param;
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = /\%/.test(value) ? tryDecodeURIComponent(value) : value;
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = {};
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return this.bodyCache.parsedBody ??= await parseBody(this, options);
  }
  #cachedBody = (key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    const anyCachedKey = Object.keys(bodyCache)[0];
    if (anyCachedKey) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  };
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text2) => JSON.parse(text2));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    this.#validatedData[target] = data;
  }
  valid(target) {
    return this.#validatedData[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
}, "HonoRequest");

// node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = /* @__PURE__ */ __name((value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
}, "raw");
var resolveCallback = /* @__PURE__ */ __name(async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
}, "resolveCallback");

// node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = /* @__PURE__ */ __name((contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
}, "setDefaultContentType");
var Context = /* @__PURE__ */ __name(class {
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= new Response(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = new Response(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = (...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  };
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = (layout) => this.#layout = layout;
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = () => this.#layout;
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = (renderer) => {
    this.#renderer = renderer;
  };
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = (name, value, options) => {
    if (this.finalized) {
      this.#res = new Response(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  };
  status = (status) => {
    this.#status = status;
  };
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = (key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  };
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = (key) => {
    return this.#var ? this.#var.get(key) : void 0;
  };
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    const responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders ?? new Headers();
    if (typeof arg === "object" && "headers" in arg) {
      const argHeaders = arg.headers instanceof Headers ? arg.headers : new Headers(arg.headers);
      for (const [key, value] of argHeaders) {
        if (key.toLowerCase() === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === "string") {
          responseHeaders.set(k, v);
        } else {
          responseHeaders.delete(k);
          for (const v2 of v) {
            responseHeaders.append(k, v2);
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return new Response(data, { status, headers: responseHeaders });
  }
  newResponse = (...args) => this.#newResponse(...args);
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = (data, arg, headers) => this.#newResponse(data, arg, headers);
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = (text2, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text2) : this.#newResponse(
      text2,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  };
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = (object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  };
  html = (html, arg, headers) => {
    const res = /* @__PURE__ */ __name((html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers)), "res");
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  };
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = (location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  };
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = () => {
    this.#notFoundHandler ??= () => new Response();
    return this.#notFoundHandler(this);
  };
}, "Context");

// node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = /* @__PURE__ */ __name(class extends Error {
}, "UnsupportedPathError");

// node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/hono/dist/hono-base.js
var notFoundHandler = /* @__PURE__ */ __name((c) => {
  return c.text("404 Not Found", 404);
}, "notFoundHandler");
var errorHandler = /* @__PURE__ */ __name((err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
}, "errorHandler");
var Hono = /* @__PURE__ */ __name(class _Hono {
  get;
  post;
  put;
  delete;
  options;
  patch;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = /* @__PURE__ */ __name(async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res, "handler");
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = (handler) => {
    this.errorHandler = handler;
    return this;
  };
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = (handler) => {
    this.#notFoundHandler = handler;
    return this;
  };
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = /* @__PURE__ */ __name((request) => request, "replaceRequest");
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = url.pathname.slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = /* @__PURE__ */ __name(async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    }, "handler");
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = { basePath: this._basePath, path, method, handler };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} Env - env Object
   * @param {ExecutionContext} - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = (request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  };
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = (input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  };
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = () => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  };
}, "_Hono");

// node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = /* @__PURE__ */ __name((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  }, "match2");
  this.match = match2;
  return match2(method, path);
}
__name(match, "match");

// node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
__name(compareKey, "compareKey");
var Node = /* @__PURE__ */ __name(class _Node {
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context, pathErrorCheckOnly) {
    if (tokens.length === 0) {
      if (this.#index !== void 0) {
        throw PATH_ERROR;
      }
      if (pathErrorCheckOnly) {
        return;
      }
      this.#index = index;
      return;
    }
    const [token, ...restTokens] = tokens;
    const pattern = token === "*" ? restTokens.length === 0 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let node;
    if (pattern) {
      const name = pattern[1];
      let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
      if (name && pattern[2]) {
        if (regexpStr === ".*") {
          throw PATH_ERROR;
        }
        regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
        if (/\((?!\?:)/.test(regexpStr)) {
          throw PATH_ERROR;
        }
      }
      node = this.#children[regexpStr];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[regexpStr] = new _Node();
        if (name !== "") {
          node.#varIndex = context.varIndex++;
        }
      }
      if (!pathErrorCheckOnly && name !== "") {
        paramMap.push([name, node.#varIndex]);
      }
    } else {
      node = this.#children[token];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[token] = new _Node();
      }
    }
    node.insert(restTokens, index, paramMap, context, pathErrorCheckOnly);
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      return (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + c.buildRegExpStr();
    });
    if (typeof this.#index === "number") {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
}, "_Node");

// node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = /* @__PURE__ */ __name(class {
  #context = { varIndex: 0 };
  #root = new Node();
  insert(path, index, pathErrorCheckOnly) {
    const paramAssoc = [];
    const groups = [];
    for (let i = 0; ; ) {
      let replaced = false;
      path = path.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = path.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, index, paramAssoc, this.#context, pathErrorCheckOnly);
    return paramAssoc;
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
}, "Trie");

// node_modules/hono/dist/router/reg-exp-router/router.js
var nullMatcher = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
__name(buildWildcardRegExp, "buildWildcardRegExp");
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
__name(clearWildcardRegExpCache, "clearWildcardRegExpCache");
function buildMatcherFromPreprocessedRoutes(routes) {
  const trie = new Trie();
  const handlerData = [];
  if (routes.length === 0) {
    return nullMatcher;
  }
  const routesWithStaticPathFlag = routes.map(
    (route) => [!/\*|\/:/.test(route[0]), ...route]
  ).sort(
    ([isStaticA, pathA], [isStaticB, pathB]) => isStaticA ? 1 : isStaticB ? -1 : pathA.length - pathB.length
  );
  const staticMap = /* @__PURE__ */ Object.create(null);
  for (let i = 0, j = -1, len = routesWithStaticPathFlag.length; i < len; i++) {
    const [pathErrorCheckOnly, path, handlers] = routesWithStaticPathFlag[i];
    if (pathErrorCheckOnly) {
      staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
    } else {
      j++;
    }
    let paramAssoc;
    try {
      paramAssoc = trie.insert(path, j, pathErrorCheckOnly);
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
    if (pathErrorCheckOnly) {
      continue;
    }
    handlerData[j] = handlers.map(([h, paramCount]) => {
      const paramIndexMap = /* @__PURE__ */ Object.create(null);
      paramCount -= 1;
      for (; paramCount >= 0; paramCount--) {
        const [key, value] = paramAssoc[paramCount];
        paramIndexMap[key] = value;
      }
      return [h, paramIndexMap];
    });
  }
  const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
  for (let i = 0, len = handlerData.length; i < len; i++) {
    for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
      const map = handlerData[i][j]?.[1];
      if (!map) {
        continue;
      }
      const keys = Object.keys(map);
      for (let k = 0, len3 = keys.length; k < len3; k++) {
        map[keys[k]] = paramReplacementMap[map[keys[k]]];
      }
    }
  }
  const handlerMap = [];
  for (const i in indexReplacementMap) {
    handlerMap[i] = handlerData[indexReplacementMap[i]];
  }
  return [regexp, handlerMap, staticMap];
}
__name(buildMatcherFromPreprocessedRoutes, "buildMatcherFromPreprocessedRoutes");
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
__name(findMiddleware, "findMiddleware");
var RegExpRouter = /* @__PURE__ */ __name(class {
  name = "RegExpRouter";
  #middleware;
  #routes;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      ;
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      if (method === METHOD_NAME_ALL) {
        Object.keys(middleware).forEach((m) => {
          middleware[m][path] ||= findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        });
      } else {
        middleware[method][path] ||= findMiddleware(middleware[method], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
      }
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          routes[m][path2] ||= [
            ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
          ];
          routes[m][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = void 0;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const routes = [];
    let hasOwnRoute = method === METHOD_NAME_ALL;
    [this.#middleware, this.#routes].forEach((r) => {
      const ownRoute = r[method] ? Object.keys(r[method]).map((path) => [path, r[method][path]]) : [];
      if (ownRoute.length !== 0) {
        hasOwnRoute ||= true;
        routes.push(...ownRoute);
      } else if (method !== METHOD_NAME_ALL) {
        routes.push(
          ...Object.keys(r[METHOD_NAME_ALL]).map((path) => [path, r[METHOD_NAME_ALL][path]])
        );
      }
    });
    if (!hasOwnRoute) {
      return null;
    } else {
      return buildMatcherFromPreprocessedRoutes(routes);
    }
  }
}, "RegExpRouter");

// node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = /* @__PURE__ */ __name(class {
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
}, "SmartRouter");

// node_modules/hono/dist/router/trie-router/node.js
var emptyParams = /* @__PURE__ */ Object.create(null);
var Node2 = /* @__PURE__ */ __name(class _Node2 {
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new _Node2();
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
        score: this.#order
      }
    });
    return curNode;
  }
  #getHandlerSets(node, method, nodeParams, params) {
    const handlerSets = [];
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
    return handlerSets;
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              handlerSets.push(
                ...this.#getHandlerSets(nextNode.#children["*"], method, node.#params)
              );
            }
            handlerSets.push(...this.#getHandlerSets(nextNode, method, node.#params));
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length; k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              handlerSets.push(...this.#getHandlerSets(astNode, method, node.#params));
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          const restPathString = parts.slice(i).join("/");
          if (matcher instanceof RegExp) {
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              handlerSets.push(...this.#getHandlerSets(child, method, node.#params, params));
              if (Object.keys(child.#children).length) {
                child.#params = params;
                const componentCount = m[0].match(/\//)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              handlerSets.push(...this.#getHandlerSets(child, method, params, node.#params));
              if (child.#children["*"]) {
                handlerSets.push(
                  ...this.#getHandlerSets(child.#children["*"], method, params, node.#params)
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      curNodes = tempNodes.concat(curNodesQueue.shift() ?? []);
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
}, "_Node");

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = /* @__PURE__ */ __name(class {
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node2();
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length; i < len; i++) {
        this.#node.insert(method, results[i], handler);
      }
      return;
    }
    this.#node.insert(method, path, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
}, "TrieRouter");

// node_modules/hono/dist/hono.js
var Hono2 = /* @__PURE__ */ __name(class extends Hono {
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
}, "Hono");

// node_modules/hono/dist/middleware/cors/index.js
var cors = /* @__PURE__ */ __name((options) => {
  const defaults = {
    origin: "*",
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"],
    allowHeaders: [],
    exposeHeaders: []
  };
  const opts = {
    ...defaults,
    ...options
  };
  const findAllowOrigin = ((optsOrigin) => {
    if (typeof optsOrigin === "string") {
      if (optsOrigin === "*") {
        return () => optsOrigin;
      } else {
        return (origin) => optsOrigin === origin ? origin : null;
      }
    } else if (typeof optsOrigin === "function") {
      return optsOrigin;
    } else {
      return (origin) => optsOrigin.includes(origin) ? origin : null;
    }
  })(opts.origin);
  const findAllowMethods = ((optsAllowMethods) => {
    if (typeof optsAllowMethods === "function") {
      return optsAllowMethods;
    } else if (Array.isArray(optsAllowMethods)) {
      return () => optsAllowMethods;
    } else {
      return () => [];
    }
  })(opts.allowMethods);
  return /* @__PURE__ */ __name(async function cors2(c, next) {
    function set(key, value) {
      c.res.headers.set(key, value);
    }
    __name(set, "set");
    const allowOrigin = await findAllowOrigin(c.req.header("origin") || "", c);
    if (allowOrigin) {
      set("Access-Control-Allow-Origin", allowOrigin);
    }
    if (opts.credentials) {
      set("Access-Control-Allow-Credentials", "true");
    }
    if (opts.exposeHeaders?.length) {
      set("Access-Control-Expose-Headers", opts.exposeHeaders.join(","));
    }
    if (c.req.method === "OPTIONS") {
      if (opts.origin !== "*") {
        set("Vary", "Origin");
      }
      if (opts.maxAge != null) {
        set("Access-Control-Max-Age", opts.maxAge.toString());
      }
      const allowMethods = await findAllowMethods(c.req.header("origin") || "", c);
      if (allowMethods.length) {
        set("Access-Control-Allow-Methods", allowMethods.join(","));
      }
      let headers = opts.allowHeaders;
      if (!headers?.length) {
        const requestHeaders = c.req.header("Access-Control-Request-Headers");
        if (requestHeaders) {
          headers = requestHeaders.split(/\s*,\s*/);
        }
      }
      if (headers?.length) {
        set("Access-Control-Allow-Headers", headers.join(","));
        c.res.headers.append("Vary", "Access-Control-Request-Headers");
      }
      c.res.headers.delete("Content-Length");
      c.res.headers.delete("Content-Type");
      return new Response(null, {
        headers: c.res.headers,
        status: 204,
        statusText: "No Content"
      });
    }
    await next();
    if (opts.origin !== "*") {
      c.header("Vary", "Origin", { append: true });
    }
  }, "cors2");
}, "cors");

// node_modules/hono/dist/utils/color.js
function getColorEnabled() {
  const { process, Deno } = globalThis;
  const isNoColor = typeof Deno?.noColor === "boolean" ? Deno.noColor : process !== void 0 ? (
    // eslint-disable-next-line no-unsafe-optional-chaining
    "NO_COLOR" in process?.env
  ) : false;
  return !isNoColor;
}
__name(getColorEnabled, "getColorEnabled");
async function getColorEnabledAsync() {
  const { navigator } = globalThis;
  const cfWorkers = "cloudflare:workers";
  const isNoColor = navigator !== void 0 && navigator.userAgent === "Cloudflare-Workers" ? await (async () => {
    try {
      return "NO_COLOR" in ((await import(cfWorkers)).env ?? {});
    } catch {
      return false;
    }
  })() : !getColorEnabled();
  return !isNoColor;
}
__name(getColorEnabledAsync, "getColorEnabledAsync");

// node_modules/hono/dist/middleware/logger/index.js
var humanize = /* @__PURE__ */ __name((times) => {
  const [delimiter, separator] = [",", "."];
  const orderTimes = times.map((v) => v.replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1" + delimiter));
  return orderTimes.join(separator);
}, "humanize");
var time = /* @__PURE__ */ __name((start) => {
  const delta = Date.now() - start;
  return humanize([delta < 1e3 ? delta + "ms" : Math.round(delta / 1e3) + "s"]);
}, "time");
var colorStatus = /* @__PURE__ */ __name(async (status) => {
  const colorEnabled = await getColorEnabledAsync();
  if (colorEnabled) {
    switch (status / 100 | 0) {
      case 5:
        return `\x1B[31m${status}\x1B[0m`;
      case 4:
        return `\x1B[33m${status}\x1B[0m`;
      case 3:
        return `\x1B[36m${status}\x1B[0m`;
      case 2:
        return `\x1B[32m${status}\x1B[0m`;
    }
  }
  return `${status}`;
}, "colorStatus");
async function log(fn, prefix, method, path, status = 0, elapsed) {
  const out = prefix === "<--" ? `${prefix} ${method} ${path}` : `${prefix} ${method} ${path} ${await colorStatus(status)} ${elapsed}`;
  fn(out);
}
__name(log, "log");
var logger = /* @__PURE__ */ __name((fn = console.log) => {
  return /* @__PURE__ */ __name(async function logger2(c, next) {
    const { method, url } = c.req;
    const path = url.slice(url.indexOf("/", 8));
    await log(fn, "<--", method, path);
    const start = Date.now();
    await next();
    await log(fn, "-->", method, path, c.res.status, time(start));
  }, "logger2");
}, "logger");

// node_modules/drizzle-orm/entity.js
var entityKind = Symbol.for("drizzle:entityKind");
var hasOwnEntityKind = Symbol.for("drizzle:hasOwnEntityKind");
function is(value, type) {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (value instanceof type) {
    return true;
  }
  if (!Object.prototype.hasOwnProperty.call(type, entityKind)) {
    throw new Error(
      `Class "${type.name ?? "<unknown>"}" doesn't look like a Drizzle entity. If this is incorrect and the class is provided by Drizzle, please report this as a bug.`
    );
  }
  let cls = value.constructor;
  if (cls) {
    while (cls) {
      if (entityKind in cls && cls[entityKind] === type[entityKind]) {
        return true;
      }
      cls = Object.getPrototypeOf(cls);
    }
  }
  return false;
}
__name(is, "is");

// node_modules/drizzle-orm/logger.js
var _a;
var ConsoleLogWriter = class {
  write(message2) {
    console.log(message2);
  }
};
__name(ConsoleLogWriter, "ConsoleLogWriter");
_a = entityKind;
__publicField(ConsoleLogWriter, _a, "ConsoleLogWriter");
var _a2;
var DefaultLogger = class {
  writer;
  constructor(config) {
    this.writer = config?.writer ?? new ConsoleLogWriter();
  }
  logQuery(query, params) {
    const stringifiedParams = params.map((p) => {
      try {
        return JSON.stringify(p);
      } catch {
        return String(p);
      }
    });
    const paramsStr = stringifiedParams.length ? ` -- params: [${stringifiedParams.join(", ")}]` : "";
    this.writer.write(`Query: ${query}${paramsStr}`);
  }
};
__name(DefaultLogger, "DefaultLogger");
_a2 = entityKind;
__publicField(DefaultLogger, _a2, "DefaultLogger");
var _a3;
var NoopLogger = class {
  logQuery() {
  }
};
__name(NoopLogger, "NoopLogger");
_a3 = entityKind;
__publicField(NoopLogger, _a3, "NoopLogger");

// node_modules/drizzle-orm/table.js
var TableName = Symbol.for("drizzle:Name");
var Schema = Symbol.for("drizzle:Schema");
var Columns = Symbol.for("drizzle:Columns");
var ExtraConfigColumns = Symbol.for("drizzle:ExtraConfigColumns");
var OriginalName = Symbol.for("drizzle:OriginalName");
var BaseName = Symbol.for("drizzle:BaseName");
var IsAlias = Symbol.for("drizzle:IsAlias");
var ExtraConfigBuilder = Symbol.for("drizzle:ExtraConfigBuilder");
var IsDrizzleTable = Symbol.for("drizzle:IsDrizzleTable");
var _a4;
var Table = class {
  /**
   * @internal
   * Can be changed if the table is aliased.
   */
  [(_a4 = entityKind, TableName)];
  /**
   * @internal
   * Used to store the original name of the table, before any aliasing.
   */
  [OriginalName];
  /** @internal */
  [Schema];
  /** @internal */
  [Columns];
  /** @internal */
  [ExtraConfigColumns];
  /**
   *  @internal
   * Used to store the table name before the transformation via the `tableCreator` functions.
   */
  [BaseName];
  /** @internal */
  [IsAlias] = false;
  /** @internal */
  [ExtraConfigBuilder] = void 0;
  constructor(name, schema, baseName) {
    this[TableName] = this[OriginalName] = name;
    this[Schema] = schema;
    this[BaseName] = baseName;
  }
};
__name(Table, "Table");
__publicField(Table, _a4, "Table");
/** @internal */
__publicField(Table, "Symbol", {
  Name: TableName,
  Schema,
  OriginalName,
  Columns,
  ExtraConfigColumns,
  BaseName,
  IsAlias,
  ExtraConfigBuilder
});
function getTableName(table) {
  return table[TableName];
}
__name(getTableName, "getTableName");
function getTableUniqueName(table) {
  return `${table[Schema] ?? "public"}.${table[TableName]}`;
}
__name(getTableUniqueName, "getTableUniqueName");

// node_modules/drizzle-orm/column.js
var _a5;
var Column = class {
  constructor(table, config) {
    this.table = table;
    this.config = config;
    this.name = config.name;
    this.notNull = config.notNull;
    this.default = config.default;
    this.defaultFn = config.defaultFn;
    this.onUpdateFn = config.onUpdateFn;
    this.hasDefault = config.hasDefault;
    this.primary = config.primaryKey;
    this.isUnique = config.isUnique;
    this.uniqueName = config.uniqueName;
    this.uniqueType = config.uniqueType;
    this.dataType = config.dataType;
    this.columnType = config.columnType;
    this.generated = config.generated;
    this.generatedIdentity = config.generatedIdentity;
  }
  name;
  primary;
  notNull;
  default;
  defaultFn;
  onUpdateFn;
  hasDefault;
  isUnique;
  uniqueName;
  uniqueType;
  dataType;
  columnType;
  enumValues = void 0;
  generated = void 0;
  generatedIdentity = void 0;
  config;
  mapFromDriverValue(value) {
    return value;
  }
  mapToDriverValue(value) {
    return value;
  }
  // ** @internal */
  shouldDisableInsert() {
    return this.config.generated !== void 0 && this.config.generated.type !== "byDefault";
  }
};
__name(Column, "Column");
_a5 = entityKind;
__publicField(Column, _a5, "Column");

// node_modules/drizzle-orm/pg-core/table.js
var InlineForeignKeys = Symbol.for("drizzle:PgInlineForeignKeys");
var _a6;
var PgTable = class extends Table {
  /**@internal */
  [(_a6 = entityKind, InlineForeignKeys)] = [];
  /** @internal */
  [Table.Symbol.ExtraConfigBuilder] = void 0;
};
__name(PgTable, "PgTable");
__publicField(PgTable, _a6, "PgTable");
/** @internal */
__publicField(PgTable, "Symbol", Object.assign({}, Table.Symbol, {
  InlineForeignKeys
}));

// node_modules/drizzle-orm/pg-core/primary-keys.js
var _a7;
var PrimaryKeyBuilder = class {
  /** @internal */
  columns;
  /** @internal */
  name;
  constructor(columns, name) {
    this.columns = columns;
    this.name = name;
  }
  /** @internal */
  build(table) {
    return new PrimaryKey(table, this.columns, this.name);
  }
};
__name(PrimaryKeyBuilder, "PrimaryKeyBuilder");
_a7 = entityKind;
__publicField(PrimaryKeyBuilder, _a7, "PgPrimaryKeyBuilder");
var _a8;
var PrimaryKey = class {
  constructor(table, columns, name) {
    this.table = table;
    this.columns = columns;
    this.name = name;
  }
  columns;
  name;
  getName() {
    return this.name ?? `${this.table[PgTable.Symbol.Name]}_${this.columns.map((column) => column.name).join("_")}_pk`;
  }
};
__name(PrimaryKey, "PrimaryKey");
_a8 = entityKind;
__publicField(PrimaryKey, _a8, "PgPrimaryKey");

// node_modules/drizzle-orm/column-builder.js
var _a9;
var ColumnBuilder = class {
  config;
  constructor(name, dataType, columnType) {
    this.config = {
      name,
      notNull: false,
      default: void 0,
      hasDefault: false,
      primaryKey: false,
      isUnique: false,
      uniqueName: void 0,
      uniqueType: void 0,
      dataType,
      columnType,
      generated: void 0
    };
  }
  /**
   * Changes the data type of the column. Commonly used with `json` columns. Also, useful for branded types.
   *
   * @example
   * ```ts
   * const users = pgTable('users', {
   * 	id: integer('id').$type<UserId>().primaryKey(),
   * 	details: json('details').$type<UserDetails>().notNull(),
   * });
   * ```
   */
  $type() {
    return this;
  }
  /**
   * Adds a `not null` clause to the column definition.
   *
   * Affects the `select` model of the table - columns *without* `not null` will be nullable on select.
   */
  notNull() {
    this.config.notNull = true;
    return this;
  }
  /**
   * Adds a `default <value>` clause to the column definition.
   *
   * Affects the `insert` model of the table - columns *with* `default` are optional on insert.
   *
   * If you need to set a dynamic default value, use {@link $defaultFn} instead.
   */
  default(value) {
    this.config.default = value;
    this.config.hasDefault = true;
    return this;
  }
  /**
   * Adds a dynamic default value to the column.
   * The function will be called when the row is inserted, and the returned value will be used as the column value.
   *
   * **Note:** This value does not affect the `drizzle-kit` behavior, it is only used at runtime in `drizzle-orm`.
   */
  $defaultFn(fn) {
    this.config.defaultFn = fn;
    this.config.hasDefault = true;
    return this;
  }
  /**
   * Alias for {@link $defaultFn}.
   */
  $default = this.$defaultFn;
  /**
   * Adds a dynamic update value to the column.
   * The function will be called when the row is updated, and the returned value will be used as the column value if none is provided.
   * If no `default` (or `$defaultFn`) value is provided, the function will be called when the row is inserted as well, and the returned value will be used as the column value.
   *
   * **Note:** This value does not affect the `drizzle-kit` behavior, it is only used at runtime in `drizzle-orm`.
   */
  $onUpdateFn(fn) {
    this.config.onUpdateFn = fn;
    this.config.hasDefault = true;
    return this;
  }
  /**
   * Alias for {@link $onUpdateFn}.
   */
  $onUpdate = this.$onUpdateFn;
  /**
   * Adds a `primary key` clause to the column definition. This implicitly makes the column `not null`.
   *
   * In SQLite, `integer primary key` implicitly makes the column auto-incrementing.
   */
  primaryKey() {
    this.config.primaryKey = true;
    this.config.notNull = true;
    return this;
  }
};
__name(ColumnBuilder, "ColumnBuilder");
_a9 = entityKind;
__publicField(ColumnBuilder, _a9, "ColumnBuilder");

// node_modules/drizzle-orm/pg-core/foreign-keys.js
var _a10;
var ForeignKeyBuilder = class {
  /** @internal */
  reference;
  /** @internal */
  _onUpdate = "no action";
  /** @internal */
  _onDelete = "no action";
  constructor(config, actions) {
    this.reference = () => {
      const { name, columns, foreignColumns } = config();
      return { name, columns, foreignTable: foreignColumns[0].table, foreignColumns };
    };
    if (actions) {
      this._onUpdate = actions.onUpdate;
      this._onDelete = actions.onDelete;
    }
  }
  onUpdate(action) {
    this._onUpdate = action === void 0 ? "no action" : action;
    return this;
  }
  onDelete(action) {
    this._onDelete = action === void 0 ? "no action" : action;
    return this;
  }
  /** @internal */
  build(table) {
    return new ForeignKey(table, this);
  }
};
__name(ForeignKeyBuilder, "ForeignKeyBuilder");
_a10 = entityKind;
__publicField(ForeignKeyBuilder, _a10, "PgForeignKeyBuilder");
var _a11;
var ForeignKey = class {
  constructor(table, builder) {
    this.table = table;
    this.reference = builder.reference;
    this.onUpdate = builder._onUpdate;
    this.onDelete = builder._onDelete;
  }
  reference;
  onUpdate;
  onDelete;
  getName() {
    const { name, columns, foreignColumns } = this.reference();
    const columnNames = columns.map((column) => column.name);
    const foreignColumnNames = foreignColumns.map((column) => column.name);
    const chunks = [
      this.table[PgTable.Symbol.Name],
      ...columnNames,
      foreignColumns[0].table[PgTable.Symbol.Name],
      ...foreignColumnNames
    ];
    return name ?? `${chunks.join("_")}_fk`;
  }
};
__name(ForeignKey, "ForeignKey");
_a11 = entityKind;
__publicField(ForeignKey, _a11, "PgForeignKey");

// node_modules/drizzle-orm/tracing-utils.js
function iife(fn, ...args) {
  return fn(...args);
}
__name(iife, "iife");

// node_modules/drizzle-orm/pg-core/unique-constraint.js
function uniqueKeyName(table, columns) {
  return `${table[PgTable.Symbol.Name]}_${columns.join("_")}_unique`;
}
__name(uniqueKeyName, "uniqueKeyName");
var _a12;
var UniqueConstraintBuilder = class {
  constructor(columns, name) {
    this.name = name;
    this.columns = columns;
  }
  /** @internal */
  columns;
  /** @internal */
  nullsNotDistinctConfig = false;
  nullsNotDistinct() {
    this.nullsNotDistinctConfig = true;
    return this;
  }
  /** @internal */
  build(table) {
    return new UniqueConstraint(table, this.columns, this.nullsNotDistinctConfig, this.name);
  }
};
__name(UniqueConstraintBuilder, "UniqueConstraintBuilder");
_a12 = entityKind;
__publicField(UniqueConstraintBuilder, _a12, "PgUniqueConstraintBuilder");
var _a13;
var UniqueOnConstraintBuilder = class {
  /** @internal */
  name;
  constructor(name) {
    this.name = name;
  }
  on(...columns) {
    return new UniqueConstraintBuilder(columns, this.name);
  }
};
__name(UniqueOnConstraintBuilder, "UniqueOnConstraintBuilder");
_a13 = entityKind;
__publicField(UniqueOnConstraintBuilder, _a13, "PgUniqueOnConstraintBuilder");
var _a14;
var UniqueConstraint = class {
  constructor(table, columns, nullsNotDistinct, name) {
    this.table = table;
    this.columns = columns;
    this.name = name ?? uniqueKeyName(this.table, this.columns.map((column) => column.name));
    this.nullsNotDistinct = nullsNotDistinct;
  }
  columns;
  name;
  nullsNotDistinct = false;
  getName() {
    return this.name;
  }
};
__name(UniqueConstraint, "UniqueConstraint");
_a14 = entityKind;
__publicField(UniqueConstraint, _a14, "PgUniqueConstraint");

// node_modules/drizzle-orm/pg-core/utils/array.js
function parsePgArrayValue(arrayString, startFrom, inQuotes) {
  for (let i = startFrom; i < arrayString.length; i++) {
    const char = arrayString[i];
    if (char === "\\") {
      i++;
      continue;
    }
    if (char === '"') {
      return [arrayString.slice(startFrom, i).replace(/\\/g, ""), i + 1];
    }
    if (inQuotes) {
      continue;
    }
    if (char === "," || char === "}") {
      return [arrayString.slice(startFrom, i).replace(/\\/g, ""), i];
    }
  }
  return [arrayString.slice(startFrom).replace(/\\/g, ""), arrayString.length];
}
__name(parsePgArrayValue, "parsePgArrayValue");
function parsePgNestedArray(arrayString, startFrom = 0) {
  const result = [];
  let i = startFrom;
  let lastCharIsComma = false;
  while (i < arrayString.length) {
    const char = arrayString[i];
    if (char === ",") {
      if (lastCharIsComma || i === startFrom) {
        result.push("");
      }
      lastCharIsComma = true;
      i++;
      continue;
    }
    lastCharIsComma = false;
    if (char === "\\") {
      i += 2;
      continue;
    }
    if (char === '"') {
      const [value2, startFrom2] = parsePgArrayValue(arrayString, i + 1, true);
      result.push(value2);
      i = startFrom2;
      continue;
    }
    if (char === "}") {
      return [result, i + 1];
    }
    if (char === "{") {
      const [value2, startFrom2] = parsePgNestedArray(arrayString, i + 1);
      result.push(value2);
      i = startFrom2;
      continue;
    }
    const [value, newStartFrom] = parsePgArrayValue(arrayString, i, false);
    result.push(value);
    i = newStartFrom;
  }
  return [result, i];
}
__name(parsePgNestedArray, "parsePgNestedArray");
function parsePgArray(arrayString) {
  const [result] = parsePgNestedArray(arrayString, 1);
  return result;
}
__name(parsePgArray, "parsePgArray");
function makePgArray(array) {
  return `{${array.map((item) => {
    if (Array.isArray(item)) {
      return makePgArray(item);
    }
    if (typeof item === "string") {
      return `"${item.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    }
    return `${item}`;
  }).join(",")}}`;
}
__name(makePgArray, "makePgArray");

// node_modules/drizzle-orm/pg-core/columns/common.js
var _a15;
var PgColumnBuilder = class extends ColumnBuilder {
  foreignKeyConfigs = [];
  array(size) {
    return new PgArrayBuilder(this.config.name, this, size);
  }
  references(ref, actions = {}) {
    this.foreignKeyConfigs.push({ ref, actions });
    return this;
  }
  unique(name, config) {
    this.config.isUnique = true;
    this.config.uniqueName = name;
    this.config.uniqueType = config?.nulls;
    return this;
  }
  generatedAlwaysAs(as) {
    this.config.generated = {
      as,
      type: "always",
      mode: "stored"
    };
    return this;
  }
  /** @internal */
  buildForeignKeys(column, table) {
    return this.foreignKeyConfigs.map(({ ref, actions }) => {
      return iife(
        (ref2, actions2) => {
          const builder = new ForeignKeyBuilder(() => {
            const foreignColumn = ref2();
            return { columns: [column], foreignColumns: [foreignColumn] };
          });
          if (actions2.onUpdate) {
            builder.onUpdate(actions2.onUpdate);
          }
          if (actions2.onDelete) {
            builder.onDelete(actions2.onDelete);
          }
          return builder.build(table);
        },
        ref,
        actions
      );
    });
  }
  /** @internal */
  buildExtraConfigColumn(table) {
    return new ExtraConfigColumn(table, this.config);
  }
};
__name(PgColumnBuilder, "PgColumnBuilder");
_a15 = entityKind;
__publicField(PgColumnBuilder, _a15, "PgColumnBuilder");
var _a16;
var PgColumn = class extends Column {
  constructor(table, config) {
    if (!config.uniqueName) {
      config.uniqueName = uniqueKeyName(table, [config.name]);
    }
    super(table, config);
    this.table = table;
  }
};
__name(PgColumn, "PgColumn");
_a16 = entityKind;
__publicField(PgColumn, _a16, "PgColumn");
var _a17;
var ExtraConfigColumn = class extends PgColumn {
  getSQLType() {
    return this.getSQLType();
  }
  indexConfig = {
    order: this.config.order ?? "asc",
    nulls: this.config.nulls ?? "last",
    opClass: this.config.opClass
  };
  defaultConfig = {
    order: "asc",
    nulls: "last",
    opClass: void 0
  };
  asc() {
    this.indexConfig.order = "asc";
    return this;
  }
  desc() {
    this.indexConfig.order = "desc";
    return this;
  }
  nullsFirst() {
    this.indexConfig.nulls = "first";
    return this;
  }
  nullsLast() {
    this.indexConfig.nulls = "last";
    return this;
  }
  /**
   * ### PostgreSQL documentation quote
   *
   * > An operator class with optional parameters can be specified for each column of an index.
   * The operator class identifies the operators to be used by the index for that column.
   * For example, a B-tree index on four-byte integers would use the int4_ops class;
   * this operator class includes comparison functions for four-byte integers.
   * In practice the default operator class for the column's data type is usually sufficient.
   * The main point of having operator classes is that for some data types, there could be more than one meaningful ordering.
   * For example, we might want to sort a complex-number data type either by absolute value or by real part.
   * We could do this by defining two operator classes for the data type and then selecting the proper class when creating an index.
   * More information about operator classes check:
   *
   * ### Useful links
   * https://www.postgresql.org/docs/current/sql-createindex.html
   *
   * https://www.postgresql.org/docs/current/indexes-opclass.html
   *
   * https://www.postgresql.org/docs/current/xindex.html
   *
   * ### Additional types
   * If you have the `pg_vector` extension installed in your database, you can use the
   * `vector_l2_ops`, `vector_ip_ops`, `vector_cosine_ops`, `vector_l1_ops`, `bit_hamming_ops`, `bit_jaccard_ops`, `halfvec_l2_ops`, `sparsevec_l2_ops` options, which are predefined types.
   *
   * **You can always specify any string you want in the operator class, in case Drizzle doesn't have it natively in its types**
   *
   * @param opClass
   * @returns
   */
  op(opClass) {
    this.indexConfig.opClass = opClass;
    return this;
  }
};
__name(ExtraConfigColumn, "ExtraConfigColumn");
_a17 = entityKind;
__publicField(ExtraConfigColumn, _a17, "ExtraConfigColumn");
var _a18;
var IndexedColumn = class {
  constructor(name, type, indexConfig) {
    this.name = name;
    this.type = type;
    this.indexConfig = indexConfig;
  }
  name;
  type;
  indexConfig;
};
__name(IndexedColumn, "IndexedColumn");
_a18 = entityKind;
__publicField(IndexedColumn, _a18, "IndexedColumn");
var _a19;
var PgArrayBuilder = class extends PgColumnBuilder {
  constructor(name, baseBuilder, size) {
    super(name, "array", "PgArray");
    this.config.baseBuilder = baseBuilder;
    this.config.size = size;
  }
  /** @internal */
  build(table) {
    const baseColumn = this.config.baseBuilder.build(table);
    return new PgArray(
      table,
      this.config,
      baseColumn
    );
  }
};
__name(PgArrayBuilder, "PgArrayBuilder");
_a19 = entityKind;
__publicField(PgArrayBuilder, _a19, "PgArrayBuilder");
var _a20;
var _PgArray = class extends PgColumn {
  constructor(table, config, baseColumn, range) {
    super(table, config);
    this.baseColumn = baseColumn;
    this.range = range;
    this.size = config.size;
  }
  size;
  getSQLType() {
    return `${this.baseColumn.getSQLType()}[${typeof this.size === "number" ? this.size : ""}]`;
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") {
      value = parsePgArray(value);
    }
    return value.map((v) => this.baseColumn.mapFromDriverValue(v));
  }
  mapToDriverValue(value, isNestedArray = false) {
    const a = value.map(
      (v) => v === null ? null : is(this.baseColumn, _PgArray) ? this.baseColumn.mapToDriverValue(v, true) : this.baseColumn.mapToDriverValue(v)
    );
    if (isNestedArray)
      return a;
    return makePgArray(a);
  }
};
var PgArray = _PgArray;
__name(PgArray, "PgArray");
_a20 = entityKind;
__publicField(PgArray, _a20, "PgArray");

// node_modules/drizzle-orm/pg-core/columns/enum.js
var isPgEnumSym = Symbol.for("drizzle:isPgEnum");
function isPgEnum(obj) {
  return !!obj && typeof obj === "function" && isPgEnumSym in obj && obj[isPgEnumSym] === true;
}
__name(isPgEnum, "isPgEnum");
var _a21;
var PgEnumColumnBuilder = class extends PgColumnBuilder {
  constructor(name, enumInstance) {
    super(name, "string", "PgEnumColumn");
    this.config.enum = enumInstance;
  }
  /** @internal */
  build(table) {
    return new PgEnumColumn(
      table,
      this.config
    );
  }
};
__name(PgEnumColumnBuilder, "PgEnumColumnBuilder");
_a21 = entityKind;
__publicField(PgEnumColumnBuilder, _a21, "PgEnumColumnBuilder");
var _a22;
var PgEnumColumn = class extends PgColumn {
  enum = this.config.enum;
  enumValues = this.config.enum.enumValues;
  constructor(table, config) {
    super(table, config);
    this.enum = config.enum;
  }
  getSQLType() {
    return this.enum.enumName;
  }
};
__name(PgEnumColumn, "PgEnumColumn");
_a22 = entityKind;
__publicField(PgEnumColumn, _a22, "PgEnumColumn");

// node_modules/drizzle-orm/subquery.js
var _a23;
var Subquery = class {
  constructor(sql2, selection, alias, isWith = false) {
    this._ = {
      brand: "Subquery",
      sql: sql2,
      selectedFields: selection,
      alias,
      isWith
    };
  }
  // getSQL(): SQL<unknown> {
  // 	return new SQL([this]);
  // }
};
__name(Subquery, "Subquery");
_a23 = entityKind;
__publicField(Subquery, _a23, "Subquery");
var _a24;
var WithSubquery = class extends Subquery {
};
__name(WithSubquery, "WithSubquery");
_a24 = entityKind;
__publicField(WithSubquery, _a24, "WithSubquery");

// node_modules/drizzle-orm/version.js
var version = "0.32.2";

// node_modules/drizzle-orm/tracing.js
var otel;
var rawTracer;
var tracer = {
  startActiveSpan(name, fn) {
    if (!otel) {
      return fn();
    }
    if (!rawTracer) {
      rawTracer = otel.trace.getTracer("drizzle-orm", version);
    }
    return iife(
      (otel2, rawTracer2) => rawTracer2.startActiveSpan(
        name,
        (span) => {
          try {
            return fn(span);
          } catch (e) {
            span.setStatus({
              code: otel2.SpanStatusCode.ERROR,
              message: e instanceof Error ? e.message : "Unknown error"
              // eslint-disable-line no-instanceof/no-instanceof
            });
            throw e;
          } finally {
            span.end();
          }
        }
      ),
      otel,
      rawTracer
    );
  }
};

// node_modules/drizzle-orm/view-common.js
var ViewBaseConfig = Symbol.for("drizzle:ViewBaseConfig");

// node_modules/drizzle-orm/sql/sql.js
var _a25;
var FakePrimitiveParam = class {
};
__name(FakePrimitiveParam, "FakePrimitiveParam");
_a25 = entityKind;
__publicField(FakePrimitiveParam, _a25, "FakePrimitiveParam");
function isSQLWrapper(value) {
  return value !== null && value !== void 0 && typeof value.getSQL === "function";
}
__name(isSQLWrapper, "isSQLWrapper");
function mergeQueries(queries) {
  const result = { sql: "", params: [] };
  for (const query of queries) {
    result.sql += query.sql;
    result.params.push(...query.params);
    if (query.typings?.length) {
      if (!result.typings) {
        result.typings = [];
      }
      result.typings.push(...query.typings);
    }
  }
  return result;
}
__name(mergeQueries, "mergeQueries");
var _a26;
var StringChunk = class {
  value;
  constructor(value) {
    this.value = Array.isArray(value) ? value : [value];
  }
  getSQL() {
    return new SQL([this]);
  }
};
__name(StringChunk, "StringChunk");
_a26 = entityKind;
__publicField(StringChunk, _a26, "StringChunk");
var _a27;
var _SQL = class {
  constructor(queryChunks) {
    this.queryChunks = queryChunks;
  }
  /** @internal */
  decoder = noopDecoder;
  shouldInlineParams = false;
  append(query) {
    this.queryChunks.push(...query.queryChunks);
    return this;
  }
  toQuery(config) {
    return tracer.startActiveSpan("drizzle.buildSQL", (span) => {
      const query = this.buildQueryFromSourceParams(this.queryChunks, config);
      span?.setAttributes({
        "drizzle.query.text": query.sql,
        "drizzle.query.params": JSON.stringify(query.params)
      });
      return query;
    });
  }
  buildQueryFromSourceParams(chunks, _config) {
    const config = Object.assign({}, _config, {
      inlineParams: _config.inlineParams || this.shouldInlineParams,
      paramStartIndex: _config.paramStartIndex || { value: 0 }
    });
    const {
      escapeName,
      escapeParam,
      prepareTyping,
      inlineParams,
      paramStartIndex
    } = config;
    return mergeQueries(chunks.map((chunk) => {
      if (is(chunk, StringChunk)) {
        return { sql: chunk.value.join(""), params: [] };
      }
      if (is(chunk, Name)) {
        return { sql: escapeName(chunk.value), params: [] };
      }
      if (chunk === void 0) {
        return { sql: "", params: [] };
      }
      if (Array.isArray(chunk)) {
        const result = [new StringChunk("(")];
        for (const [i, p] of chunk.entries()) {
          result.push(p);
          if (i < chunk.length - 1) {
            result.push(new StringChunk(", "));
          }
        }
        result.push(new StringChunk(")"));
        return this.buildQueryFromSourceParams(result, config);
      }
      if (is(chunk, _SQL)) {
        return this.buildQueryFromSourceParams(chunk.queryChunks, {
          ...config,
          inlineParams: inlineParams || chunk.shouldInlineParams
        });
      }
      if (is(chunk, Table)) {
        const schemaName = chunk[Table.Symbol.Schema];
        const tableName = chunk[Table.Symbol.Name];
        return {
          sql: schemaName === void 0 ? escapeName(tableName) : escapeName(schemaName) + "." + escapeName(tableName),
          params: []
        };
      }
      if (is(chunk, Column)) {
        if (_config.invokeSource === "indexes") {
          return { sql: escapeName(chunk.name), params: [] };
        }
        return { sql: escapeName(chunk.table[Table.Symbol.Name]) + "." + escapeName(chunk.name), params: [] };
      }
      if (is(chunk, View)) {
        const schemaName = chunk[ViewBaseConfig].schema;
        const viewName = chunk[ViewBaseConfig].name;
        return {
          sql: schemaName === void 0 ? escapeName(viewName) : escapeName(schemaName) + "." + escapeName(viewName),
          params: []
        };
      }
      if (is(chunk, Param)) {
        const mappedValue = chunk.value === null ? null : chunk.encoder.mapToDriverValue(chunk.value);
        if (is(mappedValue, _SQL)) {
          return this.buildQueryFromSourceParams([mappedValue], config);
        }
        if (inlineParams) {
          return { sql: this.mapInlineParam(mappedValue, config), params: [] };
        }
        let typings = ["none"];
        if (prepareTyping) {
          typings = [prepareTyping(chunk.encoder)];
        }
        return { sql: escapeParam(paramStartIndex.value++, mappedValue), params: [mappedValue], typings };
      }
      if (is(chunk, Placeholder)) {
        return { sql: escapeParam(paramStartIndex.value++, chunk), params: [chunk], typings: ["none"] };
      }
      if (is(chunk, _SQL.Aliased) && chunk.fieldAlias !== void 0) {
        return { sql: escapeName(chunk.fieldAlias), params: [] };
      }
      if (is(chunk, Subquery)) {
        if (chunk._.isWith) {
          return { sql: escapeName(chunk._.alias), params: [] };
        }
        return this.buildQueryFromSourceParams([
          new StringChunk("("),
          chunk._.sql,
          new StringChunk(") "),
          new Name(chunk._.alias)
        ], config);
      }
      if (isPgEnum(chunk)) {
        if (chunk.schema) {
          return { sql: escapeName(chunk.schema) + "." + escapeName(chunk.enumName), params: [] };
        }
        return { sql: escapeName(chunk.enumName), params: [] };
      }
      if (isSQLWrapper(chunk)) {
        if (chunk.shouldOmitSQLParens?.()) {
          return this.buildQueryFromSourceParams([chunk.getSQL()], config);
        }
        return this.buildQueryFromSourceParams([
          new StringChunk("("),
          chunk.getSQL(),
          new StringChunk(")")
        ], config);
      }
      if (inlineParams) {
        return { sql: this.mapInlineParam(chunk, config), params: [] };
      }
      return { sql: escapeParam(paramStartIndex.value++, chunk), params: [chunk], typings: ["none"] };
    }));
  }
  mapInlineParam(chunk, { escapeString }) {
    if (chunk === null) {
      return "null";
    }
    if (typeof chunk === "number" || typeof chunk === "boolean") {
      return chunk.toString();
    }
    if (typeof chunk === "string") {
      return escapeString(chunk);
    }
    if (typeof chunk === "object") {
      const mappedValueAsString = chunk.toString();
      if (mappedValueAsString === "[object Object]") {
        return escapeString(JSON.stringify(chunk));
      }
      return escapeString(mappedValueAsString);
    }
    throw new Error("Unexpected param value: " + chunk);
  }
  getSQL() {
    return this;
  }
  as(alias) {
    if (alias === void 0) {
      return this;
    }
    return new _SQL.Aliased(this, alias);
  }
  mapWith(decoder2) {
    this.decoder = typeof decoder2 === "function" ? { mapFromDriverValue: decoder2 } : decoder2;
    return this;
  }
  inlineParams() {
    this.shouldInlineParams = true;
    return this;
  }
  /**
   * This method is used to conditionally include a part of the query.
   *
   * @param condition - Condition to check
   * @returns itself if the condition is `true`, otherwise `undefined`
   */
  if(condition) {
    return condition ? this : void 0;
  }
};
var SQL = _SQL;
__name(SQL, "SQL");
_a27 = entityKind;
__publicField(SQL, _a27, "SQL");
var _a28;
var Name = class {
  constructor(value) {
    this.value = value;
  }
  brand;
  getSQL() {
    return new SQL([this]);
  }
};
__name(Name, "Name");
_a28 = entityKind;
__publicField(Name, _a28, "Name");
function isDriverValueEncoder(value) {
  return typeof value === "object" && value !== null && "mapToDriverValue" in value && typeof value.mapToDriverValue === "function";
}
__name(isDriverValueEncoder, "isDriverValueEncoder");
var noopDecoder = {
  mapFromDriverValue: (value) => value
};
var noopEncoder = {
  mapToDriverValue: (value) => value
};
var noopMapper = {
  ...noopDecoder,
  ...noopEncoder
};
var _a29;
var Param = class {
  /**
   * @param value - Parameter value
   * @param encoder - Encoder to convert the value to a driver parameter
   */
  constructor(value, encoder2 = noopEncoder) {
    this.value = value;
    this.encoder = encoder2;
  }
  brand;
  getSQL() {
    return new SQL([this]);
  }
};
__name(Param, "Param");
_a29 = entityKind;
__publicField(Param, _a29, "Param");
function sql(strings, ...params) {
  const queryChunks = [];
  if (params.length > 0 || strings.length > 0 && strings[0] !== "") {
    queryChunks.push(new StringChunk(strings[0]));
  }
  for (const [paramIndex, param2] of params.entries()) {
    queryChunks.push(param2, new StringChunk(strings[paramIndex + 1]));
  }
  return new SQL(queryChunks);
}
__name(sql, "sql");
((sql2) => {
  function empty() {
    return new SQL([]);
  }
  __name(empty, "empty");
  sql2.empty = empty;
  function fromList(list) {
    return new SQL(list);
  }
  __name(fromList, "fromList");
  sql2.fromList = fromList;
  function raw2(str) {
    return new SQL([new StringChunk(str)]);
  }
  __name(raw2, "raw");
  sql2.raw = raw2;
  function join(chunks, separator) {
    const result = [];
    for (const [i, chunk] of chunks.entries()) {
      if (i > 0 && separator !== void 0) {
        result.push(separator);
      }
      result.push(chunk);
    }
    return new SQL(result);
  }
  __name(join, "join");
  sql2.join = join;
  function identifier(value) {
    return new Name(value);
  }
  __name(identifier, "identifier");
  sql2.identifier = identifier;
  function placeholder2(name2) {
    return new Placeholder(name2);
  }
  __name(placeholder2, "placeholder2");
  sql2.placeholder = placeholder2;
  function param2(value, encoder2) {
    return new Param(value, encoder2);
  }
  __name(param2, "param2");
  sql2.param = param2;
})(sql || (sql = {}));
((SQL2) => {
  class Aliased {
    constructor(sql2, fieldAlias) {
      this.sql = sql2;
      this.fieldAlias = fieldAlias;
    }
    static [entityKind] = "SQL.Aliased";
    /** @internal */
    isSelectionField = false;
    getSQL() {
      return this.sql;
    }
    /** @internal */
    clone() {
      return new Aliased(this.sql, this.fieldAlias);
    }
  }
  __name(Aliased, "Aliased");
  SQL2.Aliased = Aliased;
})(SQL || (SQL = {}));
var _a30;
var Placeholder = class {
  constructor(name2) {
    this.name = name2;
  }
  getSQL() {
    return new SQL([this]);
  }
};
__name(Placeholder, "Placeholder");
_a30 = entityKind;
__publicField(Placeholder, _a30, "Placeholder");
function fillPlaceholders(params, values) {
  return params.map((p) => {
    if (is(p, Placeholder)) {
      if (!(p.name in values)) {
        throw new Error(`No value for placeholder "${p.name}" was provided`);
      }
      return values[p.name];
    }
    return p;
  });
}
__name(fillPlaceholders, "fillPlaceholders");
var _a31;
var View = class {
  /** @internal */
  [(_a31 = entityKind, ViewBaseConfig)];
  constructor({ name: name2, schema, selectedFields, query }) {
    this[ViewBaseConfig] = {
      name: name2,
      originalName: name2,
      schema,
      selectedFields,
      query,
      isExisting: !query,
      isAlias: false
    };
  }
  getSQL() {
    return new SQL([this]);
  }
};
__name(View, "View");
__publicField(View, _a31, "View");
Column.prototype.getSQL = function() {
  return new SQL([this]);
};
Table.prototype.getSQL = function() {
  return new SQL([this]);
};
Subquery.prototype.getSQL = function() {
  return new SQL([this]);
};

// node_modules/drizzle-orm/sql/expressions/conditions.js
function bindIfParam(value, column) {
  if (isDriverValueEncoder(column) && !isSQLWrapper(value) && !is(value, Param) && !is(value, Placeholder) && !is(value, Column) && !is(value, Table) && !is(value, View)) {
    return new Param(value, column);
  }
  return value;
}
__name(bindIfParam, "bindIfParam");
var eq = /* @__PURE__ */ __name((left, right) => {
  return sql`${left} = ${bindIfParam(right, left)}`;
}, "eq");
var ne = /* @__PURE__ */ __name((left, right) => {
  return sql`${left} <> ${bindIfParam(right, left)}`;
}, "ne");
function and(...unfilteredConditions) {
  const conditions = unfilteredConditions.filter(
    (c) => c !== void 0
  );
  if (conditions.length === 0) {
    return void 0;
  }
  if (conditions.length === 1) {
    return new SQL(conditions);
  }
  return new SQL([
    new StringChunk("("),
    sql.join(conditions, new StringChunk(" and ")),
    new StringChunk(")")
  ]);
}
__name(and, "and");
function or(...unfilteredConditions) {
  const conditions = unfilteredConditions.filter(
    (c) => c !== void 0
  );
  if (conditions.length === 0) {
    return void 0;
  }
  if (conditions.length === 1) {
    return new SQL(conditions);
  }
  return new SQL([
    new StringChunk("("),
    sql.join(conditions, new StringChunk(" or ")),
    new StringChunk(")")
  ]);
}
__name(or, "or");
function not(condition) {
  return sql`not ${condition}`;
}
__name(not, "not");
var gt = /* @__PURE__ */ __name((left, right) => {
  return sql`${left} > ${bindIfParam(right, left)}`;
}, "gt");
var gte = /* @__PURE__ */ __name((left, right) => {
  return sql`${left} >= ${bindIfParam(right, left)}`;
}, "gte");
var lt = /* @__PURE__ */ __name((left, right) => {
  return sql`${left} < ${bindIfParam(right, left)}`;
}, "lt");
var lte = /* @__PURE__ */ __name((left, right) => {
  return sql`${left} <= ${bindIfParam(right, left)}`;
}, "lte");
function inArray(column, values) {
  if (Array.isArray(values)) {
    if (values.length === 0) {
      return sql`false`;
    }
    return sql`${column} in ${values.map((v) => bindIfParam(v, column))}`;
  }
  return sql`${column} in ${bindIfParam(values, column)}`;
}
__name(inArray, "inArray");
function notInArray(column, values) {
  if (Array.isArray(values)) {
    if (values.length === 0) {
      return sql`true`;
    }
    return sql`${column} not in ${values.map((v) => bindIfParam(v, column))}`;
  }
  return sql`${column} not in ${bindIfParam(values, column)}`;
}
__name(notInArray, "notInArray");
function isNull(value) {
  return sql`${value} is null`;
}
__name(isNull, "isNull");
function isNotNull(value) {
  return sql`${value} is not null`;
}
__name(isNotNull, "isNotNull");
function exists(subquery) {
  return sql`exists ${subquery}`;
}
__name(exists, "exists");
function notExists(subquery) {
  return sql`not exists ${subquery}`;
}
__name(notExists, "notExists");
function between(column, min, max) {
  return sql`${column} between ${bindIfParam(min, column)} and ${bindIfParam(
    max,
    column
  )}`;
}
__name(between, "between");
function notBetween(column, min, max) {
  return sql`${column} not between ${bindIfParam(
    min,
    column
  )} and ${bindIfParam(max, column)}`;
}
__name(notBetween, "notBetween");
function like(column, value) {
  return sql`${column} like ${value}`;
}
__name(like, "like");
function notLike(column, value) {
  return sql`${column} not like ${value}`;
}
__name(notLike, "notLike");
function ilike(column, value) {
  return sql`${column} ilike ${value}`;
}
__name(ilike, "ilike");
function notIlike(column, value) {
  return sql`${column} not ilike ${value}`;
}
__name(notIlike, "notIlike");

// node_modules/drizzle-orm/sql/expressions/select.js
function asc(column) {
  return sql`${column} asc`;
}
__name(asc, "asc");
function desc(column) {
  return sql`${column} desc`;
}
__name(desc, "desc");

// node_modules/drizzle-orm/relations.js
var _a32;
var Relation = class {
  constructor(sourceTable, referencedTable, relationName) {
    this.sourceTable = sourceTable;
    this.referencedTable = referencedTable;
    this.relationName = relationName;
    this.referencedTableName = referencedTable[Table.Symbol.Name];
  }
  referencedTableName;
  fieldName;
};
__name(Relation, "Relation");
_a32 = entityKind;
__publicField(Relation, _a32, "Relation");
var _a33;
var Relations = class {
  constructor(table, config) {
    this.table = table;
    this.config = config;
  }
};
__name(Relations, "Relations");
_a33 = entityKind;
__publicField(Relations, _a33, "Relations");
var _a34;
var _One = class extends Relation {
  constructor(sourceTable, referencedTable, config, isNullable) {
    super(sourceTable, referencedTable, config?.relationName);
    this.config = config;
    this.isNullable = isNullable;
  }
  withFieldName(fieldName) {
    const relation = new _One(
      this.sourceTable,
      this.referencedTable,
      this.config,
      this.isNullable
    );
    relation.fieldName = fieldName;
    return relation;
  }
};
var One = _One;
__name(One, "One");
_a34 = entityKind;
__publicField(One, _a34, "One");
var _a35;
var _Many = class extends Relation {
  constructor(sourceTable, referencedTable, config) {
    super(sourceTable, referencedTable, config?.relationName);
    this.config = config;
  }
  withFieldName(fieldName) {
    const relation = new _Many(
      this.sourceTable,
      this.referencedTable,
      this.config
    );
    relation.fieldName = fieldName;
    return relation;
  }
};
var Many = _Many;
__name(Many, "Many");
_a35 = entityKind;
__publicField(Many, _a35, "Many");
function getOperators() {
  return {
    and,
    between,
    eq,
    exists,
    gt,
    gte,
    ilike,
    inArray,
    isNull,
    isNotNull,
    like,
    lt,
    lte,
    ne,
    not,
    notBetween,
    notExists,
    notLike,
    notIlike,
    notInArray,
    or,
    sql
  };
}
__name(getOperators, "getOperators");
function getOrderByOperators() {
  return {
    sql,
    asc,
    desc
  };
}
__name(getOrderByOperators, "getOrderByOperators");
function extractTablesRelationalConfig(schema, configHelpers) {
  if (Object.keys(schema).length === 1 && "default" in schema && !is(schema["default"], Table)) {
    schema = schema["default"];
  }
  const tableNamesMap = {};
  const relationsBuffer = {};
  const tablesConfig = {};
  for (const [key, value] of Object.entries(schema)) {
    if (is(value, Table)) {
      const dbName = getTableUniqueName(value);
      const bufferedRelations = relationsBuffer[dbName];
      tableNamesMap[dbName] = key;
      tablesConfig[key] = {
        tsName: key,
        dbName: value[Table.Symbol.Name],
        schema: value[Table.Symbol.Schema],
        columns: value[Table.Symbol.Columns],
        relations: bufferedRelations?.relations ?? {},
        primaryKey: bufferedRelations?.primaryKey ?? []
      };
      for (const column of Object.values(
        value[Table.Symbol.Columns]
      )) {
        if (column.primary) {
          tablesConfig[key].primaryKey.push(column);
        }
      }
      const extraConfig = value[Table.Symbol.ExtraConfigBuilder]?.(value[Table.Symbol.ExtraConfigColumns]);
      if (extraConfig) {
        for (const configEntry of Object.values(extraConfig)) {
          if (is(configEntry, PrimaryKeyBuilder)) {
            tablesConfig[key].primaryKey.push(...configEntry.columns);
          }
        }
      }
    } else if (is(value, Relations)) {
      const dbName = getTableUniqueName(value.table);
      const tableName = tableNamesMap[dbName];
      const relations2 = value.config(
        configHelpers(value.table)
      );
      let primaryKey2;
      for (const [relationName, relation] of Object.entries(relations2)) {
        if (tableName) {
          const tableConfig = tablesConfig[tableName];
          tableConfig.relations[relationName] = relation;
          if (primaryKey2) {
            tableConfig.primaryKey.push(...primaryKey2);
          }
        } else {
          if (!(dbName in relationsBuffer)) {
            relationsBuffer[dbName] = {
              relations: {},
              primaryKey: primaryKey2
            };
          }
          relationsBuffer[dbName].relations[relationName] = relation;
        }
      }
    }
  }
  return { tables: tablesConfig, tableNamesMap };
}
__name(extractTablesRelationalConfig, "extractTablesRelationalConfig");
function relations(table, relations2) {
  return new Relations(
    table,
    (helpers) => Object.fromEntries(
      Object.entries(relations2(helpers)).map(([key, value]) => [
        key,
        value.withFieldName(key)
      ])
    )
  );
}
__name(relations, "relations");
function createOne(sourceTable) {
  return /* @__PURE__ */ __name(function one(table, config) {
    return new One(
      sourceTable,
      table,
      config,
      config?.fields.reduce((res, f) => res && f.notNull, true) ?? false
    );
  }, "one");
}
__name(createOne, "createOne");
function createMany(sourceTable) {
  return /* @__PURE__ */ __name(function many(referencedTable, config) {
    return new Many(sourceTable, referencedTable, config);
  }, "many");
}
__name(createMany, "createMany");
function normalizeRelation(schema, tableNamesMap, relation) {
  if (is(relation, One) && relation.config) {
    return {
      fields: relation.config.fields,
      references: relation.config.references
    };
  }
  const referencedTableTsName = tableNamesMap[getTableUniqueName(relation.referencedTable)];
  if (!referencedTableTsName) {
    throw new Error(
      `Table "${relation.referencedTable[Table.Symbol.Name]}" not found in schema`
    );
  }
  const referencedTableConfig = schema[referencedTableTsName];
  if (!referencedTableConfig) {
    throw new Error(`Table "${referencedTableTsName}" not found in schema`);
  }
  const sourceTable = relation.sourceTable;
  const sourceTableTsName = tableNamesMap[getTableUniqueName(sourceTable)];
  if (!sourceTableTsName) {
    throw new Error(
      `Table "${sourceTable[Table.Symbol.Name]}" not found in schema`
    );
  }
  const reverseRelations = [];
  for (const referencedTableRelation of Object.values(
    referencedTableConfig.relations
  )) {
    if (relation.relationName && relation !== referencedTableRelation && referencedTableRelation.relationName === relation.relationName || !relation.relationName && referencedTableRelation.referencedTable === relation.sourceTable) {
      reverseRelations.push(referencedTableRelation);
    }
  }
  if (reverseRelations.length > 1) {
    throw relation.relationName ? new Error(
      `There are multiple relations with name "${relation.relationName}" in table "${referencedTableTsName}"`
    ) : new Error(
      `There are multiple relations between "${referencedTableTsName}" and "${relation.sourceTable[Table.Symbol.Name]}". Please specify relation name`
    );
  }
  if (reverseRelations[0] && is(reverseRelations[0], One) && reverseRelations[0].config) {
    return {
      fields: reverseRelations[0].config.references,
      references: reverseRelations[0].config.fields
    };
  }
  throw new Error(
    `There is not enough information to infer relation "${sourceTableTsName}.${relation.fieldName}"`
  );
}
__name(normalizeRelation, "normalizeRelation");
function createTableRelationsHelpers(sourceTable) {
  return {
    one: createOne(sourceTable),
    many: createMany(sourceTable)
  };
}
__name(createTableRelationsHelpers, "createTableRelationsHelpers");
function mapRelationalRow(tablesConfig, tableConfig, row, buildQueryResultSelection, mapColumnValue = (value) => value) {
  const result = {};
  for (const [
    selectionItemIndex,
    selectionItem
  ] of buildQueryResultSelection.entries()) {
    if (selectionItem.isJson) {
      const relation = tableConfig.relations[selectionItem.tsKey];
      const rawSubRows = row[selectionItemIndex];
      const subRows = typeof rawSubRows === "string" ? JSON.parse(rawSubRows) : rawSubRows;
      result[selectionItem.tsKey] = is(relation, One) ? subRows && mapRelationalRow(
        tablesConfig,
        tablesConfig[selectionItem.relationTableTsKey],
        subRows,
        selectionItem.selection,
        mapColumnValue
      ) : subRows.map(
        (subRow) => mapRelationalRow(
          tablesConfig,
          tablesConfig[selectionItem.relationTableTsKey],
          subRow,
          selectionItem.selection,
          mapColumnValue
        )
      );
    } else {
      const value = mapColumnValue(row[selectionItemIndex]);
      const field = selectionItem.field;
      let decoder2;
      if (is(field, Column)) {
        decoder2 = field;
      } else if (is(field, SQL)) {
        decoder2 = field.decoder;
      } else {
        decoder2 = field.sql.decoder;
      }
      result[selectionItem.tsKey] = value === null ? null : decoder2.mapFromDriverValue(value);
    }
  }
  return result;
}
__name(mapRelationalRow, "mapRelationalRow");

// node_modules/drizzle-orm/alias.js
var _a36;
var ColumnAliasProxyHandler = class {
  constructor(table) {
    this.table = table;
  }
  get(columnObj, prop) {
    if (prop === "table") {
      return this.table;
    }
    return columnObj[prop];
  }
};
__name(ColumnAliasProxyHandler, "ColumnAliasProxyHandler");
_a36 = entityKind;
__publicField(ColumnAliasProxyHandler, _a36, "ColumnAliasProxyHandler");
var _a37;
var TableAliasProxyHandler = class {
  constructor(alias, replaceOriginalName) {
    this.alias = alias;
    this.replaceOriginalName = replaceOriginalName;
  }
  get(target, prop) {
    if (prop === Table.Symbol.IsAlias) {
      return true;
    }
    if (prop === Table.Symbol.Name) {
      return this.alias;
    }
    if (this.replaceOriginalName && prop === Table.Symbol.OriginalName) {
      return this.alias;
    }
    if (prop === ViewBaseConfig) {
      return {
        ...target[ViewBaseConfig],
        name: this.alias,
        isAlias: true
      };
    }
    if (prop === Table.Symbol.Columns) {
      const columns = target[Table.Symbol.Columns];
      if (!columns) {
        return columns;
      }
      const proxiedColumns = {};
      Object.keys(columns).map((key) => {
        proxiedColumns[key] = new Proxy(
          columns[key],
          new ColumnAliasProxyHandler(new Proxy(target, this))
        );
      });
      return proxiedColumns;
    }
    const value = target[prop];
    if (is(value, Column)) {
      return new Proxy(value, new ColumnAliasProxyHandler(new Proxy(target, this)));
    }
    return value;
  }
};
__name(TableAliasProxyHandler, "TableAliasProxyHandler");
_a37 = entityKind;
__publicField(TableAliasProxyHandler, _a37, "TableAliasProxyHandler");
var _a38;
var RelationTableAliasProxyHandler = class {
  constructor(alias) {
    this.alias = alias;
  }
  get(target, prop) {
    if (prop === "sourceTable") {
      return aliasedTable(target.sourceTable, this.alias);
    }
    return target[prop];
  }
};
__name(RelationTableAliasProxyHandler, "RelationTableAliasProxyHandler");
_a38 = entityKind;
__publicField(RelationTableAliasProxyHandler, _a38, "RelationTableAliasProxyHandler");
function aliasedTable(table, tableAlias) {
  return new Proxy(table, new TableAliasProxyHandler(tableAlias, false));
}
__name(aliasedTable, "aliasedTable");
function aliasedTableColumn(column, tableAlias) {
  return new Proxy(
    column,
    new ColumnAliasProxyHandler(new Proxy(column.table, new TableAliasProxyHandler(tableAlias, false)))
  );
}
__name(aliasedTableColumn, "aliasedTableColumn");
function mapColumnsInAliasedSQLToAlias(query, alias) {
  return new SQL.Aliased(mapColumnsInSQLToAlias(query.sql, alias), query.fieldAlias);
}
__name(mapColumnsInAliasedSQLToAlias, "mapColumnsInAliasedSQLToAlias");
function mapColumnsInSQLToAlias(query, alias) {
  return sql.join(query.queryChunks.map((c) => {
    if (is(c, Column)) {
      return aliasedTableColumn(c, alias);
    }
    if (is(c, SQL)) {
      return mapColumnsInSQLToAlias(c, alias);
    }
    if (is(c, SQL.Aliased)) {
      return mapColumnsInAliasedSQLToAlias(c, alias);
    }
    return c;
  }));
}
__name(mapColumnsInSQLToAlias, "mapColumnsInSQLToAlias");

// node_modules/drizzle-orm/selection-proxy.js
var _a39;
var _SelectionProxyHandler = class {
  config;
  constructor(config) {
    this.config = { ...config };
  }
  get(subquery, prop) {
    if (prop === "_") {
      return {
        ...subquery["_"],
        selectedFields: new Proxy(
          subquery._.selectedFields,
          this
        )
      };
    }
    if (prop === ViewBaseConfig) {
      return {
        ...subquery[ViewBaseConfig],
        selectedFields: new Proxy(
          subquery[ViewBaseConfig].selectedFields,
          this
        )
      };
    }
    if (typeof prop === "symbol") {
      return subquery[prop];
    }
    const columns = is(subquery, Subquery) ? subquery._.selectedFields : is(subquery, View) ? subquery[ViewBaseConfig].selectedFields : subquery;
    const value = columns[prop];
    if (is(value, SQL.Aliased)) {
      if (this.config.sqlAliasedBehavior === "sql" && !value.isSelectionField) {
        return value.sql;
      }
      const newValue = value.clone();
      newValue.isSelectionField = true;
      return newValue;
    }
    if (is(value, SQL)) {
      if (this.config.sqlBehavior === "sql") {
        return value;
      }
      throw new Error(
        `You tried to reference "${prop}" field from a subquery, which is a raw SQL field, but it doesn't have an alias declared. Please add an alias to the field using ".as('alias')" method.`
      );
    }
    if (is(value, Column)) {
      if (this.config.alias) {
        return new Proxy(
          value,
          new ColumnAliasProxyHandler(
            new Proxy(
              value.table,
              new TableAliasProxyHandler(this.config.alias, this.config.replaceOriginalName ?? false)
            )
          )
        );
      }
      return value;
    }
    if (typeof value !== "object" || value === null) {
      return value;
    }
    return new Proxy(value, new _SelectionProxyHandler(this.config));
  }
};
var SelectionProxyHandler = _SelectionProxyHandler;
__name(SelectionProxyHandler, "SelectionProxyHandler");
_a39 = entityKind;
__publicField(SelectionProxyHandler, _a39, "SelectionProxyHandler");

// node_modules/drizzle-orm/query-promise.js
var _a40;
var QueryPromise = class {
  [(_a40 = entityKind, Symbol.toStringTag)] = "QueryPromise";
  catch(onRejected) {
    return this.then(void 0, onRejected);
  }
  finally(onFinally) {
    return this.then(
      (value) => {
        onFinally?.();
        return value;
      },
      (reason) => {
        onFinally?.();
        throw reason;
      }
    );
  }
  then(onFulfilled, onRejected) {
    return this.execute().then(onFulfilled, onRejected);
  }
};
__name(QueryPromise, "QueryPromise");
__publicField(QueryPromise, _a40, "QueryPromise");

// node_modules/drizzle-orm/sqlite-core/table.js
var InlineForeignKeys2 = Symbol.for("drizzle:SQLiteInlineForeignKeys");
var _a41;
var SQLiteTable = class extends Table {
  /** @internal */
  [(_a41 = entityKind, Table.Symbol.Columns)];
  /** @internal */
  [InlineForeignKeys2] = [];
  /** @internal */
  [Table.Symbol.ExtraConfigBuilder] = void 0;
};
__name(SQLiteTable, "SQLiteTable");
__publicField(SQLiteTable, _a41, "SQLiteTable");
/** @internal */
__publicField(SQLiteTable, "Symbol", Object.assign({}, Table.Symbol, {
  InlineForeignKeys: InlineForeignKeys2
}));
function sqliteTableBase(name, columns, extraConfig, schema, baseName = name) {
  const rawTable = new SQLiteTable(name, schema, baseName);
  const builtColumns = Object.fromEntries(
    Object.entries(columns).map(([name2, colBuilderBase]) => {
      const colBuilder = colBuilderBase;
      const column = colBuilder.build(rawTable);
      rawTable[InlineForeignKeys2].push(...colBuilder.buildForeignKeys(column, rawTable));
      return [name2, column];
    })
  );
  const table = Object.assign(rawTable, builtColumns);
  table[Table.Symbol.Columns] = builtColumns;
  table[Table.Symbol.ExtraConfigColumns] = builtColumns;
  if (extraConfig) {
    table[SQLiteTable.Symbol.ExtraConfigBuilder] = extraConfig;
  }
  return table;
}
__name(sqliteTableBase, "sqliteTableBase");
var sqliteTable = /* @__PURE__ */ __name((name, columns, extraConfig) => {
  return sqliteTableBase(name, columns, extraConfig);
}, "sqliteTable");

// node_modules/drizzle-orm/utils.js
function mapResultRow(columns, row, joinsNotNullableMap) {
  const nullifyMap = {};
  const result = columns.reduce(
    (result2, { path, field }, columnIndex) => {
      let decoder2;
      if (is(field, Column)) {
        decoder2 = field;
      } else if (is(field, SQL)) {
        decoder2 = field.decoder;
      } else {
        decoder2 = field.sql.decoder;
      }
      let node = result2;
      for (const [pathChunkIndex, pathChunk] of path.entries()) {
        if (pathChunkIndex < path.length - 1) {
          if (!(pathChunk in node)) {
            node[pathChunk] = {};
          }
          node = node[pathChunk];
        } else {
          const rawValue = row[columnIndex];
          const value = node[pathChunk] = rawValue === null ? null : decoder2.mapFromDriverValue(rawValue);
          if (joinsNotNullableMap && is(field, Column) && path.length === 2) {
            const objectName = path[0];
            if (!(objectName in nullifyMap)) {
              nullifyMap[objectName] = value === null ? getTableName(field.table) : false;
            } else if (typeof nullifyMap[objectName] === "string" && nullifyMap[objectName] !== getTableName(field.table)) {
              nullifyMap[objectName] = false;
            }
          }
        }
      }
      return result2;
    },
    {}
  );
  if (joinsNotNullableMap && Object.keys(nullifyMap).length > 0) {
    for (const [objectName, tableName] of Object.entries(nullifyMap)) {
      if (typeof tableName === "string" && !joinsNotNullableMap[tableName]) {
        result[objectName] = null;
      }
    }
  }
  return result;
}
__name(mapResultRow, "mapResultRow");
function orderSelectedFields(fields, pathPrefix) {
  return Object.entries(fields).reduce((result, [name, field]) => {
    if (typeof name !== "string") {
      return result;
    }
    const newPath = pathPrefix ? [...pathPrefix, name] : [name];
    if (is(field, Column) || is(field, SQL) || is(field, SQL.Aliased)) {
      result.push({ path: newPath, field });
    } else if (is(field, Table)) {
      result.push(...orderSelectedFields(field[Table.Symbol.Columns], newPath));
    } else {
      result.push(...orderSelectedFields(field, newPath));
    }
    return result;
  }, []);
}
__name(orderSelectedFields, "orderSelectedFields");
function haveSameKeys(left, right) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  for (const [index, key] of leftKeys.entries()) {
    if (key !== rightKeys[index]) {
      return false;
    }
  }
  return true;
}
__name(haveSameKeys, "haveSameKeys");
function mapUpdateSet(table, values) {
  const entries = Object.entries(values).filter(([, value]) => value !== void 0).map(([key, value]) => {
    if (is(value, SQL)) {
      return [key, value];
    } else {
      return [key, new Param(value, table[Table.Symbol.Columns][key])];
    }
  });
  if (entries.length === 0) {
    throw new Error("No values to set");
  }
  return Object.fromEntries(entries);
}
__name(mapUpdateSet, "mapUpdateSet");
function applyMixins(baseClass, extendedClasses) {
  for (const extendedClass of extendedClasses) {
    for (const name of Object.getOwnPropertyNames(extendedClass.prototype)) {
      if (name === "constructor")
        continue;
      Object.defineProperty(
        baseClass.prototype,
        name,
        Object.getOwnPropertyDescriptor(extendedClass.prototype, name) || /* @__PURE__ */ Object.create(null)
      );
    }
  }
}
__name(applyMixins, "applyMixins");
function getTableColumns(table) {
  return table[Table.Symbol.Columns];
}
__name(getTableColumns, "getTableColumns");
function getTableLikeName(table) {
  return is(table, Subquery) ? table._.alias : is(table, View) ? table[ViewBaseConfig].name : is(table, SQL) ? void 0 : table[Table.Symbol.IsAlias] ? table[Table.Symbol.Name] : table[Table.Symbol.BaseName];
}
__name(getTableLikeName, "getTableLikeName");

// node_modules/drizzle-orm/sqlite-core/query-builders/delete.js
var _a42;
var SQLiteDeleteBase = class extends QueryPromise {
  constructor(table, session, dialect, withList) {
    super();
    this.table = table;
    this.session = session;
    this.dialect = dialect;
    this.config = { table, withList };
  }
  /** @internal */
  config;
  /**
   * Adds a `where` clause to the query.
   *
   * Calling this method will delete only those rows that fulfill a specified condition.
   *
   * See docs: {@link https://orm.drizzle.team/docs/delete}
   *
   * @param where the `where` clause.
   *
   * @example
   * You can use conditional operators and `sql function` to filter the rows to be deleted.
   *
   * ```ts
   * // Delete all cars with green color
   * db.delete(cars).where(eq(cars.color, 'green'));
   * // or
   * db.delete(cars).where(sql`${cars.color} = 'green'`)
   * ```
   *
   * You can logically combine conditional operators with `and()` and `or()` operators:
   *
   * ```ts
   * // Delete all BMW cars with a green color
   * db.delete(cars).where(and(eq(cars.color, 'green'), eq(cars.brand, 'BMW')));
   *
   * // Delete all cars with the green or blue color
   * db.delete(cars).where(or(eq(cars.color, 'green'), eq(cars.color, 'blue')));
   * ```
   */
  where(where) {
    this.config.where = where;
    return this;
  }
  returning(fields = this.table[SQLiteTable.Symbol.Columns]) {
    this.config.returning = orderSelectedFields(fields);
    return this;
  }
  /** @internal */
  getSQL() {
    return this.dialect.buildDeleteQuery(this.config);
  }
  toSQL() {
    const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
    return rest;
  }
  /** @internal */
  _prepare(isOneTimeQuery = true) {
    return this.session[isOneTimeQuery ? "prepareOneTimeQuery" : "prepareQuery"](
      this.dialect.sqlToQuery(this.getSQL()),
      this.config.returning,
      this.config.returning ? "all" : "run",
      true
    );
  }
  prepare() {
    return this._prepare(false);
  }
  run = (placeholderValues) => {
    return this._prepare().run(placeholderValues);
  };
  all = (placeholderValues) => {
    return this._prepare().all(placeholderValues);
  };
  get = (placeholderValues) => {
    return this._prepare().get(placeholderValues);
  };
  values = (placeholderValues) => {
    return this._prepare().values(placeholderValues);
  };
  async execute(placeholderValues) {
    return this._prepare().execute(placeholderValues);
  }
  $dynamic() {
    return this;
  }
};
__name(SQLiteDeleteBase, "SQLiteDeleteBase");
_a42 = entityKind;
__publicField(SQLiteDeleteBase, _a42, "SQLiteDelete");

// node_modules/drizzle-orm/sqlite-core/query-builders/insert.js
var _a43;
var SQLiteInsertBuilder = class {
  constructor(table, session, dialect, withList) {
    this.table = table;
    this.session = session;
    this.dialect = dialect;
    this.withList = withList;
  }
  values(values) {
    values = Array.isArray(values) ? values : [values];
    if (values.length === 0) {
      throw new Error("values() must be called with at least one value");
    }
    const mappedValues = values.map((entry) => {
      const result = {};
      const cols = this.table[Table.Symbol.Columns];
      for (const colKey of Object.keys(entry)) {
        const colValue = entry[colKey];
        result[colKey] = is(colValue, SQL) ? colValue : new Param(colValue, cols[colKey]);
      }
      return result;
    });
    return new SQLiteInsertBase(this.table, mappedValues, this.session, this.dialect, this.withList);
  }
};
__name(SQLiteInsertBuilder, "SQLiteInsertBuilder");
_a43 = entityKind;
__publicField(SQLiteInsertBuilder, _a43, "SQLiteInsertBuilder");
var _a44;
var SQLiteInsertBase = class extends QueryPromise {
  constructor(table, values, session, dialect, withList) {
    super();
    this.session = session;
    this.dialect = dialect;
    this.config = { table, values, withList };
  }
  /** @internal */
  config;
  returning(fields = this.config.table[SQLiteTable.Symbol.Columns]) {
    this.config.returning = orderSelectedFields(fields);
    return this;
  }
  /**
   * Adds an `on conflict do nothing` clause to the query.
   *
   * Calling this method simply avoids inserting a row as its alternative action.
   *
   * See docs: {@link https://orm.drizzle.team/docs/insert#on-conflict-do-nothing}
   *
   * @param config The `target` and `where` clauses.
   *
   * @example
   * ```ts
   * // Insert one row and cancel the insert if there's a conflict
   * await db.insert(cars)
   *   .values({ id: 1, brand: 'BMW' })
   *   .onConflictDoNothing();
   *
   * // Explicitly specify conflict target
   * await db.insert(cars)
   *   .values({ id: 1, brand: 'BMW' })
   *   .onConflictDoNothing({ target: cars.id });
   * ```
   */
  onConflictDoNothing(config = {}) {
    if (config.target === void 0) {
      this.config.onConflict = sql`do nothing`;
    } else {
      const targetSql = Array.isArray(config.target) ? sql`${config.target}` : sql`${[config.target]}`;
      const whereSql = config.where ? sql` where ${config.where}` : sql``;
      this.config.onConflict = sql`${targetSql} do nothing${whereSql}`;
    }
    return this;
  }
  /**
   * Adds an `on conflict do update` clause to the query.
   *
   * Calling this method will update the existing row that conflicts with the row proposed for insertion as its alternative action.
   *
   * See docs: {@link https://orm.drizzle.team/docs/insert#upserts-and-conflicts}
   *
   * @param config The `target`, `set` and `where` clauses.
   *
   * @example
   * ```ts
   * // Update the row if there's a conflict
   * await db.insert(cars)
   *   .values({ id: 1, brand: 'BMW' })
   *   .onConflictDoUpdate({
   *     target: cars.id,
   *     set: { brand: 'Porsche' }
   *   });
   *
   * // Upsert with 'where' clause
   * await db.insert(cars)
   *   .values({ id: 1, brand: 'BMW' })
   *   .onConflictDoUpdate({
   *     target: cars.id,
   *     set: { brand: 'newBMW' },
   *     where: sql`${cars.createdAt} > '2023-01-01'::date`,
   *   });
   * ```
   */
  onConflictDoUpdate(config) {
    if (config.where && (config.targetWhere || config.setWhere)) {
      throw new Error(
        'You cannot use both "where" and "targetWhere"/"setWhere" at the same time - "where" is deprecated, use "targetWhere" or "setWhere" instead.'
      );
    }
    const whereSql = config.where ? sql` where ${config.where}` : void 0;
    const targetWhereSql = config.targetWhere ? sql` where ${config.targetWhere}` : void 0;
    const setWhereSql = config.setWhere ? sql` where ${config.setWhere}` : void 0;
    const targetSql = Array.isArray(config.target) ? sql`${config.target}` : sql`${[config.target]}`;
    const setSql = this.dialect.buildUpdateSet(this.config.table, mapUpdateSet(this.config.table, config.set));
    this.config.onConflict = sql`${targetSql}${targetWhereSql} do update set ${setSql}${whereSql}${setWhereSql}`;
    return this;
  }
  /** @internal */
  getSQL() {
    return this.dialect.buildInsertQuery(this.config);
  }
  toSQL() {
    const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
    return rest;
  }
  /** @internal */
  _prepare(isOneTimeQuery = true) {
    return this.session[isOneTimeQuery ? "prepareOneTimeQuery" : "prepareQuery"](
      this.dialect.sqlToQuery(this.getSQL()),
      this.config.returning,
      this.config.returning ? "all" : "run",
      true
    );
  }
  prepare() {
    return this._prepare(false);
  }
  run = (placeholderValues) => {
    return this._prepare().run(placeholderValues);
  };
  all = (placeholderValues) => {
    return this._prepare().all(placeholderValues);
  };
  get = (placeholderValues) => {
    return this._prepare().get(placeholderValues);
  };
  values = (placeholderValues) => {
    return this._prepare().values(placeholderValues);
  };
  async execute() {
    return this.config.returning ? this.all() : this.run();
  }
  $dynamic() {
    return this;
  }
};
__name(SQLiteInsertBase, "SQLiteInsertBase");
_a44 = entityKind;
__publicField(SQLiteInsertBase, _a44, "SQLiteInsert");

// node_modules/drizzle-orm/errors.js
var _a45;
var DrizzleError = class extends Error {
  constructor({ message: message2, cause }) {
    super(message2);
    this.name = "DrizzleError";
    this.cause = cause;
  }
};
__name(DrizzleError, "DrizzleError");
_a45 = entityKind;
__publicField(DrizzleError, _a45, "DrizzleError");
var _a46;
var TransactionRollbackError = class extends DrizzleError {
  constructor() {
    super({ message: "Rollback" });
  }
};
__name(TransactionRollbackError, "TransactionRollbackError");
_a46 = entityKind;
__publicField(TransactionRollbackError, _a46, "TransactionRollbackError");

// node_modules/drizzle-orm/sqlite-core/foreign-keys.js
var _a47;
var ForeignKeyBuilder2 = class {
  /** @internal */
  reference;
  /** @internal */
  _onUpdate;
  /** @internal */
  _onDelete;
  constructor(config, actions) {
    this.reference = () => {
      const { name, columns, foreignColumns } = config();
      return { name, columns, foreignTable: foreignColumns[0].table, foreignColumns };
    };
    if (actions) {
      this._onUpdate = actions.onUpdate;
      this._onDelete = actions.onDelete;
    }
  }
  onUpdate(action) {
    this._onUpdate = action;
    return this;
  }
  onDelete(action) {
    this._onDelete = action;
    return this;
  }
  /** @internal */
  build(table) {
    return new ForeignKey2(table, this);
  }
};
__name(ForeignKeyBuilder2, "ForeignKeyBuilder");
_a47 = entityKind;
__publicField(ForeignKeyBuilder2, _a47, "SQLiteForeignKeyBuilder");
var _a48;
var ForeignKey2 = class {
  constructor(table, builder) {
    this.table = table;
    this.reference = builder.reference;
    this.onUpdate = builder._onUpdate;
    this.onDelete = builder._onDelete;
  }
  reference;
  onUpdate;
  onDelete;
  getName() {
    const { name, columns, foreignColumns } = this.reference();
    const columnNames = columns.map((column) => column.name);
    const foreignColumnNames = foreignColumns.map((column) => column.name);
    const chunks = [
      this.table[SQLiteTable.Symbol.Name],
      ...columnNames,
      foreignColumns[0].table[SQLiteTable.Symbol.Name],
      ...foreignColumnNames
    ];
    return name ?? `${chunks.join("_")}_fk`;
  }
};
__name(ForeignKey2, "ForeignKey");
_a48 = entityKind;
__publicField(ForeignKey2, _a48, "SQLiteForeignKey");

// node_modules/drizzle-orm/sqlite-core/unique-constraint.js
function uniqueKeyName2(table, columns) {
  return `${table[SQLiteTable.Symbol.Name]}_${columns.join("_")}_unique`;
}
__name(uniqueKeyName2, "uniqueKeyName");
var _a49;
var UniqueConstraintBuilder2 = class {
  constructor(columns, name) {
    this.name = name;
    this.columns = columns;
  }
  /** @internal */
  columns;
  /** @internal */
  build(table) {
    return new UniqueConstraint2(table, this.columns, this.name);
  }
};
__name(UniqueConstraintBuilder2, "UniqueConstraintBuilder");
_a49 = entityKind;
__publicField(UniqueConstraintBuilder2, _a49, "SQLiteUniqueConstraintBuilder");
var _a50;
var UniqueOnConstraintBuilder2 = class {
  /** @internal */
  name;
  constructor(name) {
    this.name = name;
  }
  on(...columns) {
    return new UniqueConstraintBuilder2(columns, this.name);
  }
};
__name(UniqueOnConstraintBuilder2, "UniqueOnConstraintBuilder");
_a50 = entityKind;
__publicField(UniqueOnConstraintBuilder2, _a50, "SQLiteUniqueOnConstraintBuilder");
var _a51;
var UniqueConstraint2 = class {
  constructor(table, columns, name) {
    this.table = table;
    this.columns = columns;
    this.name = name ?? uniqueKeyName2(this.table, this.columns.map((column) => column.name));
  }
  columns;
  name;
  getName() {
    return this.name;
  }
};
__name(UniqueConstraint2, "UniqueConstraint");
_a51 = entityKind;
__publicField(UniqueConstraint2, _a51, "SQLiteUniqueConstraint");

// node_modules/drizzle-orm/sqlite-core/columns/common.js
var _a52;
var SQLiteColumnBuilder = class extends ColumnBuilder {
  foreignKeyConfigs = [];
  references(ref, actions = {}) {
    this.foreignKeyConfigs.push({ ref, actions });
    return this;
  }
  unique(name) {
    this.config.isUnique = true;
    this.config.uniqueName = name;
    return this;
  }
  generatedAlwaysAs(as, config) {
    this.config.generated = {
      as,
      type: "always",
      mode: config?.mode ?? "virtual"
    };
    return this;
  }
  /** @internal */
  buildForeignKeys(column, table) {
    return this.foreignKeyConfigs.map(({ ref, actions }) => {
      return ((ref2, actions2) => {
        const builder = new ForeignKeyBuilder2(() => {
          const foreignColumn = ref2();
          return { columns: [column], foreignColumns: [foreignColumn] };
        });
        if (actions2.onUpdate) {
          builder.onUpdate(actions2.onUpdate);
        }
        if (actions2.onDelete) {
          builder.onDelete(actions2.onDelete);
        }
        return builder.build(table);
      })(ref, actions);
    });
  }
};
__name(SQLiteColumnBuilder, "SQLiteColumnBuilder");
_a52 = entityKind;
__publicField(SQLiteColumnBuilder, _a52, "SQLiteColumnBuilder");
var _a53;
var SQLiteColumn = class extends Column {
  constructor(table, config) {
    if (!config.uniqueName) {
      config.uniqueName = uniqueKeyName2(table, [config.name]);
    }
    super(table, config);
    this.table = table;
  }
};
__name(SQLiteColumn, "SQLiteColumn");
_a53 = entityKind;
__publicField(SQLiteColumn, _a53, "SQLiteColumn");

// node_modules/drizzle-orm/sqlite-core/columns/integer.js
var _a54;
var SQLiteBaseIntegerBuilder = class extends SQLiteColumnBuilder {
  constructor(name, dataType, columnType) {
    super(name, dataType, columnType);
    this.config.autoIncrement = false;
  }
  primaryKey(config) {
    if (config?.autoIncrement) {
      this.config.autoIncrement = true;
    }
    this.config.hasDefault = true;
    return super.primaryKey();
  }
};
__name(SQLiteBaseIntegerBuilder, "SQLiteBaseIntegerBuilder");
_a54 = entityKind;
__publicField(SQLiteBaseIntegerBuilder, _a54, "SQLiteBaseIntegerBuilder");
var _a55;
var SQLiteBaseInteger = class extends SQLiteColumn {
  autoIncrement = this.config.autoIncrement;
  getSQLType() {
    return "integer";
  }
};
__name(SQLiteBaseInteger, "SQLiteBaseInteger");
_a55 = entityKind;
__publicField(SQLiteBaseInteger, _a55, "SQLiteBaseInteger");
var _a56;
var SQLiteIntegerBuilder = class extends SQLiteBaseIntegerBuilder {
  constructor(name) {
    super(name, "number", "SQLiteInteger");
  }
  build(table) {
    return new SQLiteInteger(
      table,
      this.config
    );
  }
};
__name(SQLiteIntegerBuilder, "SQLiteIntegerBuilder");
_a56 = entityKind;
__publicField(SQLiteIntegerBuilder, _a56, "SQLiteIntegerBuilder");
var _a57;
var SQLiteInteger = class extends SQLiteBaseInteger {
};
__name(SQLiteInteger, "SQLiteInteger");
_a57 = entityKind;
__publicField(SQLiteInteger, _a57, "SQLiteInteger");
var _a58;
var SQLiteTimestampBuilder = class extends SQLiteBaseIntegerBuilder {
  constructor(name, mode) {
    super(name, "date", "SQLiteTimestamp");
    this.config.mode = mode;
  }
  /**
   * @deprecated Use `default()` with your own expression instead.
   *
   * Adds `DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer))` to the column, which is the current epoch timestamp in milliseconds.
   */
  defaultNow() {
    return this.default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`);
  }
  build(table) {
    return new SQLiteTimestamp(
      table,
      this.config
    );
  }
};
__name(SQLiteTimestampBuilder, "SQLiteTimestampBuilder");
_a58 = entityKind;
__publicField(SQLiteTimestampBuilder, _a58, "SQLiteTimestampBuilder");
var _a59;
var SQLiteTimestamp = class extends SQLiteBaseInteger {
  mode = this.config.mode;
  mapFromDriverValue(value) {
    if (this.config.mode === "timestamp") {
      return new Date(value * 1e3);
    }
    return new Date(value);
  }
  mapToDriverValue(value) {
    const unix = value.getTime();
    if (this.config.mode === "timestamp") {
      return Math.floor(unix / 1e3);
    }
    return unix;
  }
};
__name(SQLiteTimestamp, "SQLiteTimestamp");
_a59 = entityKind;
__publicField(SQLiteTimestamp, _a59, "SQLiteTimestamp");
var _a60;
var SQLiteBooleanBuilder = class extends SQLiteBaseIntegerBuilder {
  constructor(name, mode) {
    super(name, "boolean", "SQLiteBoolean");
    this.config.mode = mode;
  }
  build(table) {
    return new SQLiteBoolean(
      table,
      this.config
    );
  }
};
__name(SQLiteBooleanBuilder, "SQLiteBooleanBuilder");
_a60 = entityKind;
__publicField(SQLiteBooleanBuilder, _a60, "SQLiteBooleanBuilder");
var _a61;
var SQLiteBoolean = class extends SQLiteBaseInteger {
  mode = this.config.mode;
  mapFromDriverValue(value) {
    return Number(value) === 1;
  }
  mapToDriverValue(value) {
    return value ? 1 : 0;
  }
};
__name(SQLiteBoolean, "SQLiteBoolean");
_a61 = entityKind;
__publicField(SQLiteBoolean, _a61, "SQLiteBoolean");
function integer(name, config) {
  if (config?.mode === "timestamp" || config?.mode === "timestamp_ms") {
    return new SQLiteTimestampBuilder(name, config.mode);
  }
  if (config?.mode === "boolean") {
    return new SQLiteBooleanBuilder(name, config.mode);
  }
  return new SQLiteIntegerBuilder(name);
}
__name(integer, "integer");

// node_modules/drizzle-orm/sqlite-core/columns/real.js
var _a62;
var SQLiteRealBuilder = class extends SQLiteColumnBuilder {
  constructor(name) {
    super(name, "number", "SQLiteReal");
  }
  /** @internal */
  build(table) {
    return new SQLiteReal(table, this.config);
  }
};
__name(SQLiteRealBuilder, "SQLiteRealBuilder");
_a62 = entityKind;
__publicField(SQLiteRealBuilder, _a62, "SQLiteRealBuilder");
var _a63;
var SQLiteReal = class extends SQLiteColumn {
  getSQLType() {
    return "real";
  }
};
__name(SQLiteReal, "SQLiteReal");
_a63 = entityKind;
__publicField(SQLiteReal, _a63, "SQLiteReal");
function real(name) {
  return new SQLiteRealBuilder(name);
}
__name(real, "real");

// node_modules/drizzle-orm/sqlite-core/columns/text.js
var _a64;
var SQLiteTextBuilder = class extends SQLiteColumnBuilder {
  constructor(name, config) {
    super(name, "string", "SQLiteText");
    this.config.enumValues = config.enum;
    this.config.length = config.length;
  }
  /** @internal */
  build(table) {
    return new SQLiteText(table, this.config);
  }
};
__name(SQLiteTextBuilder, "SQLiteTextBuilder");
_a64 = entityKind;
__publicField(SQLiteTextBuilder, _a64, "SQLiteTextBuilder");
var _a65;
var SQLiteText = class extends SQLiteColumn {
  enumValues = this.config.enumValues;
  length = this.config.length;
  constructor(table, config) {
    super(table, config);
  }
  getSQLType() {
    return `text${this.config.length ? `(${this.config.length})` : ""}`;
  }
};
__name(SQLiteText, "SQLiteText");
_a65 = entityKind;
__publicField(SQLiteText, _a65, "SQLiteText");
var _a66;
var SQLiteTextJsonBuilder = class extends SQLiteColumnBuilder {
  constructor(name) {
    super(name, "json", "SQLiteTextJson");
  }
  /** @internal */
  build(table) {
    return new SQLiteTextJson(
      table,
      this.config
    );
  }
};
__name(SQLiteTextJsonBuilder, "SQLiteTextJsonBuilder");
_a66 = entityKind;
__publicField(SQLiteTextJsonBuilder, _a66, "SQLiteTextJsonBuilder");
var _a67;
var SQLiteTextJson = class extends SQLiteColumn {
  getSQLType() {
    return "text";
  }
  mapFromDriverValue(value) {
    return JSON.parse(value);
  }
  mapToDriverValue(value) {
    return JSON.stringify(value);
  }
};
__name(SQLiteTextJson, "SQLiteTextJson");
_a67 = entityKind;
__publicField(SQLiteTextJson, _a67, "SQLiteTextJson");
function text(name, config = {}) {
  return config.mode === "json" ? new SQLiteTextJsonBuilder(name) : new SQLiteTextBuilder(name, config);
}
__name(text, "text");

// node_modules/drizzle-orm/sqlite-core/view-base.js
var _a68;
var SQLiteViewBase = class extends View {
};
__name(SQLiteViewBase, "SQLiteViewBase");
_a68 = entityKind;
__publicField(SQLiteViewBase, _a68, "SQLiteViewBase");

// node_modules/drizzle-orm/sqlite-core/dialect.js
var _a69;
var SQLiteDialect = class {
  escapeName(name) {
    return `"${name}"`;
  }
  escapeParam(_num) {
    return "?";
  }
  escapeString(str) {
    return `'${str.replace(/'/g, "''")}'`;
  }
  buildWithCTE(queries) {
    if (!queries?.length)
      return void 0;
    const withSqlChunks = [sql`with `];
    for (const [i, w] of queries.entries()) {
      withSqlChunks.push(sql`${sql.identifier(w._.alias)} as (${w._.sql})`);
      if (i < queries.length - 1) {
        withSqlChunks.push(sql`, `);
      }
    }
    withSqlChunks.push(sql` `);
    return sql.join(withSqlChunks);
  }
  buildDeleteQuery({ table, where, returning, withList }) {
    const withSql = this.buildWithCTE(withList);
    const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: true })}` : void 0;
    const whereSql = where ? sql` where ${where}` : void 0;
    return sql`${withSql}delete from ${table}${whereSql}${returningSql}`;
  }
  buildUpdateSet(table, set) {
    const tableColumns = table[Table.Symbol.Columns];
    const columnNames = Object.keys(tableColumns).filter(
      (colName) => set[colName] !== void 0 || tableColumns[colName]?.onUpdateFn !== void 0
    );
    const setSize = columnNames.length;
    return sql.join(columnNames.flatMap((colName, i) => {
      const col = tableColumns[colName];
      const value = set[colName] ?? sql.param(col.onUpdateFn(), col);
      const res = sql`${sql.identifier(col.name)} = ${value}`;
      if (i < setSize - 1) {
        return [res, sql.raw(", ")];
      }
      return [res];
    }));
  }
  buildUpdateQuery({ table, set, where, returning, withList }) {
    const withSql = this.buildWithCTE(withList);
    const setSql = this.buildUpdateSet(table, set);
    const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: true })}` : void 0;
    const whereSql = where ? sql` where ${where}` : void 0;
    return sql`${withSql}update ${table} set ${setSql}${whereSql}${returningSql}`;
  }
  /**
   * Builds selection SQL with provided fields/expressions
   *
   * Examples:
   *
   * `select <selection> from`
   *
   * `insert ... returning <selection>`
   *
   * If `isSingleTable` is true, then columns won't be prefixed with table name
   */
  buildSelection(fields, { isSingleTable = false } = {}) {
    const columnsLen = fields.length;
    const chunks = fields.flatMap(({ field }, i) => {
      const chunk = [];
      if (is(field, SQL.Aliased) && field.isSelectionField) {
        chunk.push(sql.identifier(field.fieldAlias));
      } else if (is(field, SQL.Aliased) || is(field, SQL)) {
        const query = is(field, SQL.Aliased) ? field.sql : field;
        if (isSingleTable) {
          chunk.push(
            new SQL(
              query.queryChunks.map((c) => {
                if (is(c, Column)) {
                  return sql.identifier(c.name);
                }
                return c;
              })
            )
          );
        } else {
          chunk.push(query);
        }
        if (is(field, SQL.Aliased)) {
          chunk.push(sql` as ${sql.identifier(field.fieldAlias)}`);
        }
      } else if (is(field, Column)) {
        const tableName = field.table[Table.Symbol.Name];
        const columnName = field.name;
        if (isSingleTable) {
          chunk.push(sql.identifier(columnName));
        } else {
          chunk.push(sql`${sql.identifier(tableName)}.${sql.identifier(columnName)}`);
        }
      }
      if (i < columnsLen - 1) {
        chunk.push(sql`, `);
      }
      return chunk;
    });
    return sql.join(chunks);
  }
  buildSelectQuery({
    withList,
    fields,
    fieldsFlat,
    where,
    having,
    table,
    joins,
    orderBy,
    groupBy,
    limit,
    offset,
    distinct,
    setOperators
  }) {
    const fieldsList = fieldsFlat ?? orderSelectedFields(fields);
    for (const f of fieldsList) {
      if (is(f.field, Column) && getTableName(f.field.table) !== (is(table, Subquery) ? table._.alias : is(table, SQLiteViewBase) ? table[ViewBaseConfig].name : is(table, SQL) ? void 0 : getTableName(table)) && !((table2) => joins?.some(
        ({ alias }) => alias === (table2[Table.Symbol.IsAlias] ? getTableName(table2) : table2[Table.Symbol.BaseName])
      ))(f.field.table)) {
        const tableName = getTableName(f.field.table);
        throw new Error(
          `Your "${f.path.join("->")}" field references a column "${tableName}"."${f.field.name}", but the table "${tableName}" is not part of the query! Did you forget to join it?`
        );
      }
    }
    const isSingleTable = !joins || joins.length === 0;
    const withSql = this.buildWithCTE(withList);
    const distinctSql = distinct ? sql` distinct` : void 0;
    const selection = this.buildSelection(fieldsList, { isSingleTable });
    const tableSql = (() => {
      if (is(table, Table) && table[Table.Symbol.OriginalName] !== table[Table.Symbol.Name]) {
        return sql`${sql.identifier(table[Table.Symbol.OriginalName])} ${sql.identifier(table[Table.Symbol.Name])}`;
      }
      return table;
    })();
    const joinsArray = [];
    if (joins) {
      for (const [index, joinMeta] of joins.entries()) {
        if (index === 0) {
          joinsArray.push(sql` `);
        }
        const table2 = joinMeta.table;
        if (is(table2, SQLiteTable)) {
          const tableName = table2[SQLiteTable.Symbol.Name];
          const tableSchema = table2[SQLiteTable.Symbol.Schema];
          const origTableName = table2[SQLiteTable.Symbol.OriginalName];
          const alias = tableName === origTableName ? void 0 : joinMeta.alias;
          joinsArray.push(
            sql`${sql.raw(joinMeta.joinType)} join ${tableSchema ? sql`${sql.identifier(tableSchema)}.` : void 0}${sql.identifier(origTableName)}${alias && sql` ${sql.identifier(alias)}`} on ${joinMeta.on}`
          );
        } else {
          joinsArray.push(
            sql`${sql.raw(joinMeta.joinType)} join ${table2} on ${joinMeta.on}`
          );
        }
        if (index < joins.length - 1) {
          joinsArray.push(sql` `);
        }
      }
    }
    const joinsSql = sql.join(joinsArray);
    const whereSql = where ? sql` where ${where}` : void 0;
    const havingSql = having ? sql` having ${having}` : void 0;
    const orderByList = [];
    if (orderBy) {
      for (const [index, orderByValue] of orderBy.entries()) {
        orderByList.push(orderByValue);
        if (index < orderBy.length - 1) {
          orderByList.push(sql`, `);
        }
      }
    }
    const groupByList = [];
    if (groupBy) {
      for (const [index, groupByValue] of groupBy.entries()) {
        groupByList.push(groupByValue);
        if (index < groupBy.length - 1) {
          groupByList.push(sql`, `);
        }
      }
    }
    const groupBySql = groupByList.length > 0 ? sql` group by ${sql.join(groupByList)}` : void 0;
    const orderBySql = orderByList.length > 0 ? sql` order by ${sql.join(orderByList)}` : void 0;
    const limitSql = typeof limit === "object" || typeof limit === "number" && limit >= 0 ? sql` limit ${limit}` : void 0;
    const offsetSql = offset ? sql` offset ${offset}` : void 0;
    const finalQuery = sql`${withSql}select${distinctSql} ${selection} from ${tableSql}${joinsSql}${whereSql}${groupBySql}${havingSql}${orderBySql}${limitSql}${offsetSql}`;
    if (setOperators.length > 0) {
      return this.buildSetOperations(finalQuery, setOperators);
    }
    return finalQuery;
  }
  buildSetOperations(leftSelect, setOperators) {
    const [setOperator, ...rest] = setOperators;
    if (!setOperator) {
      throw new Error("Cannot pass undefined values to any set operator");
    }
    if (rest.length === 0) {
      return this.buildSetOperationQuery({ leftSelect, setOperator });
    }
    return this.buildSetOperations(
      this.buildSetOperationQuery({ leftSelect, setOperator }),
      rest
    );
  }
  buildSetOperationQuery({
    leftSelect,
    setOperator: { type, isAll, rightSelect, limit, orderBy, offset }
  }) {
    const leftChunk = sql`${leftSelect.getSQL()} `;
    const rightChunk = sql`${rightSelect.getSQL()}`;
    let orderBySql;
    if (orderBy && orderBy.length > 0) {
      const orderByValues = [];
      for (const singleOrderBy of orderBy) {
        if (is(singleOrderBy, SQLiteColumn)) {
          orderByValues.push(sql.identifier(singleOrderBy.name));
        } else if (is(singleOrderBy, SQL)) {
          for (let i = 0; i < singleOrderBy.queryChunks.length; i++) {
            const chunk = singleOrderBy.queryChunks[i];
            if (is(chunk, SQLiteColumn)) {
              singleOrderBy.queryChunks[i] = sql.identifier(chunk.name);
            }
          }
          orderByValues.push(sql`${singleOrderBy}`);
        } else {
          orderByValues.push(sql`${singleOrderBy}`);
        }
      }
      orderBySql = sql` order by ${sql.join(orderByValues, sql`, `)}`;
    }
    const limitSql = typeof limit === "object" || typeof limit === "number" && limit >= 0 ? sql` limit ${limit}` : void 0;
    const operatorChunk = sql.raw(`${type} ${isAll ? "all " : ""}`);
    const offsetSql = offset ? sql` offset ${offset}` : void 0;
    return sql`${leftChunk}${operatorChunk}${rightChunk}${orderBySql}${limitSql}${offsetSql}`;
  }
  buildInsertQuery({ table, values, onConflict, returning, withList }) {
    const valuesSqlList = [];
    const columns = table[Table.Symbol.Columns];
    const colEntries = Object.entries(columns).filter(
      ([_, col]) => !col.shouldDisableInsert()
    );
    const insertOrder = colEntries.map(([, column]) => sql.identifier(column.name));
    for (const [valueIndex, value] of values.entries()) {
      const valueList = [];
      for (const [fieldName, col] of colEntries) {
        const colValue = value[fieldName];
        if (colValue === void 0 || is(colValue, Param) && colValue.value === void 0) {
          let defaultValue;
          if (col.default !== null && col.default !== void 0) {
            defaultValue = is(col.default, SQL) ? col.default : sql.param(col.default, col);
          } else if (col.defaultFn !== void 0) {
            const defaultFnResult = col.defaultFn();
            defaultValue = is(defaultFnResult, SQL) ? defaultFnResult : sql.param(defaultFnResult, col);
          } else if (!col.default && col.onUpdateFn !== void 0) {
            const onUpdateFnResult = col.onUpdateFn();
            defaultValue = is(onUpdateFnResult, SQL) ? onUpdateFnResult : sql.param(onUpdateFnResult, col);
          } else {
            defaultValue = sql`null`;
          }
          valueList.push(defaultValue);
        } else {
          valueList.push(colValue);
        }
      }
      valuesSqlList.push(valueList);
      if (valueIndex < values.length - 1) {
        valuesSqlList.push(sql`, `);
      }
    }
    const withSql = this.buildWithCTE(withList);
    const valuesSql = sql.join(valuesSqlList);
    const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: true })}` : void 0;
    const onConflictSql = onConflict ? sql` on conflict ${onConflict}` : void 0;
    return sql`${withSql}insert into ${table} ${insertOrder} values ${valuesSql}${onConflictSql}${returningSql}`;
  }
  sqlToQuery(sql2, invokeSource) {
    return sql2.toQuery({
      escapeName: this.escapeName,
      escapeParam: this.escapeParam,
      escapeString: this.escapeString,
      invokeSource
    });
  }
  buildRelationalQuery({
    fullSchema,
    schema,
    tableNamesMap,
    table,
    tableConfig,
    queryConfig: config,
    tableAlias,
    nestedQueryRelation,
    joinOn
  }) {
    let selection = [];
    let limit, offset, orderBy = [], where;
    const joins = [];
    if (config === true) {
      const selectionEntries = Object.entries(tableConfig.columns);
      selection = selectionEntries.map(([key, value]) => ({
        dbKey: value.name,
        tsKey: key,
        field: aliasedTableColumn(value, tableAlias),
        relationTableTsKey: void 0,
        isJson: false,
        selection: []
      }));
    } else {
      const aliasedColumns = Object.fromEntries(
        Object.entries(tableConfig.columns).map(([key, value]) => [key, aliasedTableColumn(value, tableAlias)])
      );
      if (config.where) {
        const whereSql = typeof config.where === "function" ? config.where(aliasedColumns, getOperators()) : config.where;
        where = whereSql && mapColumnsInSQLToAlias(whereSql, tableAlias);
      }
      const fieldsSelection = [];
      let selectedColumns = [];
      if (config.columns) {
        let isIncludeMode = false;
        for (const [field, value] of Object.entries(config.columns)) {
          if (value === void 0) {
            continue;
          }
          if (field in tableConfig.columns) {
            if (!isIncludeMode && value === true) {
              isIncludeMode = true;
            }
            selectedColumns.push(field);
          }
        }
        if (selectedColumns.length > 0) {
          selectedColumns = isIncludeMode ? selectedColumns.filter((c) => config.columns?.[c] === true) : Object.keys(tableConfig.columns).filter((key) => !selectedColumns.includes(key));
        }
      } else {
        selectedColumns = Object.keys(tableConfig.columns);
      }
      for (const field of selectedColumns) {
        const column = tableConfig.columns[field];
        fieldsSelection.push({ tsKey: field, value: column });
      }
      let selectedRelations = [];
      if (config.with) {
        selectedRelations = Object.entries(config.with).filter((entry) => !!entry[1]).map(([tsKey, queryConfig]) => ({ tsKey, queryConfig, relation: tableConfig.relations[tsKey] }));
      }
      let extras;
      if (config.extras) {
        extras = typeof config.extras === "function" ? config.extras(aliasedColumns, { sql }) : config.extras;
        for (const [tsKey, value] of Object.entries(extras)) {
          fieldsSelection.push({
            tsKey,
            value: mapColumnsInAliasedSQLToAlias(value, tableAlias)
          });
        }
      }
      for (const { tsKey, value } of fieldsSelection) {
        selection.push({
          dbKey: is(value, SQL.Aliased) ? value.fieldAlias : tableConfig.columns[tsKey].name,
          tsKey,
          field: is(value, Column) ? aliasedTableColumn(value, tableAlias) : value,
          relationTableTsKey: void 0,
          isJson: false,
          selection: []
        });
      }
      let orderByOrig = typeof config.orderBy === "function" ? config.orderBy(aliasedColumns, getOrderByOperators()) : config.orderBy ?? [];
      if (!Array.isArray(orderByOrig)) {
        orderByOrig = [orderByOrig];
      }
      orderBy = orderByOrig.map((orderByValue) => {
        if (is(orderByValue, Column)) {
          return aliasedTableColumn(orderByValue, tableAlias);
        }
        return mapColumnsInSQLToAlias(orderByValue, tableAlias);
      });
      limit = config.limit;
      offset = config.offset;
      for (const {
        tsKey: selectedRelationTsKey,
        queryConfig: selectedRelationConfigValue,
        relation
      } of selectedRelations) {
        const normalizedRelation = normalizeRelation(schema, tableNamesMap, relation);
        const relationTableName = getTableUniqueName(relation.referencedTable);
        const relationTableTsName = tableNamesMap[relationTableName];
        const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
        const joinOn2 = and(
          ...normalizedRelation.fields.map(
            (field2, i) => eq(
              aliasedTableColumn(normalizedRelation.references[i], relationTableAlias),
              aliasedTableColumn(field2, tableAlias)
            )
          )
        );
        const builtRelation = this.buildRelationalQuery({
          fullSchema,
          schema,
          tableNamesMap,
          table: fullSchema[relationTableTsName],
          tableConfig: schema[relationTableTsName],
          queryConfig: is(relation, One) ? selectedRelationConfigValue === true ? { limit: 1 } : { ...selectedRelationConfigValue, limit: 1 } : selectedRelationConfigValue,
          tableAlias: relationTableAlias,
          joinOn: joinOn2,
          nestedQueryRelation: relation
        });
        const field = sql`(${builtRelation.sql})`.as(selectedRelationTsKey);
        selection.push({
          dbKey: selectedRelationTsKey,
          tsKey: selectedRelationTsKey,
          field,
          relationTableTsKey: relationTableTsName,
          isJson: true,
          selection: builtRelation.selection
        });
      }
    }
    if (selection.length === 0) {
      throw new DrizzleError({
        message: `No fields selected for table "${tableConfig.tsName}" ("${tableAlias}"). You need to have at least one item in "columns", "with" or "extras". If you need to select all columns, omit the "columns" key or set it to undefined.`
      });
    }
    let result;
    where = and(joinOn, where);
    if (nestedQueryRelation) {
      let field = sql`json_array(${sql.join(
        selection.map(
          ({ field: field2 }) => is(field2, SQLiteColumn) ? sql.identifier(field2.name) : is(field2, SQL.Aliased) ? field2.sql : field2
        ),
        sql`, `
      )})`;
      if (is(nestedQueryRelation, Many)) {
        field = sql`coalesce(json_group_array(${field}), json_array())`;
      }
      const nestedSelection = [{
        dbKey: "data",
        tsKey: "data",
        field: field.as("data"),
        isJson: true,
        relationTableTsKey: tableConfig.tsName,
        selection
      }];
      const needsSubquery = limit !== void 0 || offset !== void 0 || orderBy.length > 0;
      if (needsSubquery) {
        result = this.buildSelectQuery({
          table: aliasedTable(table, tableAlias),
          fields: {},
          fieldsFlat: [
            {
              path: [],
              field: sql.raw("*")
            }
          ],
          where,
          limit,
          offset,
          orderBy,
          setOperators: []
        });
        where = void 0;
        limit = void 0;
        offset = void 0;
        orderBy = void 0;
      } else {
        result = aliasedTable(table, tableAlias);
      }
      result = this.buildSelectQuery({
        table: is(result, SQLiteTable) ? result : new Subquery(result, {}, tableAlias),
        fields: {},
        fieldsFlat: nestedSelection.map(({ field: field2 }) => ({
          path: [],
          field: is(field2, Column) ? aliasedTableColumn(field2, tableAlias) : field2
        })),
        joins,
        where,
        limit,
        offset,
        orderBy,
        setOperators: []
      });
    } else {
      result = this.buildSelectQuery({
        table: aliasedTable(table, tableAlias),
        fields: {},
        fieldsFlat: selection.map(({ field }) => ({
          path: [],
          field: is(field, Column) ? aliasedTableColumn(field, tableAlias) : field
        })),
        joins,
        where,
        limit,
        offset,
        orderBy,
        setOperators: []
      });
    }
    return {
      tableTsKey: tableConfig.tsName,
      sql: result,
      selection
    };
  }
};
__name(SQLiteDialect, "SQLiteDialect");
_a69 = entityKind;
__publicField(SQLiteDialect, _a69, "SQLiteDialect");
var _a70;
var SQLiteSyncDialect = class extends SQLiteDialect {
  migrate(migrations, session, config) {
    const migrationsTable = config === void 0 ? "__drizzle_migrations" : typeof config === "string" ? "__drizzle_migrations" : config.migrationsTable ?? "__drizzle_migrations";
    const migrationTableCreate = sql`
			CREATE TABLE IF NOT EXISTS ${sql.identifier(migrationsTable)} (
				id SERIAL PRIMARY KEY,
				hash text NOT NULL,
				created_at numeric
			)
		`;
    session.run(migrationTableCreate);
    const dbMigrations = session.values(
      sql`SELECT id, hash, created_at FROM ${sql.identifier(migrationsTable)} ORDER BY created_at DESC LIMIT 1`
    );
    const lastDbMigration = dbMigrations[0] ?? void 0;
    session.run(sql`BEGIN`);
    try {
      for (const migration of migrations) {
        if (!lastDbMigration || Number(lastDbMigration[2]) < migration.folderMillis) {
          for (const stmt of migration.sql) {
            session.run(sql.raw(stmt));
          }
          session.run(
            sql`INSERT INTO ${sql.identifier(migrationsTable)} ("hash", "created_at") VALUES(${migration.hash}, ${migration.folderMillis})`
          );
        }
      }
      session.run(sql`COMMIT`);
    } catch (e) {
      session.run(sql`ROLLBACK`);
      throw e;
    }
  }
};
__name(SQLiteSyncDialect, "SQLiteSyncDialect");
_a70 = entityKind;
__publicField(SQLiteSyncDialect, _a70, "SQLiteSyncDialect");
var _a71;
var SQLiteAsyncDialect = class extends SQLiteDialect {
  async migrate(migrations, session, config) {
    const migrationsTable = config === void 0 ? "__drizzle_migrations" : typeof config === "string" ? "__drizzle_migrations" : config.migrationsTable ?? "__drizzle_migrations";
    const migrationTableCreate = sql`
			CREATE TABLE IF NOT EXISTS ${sql.identifier(migrationsTable)} (
				id SERIAL PRIMARY KEY,
				hash text NOT NULL,
				created_at numeric
			)
		`;
    await session.run(migrationTableCreate);
    const dbMigrations = await session.values(
      sql`SELECT id, hash, created_at FROM ${sql.identifier(migrationsTable)} ORDER BY created_at DESC LIMIT 1`
    );
    const lastDbMigration = dbMigrations[0] ?? void 0;
    await session.transaction(async (tx) => {
      for (const migration of migrations) {
        if (!lastDbMigration || Number(lastDbMigration[2]) < migration.folderMillis) {
          for (const stmt of migration.sql) {
            await tx.run(sql.raw(stmt));
          }
          await tx.run(
            sql`INSERT INTO ${sql.identifier(migrationsTable)} ("hash", "created_at") VALUES(${migration.hash}, ${migration.folderMillis})`
          );
        }
      }
    });
  }
};
__name(SQLiteAsyncDialect, "SQLiteAsyncDialect");
_a71 = entityKind;
__publicField(SQLiteAsyncDialect, _a71, "SQLiteAsyncDialect");

// node_modules/drizzle-orm/query-builders/query-builder.js
var _a72;
var TypedQueryBuilder = class {
  /** @internal */
  getSelectedFields() {
    return this._.selectedFields;
  }
};
__name(TypedQueryBuilder, "TypedQueryBuilder");
_a72 = entityKind;
__publicField(TypedQueryBuilder, _a72, "TypedQueryBuilder");

// node_modules/drizzle-orm/sqlite-core/query-builders/select.js
var _a73;
var SQLiteSelectBuilder = class {
  fields;
  session;
  dialect;
  withList;
  distinct;
  constructor(config) {
    this.fields = config.fields;
    this.session = config.session;
    this.dialect = config.dialect;
    this.withList = config.withList;
    this.distinct = config.distinct;
  }
  from(source) {
    const isPartialSelect = !!this.fields;
    let fields;
    if (this.fields) {
      fields = this.fields;
    } else if (is(source, Subquery)) {
      fields = Object.fromEntries(
        Object.keys(source._.selectedFields).map((key) => [key, source[key]])
      );
    } else if (is(source, SQLiteViewBase)) {
      fields = source[ViewBaseConfig].selectedFields;
    } else if (is(source, SQL)) {
      fields = {};
    } else {
      fields = getTableColumns(source);
    }
    return new SQLiteSelectBase({
      table: source,
      fields,
      isPartialSelect,
      session: this.session,
      dialect: this.dialect,
      withList: this.withList,
      distinct: this.distinct
    });
  }
};
__name(SQLiteSelectBuilder, "SQLiteSelectBuilder");
_a73 = entityKind;
__publicField(SQLiteSelectBuilder, _a73, "SQLiteSelectBuilder");
var _a74;
var SQLiteSelectQueryBuilderBase = class extends TypedQueryBuilder {
  _;
  /** @internal */
  config;
  joinsNotNullableMap;
  tableName;
  isPartialSelect;
  session;
  dialect;
  constructor({ table, fields, isPartialSelect, session, dialect, withList, distinct }) {
    super();
    this.config = {
      withList,
      table,
      fields: { ...fields },
      distinct,
      setOperators: []
    };
    this.isPartialSelect = isPartialSelect;
    this.session = session;
    this.dialect = dialect;
    this._ = {
      selectedFields: fields
    };
    this.tableName = getTableLikeName(table);
    this.joinsNotNullableMap = typeof this.tableName === "string" ? { [this.tableName]: true } : {};
  }
  createJoin(joinType) {
    return (table, on) => {
      const baseTableName = this.tableName;
      const tableName = getTableLikeName(table);
      if (typeof tableName === "string" && this.config.joins?.some((join) => join.alias === tableName)) {
        throw new Error(`Alias "${tableName}" is already used in this query`);
      }
      if (!this.isPartialSelect) {
        if (Object.keys(this.joinsNotNullableMap).length === 1 && typeof baseTableName === "string") {
          this.config.fields = {
            [baseTableName]: this.config.fields
          };
        }
        if (typeof tableName === "string" && !is(table, SQL)) {
          const selection = is(table, Subquery) ? table._.selectedFields : is(table, View) ? table[ViewBaseConfig].selectedFields : table[Table.Symbol.Columns];
          this.config.fields[tableName] = selection;
        }
      }
      if (typeof on === "function") {
        on = on(
          new Proxy(
            this.config.fields,
            new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
          )
        );
      }
      if (!this.config.joins) {
        this.config.joins = [];
      }
      this.config.joins.push({ on, table, joinType, alias: tableName });
      if (typeof tableName === "string") {
        switch (joinType) {
          case "left": {
            this.joinsNotNullableMap[tableName] = false;
            break;
          }
          case "right": {
            this.joinsNotNullableMap = Object.fromEntries(
              Object.entries(this.joinsNotNullableMap).map(([key]) => [key, false])
            );
            this.joinsNotNullableMap[tableName] = true;
            break;
          }
          case "inner": {
            this.joinsNotNullableMap[tableName] = true;
            break;
          }
          case "full": {
            this.joinsNotNullableMap = Object.fromEntries(
              Object.entries(this.joinsNotNullableMap).map(([key]) => [key, false])
            );
            this.joinsNotNullableMap[tableName] = false;
            break;
          }
        }
      }
      return this;
    };
  }
  /**
   * Executes a `left join` operation by adding another table to the current query.
   *
   * Calling this method associates each row of the table with the corresponding row from the joined table, if a match is found. If no matching row exists, it sets all columns of the joined table to null.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#left-join}
   *
   * @param table the table to join.
   * @param on the `on` clause.
   *
   * @example
   *
   * ```ts
   * // Select all users and their pets
   * const usersWithPets: { user: User; pets: Pet | null }[] = await db.select()
   *   .from(users)
   *   .leftJoin(pets, eq(users.id, pets.ownerId))
   *
   * // Select userId and petId
   * const usersIdsAndPetIds: { userId: number; petId: number | null }[] = await db.select({
   *   userId: users.id,
   *   petId: pets.id,
   * })
   *   .from(users)
   *   .leftJoin(pets, eq(users.id, pets.ownerId))
   * ```
   */
  leftJoin = this.createJoin("left");
  /**
   * Executes a `right join` operation by adding another table to the current query.
   *
   * Calling this method associates each row of the joined table with the corresponding row from the main table, if a match is found. If no matching row exists, it sets all columns of the main table to null.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#right-join}
   *
   * @param table the table to join.
   * @param on the `on` clause.
   *
   * @example
   *
   * ```ts
   * // Select all users and their pets
   * const usersWithPets: { user: User | null; pets: Pet }[] = await db.select()
   *   .from(users)
   *   .rightJoin(pets, eq(users.id, pets.ownerId))
   *
   * // Select userId and petId
   * const usersIdsAndPetIds: { userId: number | null; petId: number }[] = await db.select({
   *   userId: users.id,
   *   petId: pets.id,
   * })
   *   .from(users)
   *   .rightJoin(pets, eq(users.id, pets.ownerId))
   * ```
   */
  rightJoin = this.createJoin("right");
  /**
   * Executes an `inner join` operation, creating a new table by combining rows from two tables that have matching values.
   *
   * Calling this method retrieves rows that have corresponding entries in both joined tables. Rows without matching entries in either table are excluded, resulting in a table that includes only matching pairs.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#inner-join}
   *
   * @param table the table to join.
   * @param on the `on` clause.
   *
   * @example
   *
   * ```ts
   * // Select all users and their pets
   * const usersWithPets: { user: User; pets: Pet }[] = await db.select()
   *   .from(users)
   *   .innerJoin(pets, eq(users.id, pets.ownerId))
   *
   * // Select userId and petId
   * const usersIdsAndPetIds: { userId: number; petId: number }[] = await db.select({
   *   userId: users.id,
   *   petId: pets.id,
   * })
   *   .from(users)
   *   .innerJoin(pets, eq(users.id, pets.ownerId))
   * ```
   */
  innerJoin = this.createJoin("inner");
  /**
   * Executes a `full join` operation by combining rows from two tables into a new table.
   *
   * Calling this method retrieves all rows from both main and joined tables, merging rows with matching values and filling in `null` for non-matching columns.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#full-join}
   *
   * @param table the table to join.
   * @param on the `on` clause.
   *
   * @example
   *
   * ```ts
   * // Select all users and their pets
   * const usersWithPets: { user: User | null; pets: Pet | null }[] = await db.select()
   *   .from(users)
   *   .fullJoin(pets, eq(users.id, pets.ownerId))
   *
   * // Select userId and petId
   * const usersIdsAndPetIds: { userId: number | null; petId: number | null }[] = await db.select({
   *   userId: users.id,
   *   petId: pets.id,
   * })
   *   .from(users)
   *   .fullJoin(pets, eq(users.id, pets.ownerId))
   * ```
   */
  fullJoin = this.createJoin("full");
  createSetOperator(type, isAll) {
    return (rightSelection) => {
      const rightSelect = typeof rightSelection === "function" ? rightSelection(getSQLiteSetOperators()) : rightSelection;
      if (!haveSameKeys(this.getSelectedFields(), rightSelect.getSelectedFields())) {
        throw new Error(
          "Set operator error (union / intersect / except): selected fields are not the same or are in a different order"
        );
      }
      this.config.setOperators.push({ type, isAll, rightSelect });
      return this;
    };
  }
  /**
   * Adds `union` set operator to the query.
   *
   * Calling this method will combine the result sets of the `select` statements and remove any duplicate rows that appear across them.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#union}
   *
   * @example
   *
   * ```ts
   * // Select all unique names from customers and users tables
   * await db.select({ name: users.name })
   *   .from(users)
   *   .union(
   *     db.select({ name: customers.name }).from(customers)
   *   );
   * // or
   * import { union } from 'drizzle-orm/sqlite-core'
   *
   * await union(
   *   db.select({ name: users.name }).from(users),
   *   db.select({ name: customers.name }).from(customers)
   * );
   * ```
   */
  union = this.createSetOperator("union", false);
  /**
   * Adds `union all` set operator to the query.
   *
   * Calling this method will combine the result-set of the `select` statements and keep all duplicate rows that appear across them.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#union-all}
   *
   * @example
   *
   * ```ts
   * // Select all transaction ids from both online and in-store sales
   * await db.select({ transaction: onlineSales.transactionId })
   *   .from(onlineSales)
   *   .unionAll(
   *     db.select({ transaction: inStoreSales.transactionId }).from(inStoreSales)
   *   );
   * // or
   * import { unionAll } from 'drizzle-orm/sqlite-core'
   *
   * await unionAll(
   *   db.select({ transaction: onlineSales.transactionId }).from(onlineSales),
   *   db.select({ transaction: inStoreSales.transactionId }).from(inStoreSales)
   * );
   * ```
   */
  unionAll = this.createSetOperator("union", true);
  /**
   * Adds `intersect` set operator to the query.
   *
   * Calling this method will retain only the rows that are present in both result sets and eliminate duplicates.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#intersect}
   *
   * @example
   *
   * ```ts
   * // Select course names that are offered in both departments A and B
   * await db.select({ courseName: depA.courseName })
   *   .from(depA)
   *   .intersect(
   *     db.select({ courseName: depB.courseName }).from(depB)
   *   );
   * // or
   * import { intersect } from 'drizzle-orm/sqlite-core'
   *
   * await intersect(
   *   db.select({ courseName: depA.courseName }).from(depA),
   *   db.select({ courseName: depB.courseName }).from(depB)
   * );
   * ```
   */
  intersect = this.createSetOperator("intersect", false);
  /**
   * Adds `except` set operator to the query.
   *
   * Calling this method will retrieve all unique rows from the left query, except for the rows that are present in the result set of the right query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#except}
   *
   * @example
   *
   * ```ts
   * // Select all courses offered in department A but not in department B
   * await db.select({ courseName: depA.courseName })
   *   .from(depA)
   *   .except(
   *     db.select({ courseName: depB.courseName }).from(depB)
   *   );
   * // or
   * import { except } from 'drizzle-orm/sqlite-core'
   *
   * await except(
   *   db.select({ courseName: depA.courseName }).from(depA),
   *   db.select({ courseName: depB.courseName }).from(depB)
   * );
   * ```
   */
  except = this.createSetOperator("except", false);
  /** @internal */
  addSetOperators(setOperators) {
    this.config.setOperators.push(...setOperators);
    return this;
  }
  /**
   * Adds a `where` clause to the query.
   *
   * Calling this method will select only those rows that fulfill a specified condition.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#filtering}
   *
   * @param where the `where` clause.
   *
   * @example
   * You can use conditional operators and `sql function` to filter the rows to be selected.
   *
   * ```ts
   * // Select all cars with green color
   * await db.select().from(cars).where(eq(cars.color, 'green'));
   * // or
   * await db.select().from(cars).where(sql`${cars.color} = 'green'`)
   * ```
   *
   * You can logically combine conditional operators with `and()` and `or()` operators:
   *
   * ```ts
   * // Select all BMW cars with a green color
   * await db.select().from(cars).where(and(eq(cars.color, 'green'), eq(cars.brand, 'BMW')));
   *
   * // Select all cars with the green or blue color
   * await db.select().from(cars).where(or(eq(cars.color, 'green'), eq(cars.color, 'blue')));
   * ```
   */
  where(where) {
    if (typeof where === "function") {
      where = where(
        new Proxy(
          this.config.fields,
          new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
        )
      );
    }
    this.config.where = where;
    return this;
  }
  /**
   * Adds a `having` clause to the query.
   *
   * Calling this method will select only those rows that fulfill a specified condition. It is typically used with aggregate functions to filter the aggregated data based on a specified condition.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#aggregations}
   *
   * @param having the `having` clause.
   *
   * @example
   *
   * ```ts
   * // Select all brands with more than one car
   * await db.select({
   * 	brand: cars.brand,
   * 	count: sql<number>`cast(count(${cars.id}) as int)`,
   * })
   *   .from(cars)
   *   .groupBy(cars.brand)
   *   .having(({ count }) => gt(count, 1));
   * ```
   */
  having(having) {
    if (typeof having === "function") {
      having = having(
        new Proxy(
          this.config.fields,
          new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
        )
      );
    }
    this.config.having = having;
    return this;
  }
  groupBy(...columns) {
    if (typeof columns[0] === "function") {
      const groupBy = columns[0](
        new Proxy(
          this.config.fields,
          new SelectionProxyHandler({ sqlAliasedBehavior: "alias", sqlBehavior: "sql" })
        )
      );
      this.config.groupBy = Array.isArray(groupBy) ? groupBy : [groupBy];
    } else {
      this.config.groupBy = columns;
    }
    return this;
  }
  orderBy(...columns) {
    if (typeof columns[0] === "function") {
      const orderBy = columns[0](
        new Proxy(
          this.config.fields,
          new SelectionProxyHandler({ sqlAliasedBehavior: "alias", sqlBehavior: "sql" })
        )
      );
      const orderByArray = Array.isArray(orderBy) ? orderBy : [orderBy];
      if (this.config.setOperators.length > 0) {
        this.config.setOperators.at(-1).orderBy = orderByArray;
      } else {
        this.config.orderBy = orderByArray;
      }
    } else {
      const orderByArray = columns;
      if (this.config.setOperators.length > 0) {
        this.config.setOperators.at(-1).orderBy = orderByArray;
      } else {
        this.config.orderBy = orderByArray;
      }
    }
    return this;
  }
  /**
   * Adds a `limit` clause to the query.
   *
   * Calling this method will set the maximum number of rows that will be returned by this query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#limit--offset}
   *
   * @param limit the `limit` clause.
   *
   * @example
   *
   * ```ts
   * // Get the first 10 people from this query.
   * await db.select().from(people).limit(10);
   * ```
   */
  limit(limit) {
    if (this.config.setOperators.length > 0) {
      this.config.setOperators.at(-1).limit = limit;
    } else {
      this.config.limit = limit;
    }
    return this;
  }
  /**
   * Adds an `offset` clause to the query.
   *
   * Calling this method will skip a number of rows when returning results from this query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#limit--offset}
   *
   * @param offset the `offset` clause.
   *
   * @example
   *
   * ```ts
   * // Get the 10th-20th people from this query.
   * await db.select().from(people).offset(10).limit(10);
   * ```
   */
  offset(offset) {
    if (this.config.setOperators.length > 0) {
      this.config.setOperators.at(-1).offset = offset;
    } else {
      this.config.offset = offset;
    }
    return this;
  }
  /** @internal */
  getSQL() {
    return this.dialect.buildSelectQuery(this.config);
  }
  toSQL() {
    const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
    return rest;
  }
  as(alias) {
    return new Proxy(
      new Subquery(this.getSQL(), this.config.fields, alias),
      new SelectionProxyHandler({ alias, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
    );
  }
  /** @internal */
  getSelectedFields() {
    return new Proxy(
      this.config.fields,
      new SelectionProxyHandler({ alias: this.tableName, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
    );
  }
  $dynamic() {
    return this;
  }
};
__name(SQLiteSelectQueryBuilderBase, "SQLiteSelectQueryBuilderBase");
_a74 = entityKind;
__publicField(SQLiteSelectQueryBuilderBase, _a74, "SQLiteSelectQueryBuilder");
var _a75;
var SQLiteSelectBase = class extends SQLiteSelectQueryBuilderBase {
  /** @internal */
  _prepare(isOneTimeQuery = true) {
    if (!this.session) {
      throw new Error("Cannot execute a query on a query builder. Please use a database instance instead.");
    }
    const fieldsList = orderSelectedFields(this.config.fields);
    const query = this.session[isOneTimeQuery ? "prepareOneTimeQuery" : "prepareQuery"](
      this.dialect.sqlToQuery(this.getSQL()),
      fieldsList,
      "all",
      true
    );
    query.joinsNotNullableMap = this.joinsNotNullableMap;
    return query;
  }
  prepare() {
    return this._prepare(false);
  }
  run = (placeholderValues) => {
    return this._prepare().run(placeholderValues);
  };
  all = (placeholderValues) => {
    return this._prepare().all(placeholderValues);
  };
  get = (placeholderValues) => {
    return this._prepare().get(placeholderValues);
  };
  values = (placeholderValues) => {
    return this._prepare().values(placeholderValues);
  };
  async execute() {
    return this.all();
  }
};
__name(SQLiteSelectBase, "SQLiteSelectBase");
_a75 = entityKind;
__publicField(SQLiteSelectBase, _a75, "SQLiteSelect");
applyMixins(SQLiteSelectBase, [QueryPromise]);
function createSetOperator(type, isAll) {
  return (leftSelect, rightSelect, ...restSelects) => {
    const setOperators = [rightSelect, ...restSelects].map((select) => ({
      type,
      isAll,
      rightSelect: select
    }));
    for (const setOperator of setOperators) {
      if (!haveSameKeys(leftSelect.getSelectedFields(), setOperator.rightSelect.getSelectedFields())) {
        throw new Error(
          "Set operator error (union / intersect / except): selected fields are not the same or are in a different order"
        );
      }
    }
    return leftSelect.addSetOperators(setOperators);
  };
}
__name(createSetOperator, "createSetOperator");
var getSQLiteSetOperators = /* @__PURE__ */ __name(() => ({
  union,
  unionAll,
  intersect,
  except
}), "getSQLiteSetOperators");
var union = createSetOperator("union", false);
var unionAll = createSetOperator("union", true);
var intersect = createSetOperator("intersect", false);
var except = createSetOperator("except", false);

// node_modules/drizzle-orm/sqlite-core/query-builders/query-builder.js
var _a76;
var QueryBuilder = class {
  dialect;
  $with(alias) {
    const queryBuilder = this;
    return {
      as(qb) {
        if (typeof qb === "function") {
          qb = qb(queryBuilder);
        }
        return new Proxy(
          new WithSubquery(qb.getSQL(), qb.getSelectedFields(), alias, true),
          new SelectionProxyHandler({ alias, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
        );
      }
    };
  }
  with(...queries) {
    const self = this;
    function select(fields) {
      return new SQLiteSelectBuilder({
        fields: fields ?? void 0,
        session: void 0,
        dialect: self.getDialect(),
        withList: queries
      });
    }
    __name(select, "select");
    function selectDistinct(fields) {
      return new SQLiteSelectBuilder({
        fields: fields ?? void 0,
        session: void 0,
        dialect: self.getDialect(),
        withList: queries,
        distinct: true
      });
    }
    __name(selectDistinct, "selectDistinct");
    return { select, selectDistinct };
  }
  select(fields) {
    return new SQLiteSelectBuilder({ fields: fields ?? void 0, session: void 0, dialect: this.getDialect() });
  }
  selectDistinct(fields) {
    return new SQLiteSelectBuilder({
      fields: fields ?? void 0,
      session: void 0,
      dialect: this.getDialect(),
      distinct: true
    });
  }
  // Lazy load dialect to avoid circular dependency
  getDialect() {
    if (!this.dialect) {
      this.dialect = new SQLiteSyncDialect();
    }
    return this.dialect;
  }
};
__name(QueryBuilder, "QueryBuilder");
_a76 = entityKind;
__publicField(QueryBuilder, _a76, "SQLiteQueryBuilder");

// node_modules/drizzle-orm/sqlite-core/query-builders/update.js
var _a77;
var SQLiteUpdateBuilder = class {
  constructor(table, session, dialect, withList) {
    this.table = table;
    this.session = session;
    this.dialect = dialect;
    this.withList = withList;
  }
  set(values) {
    return new SQLiteUpdateBase(
      this.table,
      mapUpdateSet(this.table, values),
      this.session,
      this.dialect,
      this.withList
    );
  }
};
__name(SQLiteUpdateBuilder, "SQLiteUpdateBuilder");
_a77 = entityKind;
__publicField(SQLiteUpdateBuilder, _a77, "SQLiteUpdateBuilder");
var _a78;
var SQLiteUpdateBase = class extends QueryPromise {
  constructor(table, set, session, dialect, withList) {
    super();
    this.session = session;
    this.dialect = dialect;
    this.config = { set, table, withList };
  }
  /** @internal */
  config;
  /**
   * Adds a 'where' clause to the query.
   *
   * Calling this method will update only those rows that fulfill a specified condition.
   *
   * See docs: {@link https://orm.drizzle.team/docs/update}
   *
   * @param where the 'where' clause.
   *
   * @example
   * You can use conditional operators and `sql function` to filter the rows to be updated.
   *
   * ```ts
   * // Update all cars with green color
   * db.update(cars).set({ color: 'red' })
   *   .where(eq(cars.color, 'green'));
   * // or
   * db.update(cars).set({ color: 'red' })
   *   .where(sql`${cars.color} = 'green'`)
   * ```
   *
   * You can logically combine conditional operators with `and()` and `or()` operators:
   *
   * ```ts
   * // Update all BMW cars with a green color
   * db.update(cars).set({ color: 'red' })
   *   .where(and(eq(cars.color, 'green'), eq(cars.brand, 'BMW')));
   *
   * // Update all cars with the green or blue color
   * db.update(cars).set({ color: 'red' })
   *   .where(or(eq(cars.color, 'green'), eq(cars.color, 'blue')));
   * ```
   */
  where(where) {
    this.config.where = where;
    return this;
  }
  returning(fields = this.config.table[SQLiteTable.Symbol.Columns]) {
    this.config.returning = orderSelectedFields(fields);
    return this;
  }
  /** @internal */
  getSQL() {
    return this.dialect.buildUpdateQuery(this.config);
  }
  toSQL() {
    const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
    return rest;
  }
  /** @internal */
  _prepare(isOneTimeQuery = true) {
    return this.session[isOneTimeQuery ? "prepareOneTimeQuery" : "prepareQuery"](
      this.dialect.sqlToQuery(this.getSQL()),
      this.config.returning,
      this.config.returning ? "all" : "run",
      true
    );
  }
  prepare() {
    return this._prepare(false);
  }
  run = (placeholderValues) => {
    return this._prepare().run(placeholderValues);
  };
  all = (placeholderValues) => {
    return this._prepare().all(placeholderValues);
  };
  get = (placeholderValues) => {
    return this._prepare().get(placeholderValues);
  };
  values = (placeholderValues) => {
    return this._prepare().values(placeholderValues);
  };
  async execute() {
    return this.config.returning ? this.all() : this.run();
  }
  $dynamic() {
    return this;
  }
};
__name(SQLiteUpdateBase, "SQLiteUpdateBase");
_a78 = entityKind;
__publicField(SQLiteUpdateBase, _a78, "SQLiteUpdate");

// node_modules/drizzle-orm/sqlite-core/query-builders/query.js
var _a79;
var RelationalQueryBuilder = class {
  constructor(mode, fullSchema, schema, tableNamesMap, table, tableConfig, dialect, session) {
    this.mode = mode;
    this.fullSchema = fullSchema;
    this.schema = schema;
    this.tableNamesMap = tableNamesMap;
    this.table = table;
    this.tableConfig = tableConfig;
    this.dialect = dialect;
    this.session = session;
  }
  findMany(config) {
    return this.mode === "sync" ? new SQLiteSyncRelationalQuery(
      this.fullSchema,
      this.schema,
      this.tableNamesMap,
      this.table,
      this.tableConfig,
      this.dialect,
      this.session,
      config ? config : {},
      "many"
    ) : new SQLiteRelationalQuery(
      this.fullSchema,
      this.schema,
      this.tableNamesMap,
      this.table,
      this.tableConfig,
      this.dialect,
      this.session,
      config ? config : {},
      "many"
    );
  }
  findFirst(config) {
    return this.mode === "sync" ? new SQLiteSyncRelationalQuery(
      this.fullSchema,
      this.schema,
      this.tableNamesMap,
      this.table,
      this.tableConfig,
      this.dialect,
      this.session,
      config ? { ...config, limit: 1 } : { limit: 1 },
      "first"
    ) : new SQLiteRelationalQuery(
      this.fullSchema,
      this.schema,
      this.tableNamesMap,
      this.table,
      this.tableConfig,
      this.dialect,
      this.session,
      config ? { ...config, limit: 1 } : { limit: 1 },
      "first"
    );
  }
};
__name(RelationalQueryBuilder, "RelationalQueryBuilder");
_a79 = entityKind;
__publicField(RelationalQueryBuilder, _a79, "SQLiteAsyncRelationalQueryBuilder");
var _a80;
var SQLiteRelationalQuery = class extends QueryPromise {
  constructor(fullSchema, schema, tableNamesMap, table, tableConfig, dialect, session, config, mode) {
    super();
    this.fullSchema = fullSchema;
    this.schema = schema;
    this.tableNamesMap = tableNamesMap;
    this.table = table;
    this.tableConfig = tableConfig;
    this.dialect = dialect;
    this.session = session;
    this.config = config;
    this.mode = mode;
  }
  /** @internal */
  mode;
  /** @internal */
  getSQL() {
    return this.dialect.buildRelationalQuery({
      fullSchema: this.fullSchema,
      schema: this.schema,
      tableNamesMap: this.tableNamesMap,
      table: this.table,
      tableConfig: this.tableConfig,
      queryConfig: this.config,
      tableAlias: this.tableConfig.tsName
    }).sql;
  }
  /** @internal */
  _prepare(isOneTimeQuery = false) {
    const { query, builtQuery } = this._toSQL();
    return this.session[isOneTimeQuery ? "prepareOneTimeQuery" : "prepareQuery"](
      builtQuery,
      void 0,
      this.mode === "first" ? "get" : "all",
      true,
      (rawRows, mapColumnValue) => {
        const rows = rawRows.map(
          (row) => mapRelationalRow(this.schema, this.tableConfig, row, query.selection, mapColumnValue)
        );
        if (this.mode === "first") {
          return rows[0];
        }
        return rows;
      }
    );
  }
  prepare() {
    return this._prepare(false);
  }
  _toSQL() {
    const query = this.dialect.buildRelationalQuery({
      fullSchema: this.fullSchema,
      schema: this.schema,
      tableNamesMap: this.tableNamesMap,
      table: this.table,
      tableConfig: this.tableConfig,
      queryConfig: this.config,
      tableAlias: this.tableConfig.tsName
    });
    const builtQuery = this.dialect.sqlToQuery(query.sql);
    return { query, builtQuery };
  }
  toSQL() {
    return this._toSQL().builtQuery;
  }
  /** @internal */
  executeRaw() {
    if (this.mode === "first") {
      return this._prepare(false).get();
    }
    return this._prepare(false).all();
  }
  async execute() {
    return this.executeRaw();
  }
};
__name(SQLiteRelationalQuery, "SQLiteRelationalQuery");
_a80 = entityKind;
__publicField(SQLiteRelationalQuery, _a80, "SQLiteAsyncRelationalQuery");
var _a81;
var SQLiteSyncRelationalQuery = class extends SQLiteRelationalQuery {
  sync() {
    return this.executeRaw();
  }
};
__name(SQLiteSyncRelationalQuery, "SQLiteSyncRelationalQuery");
_a81 = entityKind;
__publicField(SQLiteSyncRelationalQuery, _a81, "SQLiteSyncRelationalQuery");

// node_modules/drizzle-orm/sqlite-core/query-builders/raw.js
var _a82;
var SQLiteRaw = class extends QueryPromise {
  constructor(execute, getSQL, action, dialect, mapBatchResult) {
    super();
    this.execute = execute;
    this.getSQL = getSQL;
    this.dialect = dialect;
    this.mapBatchResult = mapBatchResult;
    this.config = { action };
  }
  /** @internal */
  config;
  getQuery() {
    return { ...this.dialect.sqlToQuery(this.getSQL()), method: this.config.action };
  }
  mapResult(result, isFromBatch) {
    return isFromBatch ? this.mapBatchResult(result) : result;
  }
  _prepare() {
    return this;
  }
  /** @internal */
  isResponseInArrayMode() {
    return false;
  }
};
__name(SQLiteRaw, "SQLiteRaw");
_a82 = entityKind;
__publicField(SQLiteRaw, _a82, "SQLiteRaw");

// node_modules/drizzle-orm/sqlite-core/db.js
var _a83;
var BaseSQLiteDatabase = class {
  constructor(resultKind, dialect, session, schema) {
    this.resultKind = resultKind;
    this.dialect = dialect;
    this.session = session;
    this._ = schema ? {
      schema: schema.schema,
      fullSchema: schema.fullSchema,
      tableNamesMap: schema.tableNamesMap
    } : {
      schema: void 0,
      fullSchema: {},
      tableNamesMap: {}
    };
    this.query = {};
    const query = this.query;
    if (this._.schema) {
      for (const [tableName, columns] of Object.entries(this._.schema)) {
        query[tableName] = new RelationalQueryBuilder(
          resultKind,
          schema.fullSchema,
          this._.schema,
          this._.tableNamesMap,
          schema.fullSchema[tableName],
          columns,
          dialect,
          session
        );
      }
    }
  }
  query;
  /**
   * Creates a subquery that defines a temporary named result set as a CTE.
   *
   * It is useful for breaking down complex queries into simpler parts and for reusing the result set in subsequent parts of the query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#with-clause}
   *
   * @param alias The alias for the subquery.
   *
   * Failure to provide an alias will result in a DrizzleTypeError, preventing the subquery from being referenced in other queries.
   *
   * @example
   *
   * ```ts
   * // Create a subquery with alias 'sq' and use it in the select query
   * const sq = db.$with('sq').as(db.select().from(users).where(eq(users.id, 42)));
   *
   * const result = await db.with(sq).select().from(sq);
   * ```
   *
   * To select arbitrary SQL values as fields in a CTE and reference them in other CTEs or in the main query, you need to add aliases to them:
   *
   * ```ts
   * // Select an arbitrary SQL value as a field in a CTE and reference it in the main query
   * const sq = db.$with('sq').as(db.select({
   *   name: sql<string>`upper(${users.name})`.as('name'),
   * })
   * .from(users));
   *
   * const result = await db.with(sq).select({ name: sq.name }).from(sq);
   * ```
   */
  $with(alias) {
    return {
      as(qb) {
        if (typeof qb === "function") {
          qb = qb(new QueryBuilder());
        }
        return new Proxy(
          new WithSubquery(qb.getSQL(), qb.getSelectedFields(), alias, true),
          new SelectionProxyHandler({ alias, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
        );
      }
    };
  }
  /**
   * Incorporates a previously defined CTE (using `$with`) into the main query.
   *
   * This method allows the main query to reference a temporary named result set.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#with-clause}
   *
   * @param queries The CTEs to incorporate into the main query.
   *
   * @example
   *
   * ```ts
   * // Define a subquery 'sq' as a CTE using $with
   * const sq = db.$with('sq').as(db.select().from(users).where(eq(users.id, 42)));
   *
   * // Incorporate the CTE 'sq' into the main query and select from it
   * const result = await db.with(sq).select().from(sq);
   * ```
   */
  with(...queries) {
    const self = this;
    function select(fields) {
      return new SQLiteSelectBuilder({
        fields: fields ?? void 0,
        session: self.session,
        dialect: self.dialect,
        withList: queries
      });
    }
    __name(select, "select");
    function selectDistinct(fields) {
      return new SQLiteSelectBuilder({
        fields: fields ?? void 0,
        session: self.session,
        dialect: self.dialect,
        withList: queries,
        distinct: true
      });
    }
    __name(selectDistinct, "selectDistinct");
    function update(table) {
      return new SQLiteUpdateBuilder(table, self.session, self.dialect, queries);
    }
    __name(update, "update");
    function insert(into) {
      return new SQLiteInsertBuilder(into, self.session, self.dialect, queries);
    }
    __name(insert, "insert");
    function delete_(from) {
      return new SQLiteDeleteBase(from, self.session, self.dialect, queries);
    }
    __name(delete_, "delete_");
    return { select, selectDistinct, update, insert, delete: delete_ };
  }
  select(fields) {
    return new SQLiteSelectBuilder({ fields: fields ?? void 0, session: this.session, dialect: this.dialect });
  }
  selectDistinct(fields) {
    return new SQLiteSelectBuilder({
      fields: fields ?? void 0,
      session: this.session,
      dialect: this.dialect,
      distinct: true
    });
  }
  /**
   * Creates an update query.
   *
   * Calling this method without `.where()` clause will update all rows in a table. The `.where()` clause specifies which rows should be updated.
   *
   * Use `.set()` method to specify which values to update.
   *
   * See docs: {@link https://orm.drizzle.team/docs/update}
   *
   * @param table The table to update.
   *
   * @example
   *
   * ```ts
   * // Update all rows in the 'cars' table
   * await db.update(cars).set({ color: 'red' });
   *
   * // Update rows with filters and conditions
   * await db.update(cars).set({ color: 'red' }).where(eq(cars.brand, 'BMW'));
   *
   * // Update with returning clause
   * const updatedCar: Car[] = await db.update(cars)
   *   .set({ color: 'red' })
   *   .where(eq(cars.id, 1))
   *   .returning();
   * ```
   */
  update(table) {
    return new SQLiteUpdateBuilder(table, this.session, this.dialect);
  }
  /**
   * Creates an insert query.
   *
   * Calling this method will create new rows in a table. Use `.values()` method to specify which values to insert.
   *
   * See docs: {@link https://orm.drizzle.team/docs/insert}
   *
   * @param table The table to insert into.
   *
   * @example
   *
   * ```ts
   * // Insert one row
   * await db.insert(cars).values({ brand: 'BMW' });
   *
   * // Insert multiple rows
   * await db.insert(cars).values([{ brand: 'BMW' }, { brand: 'Porsche' }]);
   *
   * // Insert with returning clause
   * const insertedCar: Car[] = await db.insert(cars)
   *   .values({ brand: 'BMW' })
   *   .returning();
   * ```
   */
  insert(into) {
    return new SQLiteInsertBuilder(into, this.session, this.dialect);
  }
  /**
   * Creates a delete query.
   *
   * Calling this method without `.where()` clause will delete all rows in a table. The `.where()` clause specifies which rows should be deleted.
   *
   * See docs: {@link https://orm.drizzle.team/docs/delete}
   *
   * @param table The table to delete from.
   *
   * @example
   *
   * ```ts
   * // Delete all rows in the 'cars' table
   * await db.delete(cars);
   *
   * // Delete rows with filters and conditions
   * await db.delete(cars).where(eq(cars.color, 'green'));
   *
   * // Delete with returning clause
   * const deletedCar: Car[] = await db.delete(cars)
   *   .where(eq(cars.id, 1))
   *   .returning();
   * ```
   */
  delete(from) {
    return new SQLiteDeleteBase(from, this.session, this.dialect);
  }
  run(query) {
    const sql2 = query.getSQL();
    if (this.resultKind === "async") {
      return new SQLiteRaw(
        async () => this.session.run(sql2),
        () => sql2,
        "run",
        this.dialect,
        this.session.extractRawRunValueFromBatchResult.bind(this.session)
      );
    }
    return this.session.run(sql2);
  }
  all(query) {
    const sql2 = query.getSQL();
    if (this.resultKind === "async") {
      return new SQLiteRaw(
        async () => this.session.all(sql2),
        () => sql2,
        "all",
        this.dialect,
        this.session.extractRawAllValueFromBatchResult.bind(this.session)
      );
    }
    return this.session.all(sql2);
  }
  get(query) {
    const sql2 = query.getSQL();
    if (this.resultKind === "async") {
      return new SQLiteRaw(
        async () => this.session.get(sql2),
        () => sql2,
        "get",
        this.dialect,
        this.session.extractRawGetValueFromBatchResult.bind(this.session)
      );
    }
    return this.session.get(sql2);
  }
  values(query) {
    const sql2 = query.getSQL();
    if (this.resultKind === "async") {
      return new SQLiteRaw(
        async () => this.session.values(sql2),
        () => sql2,
        "values",
        this.dialect,
        this.session.extractRawValuesValueFromBatchResult.bind(this.session)
      );
    }
    return this.session.values(sql2);
  }
  transaction(transaction, config) {
    return this.session.transaction(transaction, config);
  }
};
__name(BaseSQLiteDatabase, "BaseSQLiteDatabase");
_a83 = entityKind;
__publicField(BaseSQLiteDatabase, _a83, "BaseSQLiteDatabase");

// node_modules/drizzle-orm/sqlite-core/indexes.js
var _a84;
var IndexBuilderOn = class {
  constructor(name, unique) {
    this.name = name;
    this.unique = unique;
  }
  on(...columns) {
    return new IndexBuilder(this.name, columns, this.unique);
  }
};
__name(IndexBuilderOn, "IndexBuilderOn");
_a84 = entityKind;
__publicField(IndexBuilderOn, _a84, "SQLiteIndexBuilderOn");
var _a85;
var IndexBuilder = class {
  /** @internal */
  config;
  constructor(name, columns, unique) {
    this.config = {
      name,
      columns,
      unique,
      where: void 0
    };
  }
  /**
   * Condition for partial index.
   */
  where(condition) {
    this.config.where = condition;
    return this;
  }
  /** @internal */
  build(table) {
    return new Index(this.config, table);
  }
};
__name(IndexBuilder, "IndexBuilder");
_a85 = entityKind;
__publicField(IndexBuilder, _a85, "SQLiteIndexBuilder");
var _a86;
var Index = class {
  config;
  constructor(config, table) {
    this.config = { ...config, table };
  }
};
__name(Index, "Index");
_a86 = entityKind;
__publicField(Index, _a86, "SQLiteIndex");
function uniqueIndex(name) {
  return new IndexBuilderOn(name, true);
}
__name(uniqueIndex, "uniqueIndex");

// node_modules/drizzle-orm/sqlite-core/session.js
var _a87;
var ExecuteResultSync = class extends QueryPromise {
  constructor(resultCb) {
    super();
    this.resultCb = resultCb;
  }
  async execute() {
    return this.resultCb();
  }
  sync() {
    return this.resultCb();
  }
};
__name(ExecuteResultSync, "ExecuteResultSync");
_a87 = entityKind;
__publicField(ExecuteResultSync, _a87, "ExecuteResultSync");
var _a88;
var SQLitePreparedQuery = class {
  constructor(mode, executeMethod, query) {
    this.mode = mode;
    this.executeMethod = executeMethod;
    this.query = query;
  }
  /** @internal */
  joinsNotNullableMap;
  getQuery() {
    return this.query;
  }
  mapRunResult(result, _isFromBatch) {
    return result;
  }
  mapAllResult(_result, _isFromBatch) {
    throw new Error("Not implemented");
  }
  mapGetResult(_result, _isFromBatch) {
    throw new Error("Not implemented");
  }
  execute(placeholderValues) {
    if (this.mode === "async") {
      return this[this.executeMethod](placeholderValues);
    }
    return new ExecuteResultSync(() => this[this.executeMethod](placeholderValues));
  }
  mapResult(response, isFromBatch) {
    switch (this.executeMethod) {
      case "run": {
        return this.mapRunResult(response, isFromBatch);
      }
      case "all": {
        return this.mapAllResult(response, isFromBatch);
      }
      case "get": {
        return this.mapGetResult(response, isFromBatch);
      }
    }
  }
};
__name(SQLitePreparedQuery, "SQLitePreparedQuery");
_a88 = entityKind;
__publicField(SQLitePreparedQuery, _a88, "PreparedQuery");
var _a89;
var SQLiteSession = class {
  constructor(dialect) {
    this.dialect = dialect;
  }
  prepareOneTimeQuery(query, fields, executeMethod, isResponseInArrayMode) {
    return this.prepareQuery(query, fields, executeMethod, isResponseInArrayMode);
  }
  run(query) {
    const staticQuery = this.dialect.sqlToQuery(query);
    try {
      return this.prepareOneTimeQuery(staticQuery, void 0, "run", false).run();
    } catch (err) {
      throw new DrizzleError({ cause: err, message: `Failed to run the query '${staticQuery.sql}'` });
    }
  }
  /** @internal */
  extractRawRunValueFromBatchResult(result) {
    return result;
  }
  all(query) {
    return this.prepareOneTimeQuery(this.dialect.sqlToQuery(query), void 0, "run", false).all();
  }
  /** @internal */
  extractRawAllValueFromBatchResult(_result) {
    throw new Error("Not implemented");
  }
  get(query) {
    return this.prepareOneTimeQuery(this.dialect.sqlToQuery(query), void 0, "run", false).get();
  }
  /** @internal */
  extractRawGetValueFromBatchResult(_result) {
    throw new Error("Not implemented");
  }
  values(query) {
    return this.prepareOneTimeQuery(this.dialect.sqlToQuery(query), void 0, "run", false).values();
  }
  /** @internal */
  extractRawValuesValueFromBatchResult(_result) {
    throw new Error("Not implemented");
  }
};
__name(SQLiteSession, "SQLiteSession");
_a89 = entityKind;
__publicField(SQLiteSession, _a89, "SQLiteSession");
var _a90;
var SQLiteTransaction = class extends BaseSQLiteDatabase {
  constructor(resultType, dialect, session, schema, nestedIndex = 0) {
    super(resultType, dialect, session, schema);
    this.schema = schema;
    this.nestedIndex = nestedIndex;
  }
  rollback() {
    throw new TransactionRollbackError();
  }
};
__name(SQLiteTransaction, "SQLiteTransaction");
_a90 = entityKind;
__publicField(SQLiteTransaction, _a90, "SQLiteTransaction");

// node_modules/drizzle-orm/d1/session.js
var _a91;
var SQLiteD1Session = class extends SQLiteSession {
  constructor(client, dialect, schema, options = {}) {
    super(dialect);
    this.client = client;
    this.schema = schema;
    this.options = options;
    this.logger = options.logger ?? new NoopLogger();
  }
  logger;
  prepareQuery(query, fields, executeMethod, isResponseInArrayMode, customResultMapper) {
    const stmt = this.client.prepare(query.sql);
    return new D1PreparedQuery(
      stmt,
      query,
      this.logger,
      fields,
      executeMethod,
      isResponseInArrayMode,
      customResultMapper
    );
  }
  async batch(queries) {
    const preparedQueries = [];
    const builtQueries = [];
    for (const query of queries) {
      const preparedQuery = query._prepare();
      const builtQuery = preparedQuery.getQuery();
      preparedQueries.push(preparedQuery);
      if (builtQuery.params.length > 0) {
        builtQueries.push(preparedQuery.stmt.bind(...builtQuery.params));
      } else {
        const builtQuery2 = preparedQuery.getQuery();
        builtQueries.push(
          this.client.prepare(builtQuery2.sql).bind(...builtQuery2.params)
        );
      }
    }
    const batchResults = await this.client.batch(builtQueries);
    return batchResults.map((result, i) => preparedQueries[i].mapResult(result, true));
  }
  extractRawAllValueFromBatchResult(result) {
    return result.results;
  }
  extractRawGetValueFromBatchResult(result) {
    return result.results[0];
  }
  extractRawValuesValueFromBatchResult(result) {
    return d1ToRawMapping(result.results);
  }
  async transaction(transaction, config) {
    const tx = new D1Transaction("async", this.dialect, this, this.schema);
    await this.run(sql.raw(`begin${config?.behavior ? " " + config.behavior : ""}`));
    try {
      const result = await transaction(tx);
      await this.run(sql`commit`);
      return result;
    } catch (err) {
      await this.run(sql`rollback`);
      throw err;
    }
  }
};
__name(SQLiteD1Session, "SQLiteD1Session");
_a91 = entityKind;
__publicField(SQLiteD1Session, _a91, "SQLiteD1Session");
var _a92;
var _D1Transaction = class extends SQLiteTransaction {
  async transaction(transaction) {
    const savepointName = `sp${this.nestedIndex}`;
    const tx = new _D1Transaction("async", this.dialect, this.session, this.schema, this.nestedIndex + 1);
    await this.session.run(sql.raw(`savepoint ${savepointName}`));
    try {
      const result = await transaction(tx);
      await this.session.run(sql.raw(`release savepoint ${savepointName}`));
      return result;
    } catch (err) {
      await this.session.run(sql.raw(`rollback to savepoint ${savepointName}`));
      throw err;
    }
  }
};
var D1Transaction = _D1Transaction;
__name(D1Transaction, "D1Transaction");
_a92 = entityKind;
__publicField(D1Transaction, _a92, "D1Transaction");
function d1ToRawMapping(results) {
  const rows = [];
  for (const row of results) {
    const entry = Object.keys(row).map((k) => row[k]);
    rows.push(entry);
  }
  return rows;
}
__name(d1ToRawMapping, "d1ToRawMapping");
var _a93;
var D1PreparedQuery = class extends SQLitePreparedQuery {
  constructor(stmt, query, logger2, fields, executeMethod, _isResponseInArrayMode, customResultMapper) {
    super("async", executeMethod, query);
    this.logger = logger2;
    this._isResponseInArrayMode = _isResponseInArrayMode;
    this.customResultMapper = customResultMapper;
    this.fields = fields;
    this.stmt = stmt;
  }
  /** @internal */
  customResultMapper;
  /** @internal */
  fields;
  /** @internal */
  stmt;
  run(placeholderValues) {
    const params = fillPlaceholders(this.query.params, placeholderValues ?? {});
    this.logger.logQuery(this.query.sql, params);
    return this.stmt.bind(...params).run();
  }
  async all(placeholderValues) {
    const { fields, query, logger: logger2, stmt, customResultMapper } = this;
    if (!fields && !customResultMapper) {
      const params = fillPlaceholders(query.params, placeholderValues ?? {});
      logger2.logQuery(query.sql, params);
      return stmt.bind(...params).all().then(({ results }) => this.mapAllResult(results));
    }
    const rows = await this.values(placeholderValues);
    return this.mapAllResult(rows);
  }
  mapAllResult(rows, isFromBatch) {
    if (isFromBatch) {
      rows = d1ToRawMapping(rows.results);
    }
    if (!this.fields && !this.customResultMapper) {
      return rows;
    }
    if (this.customResultMapper) {
      return this.customResultMapper(rows);
    }
    return rows.map((row) => mapResultRow(this.fields, row, this.joinsNotNullableMap));
  }
  async get(placeholderValues) {
    const { fields, joinsNotNullableMap, query, logger: logger2, stmt, customResultMapper } = this;
    if (!fields && !customResultMapper) {
      const params = fillPlaceholders(query.params, placeholderValues ?? {});
      logger2.logQuery(query.sql, params);
      return stmt.bind(...params).all().then(({ results }) => results[0]);
    }
    const rows = await this.values(placeholderValues);
    if (!rows[0]) {
      return void 0;
    }
    if (customResultMapper) {
      return customResultMapper(rows);
    }
    return mapResultRow(fields, rows[0], joinsNotNullableMap);
  }
  mapGetResult(result, isFromBatch) {
    if (isFromBatch) {
      result = d1ToRawMapping(result.results)[0];
    }
    if (!this.fields && !this.customResultMapper) {
      return result;
    }
    if (this.customResultMapper) {
      return this.customResultMapper([result]);
    }
    return mapResultRow(this.fields, result, this.joinsNotNullableMap);
  }
  values(placeholderValues) {
    const params = fillPlaceholders(this.query.params, placeholderValues ?? {});
    this.logger.logQuery(this.query.sql, params);
    return this.stmt.bind(...params).raw();
  }
  /** @internal */
  isResponseInArrayMode() {
    return this._isResponseInArrayMode;
  }
};
__name(D1PreparedQuery, "D1PreparedQuery");
_a93 = entityKind;
__publicField(D1PreparedQuery, _a93, "D1PreparedQuery");

// node_modules/drizzle-orm/d1/driver.js
var _a94;
var DrizzleD1Database = class extends BaseSQLiteDatabase {
  async batch(batch) {
    return this.session.batch(batch);
  }
};
__name(DrizzleD1Database, "DrizzleD1Database");
_a94 = entityKind;
__publicField(DrizzleD1Database, _a94, "D1Database");
function drizzle(client, config = {}) {
  const dialect = new SQLiteAsyncDialect();
  let logger2;
  if (config.logger === true) {
    logger2 = new DefaultLogger();
  } else if (config.logger !== false) {
    logger2 = config.logger;
  }
  let schema;
  if (config.schema) {
    const tablesConfig = extractTablesRelationalConfig(
      config.schema,
      createTableRelationsHelpers
    );
    schema = {
      fullSchema: config.schema,
      schema: tablesConfig.tables,
      tableNamesMap: tablesConfig.tableNamesMap
    };
  }
  const session = new SQLiteD1Session(client, dialect, schema, { logger: logger2 });
  return new DrizzleD1Database("async", dialect, session, schema);
}
__name(drizzle, "drizzle");

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  leagueMembers: () => leagueMembers,
  leagueMembersRelations: () => leagueMembersRelations,
  leagues: () => leagues,
  leaguesRelations: () => leaguesRelations,
  matchups: () => matchups,
  matchupsRelations: () => matchupsRelations,
  nflGames: () => nflGames,
  nflPlayers: () => nflPlayers,
  nflPlayersRelations: () => nflPlayersRelations,
  playerNews: () => playerNews,
  playerNewsRelations: () => playerNewsRelations,
  playerProjections: () => playerProjections,
  playerProjectionsRelations: () => playerProjectionsRelations,
  playerWeeklyStats: () => playerWeeklyStats,
  playerWeeklyStatsRelations: () => playerWeeklyStatsRelations,
  rosterSpots: () => rosterSpots,
  rosterSpotsRelations: () => rosterSpotsRelations,
  sessions: () => sessions,
  teams: () => teams,
  teamsRelations: () => teamsRelations,
  tradeItems: () => tradeItems,
  trades: () => trades,
  transactions: () => transactions,
  users: () => users,
  usersRelations: () => usersRelations
});
var users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  username: text("username").notNull().unique(),
  avatarUrl: text("avatar_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => /* @__PURE__ */ new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => /* @__PURE__ */ new Date())
});
var sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => /* @__PURE__ */ new Date())
});
var leagues = sqliteTable("leagues", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  platform: text("platform"),
  // 'sleeper' | 'espn' | 'yahoo' | 'custom'
  externalId: text("external_id"),
  scoringFormat: text("scoring_format").notNull().default("ppr"),
  // 'ppr' | 'half-ppr' | 'standard'
  teamCount: integer("team_count").notNull().default(12),
  currentWeek: integer("current_week").notNull().default(1),
  seasonYear: integer("season_year").notNull(),
  draftDate: integer("draft_date", { mode: "timestamp" }),
  tradeDeadline: integer("trade_deadline", { mode: "timestamp" }),
  playoffWeeks: integer("playoff_weeks").notNull().default(3),
  playoffTeams: integer("playoff_teams").notNull().default(6),
  waiverType: text("waiver_type").notNull().default("faab"),
  // 'faab' | 'rolling' | 'reverse'
  waiverBudget: integer("waiver_budget").default(100),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => /* @__PURE__ */ new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => /* @__PURE__ */ new Date())
});
var leagueMembers = sqliteTable("league_members", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  leagueId: text("league_id").notNull().references(() => leagues.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  // 'commissioner' | 'member'
  externalUsername: text("external_username"),
  // Sleeper/ESPN/Yahoo username to identify user's team
  joinedAt: integer("joined_at", { mode: "timestamp" }).notNull().$defaultFn(() => /* @__PURE__ */ new Date())
}, (table) => ({
  userLeagueUnique: uniqueIndex("user_league_unique").on(table.userId, table.leagueId)
}));
var teams = sqliteTable("teams", {
  id: text("id").primaryKey(),
  leagueId: text("league_id").notNull().references(() => leagues.id, { onDelete: "cascade" }),
  ownerId: text("owner_id").notNull().references(() => users.id),
  externalOwnerId: text("external_owner_id"),
  // Sleeper/ESPN user ID - identifies which platform user owns this team
  name: text("name").notNull(),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  ties: integer("ties").notNull().default(0),
  pointsFor: real("points_for").notNull().default(0),
  pointsAgainst: real("points_against").notNull().default(0),
  playoffSeed: integer("playoff_seed"),
  waiverPriority: integer("waiver_priority").default(1),
  faabBudget: integer("faab_budget").default(100),
  streak: text("streak"),
  // 'W3', 'L2', etc.
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => /* @__PURE__ */ new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => /* @__PURE__ */ new Date())
});
var rosterSpots = sqliteTable("roster_spots", {
  id: text("id").primaryKey(),
  teamId: text("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  playerId: text("player_id").notNull().references(() => nflPlayers.id),
  slot: text("slot").notNull(),
  // 'QB' | 'RB1' | 'RB2' | 'WR1' | 'WR2' | 'TE' | 'FLEX' | 'K' | 'DEF' | 'BN1'-'BN6' | 'IR'
  isStarter: integer("is_starter", { mode: "boolean" }).notNull().default(false),
  acquiredAt: integer("acquired_at", { mode: "timestamp" }).notNull().$defaultFn(() => /* @__PURE__ */ new Date()),
  acquiredType: text("acquired_type").default("draft")
  // 'draft' | 'trade' | 'waiver' | 'free_agent'
}, (table) => ({
  teamPlayerUnique: uniqueIndex("team_player_unique").on(table.teamId, table.playerId)
}));
var nflPlayers = sqliteTable("nfl_players", {
  id: text("id").primaryKey(),
  externalId: text("external_id").unique(),
  name: text("name").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  team: text("team").notNull(),
  // NFL team abbreviation
  position: text("position").notNull(),
  // 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF'
  depthChartOrder: integer("depth_chart_order"),
  jerseyNumber: integer("jersey_number"),
  byeWeek: integer("bye_week"),
  status: text("status").notNull().default("active"),
  // 'active' | 'injured_reserve' | 'out' | 'questionable' | 'doubtful'
  injuryNote: text("injury_note"),
  injuryBodyPart: text("injury_body_part"),
  headshotUrl: text("headshot_url"),
  age: integer("age"),
  height: text("height"),
  weight: integer("weight"),
  college: text("college"),
  yearsExp: integer("years_exp"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => /* @__PURE__ */ new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => /* @__PURE__ */ new Date())
});
var playerWeeklyStats = sqliteTable("player_weekly_stats", {
  id: text("id").primaryKey(),
  playerId: text("player_id").notNull().references(() => nflPlayers.id, { onDelete: "cascade" }),
  week: integer("week").notNull(),
  seasonYear: integer("season_year").notNull(),
  opponent: text("opponent"),
  gameResult: text("game_result"),
  // 'W 24-17' or 'L 17-24'
  // Passing
  passAttempts: integer("pass_attempts").default(0),
  passCompletions: integer("pass_completions").default(0),
  passYards: real("pass_yards").default(0),
  passTDs: integer("pass_tds").default(0),
  passInterceptions: integer("pass_interceptions").default(0),
  // Rushing
  rushAttempts: integer("rush_attempts").default(0),
  rushYards: real("rush_yards").default(0),
  rushTDs: integer("rush_tds").default(0),
  // Receiving
  targets: integer("targets").default(0),
  receptions: integer("receptions").default(0),
  receivingYards: real("receiving_yards").default(0),
  receivingTDs: integer("receiving_tds").default(0),
  // Misc
  fumbles: integer("fumbles").default(0),
  fumblesLost: integer("fumbles_lost").default(0),
  twoPointConversions: integer("two_point_conversions").default(0),
  // Kicking
  fgMade: integer("fg_made").default(0),
  fgAttempts: integer("fg_attempts").default(0),
  fg40PlusMade: integer("fg_40_plus_made").default(0),
  fg50PlusMade: integer("fg_50_plus_made").default(0),
  xpMade: integer("xp_made").default(0),
  xpAttempts: integer("xp_attempts").default(0),
  // Defense
  sacks: real("sacks").default(0),
  defInterceptions: integer("def_interceptions").default(0),
  fumblesRecovered: integer("fumbles_recovered").default(0),
  defenseTDs: integer("defense_tds").default(0),
  safeties: integer("safeties").default(0),
  pointsAllowed: integer("points_allowed").default(0),
  // Calculated Fantasy Points
  fantasyPointsPPR: real("fantasy_points_ppr").default(0),
  fantasyPointsHalf: real("fantasy_points_half").default(0),
  fantasyPointsStd: real("fantasy_points_std").default(0)
}, (table) => ({
  playerWeekUnique: uniqueIndex("player_week_unique").on(table.playerId, table.week, table.seasonYear)
}));
var playerProjections = sqliteTable("player_projections", {
  id: text("id").primaryKey(),
  playerId: text("player_id").notNull().references(() => nflPlayers.id, { onDelete: "cascade" }),
  week: integer("week").notNull(),
  seasonYear: integer("season_year").notNull(),
  projectedPoints: real("projected_points").notNull(),
  projectedPointsLow: real("projected_points_low"),
  projectedPointsHigh: real("projected_points_high"),
  scoringFormat: text("scoring_format").notNull(),
  // 'ppr' | 'half-ppr' | 'standard'
  weekRank: integer("week_rank"),
  positionRank: integer("position_rank"),
  // Projected Stats
  projPassYards: real("proj_pass_yards"),
  projPassTDs: real("proj_pass_tds"),
  projRushYards: real("proj_rush_yards"),
  projRushTDs: real("proj_rush_tds"),
  projReceptions: real("proj_receptions"),
  projRecYards: real("proj_rec_yards"),
  projRecTDs: real("proj_rec_tds"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => /* @__PURE__ */ new Date())
}, (table) => ({
  playerProjectionUnique: uniqueIndex("player_projection_unique").on(table.playerId, table.week, table.seasonYear, table.scoringFormat)
}));
var matchups = sqliteTable("matchups", {
  id: text("id").primaryKey(),
  leagueId: text("league_id").notNull().references(() => leagues.id, { onDelete: "cascade" }),
  week: integer("week").notNull(),
  homeTeamId: text("home_team_id").notNull().references(() => teams.id),
  awayTeamId: text("away_team_id").notNull().references(() => teams.id),
  homeScore: real("home_score"),
  awayScore: real("away_score"),
  homeProjectedScore: real("home_projected_score"),
  awayProjectedScore: real("away_projected_score"),
  isPlayoff: integer("is_playoff", { mode: "boolean" }).notNull().default(false),
  isChampionship: integer("is_championship", { mode: "boolean" }).notNull().default(false),
  isComplete: integer("is_complete", { mode: "boolean" }).notNull().default(false)
}, (table) => ({
  matchupUnique: uniqueIndex("matchup_unique").on(table.leagueId, table.week, table.homeTeamId)
}));
var transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  leagueId: text("league_id").notNull().references(() => leagues.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  // 'trade' | 'waiver' | 'add' | 'drop'
  status: text("status").notNull().default("pending"),
  // 'pending' | 'approved' | 'rejected' | 'processed'
  playerId: text("player_id").references(() => nflPlayers.id),
  addTeamId: text("add_team_id").references(() => teams.id),
  dropTeamId: text("drop_team_id").references(() => teams.id),
  dropPlayerId: text("drop_player_id").references(() => nflPlayers.id),
  faabBid: integer("faab_bid"),
  waiverPriority: integer("waiver_priority"),
  processAt: integer("process_at", { mode: "timestamp" }),
  processedAt: integer("processed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => /* @__PURE__ */ new Date())
});
var trades = sqliteTable("trades", {
  id: text("id").primaryKey(),
  leagueId: text("league_id").notNull().references(() => leagues.id, { onDelete: "cascade" }),
  proposingTeamId: text("proposing_team_id").notNull().references(() => teams.id),
  receivingTeamId: text("receiving_team_id").notNull().references(() => teams.id),
  status: text("status").notNull().default("pending"),
  // 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'vetoed'
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => /* @__PURE__ */ new Date()),
  respondedAt: integer("responded_at", { mode: "timestamp" })
});
var tradeItems = sqliteTable("trade_items", {
  id: text("id").primaryKey(),
  tradeId: text("trade_id").notNull().references(() => trades.id, { onDelete: "cascade" }),
  fromTeamId: text("from_team_id").notNull().references(() => teams.id),
  toTeamId: text("to_team_id").notNull().references(() => teams.id),
  playerId: text("player_id").references(() => nflPlayers.id),
  draftPickYear: integer("draft_pick_year"),
  draftPickRound: integer("draft_pick_round")
});
var nflGames = sqliteTable("nfl_games", {
  id: text("id").primaryKey(),
  externalId: text("external_id").unique(),
  week: integer("week").notNull(),
  seasonYear: integer("season_year").notNull(),
  seasonType: text("season_type").default("regular"),
  // 'preseason' | 'regular' | 'postseason'
  homeTeam: text("home_team").notNull(),
  awayTeam: text("away_team").notNull(),
  gameTime: integer("game_time", { mode: "timestamp" }).notNull(),
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  spread: real("spread"),
  overUnder: real("over_under"),
  homeMoneyline: integer("home_moneyline"),
  awayMoneyline: integer("away_moneyline"),
  tvNetwork: text("tv_network"),
  stadium: text("stadium"),
  weather: text("weather"),
  isComplete: integer("is_complete", { mode: "boolean" }).notNull().default(false),
  quarter: text("quarter"),
  // '1' | '2' | '3' | '4' | 'OT' | 'Final'
  timeRemaining: text("time_remaining")
}, (table) => ({
  nflGameUnique: uniqueIndex("nfl_game_unique").on(table.week, table.seasonYear, table.homeTeam, table.awayTeam)
}));
var playerNews = sqliteTable("player_news", {
  id: text("id").primaryKey(),
  playerId: text("player_id").notNull().references(() => nflPlayers.id, { onDelete: "cascade" }),
  headline: text("headline").notNull(),
  content: text("content").notNull(),
  source: text("source"),
  sourceUrl: text("source_url"),
  impactLevel: text("impact_level"),
  // 'high' | 'medium' | 'low'
  publishedAt: integer("published_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => /* @__PURE__ */ new Date())
});
var usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  leagueMemberships: many(leagueMembers),
  teams: many(teams)
}));
var leaguesRelations = relations(leagues, ({ many }) => ({
  members: many(leagueMembers),
  teams: many(teams),
  matchups: many(matchups),
  transactions: many(transactions),
  trades: many(trades)
}));
var leagueMembersRelations = relations(leagueMembers, ({ one }) => ({
  user: one(users, { fields: [leagueMembers.userId], references: [users.id] }),
  league: one(leagues, { fields: [leagueMembers.leagueId], references: [leagues.id] })
}));
var teamsRelations = relations(teams, ({ one, many }) => ({
  league: one(leagues, { fields: [teams.leagueId], references: [leagues.id] }),
  owner: one(users, { fields: [teams.ownerId], references: [users.id] }),
  roster: many(rosterSpots),
  homeMatchups: many(matchups, { relationName: "homeTeam" }),
  awayMatchups: many(matchups, { relationName: "awayTeam" })
}));
var rosterSpotsRelations = relations(rosterSpots, ({ one }) => ({
  team: one(teams, { fields: [rosterSpots.teamId], references: [teams.id] }),
  player: one(nflPlayers, { fields: [rosterSpots.playerId], references: [nflPlayers.id] })
}));
var nflPlayersRelations = relations(nflPlayers, ({ many }) => ({
  weeklyStats: many(playerWeeklyStats),
  projections: many(playerProjections),
  news: many(playerNews),
  rosterSpots: many(rosterSpots)
}));
var playerWeeklyStatsRelations = relations(playerWeeklyStats, ({ one }) => ({
  player: one(nflPlayers, { fields: [playerWeeklyStats.playerId], references: [nflPlayers.id] })
}));
var playerProjectionsRelations = relations(playerProjections, ({ one }) => ({
  player: one(nflPlayers, { fields: [playerProjections.playerId], references: [nflPlayers.id] })
}));
var matchupsRelations = relations(matchups, ({ one }) => ({
  league: one(leagues, { fields: [matchups.leagueId], references: [leagues.id] }),
  homeTeam: one(teams, { fields: [matchups.homeTeamId], references: [teams.id], relationName: "homeTeam" }),
  awayTeam: one(teams, { fields: [matchups.awayTeamId], references: [teams.id], relationName: "awayTeam" })
}));
var playerNewsRelations = relations(playerNews, ({ one }) => ({
  player: one(nflPlayers, { fields: [playerNews.playerId], references: [nflPlayers.id] })
}));

// node_modules/jose/dist/browser/runtime/webcrypto.js
var webcrypto_default = crypto;
var isCryptoKey = /* @__PURE__ */ __name((key) => key instanceof CryptoKey, "isCryptoKey");

// node_modules/jose/dist/browser/lib/buffer_utils.js
var encoder = new TextEncoder();
var decoder = new TextDecoder();
var MAX_INT32 = 2 ** 32;
function concat(...buffers) {
  const size = buffers.reduce((acc, { length }) => acc + length, 0);
  const buf = new Uint8Array(size);
  let i = 0;
  for (const buffer of buffers) {
    buf.set(buffer, i);
    i += buffer.length;
  }
  return buf;
}
__name(concat, "concat");

// node_modules/jose/dist/browser/runtime/base64url.js
var encodeBase64 = /* @__PURE__ */ __name((input) => {
  let unencoded = input;
  if (typeof unencoded === "string") {
    unencoded = encoder.encode(unencoded);
  }
  const CHUNK_SIZE = 32768;
  const arr = [];
  for (let i = 0; i < unencoded.length; i += CHUNK_SIZE) {
    arr.push(String.fromCharCode.apply(null, unencoded.subarray(i, i + CHUNK_SIZE)));
  }
  return btoa(arr.join(""));
}, "encodeBase64");
var encode = /* @__PURE__ */ __name((input) => {
  return encodeBase64(input).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}, "encode");
var decodeBase64 = /* @__PURE__ */ __name((encoded) => {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}, "decodeBase64");
var decode = /* @__PURE__ */ __name((input) => {
  let encoded = input;
  if (encoded instanceof Uint8Array) {
    encoded = decoder.decode(encoded);
  }
  encoded = encoded.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "");
  try {
    return decodeBase64(encoded);
  } catch {
    throw new TypeError("The input to be decoded is not correctly encoded.");
  }
}, "decode");

// node_modules/jose/dist/browser/util/errors.js
var JOSEError = class extends Error {
  constructor(message2, options) {
    super(message2, options);
    this.code = "ERR_JOSE_GENERIC";
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }
};
__name(JOSEError, "JOSEError");
JOSEError.code = "ERR_JOSE_GENERIC";
var JWTClaimValidationFailed = class extends JOSEError {
  constructor(message2, payload, claim = "unspecified", reason = "unspecified") {
    super(message2, { cause: { claim, reason, payload } });
    this.code = "ERR_JWT_CLAIM_VALIDATION_FAILED";
    this.claim = claim;
    this.reason = reason;
    this.payload = payload;
  }
};
__name(JWTClaimValidationFailed, "JWTClaimValidationFailed");
JWTClaimValidationFailed.code = "ERR_JWT_CLAIM_VALIDATION_FAILED";
var JWTExpired = class extends JOSEError {
  constructor(message2, payload, claim = "unspecified", reason = "unspecified") {
    super(message2, { cause: { claim, reason, payload } });
    this.code = "ERR_JWT_EXPIRED";
    this.claim = claim;
    this.reason = reason;
    this.payload = payload;
  }
};
__name(JWTExpired, "JWTExpired");
JWTExpired.code = "ERR_JWT_EXPIRED";
var JOSEAlgNotAllowed = class extends JOSEError {
  constructor() {
    super(...arguments);
    this.code = "ERR_JOSE_ALG_NOT_ALLOWED";
  }
};
__name(JOSEAlgNotAllowed, "JOSEAlgNotAllowed");
JOSEAlgNotAllowed.code = "ERR_JOSE_ALG_NOT_ALLOWED";
var JOSENotSupported = class extends JOSEError {
  constructor() {
    super(...arguments);
    this.code = "ERR_JOSE_NOT_SUPPORTED";
  }
};
__name(JOSENotSupported, "JOSENotSupported");
JOSENotSupported.code = "ERR_JOSE_NOT_SUPPORTED";
var JWEDecryptionFailed = class extends JOSEError {
  constructor(message2 = "decryption operation failed", options) {
    super(message2, options);
    this.code = "ERR_JWE_DECRYPTION_FAILED";
  }
};
__name(JWEDecryptionFailed, "JWEDecryptionFailed");
JWEDecryptionFailed.code = "ERR_JWE_DECRYPTION_FAILED";
var JWEInvalid = class extends JOSEError {
  constructor() {
    super(...arguments);
    this.code = "ERR_JWE_INVALID";
  }
};
__name(JWEInvalid, "JWEInvalid");
JWEInvalid.code = "ERR_JWE_INVALID";
var JWSInvalid = class extends JOSEError {
  constructor() {
    super(...arguments);
    this.code = "ERR_JWS_INVALID";
  }
};
__name(JWSInvalid, "JWSInvalid");
JWSInvalid.code = "ERR_JWS_INVALID";
var JWTInvalid = class extends JOSEError {
  constructor() {
    super(...arguments);
    this.code = "ERR_JWT_INVALID";
  }
};
__name(JWTInvalid, "JWTInvalid");
JWTInvalid.code = "ERR_JWT_INVALID";
var JWKInvalid = class extends JOSEError {
  constructor() {
    super(...arguments);
    this.code = "ERR_JWK_INVALID";
  }
};
__name(JWKInvalid, "JWKInvalid");
JWKInvalid.code = "ERR_JWK_INVALID";
var JWKSInvalid = class extends JOSEError {
  constructor() {
    super(...arguments);
    this.code = "ERR_JWKS_INVALID";
  }
};
__name(JWKSInvalid, "JWKSInvalid");
JWKSInvalid.code = "ERR_JWKS_INVALID";
var JWKSNoMatchingKey = class extends JOSEError {
  constructor(message2 = "no applicable key found in the JSON Web Key Set", options) {
    super(message2, options);
    this.code = "ERR_JWKS_NO_MATCHING_KEY";
  }
};
__name(JWKSNoMatchingKey, "JWKSNoMatchingKey");
JWKSNoMatchingKey.code = "ERR_JWKS_NO_MATCHING_KEY";
var JWKSMultipleMatchingKeys = class extends JOSEError {
  constructor(message2 = "multiple matching keys found in the JSON Web Key Set", options) {
    super(message2, options);
    this.code = "ERR_JWKS_MULTIPLE_MATCHING_KEYS";
  }
};
__name(JWKSMultipleMatchingKeys, "JWKSMultipleMatchingKeys");
JWKSMultipleMatchingKeys.code = "ERR_JWKS_MULTIPLE_MATCHING_KEYS";
var JWKSTimeout = class extends JOSEError {
  constructor(message2 = "request timed out", options) {
    super(message2, options);
    this.code = "ERR_JWKS_TIMEOUT";
  }
};
__name(JWKSTimeout, "JWKSTimeout");
JWKSTimeout.code = "ERR_JWKS_TIMEOUT";
var JWSSignatureVerificationFailed = class extends JOSEError {
  constructor(message2 = "signature verification failed", options) {
    super(message2, options);
    this.code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
  }
};
__name(JWSSignatureVerificationFailed, "JWSSignatureVerificationFailed");
JWSSignatureVerificationFailed.code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";

// node_modules/jose/dist/browser/lib/crypto_key.js
function unusable(name, prop = "algorithm.name") {
  return new TypeError(`CryptoKey does not support this operation, its ${prop} must be ${name}`);
}
__name(unusable, "unusable");
function isAlgorithm(algorithm, name) {
  return algorithm.name === name;
}
__name(isAlgorithm, "isAlgorithm");
function getHashLength(hash) {
  return parseInt(hash.name.slice(4), 10);
}
__name(getHashLength, "getHashLength");
function getNamedCurve(alg) {
  switch (alg) {
    case "ES256":
      return "P-256";
    case "ES384":
      return "P-384";
    case "ES512":
      return "P-521";
    default:
      throw new Error("unreachable");
  }
}
__name(getNamedCurve, "getNamedCurve");
function checkUsage(key, usages) {
  if (usages.length && !usages.some((expected) => key.usages.includes(expected))) {
    let msg = "CryptoKey does not support this operation, its usages must include ";
    if (usages.length > 2) {
      const last = usages.pop();
      msg += `one of ${usages.join(", ")}, or ${last}.`;
    } else if (usages.length === 2) {
      msg += `one of ${usages[0]} or ${usages[1]}.`;
    } else {
      msg += `${usages[0]}.`;
    }
    throw new TypeError(msg);
  }
}
__name(checkUsage, "checkUsage");
function checkSigCryptoKey(key, alg, ...usages) {
  switch (alg) {
    case "HS256":
    case "HS384":
    case "HS512": {
      if (!isAlgorithm(key.algorithm, "HMAC"))
        throw unusable("HMAC");
      const expected = parseInt(alg.slice(2), 10);
      const actual = getHashLength(key.algorithm.hash);
      if (actual !== expected)
        throw unusable(`SHA-${expected}`, "algorithm.hash");
      break;
    }
    case "RS256":
    case "RS384":
    case "RS512": {
      if (!isAlgorithm(key.algorithm, "RSASSA-PKCS1-v1_5"))
        throw unusable("RSASSA-PKCS1-v1_5");
      const expected = parseInt(alg.slice(2), 10);
      const actual = getHashLength(key.algorithm.hash);
      if (actual !== expected)
        throw unusable(`SHA-${expected}`, "algorithm.hash");
      break;
    }
    case "PS256":
    case "PS384":
    case "PS512": {
      if (!isAlgorithm(key.algorithm, "RSA-PSS"))
        throw unusable("RSA-PSS");
      const expected = parseInt(alg.slice(2), 10);
      const actual = getHashLength(key.algorithm.hash);
      if (actual !== expected)
        throw unusable(`SHA-${expected}`, "algorithm.hash");
      break;
    }
    case "EdDSA": {
      if (key.algorithm.name !== "Ed25519" && key.algorithm.name !== "Ed448") {
        throw unusable("Ed25519 or Ed448");
      }
      break;
    }
    case "Ed25519": {
      if (!isAlgorithm(key.algorithm, "Ed25519"))
        throw unusable("Ed25519");
      break;
    }
    case "ES256":
    case "ES384":
    case "ES512": {
      if (!isAlgorithm(key.algorithm, "ECDSA"))
        throw unusable("ECDSA");
      const expected = getNamedCurve(alg);
      const actual = key.algorithm.namedCurve;
      if (actual !== expected)
        throw unusable(expected, "algorithm.namedCurve");
      break;
    }
    default:
      throw new TypeError("CryptoKey does not support this operation");
  }
  checkUsage(key, usages);
}
__name(checkSigCryptoKey, "checkSigCryptoKey");

// node_modules/jose/dist/browser/lib/invalid_key_input.js
function message(msg, actual, ...types2) {
  types2 = types2.filter(Boolean);
  if (types2.length > 2) {
    const last = types2.pop();
    msg += `one of type ${types2.join(", ")}, or ${last}.`;
  } else if (types2.length === 2) {
    msg += `one of type ${types2[0]} or ${types2[1]}.`;
  } else {
    msg += `of type ${types2[0]}.`;
  }
  if (actual == null) {
    msg += ` Received ${actual}`;
  } else if (typeof actual === "function" && actual.name) {
    msg += ` Received function ${actual.name}`;
  } else if (typeof actual === "object" && actual != null) {
    if (actual.constructor?.name) {
      msg += ` Received an instance of ${actual.constructor.name}`;
    }
  }
  return msg;
}
__name(message, "message");
var invalid_key_input_default = /* @__PURE__ */ __name((actual, ...types2) => {
  return message("Key must be ", actual, ...types2);
}, "default");
function withAlg(alg, actual, ...types2) {
  return message(`Key for the ${alg} algorithm must be `, actual, ...types2);
}
__name(withAlg, "withAlg");

// node_modules/jose/dist/browser/runtime/is_key_like.js
var is_key_like_default = /* @__PURE__ */ __name((key) => {
  if (isCryptoKey(key)) {
    return true;
  }
  return key?.[Symbol.toStringTag] === "KeyObject";
}, "default");
var types = ["CryptoKey"];

// node_modules/jose/dist/browser/lib/is_disjoint.js
var isDisjoint = /* @__PURE__ */ __name((...headers) => {
  const sources = headers.filter(Boolean);
  if (sources.length === 0 || sources.length === 1) {
    return true;
  }
  let acc;
  for (const header of sources) {
    const parameters = Object.keys(header);
    if (!acc || acc.size === 0) {
      acc = new Set(parameters);
      continue;
    }
    for (const parameter of parameters) {
      if (acc.has(parameter)) {
        return false;
      }
      acc.add(parameter);
    }
  }
  return true;
}, "isDisjoint");
var is_disjoint_default = isDisjoint;

// node_modules/jose/dist/browser/lib/is_object.js
function isObjectLike(value) {
  return typeof value === "object" && value !== null;
}
__name(isObjectLike, "isObjectLike");
function isObject(input) {
  if (!isObjectLike(input) || Object.prototype.toString.call(input) !== "[object Object]") {
    return false;
  }
  if (Object.getPrototypeOf(input) === null) {
    return true;
  }
  let proto = input;
  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto);
  }
  return Object.getPrototypeOf(input) === proto;
}
__name(isObject, "isObject");

// node_modules/jose/dist/browser/runtime/check_key_length.js
var check_key_length_default = /* @__PURE__ */ __name((alg, key) => {
  if (alg.startsWith("RS") || alg.startsWith("PS")) {
    const { modulusLength } = key.algorithm;
    if (typeof modulusLength !== "number" || modulusLength < 2048) {
      throw new TypeError(`${alg} requires key modulusLength to be 2048 bits or larger`);
    }
  }
}, "default");

// node_modules/jose/dist/browser/lib/is_jwk.js
function isJWK(key) {
  return isObject(key) && typeof key.kty === "string";
}
__name(isJWK, "isJWK");
function isPrivateJWK(key) {
  return key.kty !== "oct" && typeof key.d === "string";
}
__name(isPrivateJWK, "isPrivateJWK");
function isPublicJWK(key) {
  return key.kty !== "oct" && typeof key.d === "undefined";
}
__name(isPublicJWK, "isPublicJWK");
function isSecretJWK(key) {
  return isJWK(key) && key.kty === "oct" && typeof key.k === "string";
}
__name(isSecretJWK, "isSecretJWK");

// node_modules/jose/dist/browser/runtime/jwk_to_key.js
function subtleMapping(jwk) {
  let algorithm;
  let keyUsages;
  switch (jwk.kty) {
    case "RSA": {
      switch (jwk.alg) {
        case "PS256":
        case "PS384":
        case "PS512":
          algorithm = { name: "RSA-PSS", hash: `SHA-${jwk.alg.slice(-3)}` };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "RS256":
        case "RS384":
        case "RS512":
          algorithm = { name: "RSASSA-PKCS1-v1_5", hash: `SHA-${jwk.alg.slice(-3)}` };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "RSA-OAEP":
        case "RSA-OAEP-256":
        case "RSA-OAEP-384":
        case "RSA-OAEP-512":
          algorithm = {
            name: "RSA-OAEP",
            hash: `SHA-${parseInt(jwk.alg.slice(-3), 10) || 1}`
          };
          keyUsages = jwk.d ? ["decrypt", "unwrapKey"] : ["encrypt", "wrapKey"];
          break;
        default:
          throw new JOSENotSupported('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
      }
      break;
    }
    case "EC": {
      switch (jwk.alg) {
        case "ES256":
          algorithm = { name: "ECDSA", namedCurve: "P-256" };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "ES384":
          algorithm = { name: "ECDSA", namedCurve: "P-384" };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "ES512":
          algorithm = { name: "ECDSA", namedCurve: "P-521" };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "ECDH-ES":
        case "ECDH-ES+A128KW":
        case "ECDH-ES+A192KW":
        case "ECDH-ES+A256KW":
          algorithm = { name: "ECDH", namedCurve: jwk.crv };
          keyUsages = jwk.d ? ["deriveBits"] : [];
          break;
        default:
          throw new JOSENotSupported('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
      }
      break;
    }
    case "OKP": {
      switch (jwk.alg) {
        case "Ed25519":
          algorithm = { name: "Ed25519" };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "EdDSA":
          algorithm = { name: jwk.crv };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "ECDH-ES":
        case "ECDH-ES+A128KW":
        case "ECDH-ES+A192KW":
        case "ECDH-ES+A256KW":
          algorithm = { name: jwk.crv };
          keyUsages = jwk.d ? ["deriveBits"] : [];
          break;
        default:
          throw new JOSENotSupported('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
      }
      break;
    }
    default:
      throw new JOSENotSupported('Invalid or unsupported JWK "kty" (Key Type) Parameter value');
  }
  return { algorithm, keyUsages };
}
__name(subtleMapping, "subtleMapping");
var parse = /* @__PURE__ */ __name(async (jwk) => {
  if (!jwk.alg) {
    throw new TypeError('"alg" argument is required when "jwk.alg" is not present');
  }
  const { algorithm, keyUsages } = subtleMapping(jwk);
  const rest = [
    algorithm,
    jwk.ext ?? false,
    jwk.key_ops ?? keyUsages
  ];
  const keyData = { ...jwk };
  delete keyData.alg;
  delete keyData.use;
  return webcrypto_default.subtle.importKey("jwk", keyData, ...rest);
}, "parse");
var jwk_to_key_default = parse;

// node_modules/jose/dist/browser/runtime/normalize_key.js
var exportKeyValue = /* @__PURE__ */ __name((k) => decode(k), "exportKeyValue");
var privCache;
var pubCache;
var isKeyObject = /* @__PURE__ */ __name((key) => {
  return key?.[Symbol.toStringTag] === "KeyObject";
}, "isKeyObject");
var importAndCache = /* @__PURE__ */ __name(async (cache, key, jwk, alg, freeze = false) => {
  let cached = cache.get(key);
  if (cached?.[alg]) {
    return cached[alg];
  }
  const cryptoKey = await jwk_to_key_default({ ...jwk, alg });
  if (freeze)
    Object.freeze(key);
  if (!cached) {
    cache.set(key, { [alg]: cryptoKey });
  } else {
    cached[alg] = cryptoKey;
  }
  return cryptoKey;
}, "importAndCache");
var normalizePublicKey = /* @__PURE__ */ __name((key, alg) => {
  if (isKeyObject(key)) {
    let jwk = key.export({ format: "jwk" });
    delete jwk.d;
    delete jwk.dp;
    delete jwk.dq;
    delete jwk.p;
    delete jwk.q;
    delete jwk.qi;
    if (jwk.k) {
      return exportKeyValue(jwk.k);
    }
    pubCache || (pubCache = /* @__PURE__ */ new WeakMap());
    return importAndCache(pubCache, key, jwk, alg);
  }
  if (isJWK(key)) {
    if (key.k)
      return decode(key.k);
    pubCache || (pubCache = /* @__PURE__ */ new WeakMap());
    const cryptoKey = importAndCache(pubCache, key, key, alg, true);
    return cryptoKey;
  }
  return key;
}, "normalizePublicKey");
var normalizePrivateKey = /* @__PURE__ */ __name((key, alg) => {
  if (isKeyObject(key)) {
    let jwk = key.export({ format: "jwk" });
    if (jwk.k) {
      return exportKeyValue(jwk.k);
    }
    privCache || (privCache = /* @__PURE__ */ new WeakMap());
    return importAndCache(privCache, key, jwk, alg);
  }
  if (isJWK(key)) {
    if (key.k)
      return decode(key.k);
    privCache || (privCache = /* @__PURE__ */ new WeakMap());
    const cryptoKey = importAndCache(privCache, key, key, alg, true);
    return cryptoKey;
  }
  return key;
}, "normalizePrivateKey");
var normalize_key_default = { normalizePublicKey, normalizePrivateKey };

// node_modules/jose/dist/browser/key/import.js
async function importJWK(jwk, alg) {
  if (!isObject(jwk)) {
    throw new TypeError("JWK must be an object");
  }
  alg || (alg = jwk.alg);
  switch (jwk.kty) {
    case "oct":
      if (typeof jwk.k !== "string" || !jwk.k) {
        throw new TypeError('missing "k" (Key Value) Parameter value');
      }
      return decode(jwk.k);
    case "RSA":
      if ("oth" in jwk && jwk.oth !== void 0) {
        throw new JOSENotSupported('RSA JWK "oth" (Other Primes Info) Parameter value is not supported');
      }
    case "EC":
    case "OKP":
      return jwk_to_key_default({ ...jwk, alg });
    default:
      throw new JOSENotSupported('Unsupported "kty" (Key Type) Parameter value');
  }
}
__name(importJWK, "importJWK");

// node_modules/jose/dist/browser/lib/check_key_type.js
var tag = /* @__PURE__ */ __name((key) => key?.[Symbol.toStringTag], "tag");
var jwkMatchesOp = /* @__PURE__ */ __name((alg, key, usage) => {
  if (key.use !== void 0 && key.use !== "sig") {
    throw new TypeError("Invalid key for this operation, when present its use must be sig");
  }
  if (key.key_ops !== void 0 && key.key_ops.includes?.(usage) !== true) {
    throw new TypeError(`Invalid key for this operation, when present its key_ops must include ${usage}`);
  }
  if (key.alg !== void 0 && key.alg !== alg) {
    throw new TypeError(`Invalid key for this operation, when present its alg must be ${alg}`);
  }
  return true;
}, "jwkMatchesOp");
var symmetricTypeCheck = /* @__PURE__ */ __name((alg, key, usage, allowJwk) => {
  if (key instanceof Uint8Array)
    return;
  if (allowJwk && isJWK(key)) {
    if (isSecretJWK(key) && jwkMatchesOp(alg, key, usage))
      return;
    throw new TypeError(`JSON Web Key for symmetric algorithms must have JWK "kty" (Key Type) equal to "oct" and the JWK "k" (Key Value) present`);
  }
  if (!is_key_like_default(key)) {
    throw new TypeError(withAlg(alg, key, ...types, "Uint8Array", allowJwk ? "JSON Web Key" : null));
  }
  if (key.type !== "secret") {
    throw new TypeError(`${tag(key)} instances for symmetric algorithms must be of type "secret"`);
  }
}, "symmetricTypeCheck");
var asymmetricTypeCheck = /* @__PURE__ */ __name((alg, key, usage, allowJwk) => {
  if (allowJwk && isJWK(key)) {
    switch (usage) {
      case "sign":
        if (isPrivateJWK(key) && jwkMatchesOp(alg, key, usage))
          return;
        throw new TypeError(`JSON Web Key for this operation be a private JWK`);
      case "verify":
        if (isPublicJWK(key) && jwkMatchesOp(alg, key, usage))
          return;
        throw new TypeError(`JSON Web Key for this operation be a public JWK`);
    }
  }
  if (!is_key_like_default(key)) {
    throw new TypeError(withAlg(alg, key, ...types, allowJwk ? "JSON Web Key" : null));
  }
  if (key.type === "secret") {
    throw new TypeError(`${tag(key)} instances for asymmetric algorithms must not be of type "secret"`);
  }
  if (usage === "sign" && key.type === "public") {
    throw new TypeError(`${tag(key)} instances for asymmetric algorithm signing must be of type "private"`);
  }
  if (usage === "decrypt" && key.type === "public") {
    throw new TypeError(`${tag(key)} instances for asymmetric algorithm decryption must be of type "private"`);
  }
  if (key.algorithm && usage === "verify" && key.type === "private") {
    throw new TypeError(`${tag(key)} instances for asymmetric algorithm verifying must be of type "public"`);
  }
  if (key.algorithm && usage === "encrypt" && key.type === "private") {
    throw new TypeError(`${tag(key)} instances for asymmetric algorithm encryption must be of type "public"`);
  }
}, "asymmetricTypeCheck");
function checkKeyType(allowJwk, alg, key, usage) {
  const symmetric = alg.startsWith("HS") || alg === "dir" || alg.startsWith("PBES2") || /^A\d{3}(?:GCM)?KW$/.test(alg);
  if (symmetric) {
    symmetricTypeCheck(alg, key, usage, allowJwk);
  } else {
    asymmetricTypeCheck(alg, key, usage, allowJwk);
  }
}
__name(checkKeyType, "checkKeyType");
var check_key_type_default = checkKeyType.bind(void 0, false);
var checkKeyTypeWithJwk = checkKeyType.bind(void 0, true);

// node_modules/jose/dist/browser/lib/validate_crit.js
function validateCrit(Err, recognizedDefault, recognizedOption, protectedHeader, joseHeader) {
  if (joseHeader.crit !== void 0 && protectedHeader?.crit === void 0) {
    throw new Err('"crit" (Critical) Header Parameter MUST be integrity protected');
  }
  if (!protectedHeader || protectedHeader.crit === void 0) {
    return /* @__PURE__ */ new Set();
  }
  if (!Array.isArray(protectedHeader.crit) || protectedHeader.crit.length === 0 || protectedHeader.crit.some((input) => typeof input !== "string" || input.length === 0)) {
    throw new Err('"crit" (Critical) Header Parameter MUST be an array of non-empty strings when present');
  }
  let recognized;
  if (recognizedOption !== void 0) {
    recognized = new Map([...Object.entries(recognizedOption), ...recognizedDefault.entries()]);
  } else {
    recognized = recognizedDefault;
  }
  for (const parameter of protectedHeader.crit) {
    if (!recognized.has(parameter)) {
      throw new JOSENotSupported(`Extension Header Parameter "${parameter}" is not recognized`);
    }
    if (joseHeader[parameter] === void 0) {
      throw new Err(`Extension Header Parameter "${parameter}" is missing`);
    }
    if (recognized.get(parameter) && protectedHeader[parameter] === void 0) {
      throw new Err(`Extension Header Parameter "${parameter}" MUST be integrity protected`);
    }
  }
  return new Set(protectedHeader.crit);
}
__name(validateCrit, "validateCrit");
var validate_crit_default = validateCrit;

// node_modules/jose/dist/browser/lib/validate_algorithms.js
var validateAlgorithms = /* @__PURE__ */ __name((option, algorithms) => {
  if (algorithms !== void 0 && (!Array.isArray(algorithms) || algorithms.some((s) => typeof s !== "string"))) {
    throw new TypeError(`"${option}" option must be an array of strings`);
  }
  if (!algorithms) {
    return void 0;
  }
  return new Set(algorithms);
}, "validateAlgorithms");
var validate_algorithms_default = validateAlgorithms;

// node_modules/jose/dist/browser/runtime/subtle_dsa.js
function subtleDsa(alg, algorithm) {
  const hash = `SHA-${alg.slice(-3)}`;
  switch (alg) {
    case "HS256":
    case "HS384":
    case "HS512":
      return { hash, name: "HMAC" };
    case "PS256":
    case "PS384":
    case "PS512":
      return { hash, name: "RSA-PSS", saltLength: alg.slice(-3) >> 3 };
    case "RS256":
    case "RS384":
    case "RS512":
      return { hash, name: "RSASSA-PKCS1-v1_5" };
    case "ES256":
    case "ES384":
    case "ES512":
      return { hash, name: "ECDSA", namedCurve: algorithm.namedCurve };
    case "Ed25519":
      return { name: "Ed25519" };
    case "EdDSA":
      return { name: algorithm.name };
    default:
      throw new JOSENotSupported(`alg ${alg} is not supported either by JOSE or your javascript runtime`);
  }
}
__name(subtleDsa, "subtleDsa");

// node_modules/jose/dist/browser/runtime/get_sign_verify_key.js
async function getCryptoKey(alg, key, usage) {
  if (usage === "sign") {
    key = await normalize_key_default.normalizePrivateKey(key, alg);
  }
  if (usage === "verify") {
    key = await normalize_key_default.normalizePublicKey(key, alg);
  }
  if (isCryptoKey(key)) {
    checkSigCryptoKey(key, alg, usage);
    return key;
  }
  if (key instanceof Uint8Array) {
    if (!alg.startsWith("HS")) {
      throw new TypeError(invalid_key_input_default(key, ...types));
    }
    return webcrypto_default.subtle.importKey("raw", key, { hash: `SHA-${alg.slice(-3)}`, name: "HMAC" }, false, [usage]);
  }
  throw new TypeError(invalid_key_input_default(key, ...types, "Uint8Array", "JSON Web Key"));
}
__name(getCryptoKey, "getCryptoKey");

// node_modules/jose/dist/browser/runtime/verify.js
var verify = /* @__PURE__ */ __name(async (alg, key, signature, data) => {
  const cryptoKey = await getCryptoKey(alg, key, "verify");
  check_key_length_default(alg, cryptoKey);
  const algorithm = subtleDsa(alg, cryptoKey.algorithm);
  try {
    return await webcrypto_default.subtle.verify(algorithm, cryptoKey, signature, data);
  } catch {
    return false;
  }
}, "verify");
var verify_default = verify;

// node_modules/jose/dist/browser/jws/flattened/verify.js
async function flattenedVerify(jws, key, options) {
  if (!isObject(jws)) {
    throw new JWSInvalid("Flattened JWS must be an object");
  }
  if (jws.protected === void 0 && jws.header === void 0) {
    throw new JWSInvalid('Flattened JWS must have either of the "protected" or "header" members');
  }
  if (jws.protected !== void 0 && typeof jws.protected !== "string") {
    throw new JWSInvalid("JWS Protected Header incorrect type");
  }
  if (jws.payload === void 0) {
    throw new JWSInvalid("JWS Payload missing");
  }
  if (typeof jws.signature !== "string") {
    throw new JWSInvalid("JWS Signature missing or incorrect type");
  }
  if (jws.header !== void 0 && !isObject(jws.header)) {
    throw new JWSInvalid("JWS Unprotected Header incorrect type");
  }
  let parsedProt = {};
  if (jws.protected) {
    try {
      const protectedHeader = decode(jws.protected);
      parsedProt = JSON.parse(decoder.decode(protectedHeader));
    } catch {
      throw new JWSInvalid("JWS Protected Header is invalid");
    }
  }
  if (!is_disjoint_default(parsedProt, jws.header)) {
    throw new JWSInvalid("JWS Protected and JWS Unprotected Header Parameter names must be disjoint");
  }
  const joseHeader = {
    ...parsedProt,
    ...jws.header
  };
  const extensions = validate_crit_default(JWSInvalid, /* @__PURE__ */ new Map([["b64", true]]), options?.crit, parsedProt, joseHeader);
  let b64 = true;
  if (extensions.has("b64")) {
    b64 = parsedProt.b64;
    if (typeof b64 !== "boolean") {
      throw new JWSInvalid('The "b64" (base64url-encode payload) Header Parameter must be a boolean');
    }
  }
  const { alg } = joseHeader;
  if (typeof alg !== "string" || !alg) {
    throw new JWSInvalid('JWS "alg" (Algorithm) Header Parameter missing or invalid');
  }
  const algorithms = options && validate_algorithms_default("algorithms", options.algorithms);
  if (algorithms && !algorithms.has(alg)) {
    throw new JOSEAlgNotAllowed('"alg" (Algorithm) Header Parameter value not allowed');
  }
  if (b64) {
    if (typeof jws.payload !== "string") {
      throw new JWSInvalid("JWS Payload must be a string");
    }
  } else if (typeof jws.payload !== "string" && !(jws.payload instanceof Uint8Array)) {
    throw new JWSInvalid("JWS Payload must be a string or an Uint8Array instance");
  }
  let resolvedKey = false;
  if (typeof key === "function") {
    key = await key(parsedProt, jws);
    resolvedKey = true;
    checkKeyTypeWithJwk(alg, key, "verify");
    if (isJWK(key)) {
      key = await importJWK(key, alg);
    }
  } else {
    checkKeyTypeWithJwk(alg, key, "verify");
  }
  const data = concat(encoder.encode(jws.protected ?? ""), encoder.encode("."), typeof jws.payload === "string" ? encoder.encode(jws.payload) : jws.payload);
  let signature;
  try {
    signature = decode(jws.signature);
  } catch {
    throw new JWSInvalid("Failed to base64url decode the signature");
  }
  const verified = await verify_default(alg, key, signature, data);
  if (!verified) {
    throw new JWSSignatureVerificationFailed();
  }
  let payload;
  if (b64) {
    try {
      payload = decode(jws.payload);
    } catch {
      throw new JWSInvalid("Failed to base64url decode the payload");
    }
  } else if (typeof jws.payload === "string") {
    payload = encoder.encode(jws.payload);
  } else {
    payload = jws.payload;
  }
  const result = { payload };
  if (jws.protected !== void 0) {
    result.protectedHeader = parsedProt;
  }
  if (jws.header !== void 0) {
    result.unprotectedHeader = jws.header;
  }
  if (resolvedKey) {
    return { ...result, key };
  }
  return result;
}
__name(flattenedVerify, "flattenedVerify");

// node_modules/jose/dist/browser/jws/compact/verify.js
async function compactVerify(jws, key, options) {
  if (jws instanceof Uint8Array) {
    jws = decoder.decode(jws);
  }
  if (typeof jws !== "string") {
    throw new JWSInvalid("Compact JWS must be a string or Uint8Array");
  }
  const { 0: protectedHeader, 1: payload, 2: signature, length } = jws.split(".");
  if (length !== 3) {
    throw new JWSInvalid("Invalid Compact JWS");
  }
  const verified = await flattenedVerify({ payload, protected: protectedHeader, signature }, key, options);
  const result = { payload: verified.payload, protectedHeader: verified.protectedHeader };
  if (typeof key === "function") {
    return { ...result, key: verified.key };
  }
  return result;
}
__name(compactVerify, "compactVerify");

// node_modules/jose/dist/browser/lib/epoch.js
var epoch_default = /* @__PURE__ */ __name((date) => Math.floor(date.getTime() / 1e3), "default");

// node_modules/jose/dist/browser/lib/secs.js
var minute = 60;
var hour = minute * 60;
var day = hour * 24;
var week = day * 7;
var year = day * 365.25;
var REGEX = /^(\+|\-)? ?(\d+|\d+\.\d+) ?(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)(?: (ago|from now))?$/i;
var secs_default = /* @__PURE__ */ __name((str) => {
  const matched = REGEX.exec(str);
  if (!matched || matched[4] && matched[1]) {
    throw new TypeError("Invalid time period format");
  }
  const value = parseFloat(matched[2]);
  const unit = matched[3].toLowerCase();
  let numericDate;
  switch (unit) {
    case "sec":
    case "secs":
    case "second":
    case "seconds":
    case "s":
      numericDate = Math.round(value);
      break;
    case "minute":
    case "minutes":
    case "min":
    case "mins":
    case "m":
      numericDate = Math.round(value * minute);
      break;
    case "hour":
    case "hours":
    case "hr":
    case "hrs":
    case "h":
      numericDate = Math.round(value * hour);
      break;
    case "day":
    case "days":
    case "d":
      numericDate = Math.round(value * day);
      break;
    case "week":
    case "weeks":
    case "w":
      numericDate = Math.round(value * week);
      break;
    default:
      numericDate = Math.round(value * year);
      break;
  }
  if (matched[1] === "-" || matched[4] === "ago") {
    return -numericDate;
  }
  return numericDate;
}, "default");

// node_modules/jose/dist/browser/lib/jwt_claims_set.js
var normalizeTyp = /* @__PURE__ */ __name((value) => value.toLowerCase().replace(/^application\//, ""), "normalizeTyp");
var checkAudiencePresence = /* @__PURE__ */ __name((audPayload, audOption) => {
  if (typeof audPayload === "string") {
    return audOption.includes(audPayload);
  }
  if (Array.isArray(audPayload)) {
    return audOption.some(Set.prototype.has.bind(new Set(audPayload)));
  }
  return false;
}, "checkAudiencePresence");
var jwt_claims_set_default = /* @__PURE__ */ __name((protectedHeader, encodedPayload, options = {}) => {
  let payload;
  try {
    payload = JSON.parse(decoder.decode(encodedPayload));
  } catch {
  }
  if (!isObject(payload)) {
    throw new JWTInvalid("JWT Claims Set must be a top-level JSON object");
  }
  const { typ } = options;
  if (typ && (typeof protectedHeader.typ !== "string" || normalizeTyp(protectedHeader.typ) !== normalizeTyp(typ))) {
    throw new JWTClaimValidationFailed('unexpected "typ" JWT header value', payload, "typ", "check_failed");
  }
  const { requiredClaims = [], issuer, subject, audience, maxTokenAge } = options;
  const presenceCheck = [...requiredClaims];
  if (maxTokenAge !== void 0)
    presenceCheck.push("iat");
  if (audience !== void 0)
    presenceCheck.push("aud");
  if (subject !== void 0)
    presenceCheck.push("sub");
  if (issuer !== void 0)
    presenceCheck.push("iss");
  for (const claim of new Set(presenceCheck.reverse())) {
    if (!(claim in payload)) {
      throw new JWTClaimValidationFailed(`missing required "${claim}" claim`, payload, claim, "missing");
    }
  }
  if (issuer && !(Array.isArray(issuer) ? issuer : [issuer]).includes(payload.iss)) {
    throw new JWTClaimValidationFailed('unexpected "iss" claim value', payload, "iss", "check_failed");
  }
  if (subject && payload.sub !== subject) {
    throw new JWTClaimValidationFailed('unexpected "sub" claim value', payload, "sub", "check_failed");
  }
  if (audience && !checkAudiencePresence(payload.aud, typeof audience === "string" ? [audience] : audience)) {
    throw new JWTClaimValidationFailed('unexpected "aud" claim value', payload, "aud", "check_failed");
  }
  let tolerance;
  switch (typeof options.clockTolerance) {
    case "string":
      tolerance = secs_default(options.clockTolerance);
      break;
    case "number":
      tolerance = options.clockTolerance;
      break;
    case "undefined":
      tolerance = 0;
      break;
    default:
      throw new TypeError("Invalid clockTolerance option type");
  }
  const { currentDate } = options;
  const now = epoch_default(currentDate || /* @__PURE__ */ new Date());
  if ((payload.iat !== void 0 || maxTokenAge) && typeof payload.iat !== "number") {
    throw new JWTClaimValidationFailed('"iat" claim must be a number', payload, "iat", "invalid");
  }
  if (payload.nbf !== void 0) {
    if (typeof payload.nbf !== "number") {
      throw new JWTClaimValidationFailed('"nbf" claim must be a number', payload, "nbf", "invalid");
    }
    if (payload.nbf > now + tolerance) {
      throw new JWTClaimValidationFailed('"nbf" claim timestamp check failed', payload, "nbf", "check_failed");
    }
  }
  if (payload.exp !== void 0) {
    if (typeof payload.exp !== "number") {
      throw new JWTClaimValidationFailed('"exp" claim must be a number', payload, "exp", "invalid");
    }
    if (payload.exp <= now - tolerance) {
      throw new JWTExpired('"exp" claim timestamp check failed', payload, "exp", "check_failed");
    }
  }
  if (maxTokenAge) {
    const age = now - payload.iat;
    const max = typeof maxTokenAge === "number" ? maxTokenAge : secs_default(maxTokenAge);
    if (age - tolerance > max) {
      throw new JWTExpired('"iat" claim timestamp check failed (too far in the past)', payload, "iat", "check_failed");
    }
    if (age < 0 - tolerance) {
      throw new JWTClaimValidationFailed('"iat" claim timestamp check failed (it should be in the past)', payload, "iat", "check_failed");
    }
  }
  return payload;
}, "default");

// node_modules/jose/dist/browser/jwt/verify.js
async function jwtVerify(jwt, key, options) {
  const verified = await compactVerify(jwt, key, options);
  if (verified.protectedHeader.crit?.includes("b64") && verified.protectedHeader.b64 === false) {
    throw new JWTInvalid("JWTs MUST NOT use unencoded payload");
  }
  const payload = jwt_claims_set_default(verified.protectedHeader, verified.payload, options);
  const result = { payload, protectedHeader: verified.protectedHeader };
  if (typeof key === "function") {
    return { ...result, key: verified.key };
  }
  return result;
}
__name(jwtVerify, "jwtVerify");

// node_modules/jose/dist/browser/runtime/sign.js
var sign = /* @__PURE__ */ __name(async (alg, key, data) => {
  const cryptoKey = await getCryptoKey(alg, key, "sign");
  check_key_length_default(alg, cryptoKey);
  const signature = await webcrypto_default.subtle.sign(subtleDsa(alg, cryptoKey.algorithm), cryptoKey, data);
  return new Uint8Array(signature);
}, "sign");
var sign_default = sign;

// node_modules/jose/dist/browser/jws/flattened/sign.js
var FlattenedSign = class {
  constructor(payload) {
    if (!(payload instanceof Uint8Array)) {
      throw new TypeError("payload must be an instance of Uint8Array");
    }
    this._payload = payload;
  }
  setProtectedHeader(protectedHeader) {
    if (this._protectedHeader) {
      throw new TypeError("setProtectedHeader can only be called once");
    }
    this._protectedHeader = protectedHeader;
    return this;
  }
  setUnprotectedHeader(unprotectedHeader) {
    if (this._unprotectedHeader) {
      throw new TypeError("setUnprotectedHeader can only be called once");
    }
    this._unprotectedHeader = unprotectedHeader;
    return this;
  }
  async sign(key, options) {
    if (!this._protectedHeader && !this._unprotectedHeader) {
      throw new JWSInvalid("either setProtectedHeader or setUnprotectedHeader must be called before #sign()");
    }
    if (!is_disjoint_default(this._protectedHeader, this._unprotectedHeader)) {
      throw new JWSInvalid("JWS Protected and JWS Unprotected Header Parameter names must be disjoint");
    }
    const joseHeader = {
      ...this._protectedHeader,
      ...this._unprotectedHeader
    };
    const extensions = validate_crit_default(JWSInvalid, /* @__PURE__ */ new Map([["b64", true]]), options?.crit, this._protectedHeader, joseHeader);
    let b64 = true;
    if (extensions.has("b64")) {
      b64 = this._protectedHeader.b64;
      if (typeof b64 !== "boolean") {
        throw new JWSInvalid('The "b64" (base64url-encode payload) Header Parameter must be a boolean');
      }
    }
    const { alg } = joseHeader;
    if (typeof alg !== "string" || !alg) {
      throw new JWSInvalid('JWS "alg" (Algorithm) Header Parameter missing or invalid');
    }
    checkKeyTypeWithJwk(alg, key, "sign");
    let payload = this._payload;
    if (b64) {
      payload = encoder.encode(encode(payload));
    }
    let protectedHeader;
    if (this._protectedHeader) {
      protectedHeader = encoder.encode(encode(JSON.stringify(this._protectedHeader)));
    } else {
      protectedHeader = encoder.encode("");
    }
    const data = concat(protectedHeader, encoder.encode("."), payload);
    const signature = await sign_default(alg, key, data);
    const jws = {
      signature: encode(signature),
      payload: ""
    };
    if (b64) {
      jws.payload = decoder.decode(payload);
    }
    if (this._unprotectedHeader) {
      jws.header = this._unprotectedHeader;
    }
    if (this._protectedHeader) {
      jws.protected = decoder.decode(protectedHeader);
    }
    return jws;
  }
};
__name(FlattenedSign, "FlattenedSign");

// node_modules/jose/dist/browser/jws/compact/sign.js
var CompactSign = class {
  constructor(payload) {
    this._flattened = new FlattenedSign(payload);
  }
  setProtectedHeader(protectedHeader) {
    this._flattened.setProtectedHeader(protectedHeader);
    return this;
  }
  async sign(key, options) {
    const jws = await this._flattened.sign(key, options);
    if (jws.payload === void 0) {
      throw new TypeError("use the flattened module for creating JWS with b64: false");
    }
    return `${jws.protected}.${jws.payload}.${jws.signature}`;
  }
};
__name(CompactSign, "CompactSign");

// node_modules/jose/dist/browser/jwt/produce.js
function validateInput(label, input) {
  if (!Number.isFinite(input)) {
    throw new TypeError(`Invalid ${label} input`);
  }
  return input;
}
__name(validateInput, "validateInput");
var ProduceJWT = class {
  constructor(payload = {}) {
    if (!isObject(payload)) {
      throw new TypeError("JWT Claims Set MUST be an object");
    }
    this._payload = payload;
  }
  setIssuer(issuer) {
    this._payload = { ...this._payload, iss: issuer };
    return this;
  }
  setSubject(subject) {
    this._payload = { ...this._payload, sub: subject };
    return this;
  }
  setAudience(audience) {
    this._payload = { ...this._payload, aud: audience };
    return this;
  }
  setJti(jwtId) {
    this._payload = { ...this._payload, jti: jwtId };
    return this;
  }
  setNotBefore(input) {
    if (typeof input === "number") {
      this._payload = { ...this._payload, nbf: validateInput("setNotBefore", input) };
    } else if (input instanceof Date) {
      this._payload = { ...this._payload, nbf: validateInput("setNotBefore", epoch_default(input)) };
    } else {
      this._payload = { ...this._payload, nbf: epoch_default(/* @__PURE__ */ new Date()) + secs_default(input) };
    }
    return this;
  }
  setExpirationTime(input) {
    if (typeof input === "number") {
      this._payload = { ...this._payload, exp: validateInput("setExpirationTime", input) };
    } else if (input instanceof Date) {
      this._payload = { ...this._payload, exp: validateInput("setExpirationTime", epoch_default(input)) };
    } else {
      this._payload = { ...this._payload, exp: epoch_default(/* @__PURE__ */ new Date()) + secs_default(input) };
    }
    return this;
  }
  setIssuedAt(input) {
    if (typeof input === "undefined") {
      this._payload = { ...this._payload, iat: epoch_default(/* @__PURE__ */ new Date()) };
    } else if (input instanceof Date) {
      this._payload = { ...this._payload, iat: validateInput("setIssuedAt", epoch_default(input)) };
    } else if (typeof input === "string") {
      this._payload = {
        ...this._payload,
        iat: validateInput("setIssuedAt", epoch_default(/* @__PURE__ */ new Date()) + secs_default(input))
      };
    } else {
      this._payload = { ...this._payload, iat: validateInput("setIssuedAt", input) };
    }
    return this;
  }
};
__name(ProduceJWT, "ProduceJWT");

// node_modules/jose/dist/browser/jwt/sign.js
var SignJWT = class extends ProduceJWT {
  setProtectedHeader(protectedHeader) {
    this._protectedHeader = protectedHeader;
    return this;
  }
  async sign(key, options) {
    const sig = new CompactSign(encoder.encode(JSON.stringify(this._payload)));
    sig.setProtectedHeader(this._protectedHeader);
    if (Array.isArray(this._protectedHeader?.crit) && this._protectedHeader.crit.includes("b64") && this._protectedHeader.b64 === false) {
      throw new JWTInvalid("JWTs MUST NOT use unencoded payload");
    }
    return sig.sign(key, options);
  }
};
__name(SignJWT, "SignJWT");

// src/middleware/auth.ts
var authMiddleware = /* @__PURE__ */ __name(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized - No token provided" }, 401);
  }
  const token = authHeader.substring(7);
  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub) {
      return c.json({ error: "Unauthorized - Invalid token" }, 401);
    }
    const db = c.get("db");
    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.sub)
    });
    if (!user) {
      return c.json({ error: "Unauthorized - User not found" }, 401);
    }
    c.set("user", user);
    await next();
  } catch (error) {
    console.error("Auth error:", error);
    return c.json({ error: "Unauthorized - Invalid token" }, 401);
  }
}, "authMiddleware");
var optionalAuthMiddleware = /* @__PURE__ */ __name(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    try {
      const secret = new TextEncoder().encode(c.env.JWT_SECRET);
      const { payload } = await jwtVerify(token, secret);
      if (payload.sub) {
        const db = c.get("db");
        const user = await db.query.users.findFirst({
          where: eq(users.id, payload.sub)
        });
        if (user) {
          c.set("user", user);
        }
      }
    } catch (error) {
      console.log("Optional auth failed:", error);
    }
  }
  await next();
}, "optionalAuthMiddleware");

// src/utils/password.ts
var ITERATIONS = 1e5;
var KEY_LENGTH = 64;
var SALT_LENGTH = 16;
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: ITERATIONS,
      hash: "SHA-256"
    },
    passwordKey,
    KEY_LENGTH * 8
  );
  const hashArray = new Uint8Array(hashBuffer);
  const combined = new Uint8Array(salt.length + hashArray.length);
  combined.set(salt);
  combined.set(hashArray, salt.length);
  return btoa(String.fromCharCode(...combined));
}
__name(hashPassword, "hashPassword");
async function verifyPassword(password, storedHash) {
  try {
    const combined = Uint8Array.from(atob(storedHash), (c) => c.charCodeAt(0));
    const salt = combined.slice(0, SALT_LENGTH);
    const storedHashBytes = combined.slice(SALT_LENGTH);
    const passwordKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations: ITERATIONS,
        hash: "SHA-256"
      },
      passwordKey,
      KEY_LENGTH * 8
    );
    const hashArray = new Uint8Array(hashBuffer);
    if (hashArray.length !== storedHashBytes.length) {
      return false;
    }
    let result = 0;
    for (let i = 0; i < hashArray.length; i++) {
      result |= hashArray[i] ^ storedHashBytes[i];
    }
    return result === 0;
  } catch (error) {
    console.error("Password verification error:", error);
    return false;
  }
}
__name(verifyPassword, "verifyPassword");

// src/routes/auth.ts
var authRoutes = new Hono2();
var generateId = /* @__PURE__ */ __name(() => crypto.randomUUID(), "generateId");
var generateToken = /* @__PURE__ */ __name(async (userId, secret) => {
  const secretKey = new TextEncoder().encode(secret);
  return new SignJWT({ sub: userId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(secretKey);
}, "generateToken");
authRoutes.post("/register", async (c) => {
  try {
    const { email, password, username } = await c.req.json();
    if (!email || !password || !username) {
      return c.json({ error: "Email, password, and username are required" }, 400);
    }
    if (password.length < 8) {
      return c.json({ error: "Password must be at least 8 characters" }, 400);
    }
    const db = c.get("db");
    const existingEmail = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase())
    });
    if (existingEmail) {
      return c.json({ error: "Email already registered" }, 400);
    }
    const existingUsername = await db.query.users.findFirst({
      where: eq(users.username, username)
    });
    if (existingUsername) {
      return c.json({ error: "Username already taken" }, 400);
    }
    const passwordHash = await hashPassword(password);
    const userId = generateId();
    await db.insert(users).values({
      id: userId,
      email: email.toLowerCase(),
      passwordHash,
      username
    });
    const token = await generateToken(userId, c.env.JWT_SECRET);
    return c.json({
      user: {
        id: userId,
        email: email.toLowerCase(),
        username
      },
      token
    }, 201);
  } catch (error) {
    console.error("Registration error:", error);
    return c.json({ error: "Registration failed" }, 500);
  }
});
authRoutes.post("/login", async (c) => {
  try {
    const { email, password } = await c.req.json();
    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }
    const db = c.get("db");
    const user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase())
    });
    if (!user) {
      return c.json({ error: "Invalid email or password" }, 401);
    }
    const validPassword = await verifyPassword(password, user.passwordHash);
    if (!validPassword) {
      return c.json({ error: "Invalid email or password" }, 401);
    }
    const token = await generateToken(user.id, c.env.JWT_SECRET);
    return c.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatarUrl: user.avatarUrl
      },
      token
    });
  } catch (error) {
    console.error("Login error:", error);
    return c.json({ error: "Login failed" }, 500);
  }
});
authRoutes.get("/me", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Not authenticated" }, 401);
  }
  const db = c.get("db");
  const memberships = await db.query.leagueMembers.findMany({
    where: eq(leagueMembers.userId, user.id),
    with: {
      league: true
    }
  });
  return c.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt
    },
    leagues: memberships.map((m) => ({
      ...m.league,
      role: m.role
    }))
  });
});
authRoutes.put("/profile", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const { username, avatarUrl } = await c.req.json();
    if (!user) {
      return c.json({ error: "Not authenticated" }, 401);
    }
    const db = c.get("db");
    if (username && username !== user.username) {
      const existingUsername = await db.query.users.findFirst({
        where: eq(users.username, username)
      });
      if (existingUsername) {
        return c.json({ error: "Username already taken" }, 400);
      }
    }
    await db.update(users).set({
      username: username || user.username,
      avatarUrl: avatarUrl ?? user.avatarUrl,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(users.id, user.id));
    return c.json({
      user: {
        id: user.id,
        email: user.email,
        username: username || user.username,
        avatarUrl: avatarUrl ?? user.avatarUrl
      }
    });
  } catch (error) {
    console.error("Profile update error:", error);
    return c.json({ error: "Profile update failed" }, 500);
  }
});
authRoutes.post("/change-password", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const { currentPassword, newPassword } = await c.req.json();
    if (!user) {
      return c.json({ error: "Not authenticated" }, 401);
    }
    if (!currentPassword || !newPassword) {
      return c.json({ error: "Current password and new password are required" }, 400);
    }
    if (newPassword.length < 8) {
      return c.json({ error: "New password must be at least 8 characters" }, 400);
    }
    const db = c.get("db");
    const validPassword = await verifyPassword(currentPassword, user.passwordHash);
    if (!validPassword) {
      return c.json({ error: "Current password is incorrect" }, 401);
    }
    const passwordHash = await hashPassword(newPassword);
    await db.update(users).set({
      passwordHash,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(users.id, user.id));
    return c.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Password change error:", error);
    return c.json({ error: "Password change failed" }, 500);
  }
});
authRoutes.post("/forgot-password", async (c) => {
  try {
    const { email } = await c.req.json();
    if (!email) {
      return c.json({ error: "Email is required" }, 400);
    }
    return c.json({
      message: "If an account exists with that email, a password reset link will be sent."
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return c.json({ error: "Request failed" }, 500);
  }
});

// src/routes/leagues.ts
var leagueRoutes = new Hono2();
var generateId2 = /* @__PURE__ */ __name(() => crypto.randomUUID(), "generateId");
leagueRoutes.get("/", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  if (!user) {
    return c.json({ error: "Not authenticated" }, 401);
  }
  const memberships = await db.query.leagueMembers.findMany({
    where: eq(leagueMembers.userId, user.id),
    with: {
      league: {
        with: {
          teams: true
        }
      }
    }
  });
  const leagues2 = memberships.map((m) => ({
    ...m.league,
    role: m.role,
    teamCount: m.league.teams.length
  }));
  return c.json({ leagues: leagues2 });
});
leagueRoutes.post("/", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  if (!user) {
    return c.json({ error: "Not authenticated" }, 401);
  }
  try {
    const body = await c.req.json();
    const {
      name,
      scoringFormat = "ppr",
      teamCount = 12,
      seasonYear = (/* @__PURE__ */ new Date()).getFullYear(),
      playoffWeeks = 3,
      playoffTeams = 6,
      waiverType = "faab",
      waiverBudget = 100
    } = body;
    if (!name) {
      return c.json({ error: "League name is required" }, 400);
    }
    const leagueId = generateId2();
    await db.insert(leagues).values({
      id: leagueId,
      name,
      scoringFormat,
      teamCount,
      seasonYear,
      playoffWeeks,
      playoffTeams,
      waiverType,
      waiverBudget
    });
    await db.insert(leagueMembers).values({
      id: generateId2(),
      userId: user.id,
      leagueId,
      role: "commissioner"
    });
    const teamId = generateId2();
    await db.insert(teams).values({
      id: teamId,
      leagueId,
      ownerId: user.id,
      name: `${user.username}'s Team`,
      waiverPriority: 1,
      faabBudget: waiverBudget
    });
    const league = await db.query.leagues.findFirst({
      where: eq(leagues.id, leagueId)
    });
    return c.json({ league, teamId }, 201);
  } catch (error) {
    console.error("Create league error:", error);
    return c.json({ error: "Failed to create league" }, 500);
  }
});
leagueRoutes.get("/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const leagueId = c.req.param("id");
  if (!user) {
    return c.json({ error: "Not authenticated" }, 401);
  }
  const membership = await db.query.leagueMembers.findFirst({
    where: and(
      eq(leagueMembers.userId, user.id),
      eq(leagueMembers.leagueId, leagueId)
    )
  });
  if (!membership) {
    return c.json({ error: "Not a member of this league" }, 403);
  }
  const league = await db.query.leagues.findFirst({
    where: eq(leagues.id, leagueId),
    with: {
      teams: {
        with: {
          owner: true
        }
      },
      members: {
        with: {
          user: true
        }
      }
    }
  });
  if (!league) {
    return c.json({ error: "League not found" }, 404);
  }
  let userSleeperUserId = null;
  if (league.platform === "sleeper" && league.externalId && membership.externalUsername) {
    try {
      const usersRes = await fetch(`https://api.sleeper.app/v1/league/${league.externalId}/users`);
      if (usersRes.ok) {
        const sleeperUsers = await usersRes.json();
        for (const su of sleeperUsers) {
          if (su.display_name?.toLowerCase() === membership.externalUsername.toLowerCase() || su.username?.toLowerCase() === membership.externalUsername.toLowerCase()) {
            userSleeperUserId = su.user_id;
            break;
          }
        }
      }
    } catch (e) {
      console.error("Failed to fetch Sleeper users for league:", e);
    }
  }
  return c.json({
    league: {
      ...league,
      role: membership.role,
      teams: league.teams.map((t) => {
        const isCurrentUserTeam = userSleeperUserId != null && t.externalOwnerId === userSleeperUserId;
        return {
          id: t.id,
          name: t.name,
          wins: t.wins,
          losses: t.losses,
          ties: t.ties,
          pointsFor: t.pointsFor,
          pointsAgainst: t.pointsAgainst,
          externalOwnerId: t.externalOwnerId,
          isCurrentUserTeam,
          owner: {
            id: t.owner.id,
            username: t.owner.username,
            avatarUrl: t.owner.avatarUrl
          }
        };
      })
    }
  });
});
leagueRoutes.put("/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const leagueId = c.req.param("id");
  if (!user) {
    return c.json({ error: "Not authenticated" }, 401);
  }
  const membership = await db.query.leagueMembers.findFirst({
    where: and(
      eq(leagueMembers.userId, user.id),
      eq(leagueMembers.leagueId, leagueId),
      eq(leagueMembers.role, "commissioner")
    )
  });
  if (!membership) {
    return c.json({ error: "Only commissioners can update league settings" }, 403);
  }
  try {
    const body = await c.req.json();
    const allowedUpdates = [
      "name",
      "scoringFormat",
      "currentWeek",
      "tradeDeadline",
      "playoffWeeks",
      "playoffTeams",
      "waiverType",
      "waiverBudget"
    ];
    const updates = {};
    for (const key of allowedUpdates) {
      if (body[key] !== void 0) {
        updates[key] = body[key];
      }
    }
    updates.updatedAt = /* @__PURE__ */ new Date();
    await db.update(leagues).set(updates).where(eq(leagues.id, leagueId));
    const league = await db.query.leagues.findFirst({
      where: eq(leagues.id, leagueId)
    });
    return c.json({ league });
  } catch (error) {
    console.error("Update league error:", error);
    return c.json({ error: "Failed to update league" }, 500);
  }
});
leagueRoutes.post("/:id/join", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const leagueId = c.req.param("id");
  if (!user) {
    return c.json({ error: "Not authenticated" }, 401);
  }
  const existingMembership = await db.query.leagueMembers.findFirst({
    where: and(
      eq(leagueMembers.userId, user.id),
      eq(leagueMembers.leagueId, leagueId)
    )
  });
  if (existingMembership) {
    return c.json({ error: "Already a member of this league" }, 400);
  }
  const league = await db.query.leagues.findFirst({
    where: eq(leagues.id, leagueId),
    with: {
      teams: true
    }
  });
  if (!league) {
    return c.json({ error: "League not found" }, 404);
  }
  if (league.teams.length >= league.teamCount) {
    return c.json({ error: "League is full" }, 400);
  }
  try {
    const body = await c.req.json();
    const { teamName } = body;
    await db.insert(leagueMembers).values({
      id: generateId2(),
      userId: user.id,
      leagueId,
      role: "member"
    });
    const teamId = generateId2();
    await db.insert(teams).values({
      id: teamId,
      leagueId,
      ownerId: user.id,
      name: teamName || `${user.username}'s Team`,
      waiverPriority: league.teams.length + 1,
      faabBudget: league.waiverBudget || 100
    });
    return c.json({ message: "Joined league successfully", teamId }, 201);
  } catch (error) {
    console.error("Join league error:", error);
    return c.json({ error: "Failed to join league" }, 500);
  }
});
leagueRoutes.post("/connect", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  if (!user) {
    return c.json({ error: "Not authenticated" }, 401);
  }
  try {
    const body = await c.req.json();
    const {
      platform,
      externalId,
      name,
      scoringFormat = "ppr",
      teamCount = 12,
      seasonYear = (/* @__PURE__ */ new Date()).getFullYear(),
      sleeperUsername
      // User's Sleeper username to identify their team
    } = body;
    if (!platform || !externalId || !name) {
      return c.json({ error: "Platform, external ID, and name are required" }, 400);
    }
    const existingLeague = await db.query.leagues.findFirst({
      where: and(
        eq(leagues.platform, platform),
        eq(leagues.externalId, externalId)
      )
    });
    if (existingLeague) {
      const existingMembership = await db.query.leagueMembers.findFirst({
        where: and(
          eq(leagueMembers.userId, user.id),
          eq(leagueMembers.leagueId, existingLeague.id)
        )
      });
      if (existingMembership) {
        return c.json({ error: "You have already connected this league" }, 400);
      }
      await db.insert(leagueMembers).values({
        id: generateId2(),
        userId: user.id,
        leagueId: existingLeague.id,
        role: "member",
        externalUsername: sleeperUsername || null
      });
      const teamId2 = generateId2();
      await db.insert(teams).values({
        id: teamId2,
        leagueId: existingLeague.id,
        ownerId: user.id,
        name: `${user.username}'s Team`,
        waiverPriority: 1,
        faabBudget: 100
      });
      return c.json({
        league: existingLeague,
        team: { id: teamId2, name: `${user.username}'s Team` }
      }, 201);
    }
    const leagueId = generateId2();
    await db.insert(leagues).values({
      id: leagueId,
      name,
      platform,
      externalId,
      scoringFormat,
      teamCount,
      seasonYear,
      waiverType: "faab",
      waiverBudget: 100
    });
    await db.insert(leagueMembers).values({
      id: generateId2(),
      userId: user.id,
      leagueId,
      role: "commissioner",
      externalUsername: sleeperUsername || null
    });
    const teamId = generateId2();
    await db.insert(teams).values({
      id: teamId,
      leagueId,
      ownerId: user.id,
      name: `${user.username}'s Team`,
      waiverPriority: 1,
      faabBudget: 100
    });
    const league = await db.query.leagues.findFirst({
      where: eq(leagues.id, leagueId)
    });
    return c.json({
      league,
      team: { id: teamId, name: `${user.username}'s Team` }
    }, 201);
  } catch (error) {
    console.error("Connect league error:", error);
    return c.json({ error: "Failed to connect league" }, 500);
  }
});
leagueRoutes.post("/:id/sync", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const leagueId = c.req.param("id");
  if (!user) {
    return c.json({ error: "Not authenticated" }, 401);
  }
  const membership = await db.query.leagueMembers.findFirst({
    where: and(
      eq(leagueMembers.userId, user.id),
      eq(leagueMembers.leagueId, leagueId)
    )
  });
  if (!membership) {
    return c.json({ error: "Not a member of this league" }, 403);
  }
  const league = await db.query.leagues.findFirst({
    where: eq(leagues.id, leagueId),
    with: {
      teams: true
    }
  });
  if (!league) {
    return c.json({ error: "League not found" }, 404);
  }
  if (league.platform === "sleeper" && league.externalId) {
    try {
      const rostersResponse = await fetch(`https://api.sleeper.app/v1/league/${league.externalId}/rosters`);
      if (!rostersResponse.ok) {
        return c.json({ error: "Failed to fetch rosters from Sleeper" }, 500);
      }
      const rosters = await rostersResponse.json();
      const usersResponse = await fetch(`https://api.sleeper.app/v1/league/${league.externalId}/users`);
      if (!usersResponse.ok) {
        return c.json({ error: "Failed to fetch users from Sleeper" }, 500);
      }
      const sleeperUsers = await usersResponse.json();
      let sleeperPlayers = {};
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25e3);
        const playersResponse = await fetch("https://api.sleeper.app/v1/players/nfl", {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (playersResponse.ok) {
          sleeperPlayers = await playersResponse.json();
        }
      } catch (e) {
        console.error("Failed to fetch Sleeper players (sync continues with basic player names):", e);
      }
      const userMap = /* @__PURE__ */ new Map();
      for (const sleeperUser of sleeperUsers) {
        userMap.set(sleeperUser.user_id, sleeperUser);
      }
      const userTeam = league.teams.find((t) => t.ownerId === user.id);
      let userSleeperUserId = null;
      if (membership.externalUsername) {
        for (const sleeperUser of sleeperUsers) {
          if (sleeperUser.display_name?.toLowerCase() === membership.externalUsername.toLowerCase() || sleeperUser.username?.toLowerCase() === membership.externalUsername.toLowerCase()) {
            userSleeperUserId = sleeperUser.user_id;
            break;
          }
        }
      }
      let userRosterAssigned = false;
      for (const roster of rosters) {
        const sleeperUser = userMap.get(roster.owner_id);
        const teamName = sleeperUser?.metadata?.team_name || sleeperUser?.display_name || `Team ${roster.roster_id}`;
        const isUserTeam = userTeam && !userRosterAssigned && userSleeperUserId && roster.owner_id === userSleeperUserId;
        let team;
        if (isUserTeam) {
          team = userTeam;
          userRosterAssigned = true;
          await db.update(teams).set({
            externalOwnerId: String(roster.owner_id),
            name: teamName,
            wins: roster.settings?.wins || 0,
            losses: roster.settings?.losses || 0,
            ties: roster.settings?.ties || 0,
            pointsFor: roster.settings?.fpts || 0,
            pointsAgainst: roster.settings?.fpts_against || 0,
            waiverPriority: roster.settings?.waiver_position || 1,
            faabBudget: roster.settings?.waiver_budget_used != null ? (league.waiverBudget || 100) - roster.settings.waiver_budget_used : league.waiverBudget || 100,
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq(teams.id, team.id));
        } else {
          const existingTeam = league.teams.find(
            (t) => t.name === teamName || t.name.includes(`Roster ${roster.roster_id}`)
          );
          if (existingTeam) {
            team = existingTeam;
            await db.update(teams).set({
              externalOwnerId: String(roster.owner_id),
              name: teamName,
              wins: roster.settings?.wins || 0,
              losses: roster.settings?.losses || 0,
              ties: roster.settings?.ties || 0,
              pointsFor: roster.settings?.fpts || 0,
              pointsAgainst: roster.settings?.fpts_against || 0,
              waiverPriority: roster.settings?.waiver_position || 1,
              updatedAt: /* @__PURE__ */ new Date()
            }).where(eq(teams.id, team.id));
          } else {
            const teamId = generateId2();
            await db.insert(teams).values({
              id: teamId,
              leagueId: league.id,
              ownerId: user.id,
              externalOwnerId: String(roster.owner_id),
              name: teamName,
              wins: roster.settings?.wins || 0,
              losses: roster.settings?.losses || 0,
              ties: roster.settings?.ties || 0,
              pointsFor: roster.settings?.fpts || 0,
              pointsAgainst: roster.settings?.fpts_against || 0,
              waiverPriority: roster.settings?.waiver_position || 1,
              faabBudget: roster.settings?.waiver_budget_used != null ? (league.waiverBudget || 100) - roster.settings.waiver_budget_used : league.waiverBudget || 100
            });
            team = { id: teamId };
          }
        }
        if (roster.players && roster.players.length > 0 && (isUserTeam || team)) {
          await db.delete(rosterSpots).where(eq(rosterSpots.teamId, team.id));
          const starters = roster.starters || [];
          const starterSlots = ["QB", "RB1", "RB2", "WR1", "WR2", "TE", "FLEX", "K", "DEF"];
          for (let i = 0; i < roster.players.length; i++) {
            const playerId = roster.players[i];
            const isStarter = starters.includes(playerId);
            const starterIndex = starters.indexOf(playerId);
            let slot;
            if (isStarter && starterIndex >= 0 && starterIndex < starterSlots.length) {
              slot = starterSlots[starterIndex];
            } else {
              const benchIndex = roster.players.filter(
                (p, idx) => !starters.includes(p) && idx < i
              ).length;
              slot = `BN${benchIndex + 1}`;
            }
            let player = await db.query.nflPlayers.findFirst({
              where: eq(nflPlayers.externalId, playerId)
            });
            if (!player) {
              const playerData = sleeperPlayers[playerId];
              const newPlayerId = generateId2();
              await db.insert(nflPlayers).values({
                id: newPlayerId,
                externalId: playerId,
                name: playerData ? `${playerData.first_name || ""} ${playerData.last_name || ""}`.trim() || `Player ${playerId}` : `Player ${playerId}`,
                firstName: playerData?.first_name,
                lastName: playerData?.last_name,
                team: playerData?.team || "FA",
                position: playerData?.position || "UNK",
                status: playerData?.injury_status || "active",
                injuryNote: playerData?.injury_notes,
                injuryBodyPart: playerData?.injury_body_part,
                byeWeek: playerData?.bye_week,
                age: playerData?.age,
                height: playerData?.height,
                weight: playerData?.weight,
                college: playerData?.college,
                yearsExp: playerData?.years_exp,
                jerseyNumber: playerData?.number,
                depthChartOrder: playerData?.depth_chart_order
              });
              player = { id: newPlayerId };
            }
            if (player) {
              await db.insert(rosterSpots).values({
                id: generateId2(),
                teamId: team.id,
                playerId: player.id,
                slot,
                isStarter,
                acquiredType: "sync"
              });
            }
          }
        }
      }
      const rosterIdToTeamId = /* @__PURE__ */ new Map();
      const updatedTeams = await db.query.teams.findMany({
        where: eq(teams.leagueId, league.id)
      });
      for (const roster of rosters) {
        const sleeperUser = userMap.get(roster.owner_id);
        const teamName = sleeperUser?.metadata?.team_name || sleeperUser?.display_name || `Team ${roster.roster_id}`;
        const matchingTeam = updatedTeams.find((t) => t.name === teamName);
        if (matchingTeam) {
          rosterIdToTeamId.set(roster.roster_id, matchingTeam.id);
        }
      }
      let matchupsImported = 0;
      const currentWeek = league.currentWeek || 1;
      for (let week2 = 1; week2 <= currentWeek; week2++) {
        try {
          const matchupsResponse = await fetch(
            `https://api.sleeper.app/v1/league/${league.externalId}/matchups/${week2}`
          );
          if (matchupsResponse.ok) {
            const weekMatchups = await matchupsResponse.json();
            const matchupGroups = /* @__PURE__ */ new Map();
            for (const m of weekMatchups) {
              if (m.matchup_id) {
                if (!matchupGroups.has(m.matchup_id)) {
                  matchupGroups.set(m.matchup_id, []);
                }
                matchupGroups.get(m.matchup_id).push(m);
              }
            }
            for (const [matchupId, teams2] of matchupGroups) {
              if (teams2.length === 2) {
                const team1 = teams2[0];
                const team2 = teams2[1];
                const homeTeamId = rosterIdToTeamId.get(team1.roster_id);
                const awayTeamId = rosterIdToTeamId.get(team2.roster_id);
                if (homeTeamId && awayTeamId) {
                  const existingMatchup = await db.query.matchups.findFirst({
                    where: and(
                      eq(matchups.leagueId, league.id),
                      eq(matchups.week, week2),
                      eq(matchups.homeTeamId, homeTeamId)
                    )
                  });
                  if (!existingMatchup) {
                    await db.insert(matchups).values({
                      id: generateId2(),
                      leagueId: league.id,
                      week: week2,
                      homeTeamId,
                      awayTeamId,
                      homeScore: team1.points || 0,
                      awayScore: team2.points || 0,
                      homeProjectedScore: team1.projected_points || 0,
                      awayProjectedScore: team2.projected_points || 0,
                      isComplete: week2 < currentWeek,
                      isPlayoff: false,
                      isChampionship: false
                    });
                    matchupsImported++;
                  } else {
                    await db.update(matchups).set({
                      homeScore: team1.points || 0,
                      awayScore: team2.points || 0,
                      isComplete: week2 < currentWeek
                    }).where(eq(matchups.id, existingMatchup.id));
                  }
                }
              }
            }
          }
        } catch (e) {
          console.error(`Failed to fetch matchups for week ${week2}:`, e);
        }
      }
      let statsImported = 0;
      const allRosteredPlayerIds = /* @__PURE__ */ new Set();
      for (const roster of rosters) {
        if (roster.players) {
          for (const playerId of roster.players) {
            allRosteredPlayerIds.add(playerId);
          }
        }
      }
      for (let week2 = 1; week2 <= currentWeek; week2++) {
        try {
          const statsResponse = await fetch(
            `https://api.sleeper.com/stats/nfl/${league.seasonYear}/${week2}?season_type=regular`
          );
          if (!statsResponse.ok) {
            console.log(`No stats available for week ${week2}`);
            continue;
          }
          const weekStats = await statsResponse.json();
          for (const sleeperPlayerId of allRosteredPlayerIds) {
            const playerStats = weekStats[sleeperPlayerId];
            if (!playerStats)
              continue;
            const player = await db.query.nflPlayers.findFirst({
              where: eq(nflPlayers.externalId, sleeperPlayerId)
            });
            if (!player)
              continue;
            const existingStats = await db.query.playerWeeklyStats.findFirst({
              where: and(
                eq(playerWeeklyStats.playerId, player.id),
                eq(playerWeeklyStats.week, week2),
                eq(playerWeeklyStats.seasonYear, league.seasonYear)
              )
            });
            const statsData = {
              playerId: player.id,
              week: week2,
              seasonYear: league.seasonYear,
              opponent: playerStats.opponent || null,
              // Passing
              passAttempts: playerStats.pass_att || 0,
              passCompletions: playerStats.pass_cmp || 0,
              passYards: playerStats.pass_yd || 0,
              passTDs: playerStats.pass_td || 0,
              passInterceptions: playerStats.pass_int || 0,
              // Rushing
              rushAttempts: playerStats.rush_att || 0,
              rushYards: playerStats.rush_yd || 0,
              rushTDs: playerStats.rush_td || 0,
              // Receiving
              targets: playerStats.rec_tgt || 0,
              receptions: playerStats.rec || 0,
              receivingYards: playerStats.rec_yd || 0,
              receivingTDs: playerStats.rec_td || 0,
              // Misc
              fumbles: playerStats.fum || 0,
              fumblesLost: playerStats.fum_lost || 0,
              twoPointConversions: (playerStats.pass_2pt || 0) + (playerStats.rush_2pt || 0) + (playerStats.rec_2pt || 0),
              // Kicking
              fgMade: playerStats.fgm || 0,
              fgAttempts: playerStats.fga || 0,
              fg40PlusMade: (playerStats.fgm_40_49 || 0) + (playerStats.fgm_50p || 0),
              fg50PlusMade: playerStats.fgm_50p || 0,
              xpMade: playerStats.xpm || 0,
              xpAttempts: playerStats.xpa || 0,
              // Defense (for team defenses)
              sacks: playerStats.sack || 0,
              defInterceptions: playerStats.int || 0,
              fumblesRecovered: playerStats.fum_rec || 0,
              defenseTDs: (playerStats.def_td || 0) + (playerStats.st_td || 0),
              safeties: playerStats.safe || 0,
              pointsAllowed: playerStats.pts_allow || 0,
              // Fantasy Points (Sleeper provides these)
              fantasyPointsPPR: playerStats.pts_ppr || 0,
              fantasyPointsHalf: playerStats.pts_half_ppr || 0,
              fantasyPointsStd: playerStats.pts_std || 0
            };
            if (existingStats) {
              await db.update(playerWeeklyStats).set(statsData).where(eq(playerWeeklyStats.id, existingStats.id));
            } else {
              await db.insert(playerWeeklyStats).values({
                id: generateId2(),
                ...statsData
              });
              statsImported++;
            }
          }
        } catch (e) {
          console.error(`Failed to fetch stats for week ${week2}:`, e);
        }
      }
      let projectionsImported = 0;
      try {
        const projectionsResponse = await fetch(
          `https://api.sleeper.com/projections/nfl/${league.seasonYear}/${currentWeek}?season_type=regular`
        );
        if (projectionsResponse.ok) {
          const projections = await projectionsResponse.json();
          for (const [sleeperPlayerId, playerProj] of Object.entries(projections)) {
            if (!playerProj)
              continue;
            const player = await db.query.nflPlayers.findFirst({
              where: eq(nflPlayers.externalId, sleeperPlayerId)
            });
            if (!player)
              continue;
            const scoringFormat = league.scoringFormat || "ppr";
            const existingProj = await db.query.playerProjections.findFirst({
              where: and(
                eq(playerProjections.playerId, player.id),
                eq(playerProjections.week, currentWeek),
                eq(playerProjections.seasonYear, league.seasonYear),
                eq(playerProjections.scoringFormat, scoringFormat)
              )
            });
            const projData = {
              playerId: player.id,
              week: currentWeek,
              seasonYear: league.seasonYear,
              scoringFormat,
              projectedPoints: scoringFormat === "ppr" ? playerProj.pts_ppr || 0 : scoringFormat === "half_ppr" ? playerProj.pts_half_ppr || 0 : playerProj.pts_std || 0,
              projPassYards: playerProj.pass_yd || null,
              projPassTDs: playerProj.pass_td || null,
              projRushYards: playerProj.rush_yd || null,
              projRushTDs: playerProj.rush_td || null,
              projReceptions: playerProj.rec || null,
              projRecYards: playerProj.rec_yd || null,
              projRecTDs: playerProj.rec_td || null,
              updatedAt: /* @__PURE__ */ new Date()
            };
            if (existingProj) {
              await db.update(playerProjections).set(projData).where(eq(playerProjections.id, existingProj.id));
            } else {
              await db.insert(playerProjections).values({
                id: generateId2(),
                ...projData
              });
              projectionsImported++;
            }
          }
        }
      } catch (e) {
        console.error("Failed to fetch projections:", e);
      }
      return c.json({
        success: true,
        message: `League synced successfully from Sleeper. ${rosters.length} teams, ${matchupsImported} matchups, ${statsImported} player stats, and ${projectionsImported} projections updated.`,
        teamsUpdated: rosters.length,
        matchupsImported,
        statsImported,
        projectionsImported
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("Sleeper sync error:", err);
      return c.json({ error: err.message || "Failed to sync league from Sleeper" }, 500);
    }
  }
  return c.json({
    success: true,
    message: `League synced successfully from ${league.platform || "FilmRoom"}`
  });
});
leagueRoutes.delete("/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const leagueId = c.req.param("id");
  if (!user) {
    return c.json({ error: "Not authenticated" }, 401);
  }
  const membership = await db.query.leagueMembers.findFirst({
    where: and(
      eq(leagueMembers.userId, user.id),
      eq(leagueMembers.leagueId, leagueId)
    )
  });
  if (!membership) {
    return c.json({ error: "Not a member of this league" }, 403);
  }
  try {
    await db.delete(leagueMembers).where(
      and(
        eq(leagueMembers.userId, user.id),
        eq(leagueMembers.leagueId, leagueId)
      )
    );
    await db.delete(teams).where(
      and(
        eq(teams.ownerId, user.id),
        eq(teams.leagueId, leagueId)
      )
    );
    return c.json({ success: true });
  } catch (error) {
    console.error("Disconnect league error:", error);
    return c.json({ error: "Failed to disconnect league" }, 500);
  }
});
leagueRoutes.get("/:id/standings", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const leagueId = c.req.param("id");
  if (!user) {
    return c.json({ error: "Not authenticated" }, 401);
  }
  const membership = await db.query.leagueMembers.findFirst({
    where: and(
      eq(leagueMembers.userId, user.id),
      eq(leagueMembers.leagueId, leagueId)
    )
  });
  if (!membership) {
    return c.json({ error: "Not a member of this league" }, 403);
  }
  const teams2 = await db.query.teams.findMany({
    where: eq(teams.leagueId, leagueId),
    with: {
      owner: true
    }
  });
  const standings = teams2.map((t) => ({
    id: t.id,
    name: t.name,
    owner: {
      id: t.owner.id,
      username: t.owner.username
    },
    wins: t.wins,
    losses: t.losses,
    ties: t.ties,
    pointsFor: t.pointsFor,
    pointsAgainst: t.pointsAgainst,
    winPct: t.wins + t.losses + t.ties > 0 ? t.wins / (t.wins + t.losses + t.ties) : 0,
    streak: t.streak,
    playoffSeed: t.playoffSeed
  })).sort((a, b) => {
    if (b.wins !== a.wins)
      return b.wins - a.wins;
    return b.pointsFor - a.pointsFor;
  }).map((t, i) => ({ ...t, rank: i + 1 }));
  return c.json({ standings });
});

// src/routes/teams.ts
var teamRoutes = new Hono2();
var generateId3 = /* @__PURE__ */ __name(() => crypto.randomUUID(), "generateId");
async function getPlayerStatsSummary(db, playerId, seasonYear) {
  const stats = await db.query.playerWeeklyStats.findMany({
    where: and(
      eq(playerWeeklyStats.playerId, playerId),
      eq(playerWeeklyStats.seasonYear, seasonYear)
    )
  });
  if (stats.length === 0)
    return null;
  const totals = stats.reduce((acc, week2) => ({
    games: acc.games + 1,
    fantasyPointsPPR: acc.fantasyPointsPPR + (week2.fantasyPointsPPR || 0),
    fantasyPointsHalf: acc.fantasyPointsHalf + (week2.fantasyPointsHalf || 0),
    fantasyPointsStd: acc.fantasyPointsStd + (week2.fantasyPointsStd || 0),
    passYards: acc.passYards + (week2.passYards || 0),
    passTDs: acc.passTDs + (week2.passTDs || 0),
    rushYards: acc.rushYards + (week2.rushYards || 0),
    rushTDs: acc.rushTDs + (week2.rushTDs || 0),
    receptions: acc.receptions + (week2.receptions || 0),
    receivingYards: acc.receivingYards + (week2.receivingYards || 0),
    receivingTDs: acc.receivingTDs + (week2.receivingTDs || 0)
  }), {
    games: 0,
    fantasyPointsPPR: 0,
    fantasyPointsHalf: 0,
    fantasyPointsStd: 0,
    passYards: 0,
    passTDs: 0,
    rushYards: 0,
    rushTDs: 0,
    receptions: 0,
    receivingYards: 0,
    receivingTDs: 0
  });
  return {
    ...totals,
    avgPointsPPR: totals.games > 0 ? Math.round(totals.fantasyPointsPPR / totals.games * 10) / 10 : 0,
    avgPointsHalf: totals.games > 0 ? Math.round(totals.fantasyPointsHalf / totals.games * 10) / 10 : 0,
    avgPointsStd: totals.games > 0 ? Math.round(totals.fantasyPointsStd / totals.games * 10) / 10 : 0
  };
}
__name(getPlayerStatsSummary, "getPlayerStatsSummary");
teamRoutes.get("/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const teamId = c.req.param("id");
  if (!user) {
    return c.json({ error: "Not authenticated" }, 401);
  }
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    with: {
      owner: true,
      league: true,
      roster: {
        with: {
          player: true
        }
      }
    }
  });
  if (!team) {
    return c.json({ error: "Team not found" }, 404);
  }
  const membership = await db.query.leagueMembers.findFirst({
    where: and(
      eq(leagueMembers.userId, user.id),
      eq(leagueMembers.leagueId, team.leagueId)
    )
  });
  if (!membership) {
    return c.json({ error: "Not a member of this league" }, 403);
  }
  return c.json({
    team: {
      id: team.id,
      name: team.name,
      wins: team.wins,
      losses: team.losses,
      ties: team.ties,
      pointsFor: team.pointsFor,
      pointsAgainst: team.pointsAgainst,
      streak: team.streak,
      waiverPriority: team.waiverPriority,
      faabBudget: team.faabBudget,
      isOwner: team.ownerId === user.id,
      owner: {
        id: team.owner.id,
        username: team.owner.username,
        avatarUrl: team.owner.avatarUrl
      },
      league: {
        id: team.league.id,
        name: team.league.name,
        scoringFormat: team.league.scoringFormat
      },
      roster: team.roster.map((r) => ({
        id: r.id,
        slot: r.slot,
        isStarter: r.isStarter,
        acquiredAt: r.acquiredAt,
        acquiredType: r.acquiredType,
        player: {
          id: r.player.id,
          name: r.player.name,
          team: r.player.team,
          position: r.player.position,
          status: r.player.status,
          injuryNote: r.player.injuryNote,
          headshotUrl: r.player.headshotUrl,
          byeWeek: r.player.byeWeek
        }
      }))
    }
  });
});
teamRoutes.put("/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const teamId = c.req.param("id");
  if (!user) {
    return c.json({ error: "Not authenticated" }, 401);
  }
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId)
  });
  if (!team) {
    return c.json({ error: "Team not found" }, 404);
  }
  if (team.ownerId !== user.id) {
    return c.json({ error: "Only the team owner can update the team" }, 403);
  }
  try {
    const { name } = await c.req.json();
    if (name) {
      await db.update(teams).set({ name, updatedAt: /* @__PURE__ */ new Date() }).where(eq(teams.id, teamId));
    }
    const updatedTeam = await db.query.teams.findFirst({
      where: eq(teams.id, teamId)
    });
    return c.json({ team: updatedTeam });
  } catch (error) {
    console.error("Update team error:", error);
    return c.json({ error: "Failed to update team" }, 500);
  }
});
teamRoutes.get("/:id/roster", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const teamId = c.req.param("id");
  if (!user) {
    return c.json({ error: "Not authenticated" }, 401);
  }
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    with: {
      league: true
    }
  });
  if (!team) {
    return c.json({ error: "Team not found" }, 404);
  }
  const membership = await db.query.leagueMembers.findFirst({
    where: and(
      eq(leagueMembers.userId, user.id),
      eq(leagueMembers.leagueId, team.leagueId)
    )
  });
  if (!membership) {
    return c.json({ error: "Not a member of this league" }, 403);
  }
  const roster = await db.query.rosterSpots.findMany({
    where: eq(rosterSpots.teamId, teamId),
    with: {
      player: true
    }
  });
  const seasonYear = team.league?.seasonYear || (/* @__PURE__ */ new Date()).getFullYear();
  const scoringFormat = team.league?.scoringFormat || "ppr";
  const enrichedRoster = await Promise.all(roster.map(async (r) => {
    const seasonStats = await getPlayerStatsSummary(db, r.player.id, seasonYear);
    const projection = await db.query.playerProjections.findFirst({
      where: and(
        eq(playerProjections.playerId, r.player.id),
        eq(playerProjections.seasonYear, seasonYear),
        eq(playerProjections.scoringFormat, scoringFormat)
      ),
      orderBy: desc(playerProjections.week)
    });
    const lastWeekStats = await db.query.playerWeeklyStats.findFirst({
      where: and(
        eq(playerWeeklyStats.playerId, r.player.id),
        eq(playerWeeklyStats.seasonYear, seasonYear)
      ),
      orderBy: desc(playerWeeklyStats.week)
    });
    return {
      slot: r.slot,
      isStarter: r.isStarter,
      acquiredAt: r.acquiredAt,
      acquiredType: r.acquiredType,
      player: {
        ...r.player,
        // Season totals
        seasonStats: seasonStats ? {
          games: seasonStats.games,
          totalPoints: scoringFormat === "ppr" ? seasonStats.fantasyPointsPPR : scoringFormat === "half_ppr" ? seasonStats.fantasyPointsHalf : seasonStats.fantasyPointsStd,
          avgPoints: scoringFormat === "ppr" ? seasonStats.avgPointsPPR : scoringFormat === "half_ppr" ? seasonStats.avgPointsHalf : seasonStats.avgPointsStd,
          passYards: seasonStats.passYards,
          passTDs: seasonStats.passTDs,
          rushYards: seasonStats.rushYards,
          rushTDs: seasonStats.rushTDs,
          receptions: seasonStats.receptions,
          receivingYards: seasonStats.receivingYards,
          receivingTDs: seasonStats.receivingTDs
        } : null,
        // Current week projection
        projectedPoints: projection?.projectedPoints || 0,
        // Last week's actual points
        lastWeekPoints: lastWeekStats ? scoringFormat === "ppr" ? lastWeekStats.fantasyPointsPPR : scoringFormat === "half_ppr" ? lastWeekStats.fantasyPointsHalf : lastWeekStats.fantasyPointsStd : null
      }
    };
  }));
  const starters = enrichedRoster.filter((r) => r.isStarter);
  const bench = enrichedRoster.filter((r) => !r.isStarter);
  const projectedTotal = starters.reduce((sum, r) => sum + (r.player.projectedPoints || 0), 0);
  return c.json({
    roster: {
      starters,
      bench,
      projectedTotal: Math.round(projectedTotal * 10) / 10,
      scoringFormat
    }
  });
});
teamRoutes.put("/:id/roster", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const teamId = c.req.param("id");
  if (!user) {
    return c.json({ error: "Not authenticated" }, 401);
  }
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId)
  });
  if (!team) {
    return c.json({ error: "Team not found" }, 404);
  }
  if (team.ownerId !== user.id) {
    return c.json({ error: "Only the team owner can set the lineup" }, 403);
  }
  try {
    const { moves } = await c.req.json();
    for (const move of moves) {
      const { playerId, newSlot, isStarter } = move;
      await db.update(rosterSpots).set({
        slot: newSlot,
        isStarter: isStarter ?? false
      }).where(
        and(
          eq(rosterSpots.teamId, teamId),
          eq(rosterSpots.playerId, playerId)
        )
      );
    }
    return c.json({ message: "Lineup updated successfully" });
  } catch (error) {
    console.error("Set lineup error:", error);
    return c.json({ error: "Failed to update lineup" }, 500);
  }
});
teamRoutes.post("/:id/roster/add", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const teamId = c.req.param("id");
  if (!user) {
    return c.json({ error: "Not authenticated" }, 401);
  }
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    with: {
      roster: true
    }
  });
  if (!team) {
    return c.json({ error: "Team not found" }, 404);
  }
  if (team.ownerId !== user.id) {
    return c.json({ error: "Only the team owner can add players" }, 403);
  }
  try {
    const { playerId, slot, dropPlayerId } = await c.req.json();
    const player = await db.query.nflPlayers.findFirst({
      where: eq(nflPlayers.id, playerId)
    });
    if (!player) {
      return c.json({ error: "Player not found" }, 404);
    }
    const existingRoster = await db.query.rosterSpots.findFirst({
      where: eq(rosterSpots.playerId, playerId),
      with: {
        team: true
      }
    });
    if (existingRoster && existingRoster.team.leagueId === team.leagueId) {
      return c.json({ error: "Player is already on a team in this league" }, 400);
    }
    if (dropPlayerId) {
      await db.delete(rosterSpots).where(
        and(
          eq(rosterSpots.teamId, teamId),
          eq(rosterSpots.playerId, dropPlayerId)
        )
      );
    }
    await db.insert(rosterSpots).values({
      id: generateId3(),
      teamId,
      playerId,
      slot: slot || "BN1",
      isStarter: false,
      acquiredType: "free_agent"
    });
    return c.json({ message: "Player added successfully" }, 201);
  } catch (error) {
    console.error("Add player error:", error);
    return c.json({ error: "Failed to add player" }, 500);
  }
});
teamRoutes.delete("/:id/roster/:playerId", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const teamId = c.req.param("id");
  const playerId = c.req.param("playerId");
  if (!user) {
    return c.json({ error: "Not authenticated" }, 401);
  }
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId)
  });
  if (!team) {
    return c.json({ error: "Team not found" }, 404);
  }
  if (team.ownerId !== user.id) {
    return c.json({ error: "Only the team owner can drop players" }, 403);
  }
  try {
    const rosterSpot = await db.query.rosterSpots.findFirst({
      where: and(
        eq(rosterSpots.teamId, teamId),
        eq(rosterSpots.playerId, playerId)
      )
    });
    if (!rosterSpot) {
      return c.json({ error: "Player not on roster" }, 404);
    }
    await db.delete(rosterSpots).where(eq(rosterSpots.id, rosterSpot.id));
    return c.json({ message: "Player dropped successfully" });
  } catch (error) {
    console.error("Drop player error:", error);
    return c.json({ error: "Failed to drop player" }, 500);
  }
});

// src/routes/players.ts
var playerRoutes = new Hono2();
playerRoutes.get("/", optionalAuthMiddleware, async (c) => {
  const db = c.get("db");
  const page = parseInt(c.req.query("page") || "1");
  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 2e3);
  const offset = (page - 1) * limit;
  const position = c.req.query("position");
  const team = c.req.query("team");
  const search = c.req.query("search");
  const status = c.req.query("status");
  const sortBy = c.req.query("sortBy") || "name";
  const sortOrder = c.req.query("sortOrder") || "asc";
  const leagueId = c.req.query("leagueId");
  const includeStats = c.req.query("includeStats") === "true";
  const season = parseInt(c.req.query("season") || String((/* @__PURE__ */ new Date()).getFullYear()));
  try {
    const conditions = [];
    if (position && position !== "ALL") {
      conditions.push(eq(nflPlayers.position, position));
    }
    if (team) {
      conditions.push(eq(nflPlayers.team, team));
    }
    if (status) {
      conditions.push(eq(nflPlayers.status, status));
    }
    if (search) {
      conditions.push(like(nflPlayers.name, `%${search}%`));
    }
    const getSortColumn = /* @__PURE__ */ __name(() => {
      const columns = {
        name: nflPlayers.name,
        position: nflPlayers.position,
        team: nflPlayers.team,
        status: nflPlayers.status
      };
      return columns[sortBy] || nflPlayers.name;
    }, "getSortColumn");
    const players = await db.query.nflPlayers.findMany({
      where: conditions.length > 0 ? and(...conditions) : void 0,
      limit,
      offset,
      orderBy: sortOrder === "desc" ? desc(getSortColumn()) : asc(getSortColumn())
    });
    let rosteredPlayerIds = [];
    if (leagueId) {
      const teams2 = await db.query.teams.findMany({
        where: eq(teams.leagueId, leagueId),
        with: { roster: true }
      });
      rosteredPlayerIds = teams2.flatMap((t) => t.roster.map((r) => r.playerId));
    }
    let enrichedPlayers = players;
    if (includeStats && players.length > 0) {
      const playerIds = players.map((p) => p.id);
      const CHUNK = 99;
      const allStats = [];
      const allProjections = [];
      for (let i = 0; i < playerIds.length; i += CHUNK) {
        const chunk = playerIds.slice(i, i + CHUNK);
        const [statsChunk, projChunk] = await Promise.all([
          db.query.playerWeeklyStats.findMany({
            where: and(
              inArray(playerWeeklyStats.playerId, chunk),
              eq(playerWeeklyStats.seasonYear, season)
            )
          }),
          db.query.playerProjections.findMany({
            where: and(
              inArray(playerProjections.playerId, chunk),
              eq(playerProjections.seasonYear, season)
            ),
            orderBy: desc(playerProjections.week)
          })
        ]);
        allStats.push(...statsChunk);
        allProjections.push(...projChunk);
      }
      const statsByPlayer = /* @__PURE__ */ new Map();
      for (const s of allStats) {
        const list = statsByPlayer.get(s.playerId) || [];
        list.push(s);
        statsByPlayer.set(s.playerId, list);
      }
      const projectionByPlayer = /* @__PURE__ */ new Map();
      for (const p of allProjections) {
        if (!projectionByPlayer.has(p.playerId))
          projectionByPlayer.set(p.playerId, p);
      }
      enrichedPlayers = players.map((player) => {
        const stats = statsByPlayer.get(player.id) || [];
        const seasonStats = stats.reduce((acc, week2) => ({
          games: acc.games + 1,
          fantasyPointsPPR: acc.fantasyPointsPPR + (week2.fantasyPointsPPR || 0),
          fantasyPointsHalf: acc.fantasyPointsHalf + (week2.fantasyPointsHalf || 0),
          fantasyPointsStd: acc.fantasyPointsStd + (week2.fantasyPointsStd || 0),
          passYards: acc.passYards + (week2.passYards || 0),
          passTDs: acc.passTDs + (week2.passTDs || 0),
          rushYards: acc.rushYards + (week2.rushYards || 0),
          rushTDs: acc.rushTDs + (week2.rushTDs || 0),
          receptions: acc.receptions + (week2.receptions || 0),
          receivingYards: acc.receivingYards + (week2.receivingYards || 0),
          receivingTDs: acc.receivingTDs + (week2.receivingTDs || 0)
        }), {
          games: 0,
          fantasyPointsPPR: 0,
          fantasyPointsHalf: 0,
          fantasyPointsStd: 0,
          passYards: 0,
          passTDs: 0,
          rushYards: 0,
          rushTDs: 0,
          receptions: 0,
          receivingYards: 0,
          receivingTDs: 0
        });
        const projection = projectionByPlayer.get(player.id);
        return {
          ...player,
          seasonStats,
          avgPointsPPR: seasonStats.games > 0 ? Math.round(seasonStats.fantasyPointsPPR / seasonStats.games * 10) / 10 : 0,
          projectedPoints: projection?.projectedPoints || 0,
          isRostered: rosteredPlayerIds.includes(player.id)
        };
      });
    } else {
      enrichedPlayers = players.map((player) => ({
        ...player,
        isRostered: rosteredPlayerIds.includes(player.id)
      }));
    }
    const countResult = await db.select({ count: sql`count(*)` }).from(nflPlayers).where(conditions.length > 0 ? and(...conditions) : void 0);
    const total = countResult[0]?.count || 0;
    return c.json({
      players: enrichedPlayers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Get players error:", error);
    return c.json({ error: "Failed to fetch players" }, 500);
  }
});
playerRoutes.get("/search", optionalAuthMiddleware, async (c) => {
  const db = c.get("db");
  const query = c.req.query("q");
  if (!query || query.length < 2) {
    return c.json({ players: [] });
  }
  try {
    const players = await db.query.nflPlayers.findMany({
      where: like(nflPlayers.name, `%${query}%`),
      limit: 20
    });
    return c.json({ players });
  } catch (error) {
    console.error("Search players error:", error);
    return c.json({ error: "Search failed" }, 500);
  }
});
playerRoutes.get("/news", optionalAuthMiddleware, async (c) => {
  const db = c.get("db");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 50);
  try {
    const news = await db.query.playerNews.findMany({
      orderBy: desc(playerNews.publishedAt),
      limit,
      with: {
        player: true
      }
    });
    return c.json({ news });
  } catch (error) {
    console.error("Get all news error:", error);
    return c.json({ error: "Failed to fetch news" }, 500);
  }
});
playerRoutes.get("/trending", optionalAuthMiddleware, async (c) => {
  const db = c.get("db");
  const direction = c.req.query("direction") || "up";
  try {
    const players = await db.query.nflPlayers.findMany({
      where: eq(nflPlayers.status, "active"),
      limit: 10
    });
    return c.json({
      trending: players.map((p, i) => ({
        ...p,
        trendDirection: direction,
        trendValue: direction === "up" ? 100 - i * 5 : i * 5 + 10,
        ownedPct: Math.floor(Math.random() * 60) + 20
      }))
    });
  } catch (error) {
    console.error("Get trending error:", error);
    return c.json({ error: "Failed to fetch trending players" }, 500);
  }
});
playerRoutes.get("/stats/available-years", optionalAuthMiddleware, async (c) => {
  const db = c.get("db");
  try {
    const result = await db.select({ seasonYear: playerWeeklyStats.seasonYear }).from(playerWeeklyStats).groupBy(playerWeeklyStats.seasonYear).orderBy(desc(playerWeeklyStats.seasonYear));
    const years = result.map((r) => r.seasonYear).filter((y) => y != null);
    return c.json({
      years: years.length > 0 ? years : [2024, 2023],
      latest: years[0] ?? 2024
    });
  } catch (error) {
    console.error("Get available years error:", error);
    return c.json({ years: [2024, 2023], latest: 2024 });
  }
});
playerRoutes.get("/:id", optionalAuthMiddleware, async (c) => {
  const db = c.get("db");
  const playerId = c.req.param("id");
  try {
    const player = await db.query.nflPlayers.findFirst({
      where: eq(nflPlayers.id, playerId),
      with: {
        news: {
          orderBy: desc(playerNews.publishedAt),
          limit: 5
        }
      }
    });
    if (!player) {
      return c.json({ error: "Player not found" }, 404);
    }
    return c.json({ player });
  } catch (error) {
    console.error("Get player error:", error);
    return c.json({ error: "Failed to fetch player" }, 500);
  }
});
playerRoutes.get("/:id/stats", optionalAuthMiddleware, async (c) => {
  const db = c.get("db");
  let playerId = c.req.param("id");
  try {
    const seasonParam = c.req.query("season") || "latest";
    let season;
    if (seasonParam === "latest") {
      const maxResult = await db.select({ maxYear: sql`max(${playerWeeklyStats.seasonYear})` }).from(playerWeeklyStats);
      season = maxResult[0]?.maxYear ?? 2024;
    } else {
      const parsed = parseInt(seasonParam);
      season = isNaN(parsed) ? 2024 : parsed;
    }
    let stats = await db.query.playerWeeklyStats.findMany({
      where: and(
        eq(playerWeeklyStats.playerId, playerId),
        eq(playerWeeklyStats.seasonYear, season)
      ),
      orderBy: asc(playerWeeklyStats.week)
    });
    if (stats.length === 0 && /^\d+$/.test(playerId)) {
      const player = await db.query.nflPlayers.findFirst({
        where: eq(nflPlayers.externalId, playerId)
      });
      if (player) {
        playerId = player.id;
        stats = await db.query.playerWeeklyStats.findMany({
          where: and(
            eq(playerWeeklyStats.playerId, playerId),
            eq(playerWeeklyStats.seasonYear, season)
          ),
          orderBy: asc(playerWeeklyStats.week)
        });
      }
    }
    if (stats.length === 0 && season >= 2023) {
      stats = await db.query.playerWeeklyStats.findMany({
        where: and(
          eq(playerWeeklyStats.playerId, playerId),
          eq(playerWeeklyStats.seasonYear, season - 1)
        ),
        orderBy: asc(playerWeeklyStats.week)
      });
    }
    const seasonTotals = stats.reduce(
      (acc, week2) => ({
        games: acc.games + 1,
        passYards: acc.passYards + (week2.passYards || 0),
        passTDs: acc.passTDs + (week2.passTDs || 0),
        passInterceptions: acc.passInterceptions + (week2.passInterceptions || 0),
        rushYards: acc.rushYards + (week2.rushYards || 0),
        rushTDs: acc.rushTDs + (week2.rushTDs || 0),
        receptions: acc.receptions + (week2.receptions || 0),
        receivingYards: acc.receivingYards + (week2.receivingYards || 0),
        receivingTDs: acc.receivingTDs + (week2.receivingTDs || 0),
        targets: acc.targets + (week2.targets || 0),
        fantasyPointsPPR: acc.fantasyPointsPPR + (week2.fantasyPointsPPR || 0),
        fantasyPointsHalf: acc.fantasyPointsHalf + (week2.fantasyPointsHalf || 0),
        fantasyPointsStd: acc.fantasyPointsStd + (week2.fantasyPointsStd || 0)
      }),
      {
        games: 0,
        passYards: 0,
        passTDs: 0,
        passInterceptions: 0,
        rushYards: 0,
        rushTDs: 0,
        receptions: 0,
        receivingYards: 0,
        receivingTDs: 0,
        targets: 0,
        fantasyPointsPPR: 0,
        fantasyPointsHalf: 0,
        fantasyPointsStd: 0
      }
    );
    const toCamel = /* @__PURE__ */ __name((key) => key.replace(/_([a-z])/g, (_, c2) => c2.toUpperCase()), "toCamel");
    const normalize = /* @__PURE__ */ __name((row) => {
      const out = {};
      for (const [k, v] of Object.entries(row)) {
        out[k.includes("_") ? toCamel(k) : k] = v;
      }
      return out;
    }, "normalize");
    const normalizedStats = stats.map(normalize);
    return c.json({
      weeklyStats: normalizedStats,
      seasonTotals,
      resolvedSeason: season,
      averagePointsPPR: seasonTotals.games > 0 ? Math.round(seasonTotals.fantasyPointsPPR / seasonTotals.games * 10) / 10 : 0
    });
  } catch (error) {
    console.error("Get player stats error:", error);
    return c.json({ error: "Failed to fetch player stats" }, 500);
  }
});
playerRoutes.get("/:id/projections", optionalAuthMiddleware, async (c) => {
  const db = c.get("db");
  const playerId = c.req.param("id");
  const week2 = c.req.query("week");
  const season = parseInt(c.req.query("season") || String((/* @__PURE__ */ new Date()).getFullYear()));
  const scoringFormat = c.req.query("format") || "ppr";
  try {
    const conditions = [
      eq(playerProjections.playerId, playerId),
      eq(playerProjections.seasonYear, season),
      eq(playerProjections.scoringFormat, scoringFormat)
    ];
    if (week2) {
      conditions.push(eq(playerProjections.week, parseInt(week2)));
    }
    const projections = await db.query.playerProjections.findMany({
      where: and(...conditions),
      orderBy: asc(playerProjections.week)
    });
    return c.json({ projections });
  } catch (error) {
    console.error("Get player projections error:", error);
    return c.json({ error: "Failed to fetch projections" }, 500);
  }
});
playerRoutes.get("/:id/news", optionalAuthMiddleware, async (c) => {
  const db = c.get("db");
  const playerId = c.req.param("id");
  try {
    const news = await db.query.playerNews.findMany({
      where: eq(playerNews.playerId, playerId),
      orderBy: desc(playerNews.publishedAt),
      limit: 20
    });
    return c.json({ news });
  } catch (error) {
    console.error("Get player news error:", error);
    return c.json({ error: "Failed to fetch player news" }, 500);
  }
});
playerRoutes.get("/available/:leagueId", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const leagueId = c.req.param("leagueId");
  if (!user) {
    return c.json({ error: "Not authenticated" }, 401);
  }
  const membership = await db.query.leagueMembers.findFirst({
    where: and(
      eq(leagueMembers.userId, user.id),
      eq(leagueMembers.leagueId, leagueId)
    )
  });
  if (!membership) {
    return c.json({ error: "Not a member of this league" }, 403);
  }
  try {
    const teams2 = await db.query.teams.findMany({
      where: eq(teams.leagueId, leagueId),
      with: {
        roster: true
      }
    });
    const rosteredPlayerIds = teams2.flatMap((t) => t.roster.map((r) => r.playerId));
    const allPlayers = await db.query.nflPlayers.findMany({
      where: eq(nflPlayers.status, "active")
    });
    const availablePlayers = allPlayers.filter(
      (p) => !rosteredPlayerIds.includes(p.id)
    );
    return c.json({ players: availablePlayers });
  } catch (error) {
    console.error("Get available players error:", error);
    return c.json({ error: "Failed to fetch available players" }, 500);
  }
});

// src/routes/matchups.ts
var matchupRoutes = new Hono2();
matchupRoutes.get("/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const matchupId = c.req.param("id");
  if (!user) {
    return c.json({ error: "Not authenticated" }, 401);
  }
  try {
    const matchup = await db.query.matchups.findFirst({
      where: eq(matchups.id, matchupId),
      with: {
        league: true,
        homeTeam: {
          with: {
            owner: true,
            roster: {
              with: {
                player: true
              }
            }
          }
        },
        awayTeam: {
          with: {
            owner: true,
            roster: {
              with: {
                player: true
              }
            }
          }
        }
      }
    });
    if (!matchup) {
      return c.json({ error: "Matchup not found" }, 404);
    }
    const membership = await db.query.leagueMembers.findFirst({
      where: and(
        eq(leagueMembers.userId, user.id),
        eq(leagueMembers.leagueId, matchup.leagueId)
      )
    });
    if (!membership) {
      return c.json({ error: "Not a member of this league" }, 403);
    }
    const formatTeam = /* @__PURE__ */ __name((team, score, projectedScore) => ({
      id: team.id,
      name: team.name,
      owner: {
        id: team.owner.id,
        username: team.owner.username,
        avatarUrl: team.owner.avatarUrl
      },
      record: `${team.wins}-${team.losses}${team.ties > 0 ? `-${team.ties}` : ""}`,
      score: score || 0,
      projectedScore: projectedScore || 0,
      starters: team.roster.filter((r) => r.isStarter).map((r) => ({
        slot: r.slot,
        player: {
          id: r.player.id,
          name: r.player.name,
          team: r.player.team,
          position: r.player.position,
          status: r.player.status,
          headshotUrl: r.player.headshotUrl
        },
        points: 0,
        // Would come from weekly stats
        projectedPoints: 0
        // Would come from projections
      })),
      bench: team.roster.filter((r) => !r.isStarter).map((r) => ({
        slot: r.slot,
        player: {
          id: r.player.id,
          name: r.player.name,
          team: r.player.team,
          position: r.player.position,
          status: r.player.status,
          headshotUrl: r.player.headshotUrl
        },
        points: 0,
        projectedPoints: 0
      }))
    }), "formatTeam");
    return c.json({
      matchup: {
        id: matchup.id,
        week: matchup.week,
        isPlayoff: matchup.isPlayoff,
        isChampionship: matchup.isChampionship,
        isComplete: matchup.isComplete,
        league: {
          id: matchup.league.id,
          name: matchup.league.name,
          scoringFormat: matchup.league.scoringFormat
        },
        homeTeam: formatTeam(matchup.homeTeam, matchup.homeScore, matchup.homeProjectedScore),
        awayTeam: formatTeam(matchup.awayTeam, matchup.awayScore, matchup.awayProjectedScore)
      }
    });
  } catch (error) {
    console.error("Get matchup error:", error);
    return c.json({ error: "Failed to fetch matchup" }, 500);
  }
});
matchupRoutes.get("/:id/live", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const matchupId = c.req.param("id");
  if (!user) {
    return c.json({ error: "Not authenticated" }, 401);
  }
  try {
    const matchup = await db.query.matchups.findFirst({
      where: eq(matchups.id, matchupId)
    });
    if (!matchup) {
      return c.json({ error: "Matchup not found" }, 404);
    }
    return c.json({
      matchupId: matchup.id,
      homeScore: matchup.homeScore || 0,
      awayScore: matchup.awayScore || 0,
      homeProjectedScore: matchup.homeProjectedScore || 0,
      awayProjectedScore: matchup.awayProjectedScore || 0,
      isComplete: matchup.isComplete,
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    console.error("Get live scoring error:", error);
    return c.json({ error: "Failed to fetch live scoring" }, 500);
  }
});
matchupRoutes.get("/league/:leagueId/week/:week", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const leagueId = c.req.param("leagueId");
  const week2 = parseInt(c.req.param("week"));
  if (!user) {
    return c.json({ error: "Not authenticated" }, 401);
  }
  const membership = await db.query.leagueMembers.findFirst({
    where: and(
      eq(leagueMembers.userId, user.id),
      eq(leagueMembers.leagueId, leagueId)
    )
  });
  if (!membership) {
    return c.json({ error: "Not a member of this league" }, 403);
  }
  try {
    const matchups2 = await db.query.matchups.findMany({
      where: and(
        eq(matchups.leagueId, leagueId),
        eq(matchups.week, week2)
      ),
      with: {
        homeTeam: {
          with: { owner: true }
        },
        awayTeam: {
          with: { owner: true }
        }
      }
    });
    return c.json({
      week: week2,
      matchups: matchups2.map((m) => ({
        id: m.id,
        isPlayoff: m.isPlayoff,
        isChampionship: m.isChampionship,
        isComplete: m.isComplete,
        homeTeam: {
          id: m.homeTeam.id,
          name: m.homeTeam.name,
          owner: m.homeTeam.owner.username,
          score: m.homeScore || 0,
          projectedScore: m.homeProjectedScore || 0
        },
        awayTeam: {
          id: m.awayTeam.id,
          name: m.awayTeam.owner.username,
          owner: m.awayTeam.owner.username,
          score: m.awayScore || 0,
          projectedScore: m.awayProjectedScore || 0
        }
      }))
    });
  } catch (error) {
    console.error("Get league matchups error:", error);
    return c.json({ error: "Failed to fetch matchups" }, 500);
  }
});
matchupRoutes.get("/my/current", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const leagueId = c.req.query("leagueId");
  if (!user) {
    return c.json({ error: "Not authenticated" }, 401);
  }
  if (!leagueId) {
    return c.json({ error: "League ID required" }, 400);
  }
  try {
    const league = await db.query.leagues.findFirst({
      where: eq(leagues.id, leagueId)
    });
    if (!league) {
      return c.json({ error: "League not found" }, 404);
    }
    const team = await db.query.teams.findFirst({
      where: and(
        eq(teams.leagueId, leagueId),
        eq(teams.ownerId, user.id)
      )
    });
    if (!team) {
      return c.json({ error: "Team not found" }, 404);
    }
    const matchup = await db.query.matchups.findFirst({
      where: and(
        eq(matchups.leagueId, leagueId),
        eq(matchups.week, league.currentWeek)
      ),
      with: {
        homeTeam: { with: { owner: true } },
        awayTeam: { with: { owner: true } }
      }
    });
    if (!matchup) {
      return c.json({ error: "No matchup found for current week" }, 404);
    }
    const isHome = matchup.homeTeamId === team.id;
    const myTeam = isHome ? matchup.homeTeam : matchup.awayTeam;
    const opponent = isHome ? matchup.awayTeam : matchup.homeTeam;
    const myScore = isHome ? matchup.homeScore : matchup.awayScore;
    const opponentScore = isHome ? matchup.awayScore : matchup.homeScore;
    return c.json({
      matchupId: matchup.id,
      week: matchup.week,
      myTeam: {
        id: myTeam.id,
        name: myTeam.name,
        score: myScore || 0
      },
      opponent: {
        id: opponent.id,
        name: opponent.name,
        owner: opponent.owner.username,
        score: opponentScore || 0
      },
      isComplete: matchup.isComplete
    });
  } catch (error) {
    console.error("Get current matchup error:", error);
    return c.json({ error: "Failed to fetch current matchup" }, 500);
  }
});
matchupRoutes.get("/league/:leagueId/all", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const leagueId = c.req.param("leagueId");
  if (!user) {
    return c.json({ error: "Not authenticated" }, 401);
  }
  const membership = await db.query.leagueMembers.findFirst({
    where: and(
      eq(leagueMembers.userId, user.id),
      eq(leagueMembers.leagueId, leagueId)
    )
  });
  if (!membership) {
    return c.json({ error: "Not a member of this league" }, 403);
  }
  try {
    const matchups2 = await db.query.matchups.findMany({
      where: eq(matchups.leagueId, leagueId),
      with: {
        homeTeam: {
          with: { owner: true }
        },
        awayTeam: {
          with: { owner: true }
        }
      },
      orderBy: (matchups3, { asc: asc2 }) => [asc2(matchups3.week)]
    });
    return c.json({
      matchups: matchups2.map((m) => ({
        id: m.id,
        week: m.week,
        isPlayoff: m.isPlayoff,
        isChampionship: m.isChampionship,
        isComplete: m.isComplete,
        homeTeam: {
          id: m.homeTeam.id,
          name: m.homeTeam.name,
          owner: m.homeTeam.owner.username,
          score: m.homeScore || 0,
          projectedScore: m.homeProjectedScore || 0
        },
        awayTeam: {
          id: m.awayTeam.id,
          name: m.awayTeam.name,
          owner: m.awayTeam.owner.username,
          score: m.awayScore || 0,
          projectedScore: m.awayProjectedScore || 0
        }
      }))
    });
  } catch (error) {
    console.error("Get all league matchups error:", error);
    return c.json({ error: "Failed to fetch matchups" }, 500);
  }
});

// src/routes/games.ts
var gameRoutes = new Hono2();
gameRoutes.get("/week/:week", optionalAuthMiddleware, async (c) => {
  const db = c.get("db");
  const week2 = parseInt(c.req.param("week"));
  const season = parseInt(c.req.query("season") || String((/* @__PURE__ */ new Date()).getFullYear()));
  try {
    const games = await db.query.nflGames.findMany({
      where: and(
        eq(nflGames.week, week2),
        eq(nflGames.seasonYear, season)
      ),
      orderBy: asc(nflGames.gameTime)
    });
    const gamesByDay = games.reduce((acc, game) => {
      const date = new Date(game.gameTime).toDateString();
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(game);
      return acc;
    }, {});
    return c.json({
      week: week2,
      season,
      games,
      gamesByDay
    });
  } catch (error) {
    console.error("Get games error:", error);
    return c.json({ error: "Failed to fetch games" }, 500);
  }
});
gameRoutes.get("/:id", optionalAuthMiddleware, async (c) => {
  const db = c.get("db");
  const gameId = c.req.param("id");
  try {
    const game = await db.query.nflGames.findFirst({
      where: eq(nflGames.id, gameId)
    });
    if (!game) {
      return c.json({ error: "Game not found" }, 404);
    }
    const homePlayers = await db.query.nflPlayers.findMany({
      where: eq(nflPlayers.team, game.homeTeam)
    });
    const awayPlayers = await db.query.nflPlayers.findMany({
      where: eq(nflPlayers.team, game.awayTeam)
    });
    return c.json({
      game,
      homePlayers: homePlayers.slice(0, 20),
      // Top 20 players
      awayPlayers: awayPlayers.slice(0, 20)
    });
  } catch (error) {
    console.error("Get game error:", error);
    return c.json({ error: "Failed to fetch game" }, 500);
  }
});
gameRoutes.get("/:id/props", optionalAuthMiddleware, async (c) => {
  const db = c.get("db");
  const gameId = c.req.param("id");
  try {
    const game = await db.query.nflGames.findFirst({
      where: eq(nflGames.id, gameId)
    });
    if (!game) {
      return c.json({ error: "Game not found" }, 404);
    }
    const homePlayers = await db.query.nflPlayers.findMany({
      where: eq(nflPlayers.team, game.homeTeam)
    });
    const awayPlayers = await db.query.nflPlayers.findMany({
      where: eq(nflPlayers.team, game.awayTeam)
    });
    const allPlayerIds = [...homePlayers, ...awayPlayers].map((p) => p.id);
    const projections = await db.query.playerProjections.findMany({
      where: and(
        eq(playerProjections.week, game.week),
        eq(playerProjections.seasonYear, game.seasonYear)
      ),
      with: {
        player: true
      }
    });
    const gameProjections = projections.filter(
      (p) => allPlayerIds.includes(p.playerId)
    );
    return c.json({
      gameId,
      spread: game.spread,
      overUnder: game.overUnder,
      homeMoneyline: game.homeMoneyline,
      awayMoneyline: game.awayMoneyline,
      props: gameProjections.map((p) => ({
        player: p.player,
        projectedPoints: p.projectedPoints,
        weekRank: p.weekRank,
        positionRank: p.positionRank,
        projPassYards: p.projPassYards,
        projPassTDs: p.projPassTDs,
        projRushYards: p.projRushYards,
        projRushTDs: p.projRushTDs,
        projReceptions: p.projReceptions,
        projRecYards: p.projRecYards,
        projRecTDs: p.projRecTDs
      }))
    });
  } catch (error) {
    console.error("Get game props error:", error);
    return c.json({ error: "Failed to fetch game props" }, 500);
  }
});
gameRoutes.get("/live/scores", optionalAuthMiddleware, async (c) => {
  const db = c.get("db");
  try {
    const now = /* @__PURE__ */ new Date();
    const games = await db.query.nflGames.findMany({
      where: eq(nflGames.isComplete, false)
    });
    const liveGames = games.filter((g) => new Date(g.gameTime) <= now);
    return c.json({
      games: liveGames.map((g) => ({
        id: g.id,
        homeTeam: g.homeTeam,
        awayTeam: g.awayTeam,
        homeScore: g.homeScore || 0,
        awayScore: g.awayScore || 0,
        quarter: g.quarter,
        timeRemaining: g.timeRemaining,
        isComplete: g.isComplete
      })),
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    console.error("Get live scores error:", error);
    return c.json({ error: "Failed to fetch live scores" }, 500);
  }
});
gameRoutes.get("/upcoming", optionalAuthMiddleware, async (c) => {
  const db = c.get("db");
  const limit = parseInt(c.req.query("limit") || "10");
  try {
    const now = /* @__PURE__ */ new Date();
    const games = await db.query.nflGames.findMany({
      where: eq(nflGames.isComplete, false),
      orderBy: asc(nflGames.gameTime),
      limit
    });
    const upcomingGames = games.filter((g) => new Date(g.gameTime) > now);
    return c.json({ games: upcomingGames });
  } catch (error) {
    console.error("Get upcoming games error:", error);
    return c.json({ error: "Failed to fetch upcoming games" }, 500);
  }
});
gameRoutes.get("/team/:team", optionalAuthMiddleware, async (c) => {
  const db = c.get("db");
  const team = c.req.param("team").toUpperCase();
  const season = parseInt(c.req.query("season") || String((/* @__PURE__ */ new Date()).getFullYear()));
  try {
    const allGames = await db.query.nflGames.findMany({
      where: eq(nflGames.seasonYear, season),
      orderBy: asc(nflGames.week)
    });
    const teamGames = allGames.filter(
      (g) => g.homeTeam === team || g.awayTeam === team
    );
    return c.json({
      team,
      season,
      schedule: teamGames.map((g) => ({
        ...g,
        isHome: g.homeTeam === team,
        opponent: g.homeTeam === team ? g.awayTeam : g.homeTeam
      }))
    });
  } catch (error) {
    console.error("Get team schedule error:", error);
    return c.json({ error: "Failed to fetch team schedule" }, 500);
  }
});

// src/routes/waivers.ts
var waiverRoutes = new Hono2();
var generateId4 = /* @__PURE__ */ __name(() => crypto.randomUUID(), "generateId");
waiverRoutes.get("/league/:leagueId", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const leagueId = c.req.param("leagueId");
  if (!user) {
    return c.json({ error: "Not authenticated" }, 401);
  }
  const membership = await db.query.leagueMembers.findFirst({
    where: and(
      eq(leagueMembers.userId, user.id),
      eq(leagueMembers.leagueId, leagueId)
    )
  });
  if (!membership) {
    return c.json({ error: "Not a member of this league" }, 403);
  }
  try {
    const team = await db.query.teams.findFirst({
      where: and(
        eq(teams.leagueId, leagueId),
        eq(teams.ownerId, user.id)
      )
    });
    if (!team) {
      return c.json({ error: "Team not found" }, 404);
    }
    const claims = await db.query.transactions.findMany({
      where: and(
        eq(transactions.leagueId, leagueId),
        eq(transactions.addTeamId, team.id),
        eq(transactions.type, "waiver"),
        eq(transactions.status, "pending")
      ),
      orderBy: asc(transactions.waiverPriority)
    });
    const claimsWithPlayers = await Promise.all(
      claims.map(async (claim) => {
        const player = claim.playerId ? await db.query.nflPlayers.findFirst({
          where: eq(nflPlayers.id, claim.playerId)
        }) : null;
        const dropPlayer = claim.dropPlayerId ? await db.query.nflPlayers.findFirst({
          where: eq(nflPlayers.id, claim.dropPlayerId)
        }) : null;
        return {
          ...claim,
          player,
          dropPlayer
        };
      })
    );
    return c.json({
      claims: claimsWithPlayers,
      waiverPriority: team.waiverPriority,
      faabBudget: team.faabBudget
    });
  } catch (error) {
    console.error("Get waivers error:", error);
    return c.json({ error: "Failed to fetch waivers" }, 500);
  }
});
waiverRoutes.post("/league/:leagueId/claim", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const leagueId = c.req.param("leagueId");
  if (!user) {
    return c.json({ error: "Not authenticated" }, 401);
  }
  try {
    const { playerId, dropPlayerId, faabBid } = await c.req.json();
    if (!playerId) {
      return c.json({ error: "Player ID is required" }, 400);
    }
    const league = await db.query.leagues.findFirst({
      where: eq(leagues.id, leagueId)
    });
    if (!league) {
      return c.json({ error: "League not found" }, 404);
    }
    const team = await db.query.teams.findFirst({
      where: and(
        eq(teams.leagueId, leagueId),
        eq(teams.ownerId, user.id)
      )
    });
    if (!team) {
      return c.json({ error: "Team not found" }, 404);
    }
    if (league.waiverType === "faab") {
      if (faabBid === void 0 || faabBid < 0) {
        return c.json({ error: "FAAB bid is required" }, 400);
      }
      if (faabBid > (team.faabBudget || 0)) {
        return c.json({ error: "FAAB bid exceeds remaining budget" }, 400);
      }
    }
    const existingRoster = await db.query.rosterSpots.findFirst({
      where: eq(rosterSpots.playerId, playerId),
      with: { team: true }
    });
    if (existingRoster && existingRoster.team.leagueId === leagueId) {
      return c.json({ error: "Player is already rostered in this league" }, 400);
    }
    const existingClaim = await db.query.transactions.findFirst({
      where: and(
        eq(transactions.leagueId, leagueId),
        eq(transactions.addTeamId, team.id),
        eq(transactions.playerId, playerId),
        eq(transactions.status, "pending")
      )
    });
    if (existingClaim) {
      return c.json({ error: "You already have a pending claim for this player" }, 400);
    }
    const existingClaims = await db.query.transactions.findMany({
      where: and(
        eq(transactions.leagueId, leagueId),
        eq(transactions.addTeamId, team.id),
        eq(transactions.type, "waiver"),
        eq(transactions.status, "pending")
      )
    });
    const claimId = generateId4();
    await db.insert(transactions).values({
      id: claimId,
      leagueId,
      type: "waiver",
      status: "pending",
      playerId,
      addTeamId: team.id,
      dropPlayerId: dropPlayerId || null,
      faabBid: faabBid || null,
      waiverPriority: existingClaims.length + 1,
      processAt: getNextWaiverProcessTime()
    });
    return c.json({ message: "Waiver claim submitted", claimId }, 201);
  } catch (error) {
    console.error("Submit waiver claim error:", error);
    return c.json({ error: "Failed to submit waiver claim" }, 500);
  }
});
waiverRoutes.delete("/:claimId", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const claimId = c.req.param("claimId");
  if (!user) {
    return c.json({ error: "Not authenticated" }, 401);
  }
  try {
    const claim = await db.query.transactions.findFirst({
      where: eq(transactions.id, claimId)
    });
    if (!claim) {
      return c.json({ error: "Claim not found" }, 404);
    }
    if (!claim.addTeamId) {
      return c.json({ error: "Invalid claim - no team associated" }, 400);
    }
    const addTeam = await db.query.teams.findFirst({
      where: eq(teams.id, claim.addTeamId)
    });
    if (!addTeam || addTeam.ownerId !== user.id) {
      return c.json({ error: "Not authorized to cancel this claim" }, 403);
    }
    if (claim.status !== "pending") {
      return c.json({ error: "Can only cancel pending claims" }, 400);
    }
    await db.delete(transactions).where(eq(transactions.id, claimId));
    return c.json({ message: "Waiver claim cancelled" });
  } catch (error) {
    console.error("Cancel waiver claim error:", error);
    return c.json({ error: "Failed to cancel waiver claim" }, 500);
  }
});
waiverRoutes.put("/league/:leagueId/reorder", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const leagueId = c.req.param("leagueId");
  if (!user) {
    return c.json({ error: "Not authenticated" }, 401);
  }
  try {
    const { claimOrder } = await c.req.json();
    if (!Array.isArray(claimOrder)) {
      return c.json({ error: "claimOrder must be an array of claim IDs" }, 400);
    }
    const team = await db.query.teams.findFirst({
      where: and(
        eq(teams.leagueId, leagueId),
        eq(teams.ownerId, user.id)
      )
    });
    if (!team) {
      return c.json({ error: "Team not found" }, 404);
    }
    for (let i = 0; i < claimOrder.length; i++) {
      const claimId = claimOrder[i];
      const claim = await db.query.transactions.findFirst({
        where: and(
          eq(transactions.id, claimId),
          eq(transactions.addTeamId, team.id)
        )
      });
      if (claim) {
        await db.update(transactions).set({ waiverPriority: i + 1 }).where(eq(transactions.id, claimId));
      }
    }
    return c.json({ message: "Waiver priorities updated" });
  } catch (error) {
    console.error("Reorder waivers error:", error);
    return c.json({ error: "Failed to reorder waivers" }, 500);
  }
});
waiverRoutes.get("/league/:leagueId/history", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const leagueId = c.req.param("leagueId");
  const limit = parseInt(c.req.query("limit") || "50");
  if (!user) {
    return c.json({ error: "Not authenticated" }, 401);
  }
  const membership = await db.query.leagueMembers.findFirst({
    where: and(
      eq(leagueMembers.userId, user.id),
      eq(leagueMembers.leagueId, leagueId)
    )
  });
  if (!membership) {
    return c.json({ error: "Not a member of this league" }, 403);
  }
  try {
    const transactions2 = await db.query.transactions.findMany({
      where: and(
        eq(transactions.leagueId, leagueId),
        eq(transactions.status, "processed")
      ),
      orderBy: desc(transactions.processedAt),
      limit
    });
    const transactionsWithDetails = await Promise.all(
      transactions2.map(async (t) => {
        const player = t.playerId ? await db.query.nflPlayers.findFirst({
          where: eq(nflPlayers.id, t.playerId)
        }) : null;
        const addTeam = t.addTeamId ? await db.query.teams.findFirst({
          where: eq(teams.id, t.addTeamId)
        }) : null;
        const dropTeam = t.dropTeamId ? await db.query.teams.findFirst({
          where: eq(teams.id, t.dropTeamId)
        }) : null;
        return {
          ...t,
          player,
          addTeam,
          dropTeam
        };
      })
    );
    return c.json({ transactions: transactionsWithDetails });
  } catch (error) {
    console.error("Get transaction history error:", error);
    return c.json({ error: "Failed to fetch transaction history" }, 500);
  }
});
function getNextWaiverProcessTime() {
  const now = /* @__PURE__ */ new Date();
  const wednesday = 3;
  const daysUntilWednesday = (wednesday - now.getDay() + 7) % 7 || 7;
  const nextWednesday = new Date(now);
  nextWednesday.setDate(now.getDate() + daysUntilWednesday);
  nextWednesday.setHours(3, 0, 0, 0);
  return nextWednesday;
}
__name(getNextWaiverProcessTime, "getNextWaiverProcessTime");

// src/services/sleeper.ts
var SLEEPER_PLAYERS_URL = "https://api.sleeper.app/v1/players/nfl";
var FANTASY_POSITIONS = /* @__PURE__ */ new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);
var NFL_TEAMS = [
  "ARI",
  "ATL",
  "BAL",
  "BUF",
  "CAR",
  "CHI",
  "CIN",
  "CLE",
  "DAL",
  "DEN",
  "DET",
  "GB",
  "HOU",
  "IND",
  "JAX",
  "KC",
  "LAC",
  "LAR",
  "LV",
  "MIA",
  "MIN",
  "NE",
  "NO",
  "NYG",
  "NYJ",
  "PHI",
  "PIT",
  "SEA",
  "SF",
  "TB",
  "TEN",
  "WAS"
];
function mapStatus(sleeperStatus, injuryStatus) {
  const status = (sleeperStatus || "Active").toLowerCase();
  const injury = (injuryStatus || "").toLowerCase();
  if (status === "injured_reserve" || injury === "ir")
    return "injured_reserve";
  if (status === "out" || injury === "out")
    return "out";
  if (injury === "doubtful")
    return "doubtful";
  if (injury === "questionable")
    return "questionable";
  if (status === "inactive")
    return "inactive";
  return "active";
}
__name(mapStatus, "mapStatus");
function parseWeight(weight) {
  if (weight == null)
    return null;
  const n = typeof weight === "string" ? parseInt(weight, 10) : weight;
  return isNaN(n) ? null : n;
}
__name(parseWeight, "parseWeight");
async function fetchSleeperPlayers() {
  const response = await fetch(SLEEPER_PLAYERS_URL);
  if (!response.ok) {
    throw new Error(`Sleeper API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
__name(fetchSleeperPlayers, "fetchSleeperPlayers");
function mapSleeperPlayerToDb(sleeperId, player) {
  const position = player.position;
  if (!position || !FANTASY_POSITIONS.has(position))
    return null;
  const team = player.team || "FA";
  if (team === "FA" && position !== "DEF") {
  }
  const name = player.full_name || [player.first_name, player.last_name].filter(Boolean).join(" ") || `Player ${sleeperId}`;
  const status = mapStatus(player.status, player.injury_status);
  const headshotUrl = player.espn_id != null ? `https://a.espncdn.com/i/headshots/nfl/players/full/${player.espn_id}.png` : null;
  return {
    id: crypto.randomUUID(),
    externalId: sleeperId,
    name: name.trim(),
    firstName: player.first_name || null,
    lastName: player.last_name || null,
    team,
    position,
    status,
    injuryNote: player.injury_notes || null,
    injuryBodyPart: player.injury_body_part || null,
    headshotUrl,
    age: player.age ?? null,
    height: player.height || null,
    weight: parseWeight(player.weight),
    college: player.college || null,
    yearsExp: player.years_exp ?? null,
    jerseyNumber: player.number ?? null,
    depthChartOrder: player.depth_chart_order ?? null
  };
}
__name(mapSleeperPlayerToDb, "mapSleeperPlayerToDb");
async function getMappedPlayers() {
  const raw2 = await fetchSleeperPlayers();
  const mapped = [];
  const seenDef = /* @__PURE__ */ new Set();
  for (const [sleeperId, player] of Object.entries(raw2)) {
    if (!player)
      continue;
    const m = mapSleeperPlayerToDb(sleeperId, player);
    if (m) {
      mapped.push(m);
      if (m.position === "DEF")
        seenDef.add(m.team);
    }
  }
  for (const team of NFL_TEAMS) {
    if (seenDef.has(team))
      continue;
    mapped.push({
      id: crypto.randomUUID(),
      externalId: team,
      name: `${team} Defense`,
      firstName: null,
      lastName: null,
      team,
      position: "DEF",
      status: "active",
      injuryNote: null,
      injuryBodyPart: null,
      headshotUrl: null,
      age: null,
      height: null,
      weight: null,
      college: null,
      yearsExp: null,
      jerseyNumber: null,
      depthChartOrder: null
    });
  }
  return mapped;
}
__name(getMappedPlayers, "getMappedPlayers");

// src/routes/admin.ts
var generateId5 = /* @__PURE__ */ __name(() => crypto.randomUUID(), "generateId");
var adminRoutes = new Hono2();
adminRoutes.post("/sync-players", async (c) => {
  const db = c.get("db");
  const syncSecret = c.env.SYNC_SECRET;
  if (syncSecret) {
    const adminKey = c.req.header("X-Admin-Key");
    if (adminKey !== syncSecret) {
      return c.json({ error: "Unauthorized" }, 401);
    }
  }
  try {
    c.header("Content-Type", "application/json");
    const mapped = await getMappedPlayers();
    let inserted = 0;
    let updated = 0;
    const now = /* @__PURE__ */ new Date();
    for (const player of mapped) {
      const existing = await db.query.nflPlayers.findFirst({
        where: eq(nflPlayers.externalId, player.externalId)
      });
      if (existing) {
        await db.update(nflPlayers).set({
          name: player.name,
          firstName: player.firstName,
          lastName: player.lastName,
          team: player.team,
          position: player.position,
          status: player.status,
          injuryNote: player.injuryNote,
          injuryBodyPart: player.injuryBodyPart,
          headshotUrl: player.headshotUrl,
          age: player.age,
          height: player.height,
          weight: player.weight,
          college: player.college,
          yearsExp: player.yearsExp,
          jerseyNumber: player.jerseyNumber,
          depthChartOrder: player.depthChartOrder,
          updatedAt: now
        }).where(eq(nflPlayers.id, existing.id));
        updated++;
      } else {
        await db.insert(nflPlayers).values({
          id: player.id,
          externalId: player.externalId,
          name: player.name,
          firstName: player.firstName,
          lastName: player.lastName,
          team: player.team,
          position: player.position,
          status: player.status,
          injuryNote: player.injuryNote,
          injuryBodyPart: player.injuryBodyPart,
          headshotUrl: player.headshotUrl,
          age: player.age,
          height: player.height,
          weight: player.weight,
          college: player.college,
          yearsExp: player.yearsExp,
          jerseyNumber: player.jerseyNumber,
          depthChartOrder: player.depthChartOrder,
          createdAt: now,
          updatedAt: now
        });
        inserted++;
      }
    }
    return c.json({
      success: true,
      message: "Player sync completed",
      inserted,
      updated,
      total: mapped.length
    });
  } catch (err) {
    console.error("Sync players error:", err);
    return c.json(
      {
        error: "Sync failed",
        message: err instanceof Error ? err.message : "Unknown error"
      },
      500
    );
  }
});
adminRoutes.post("/sync-stats", async (c) => {
  const db = c.get("db");
  const syncSecret = c.env.SYNC_SECRET;
  if (syncSecret) {
    const adminKey = c.req.header("X-Admin-Key");
    if (adminKey !== syncSecret) {
      return c.json({ error: "Unauthorized" }, 401);
    }
  }
  try {
    let body = {};
    try {
      const raw2 = await c.req.json();
      body = raw2 && typeof raw2 === "object" ? raw2 : {};
    } catch {
    }
    const seasonYear = body.seasonYear ?? 2024;
    const maxWeeks = body.weeks ?? 18;
    let statsImported = 0;
    let statsUpdated = 0;
    for (let week2 = 1; week2 <= maxWeeks; week2++) {
      try {
        const statsResponse = await fetch(
          `https://api.sleeper.com/stats/nfl/${seasonYear}/${week2}?season_type=regular`
        );
        if (!statsResponse.ok) {
          console.log(`No stats available for week ${week2}`);
          continue;
        }
        const raw2 = await statsResponse.json();
        const weekEntries = [];
        if (Array.isArray(raw2)) {
          for (const item of raw2) {
            const pid = item?.player_id;
            if (!pid)
              continue;
            const s = item.stats || {};
            weekEntries.push({
              sleeperPlayerId: String(pid),
              playerStats: { ...s, opponent: item.opponent }
            });
          }
        } else if (raw2 && typeof raw2 === "object") {
          for (const sleeperPlayerId of Object.keys(raw2)) {
            const playerStats = raw2[sleeperPlayerId];
            if (playerStats)
              weekEntries.push({ sleeperPlayerId, playerStats });
          }
        }
        for (const { sleeperPlayerId, playerStats } of weekEntries) {
          const player = await db.query.nflPlayers.findFirst({
            where: eq(nflPlayers.externalId, sleeperPlayerId)
          });
          if (!player)
            continue;
          const existingStats = await db.query.playerWeeklyStats.findFirst({
            where: and(
              eq(playerWeeklyStats.playerId, player.id),
              eq(playerWeeklyStats.week, week2),
              eq(playerWeeklyStats.seasonYear, seasonYear)
            )
          });
          const statsData = {
            playerId: player.id,
            week: week2,
            seasonYear,
            opponent: playerStats.opponent || null,
            passAttempts: playerStats.pass_att || 0,
            passCompletions: playerStats.pass_cmp || 0,
            passYards: playerStats.pass_yd || 0,
            passTDs: playerStats.pass_td || 0,
            passInterceptions: playerStats.pass_int || 0,
            rushAttempts: playerStats.rush_att || 0,
            rushYards: playerStats.rush_yd || 0,
            rushTDs: playerStats.rush_td || 0,
            targets: playerStats.rec_tgt || 0,
            receptions: playerStats.rec || 0,
            receivingYards: playerStats.rec_yd || 0,
            receivingTDs: playerStats.rec_td || 0,
            fumbles: playerStats.fum || 0,
            fumblesLost: playerStats.fum_lost || 0,
            twoPointConversions: (playerStats.pass_2pt || 0) + (playerStats.rush_2pt || 0) + (playerStats.rec_2pt || 0),
            fgMade: playerStats.fgm || 0,
            fgAttempts: playerStats.fga || 0,
            fg40PlusMade: (playerStats.fgm_40_49 || 0) + (playerStats.fgm_50p || 0),
            fg50PlusMade: playerStats.fgm_50p || 0,
            xpMade: playerStats.xpm || 0,
            xpAttempts: playerStats.xpa || 0,
            sacks: playerStats.sack || 0,
            defInterceptions: playerStats.int || 0,
            fumblesRecovered: playerStats.fum_rec || 0,
            defenseTDs: (playerStats.def_td || 0) + (playerStats.st_td || 0),
            safeties: playerStats.safe || 0,
            pointsAllowed: playerStats.pts_allow || 0,
            fantasyPointsPPR: playerStats.pts_ppr || 0,
            fantasyPointsHalf: playerStats.pts_half_ppr || 0,
            fantasyPointsStd: playerStats.pts_std || 0
          };
          if (existingStats) {
            await db.update(playerWeeklyStats).set(statsData).where(eq(playerWeeklyStats.id, existingStats.id));
            statsUpdated++;
          } else {
            await db.insert(playerWeeklyStats).values({
              id: generateId5(),
              ...statsData
            });
            statsImported++;
          }
        }
      } catch (e) {
        console.error(`Failed to fetch stats for week ${week2}:`, e);
      }
    }
    return c.json({
      success: true,
      message: "Stats sync completed",
      seasonYear,
      inserted: statsImported,
      updated: statsUpdated,
      total: statsImported + statsUpdated
    });
  } catch (err) {
    console.error("Sync stats error:", err);
    return c.json(
      {
        error: "Sync failed",
        message: err instanceof Error ? err.message : "Unknown error"
      },
      500
    );
  }
});

// src/index.ts
var app = new Hono2();
app.use("*", logger());
app.use("*", cors({
  origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));
app.use("*", async (c, next) => {
  const db = drizzle(c.env.DB, { schema: schema_exports });
  c.set("db", db);
  await next();
});
app.get("/", (c) => {
  return c.json({
    status: "ok",
    name: "FilmRoom Fantasy API",
    version: "1.0.0",
    environment: c.env.ENVIRONMENT
  });
});
app.get("/health", (c) => {
  return c.json({ status: "healthy", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
app.route("/api/auth", authRoutes);
app.route("/api/leagues", leagueRoutes);
app.route("/api/teams", teamRoutes);
app.route("/api/players", playerRoutes);
app.route("/api/matchups", matchupRoutes);
app.route("/api/games", gameRoutes);
app.route("/api/waivers", waiverRoutes);
app.route("/api/admin", adminRoutes);
app.notFound((c) => {
  return c.json({ error: "Not found", path: c.req.path }, 404);
});
app.onError((err, c) => {
  console.error("API Error:", err);
  return c.json({
    error: "Internal server error",
    message: c.env.ENVIRONMENT === "development" ? err.message : void 0
  }, 500);
});
var src_default = app;

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-N9UnWY/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-N9UnWY/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
