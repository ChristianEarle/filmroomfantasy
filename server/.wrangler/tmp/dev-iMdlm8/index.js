var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// .wrangler/tmp/bundle-n6Y6qc/checked-fetch.js
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
var urls;
var init_checked_fetch = __esm({
  ".wrangler/tmp/bundle-n6Y6qc/checked-fetch.js"() {
    "use strict";
    urls = /* @__PURE__ */ new Set();
    __name(checkURL, "checkURL");
    globalThis.fetch = new Proxy(globalThis.fetch, {
      apply(target, thisArg, argArray) {
        const [request, init] = argArray;
        checkURL(request, init);
        return Reflect.apply(target, thisArg, argArray);
      }
    });
  }
});

// wrangler-modules-watch:wrangler:modules-watch
var init_wrangler_modules_watch = __esm({
  "wrangler-modules-watch:wrangler:modules-watch"() {
    init_checked_fetch();
    init_modules_watch_stub();
  }
});

// node_modules/wrangler/templates/modules-watch-stub.js
var init_modules_watch_stub = __esm({
  "node_modules/wrangler/templates/modules-watch-stub.js"() {
    init_wrangler_modules_watch();
  }
});

// node_modules/hono/dist/compose.js
var compose;
var init_compose = __esm({
  "node_modules/hono/dist/compose.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    compose = /* @__PURE__ */ __name((middleware, onError, onNotFound) => {
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
  }
});

// node_modules/hono/dist/http-exception.js
var init_http_exception = __esm({
  "node_modules/hono/dist/http-exception.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
  }
});

// node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT;
var init_constants = __esm({
  "node_modules/hono/dist/request/constants.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    GET_MATCH_RESULT = /* @__PURE__ */ Symbol();
  }
});

// node_modules/hono/dist/utils/body.js
async function parseFormData(request, options) {
  const formData = await request.formData();
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
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
var parseBody, handleParsingAllValues, handleParsingNestedValues;
var init_body = __esm({
  "node_modules/hono/dist/utils/body.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_request();
    parseBody = /* @__PURE__ */ __name(async (request, options = /* @__PURE__ */ Object.create(null)) => {
      const { all = false, dot = false } = options;
      const headers = request instanceof HonoRequest ? request.raw.headers : request.headers;
      const contentType = headers.get("Content-Type");
      if (contentType?.startsWith("multipart/form-data") || contentType?.startsWith("application/x-www-form-urlencoded")) {
        return parseFormData(request, { all, dot });
      }
      return {};
    }, "parseBody");
    __name(parseFormData, "parseFormData");
    __name(convertFormDataToBodyData, "convertFormDataToBodyData");
    handleParsingAllValues = /* @__PURE__ */ __name((form, key, value) => {
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
    handleParsingNestedValues = /* @__PURE__ */ __name((form, key, value) => {
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
  }
});

// node_modules/hono/dist/utils/url.js
var splitPath, splitRoutingPath, extractGroupsFromPath, replaceGroupMarks, patternCache, getPattern, tryDecode, tryDecodeURI, getPath, getPathNoStrict, mergePath, checkOptionalParameter, _decodeURI, _getQueryParam, getQueryParam, getQueryParams, decodeURIComponent_;
var init_url = __esm({
  "node_modules/hono/dist/utils/url.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    splitPath = /* @__PURE__ */ __name((path) => {
      const paths = path.split("/");
      if (paths[0] === "") {
        paths.shift();
      }
      return paths;
    }, "splitPath");
    splitRoutingPath = /* @__PURE__ */ __name((routePath) => {
      const { groups, path } = extractGroupsFromPath(routePath);
      const paths = splitPath(path);
      return replaceGroupMarks(paths, groups);
    }, "splitRoutingPath");
    extractGroupsFromPath = /* @__PURE__ */ __name((path) => {
      const groups = [];
      path = path.replace(/\{[^}]+\}/g, (match2, index) => {
        const mark = `@${index}`;
        groups.push([mark, match2]);
        return mark;
      });
      return { groups, path };
    }, "extractGroupsFromPath");
    replaceGroupMarks = /* @__PURE__ */ __name((paths, groups) => {
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
    patternCache = {};
    getPattern = /* @__PURE__ */ __name((label, next) => {
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
    tryDecode = /* @__PURE__ */ __name((str, decoder2) => {
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
    tryDecodeURI = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURI), "tryDecodeURI");
    getPath = /* @__PURE__ */ __name((request) => {
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
    getPathNoStrict = /* @__PURE__ */ __name((request) => {
      const result = getPath(request);
      return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
    }, "getPathNoStrict");
    mergePath = /* @__PURE__ */ __name((base, sub, ...rest) => {
      if (rest.length) {
        sub = mergePath(sub, ...rest);
      }
      return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
    }, "mergePath");
    checkOptionalParameter = /* @__PURE__ */ __name((path) => {
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
    _decodeURI = /* @__PURE__ */ __name((value) => {
      if (!/[%+]/.test(value)) {
        return value;
      }
      if (value.indexOf("+") !== -1) {
        value = value.replace(/\+/g, " ");
      }
      return value.indexOf("%") !== -1 ? tryDecode(value, decodeURIComponent_) : value;
    }, "_decodeURI");
    _getQueryParam = /* @__PURE__ */ __name((url, key, multiple) => {
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
    getQueryParam = _getQueryParam;
    getQueryParams = /* @__PURE__ */ __name((url, key) => {
      return _getQueryParam(url, key, true);
    }, "getQueryParams");
    decodeURIComponent_ = decodeURIComponent;
  }
});

// node_modules/hono/dist/request.js
var tryDecodeURIComponent, HonoRequest;
var init_request = __esm({
  "node_modules/hono/dist/request.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_http_exception();
    init_constants();
    init_body();
    init_url();
    tryDecodeURIComponent = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURIComponent_), "tryDecodeURIComponent");
    HonoRequest = class {
      static {
        __name(this, "HonoRequest");
      }
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
      #cachedBody = /* @__PURE__ */ __name((key) => {
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
      }, "#cachedBody");
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
    };
  }
});

// node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase, raw, resolveCallback;
var init_html = __esm({
  "node_modules/hono/dist/utils/html.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    HtmlEscapedCallbackPhase = {
      Stringify: 1,
      BeforeStream: 2,
      Stream: 3
    };
    raw = /* @__PURE__ */ __name((value, callbacks) => {
      const escapedString = new String(value);
      escapedString.isEscaped = true;
      escapedString.callbacks = callbacks;
      return escapedString;
    }, "raw");
    resolveCallback = /* @__PURE__ */ __name(async (str, phase, preserveCallbacks, context, buffer) => {
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
  }
});

// node_modules/hono/dist/context.js
var TEXT_PLAIN, setDefaultContentType, Context;
var init_context = __esm({
  "node_modules/hono/dist/context.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_request();
    init_html();
    TEXT_PLAIN = "text/plain; charset=UTF-8";
    setDefaultContentType = /* @__PURE__ */ __name((contentType, headers) => {
      return {
        "Content-Type": contentType,
        ...headers
      };
    }, "setDefaultContentType");
    Context = class {
      static {
        __name(this, "Context");
      }
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
      render = /* @__PURE__ */ __name((...args) => {
        this.#renderer ??= (content) => this.html(content);
        return this.#renderer(...args);
      }, "render");
      /**
       * Sets the layout for the response.
       *
       * @param layout - The layout to set.
       * @returns The layout function.
       */
      setLayout = /* @__PURE__ */ __name((layout) => this.#layout = layout, "setLayout");
      /**
       * Gets the current layout for the response.
       *
       * @returns The current layout function.
       */
      getLayout = /* @__PURE__ */ __name(() => this.#layout, "getLayout");
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
      setRenderer = /* @__PURE__ */ __name((renderer) => {
        this.#renderer = renderer;
      }, "setRenderer");
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
      header = /* @__PURE__ */ __name((name, value, options) => {
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
      }, "header");
      status = /* @__PURE__ */ __name((status) => {
        this.#status = status;
      }, "status");
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
      set = /* @__PURE__ */ __name((key, value) => {
        this.#var ??= /* @__PURE__ */ new Map();
        this.#var.set(key, value);
      }, "set");
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
      get = /* @__PURE__ */ __name((key) => {
        return this.#var ? this.#var.get(key) : void 0;
      }, "get");
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
      newResponse = /* @__PURE__ */ __name((...args) => this.#newResponse(...args), "newResponse");
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
      body = /* @__PURE__ */ __name((data, arg, headers) => this.#newResponse(data, arg, headers), "body");
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
      text = /* @__PURE__ */ __name((text2, arg, headers) => {
        return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text2) : this.#newResponse(
          text2,
          arg,
          setDefaultContentType(TEXT_PLAIN, headers)
        );
      }, "text");
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
      json = /* @__PURE__ */ __name((object, arg, headers) => {
        return this.#newResponse(
          JSON.stringify(object),
          arg,
          setDefaultContentType("application/json", headers)
        );
      }, "json");
      html = /* @__PURE__ */ __name((html, arg, headers) => {
        const res = /* @__PURE__ */ __name((html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers)), "res");
        return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
      }, "html");
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
      redirect = /* @__PURE__ */ __name((location, status) => {
        const locationString = String(location);
        this.header(
          "Location",
          // Multibyes should be encoded
          // eslint-disable-next-line no-control-regex
          !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
        );
        return this.newResponse(null, status ?? 302);
      }, "redirect");
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
      notFound = /* @__PURE__ */ __name(() => {
        this.#notFoundHandler ??= () => new Response();
        return this.#notFoundHandler(this);
      }, "notFound");
    };
  }
});

// node_modules/hono/dist/router.js
var METHOD_NAME_ALL, METHOD_NAME_ALL_LOWERCASE, METHODS, MESSAGE_MATCHER_IS_ALREADY_BUILT, UnsupportedPathError;
var init_router = __esm({
  "node_modules/hono/dist/router.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    METHOD_NAME_ALL = "ALL";
    METHOD_NAME_ALL_LOWERCASE = "all";
    METHODS = ["get", "post", "put", "delete", "options", "patch"];
    MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
    UnsupportedPathError = class extends Error {
      static {
        __name(this, "UnsupportedPathError");
      }
    };
  }
});

// node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER;
var init_constants2 = __esm({
  "node_modules/hono/dist/utils/constants.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    COMPOSED_HANDLER = "__COMPOSED_HANDLER";
  }
});

// node_modules/hono/dist/hono-base.js
var notFoundHandler, errorHandler, Hono;
var init_hono_base = __esm({
  "node_modules/hono/dist/hono-base.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_compose();
    init_context();
    init_router();
    init_constants2();
    init_url();
    notFoundHandler = /* @__PURE__ */ __name((c) => {
      return c.text("404 Not Found", 404);
    }, "notFoundHandler");
    errorHandler = /* @__PURE__ */ __name((err, c) => {
      if ("getResponse" in err) {
        const res = err.getResponse();
        return c.newResponse(res.body, res);
      }
      console.error(err);
      return c.text("Internal Server Error", 500);
    }, "errorHandler");
    Hono = class _Hono {
      static {
        __name(this, "_Hono");
      }
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
        const clone2 = new _Hono({
          router: this.router,
          getPath: this.getPath
        });
        clone2.errorHandler = this.errorHandler;
        clone2.#notFoundHandler = this.#notFoundHandler;
        clone2.routes = this.routes;
        return clone2;
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
      onError = /* @__PURE__ */ __name((handler) => {
        this.errorHandler = handler;
        return this;
      }, "onError");
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
      notFound = /* @__PURE__ */ __name((handler) => {
        this.#notFoundHandler = handler;
        return this;
      }, "notFound");
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
      fetch = /* @__PURE__ */ __name((request, ...rest) => {
        return this.#dispatch(request, rest[1], rest[0], request.method);
      }, "fetch");
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
      request = /* @__PURE__ */ __name((input, requestInit, Env, executionCtx) => {
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
      }, "request");
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
      fire = /* @__PURE__ */ __name(() => {
        addEventListener("fetch", (event) => {
          event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
        });
      }, "fire");
    };
  }
});

// node_modules/hono/dist/router/reg-exp-router/matcher.js
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = /* @__PURE__ */ __name(((method2, path2) => {
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
  }), "match2");
  this.match = match2;
  return match2(method, path);
}
var emptyParam;
var init_matcher = __esm({
  "node_modules/hono/dist/router/reg-exp-router/matcher.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_router();
    emptyParam = [];
    __name(match, "match");
  }
});

// node_modules/hono/dist/router/reg-exp-router/node.js
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
var LABEL_REG_EXP_STR, ONLY_WILDCARD_REG_EXP_STR, TAIL_WILDCARD_REG_EXP_STR, PATH_ERROR, regExpMetaChars, Node;
var init_node = __esm({
  "node_modules/hono/dist/router/reg-exp-router/node.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    LABEL_REG_EXP_STR = "[^/]+";
    ONLY_WILDCARD_REG_EXP_STR = ".*";
    TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
    PATH_ERROR = /* @__PURE__ */ Symbol();
    regExpMetaChars = new Set(".\\+*[^]$()");
    __name(compareKey, "compareKey");
    Node = class _Node {
      static {
        __name(this, "_Node");
      }
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
    };
  }
});

// node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie;
var init_trie = __esm({
  "node_modules/hono/dist/router/reg-exp-router/trie.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_node();
    Trie = class {
      static {
        __name(this, "Trie");
      }
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
    };
  }
});

// node_modules/hono/dist/router/reg-exp-router/router.js
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
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
var nullMatcher, wildcardRegExpCache, RegExpRouter;
var init_router2 = __esm({
  "node_modules/hono/dist/router/reg-exp-router/router.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_router();
    init_url();
    init_matcher();
    init_node();
    init_trie();
    nullMatcher = [/^$/, [], /* @__PURE__ */ Object.create(null)];
    wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
    __name(buildWildcardRegExp, "buildWildcardRegExp");
    __name(clearWildcardRegExpCache, "clearWildcardRegExpCache");
    __name(buildMatcherFromPreprocessedRoutes, "buildMatcherFromPreprocessedRoutes");
    __name(findMiddleware, "findMiddleware");
    RegExpRouter = class {
      static {
        __name(this, "RegExpRouter");
      }
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
    };
  }
});

// node_modules/hono/dist/router/reg-exp-router/prepared-router.js
var init_prepared_router = __esm({
  "node_modules/hono/dist/router/reg-exp-router/prepared-router.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_router();
    init_matcher();
    init_router2();
  }
});

// node_modules/hono/dist/router/reg-exp-router/index.js
var init_reg_exp_router = __esm({
  "node_modules/hono/dist/router/reg-exp-router/index.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_router2();
    init_prepared_router();
  }
});

// node_modules/hono/dist/router/smart-router/router.js
var SmartRouter;
var init_router3 = __esm({
  "node_modules/hono/dist/router/smart-router/router.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_router();
    SmartRouter = class {
      static {
        __name(this, "SmartRouter");
      }
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
    };
  }
});

// node_modules/hono/dist/router/smart-router/index.js
var init_smart_router = __esm({
  "node_modules/hono/dist/router/smart-router/index.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_router3();
  }
});

// node_modules/hono/dist/router/trie-router/node.js
var emptyParams, Node2;
var init_node2 = __esm({
  "node_modules/hono/dist/router/trie-router/node.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_router();
    init_url();
    emptyParams = /* @__PURE__ */ Object.create(null);
    Node2 = class _Node2 {
      static {
        __name(this, "_Node");
      }
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
    };
  }
});

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter;
var init_router4 = __esm({
  "node_modules/hono/dist/router/trie-router/router.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_url();
    init_node2();
    TrieRouter = class {
      static {
        __name(this, "TrieRouter");
      }
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
    };
  }
});

// node_modules/hono/dist/router/trie-router/index.js
var init_trie_router = __esm({
  "node_modules/hono/dist/router/trie-router/index.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_router4();
  }
});

// node_modules/hono/dist/hono.js
var Hono2;
var init_hono = __esm({
  "node_modules/hono/dist/hono.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_hono_base();
    init_reg_exp_router();
    init_smart_router();
    init_trie_router();
    Hono2 = class extends Hono {
      static {
        __name(this, "Hono");
      }
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
    };
  }
});

// node_modules/hono/dist/index.js
var init_dist = __esm({
  "node_modules/hono/dist/index.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_hono();
  }
});

// node_modules/drizzle-orm/entity.js
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
var entityKind;
var init_entity = __esm({
  "node_modules/drizzle-orm/entity.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    entityKind = /* @__PURE__ */ Symbol.for("drizzle:entityKind");
    __name(is, "is");
  }
});

// node_modules/drizzle-orm/logger.js
var ConsoleLogWriter, DefaultLogger, NoopLogger;
var init_logger = __esm({
  "node_modules/drizzle-orm/logger.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    ConsoleLogWriter = class {
      static {
        __name(this, "ConsoleLogWriter");
      }
      static [entityKind] = "ConsoleLogWriter";
      write(message2) {
        console.log(message2);
      }
    };
    DefaultLogger = class {
      static {
        __name(this, "DefaultLogger");
      }
      static [entityKind] = "DefaultLogger";
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
    NoopLogger = class {
      static {
        __name(this, "NoopLogger");
      }
      static [entityKind] = "NoopLogger";
      logQuery() {
      }
    };
  }
});

// node_modules/drizzle-orm/table.js
function getTableName(table) {
  return table[TableName];
}
function getTableUniqueName(table) {
  return `${table[Schema] ?? "public"}.${table[TableName]}`;
}
var TableName, Schema, Columns, ExtraConfigColumns, OriginalName, BaseName, IsAlias, ExtraConfigBuilder, Table;
var init_table = __esm({
  "node_modules/drizzle-orm/table.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    TableName = /* @__PURE__ */ Symbol.for("drizzle:Name");
    Schema = /* @__PURE__ */ Symbol.for("drizzle:Schema");
    Columns = /* @__PURE__ */ Symbol.for("drizzle:Columns");
    ExtraConfigColumns = /* @__PURE__ */ Symbol.for("drizzle:ExtraConfigColumns");
    OriginalName = /* @__PURE__ */ Symbol.for("drizzle:OriginalName");
    BaseName = /* @__PURE__ */ Symbol.for("drizzle:BaseName");
    IsAlias = /* @__PURE__ */ Symbol.for("drizzle:IsAlias");
    ExtraConfigBuilder = /* @__PURE__ */ Symbol.for("drizzle:ExtraConfigBuilder");
    Table = class {
      static {
        __name(this, "Table");
      }
      static [entityKind] = "Table";
      /** @internal */
      static Symbol = {
        Name: TableName,
        Schema,
        OriginalName,
        Columns,
        ExtraConfigColumns,
        BaseName,
        IsAlias,
        ExtraConfigBuilder
      };
      /**
       * @internal
       * Can be changed if the table is aliased.
       */
      [TableName];
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
    __name(getTableName, "getTableName");
    __name(getTableUniqueName, "getTableUniqueName");
  }
});

// node_modules/drizzle-orm/column.js
var Column;
var init_column = __esm({
  "node_modules/drizzle-orm/column.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    Column = class {
      static {
        __name(this, "Column");
      }
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
      static [entityKind] = "Column";
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
  }
});

// node_modules/drizzle-orm/pg-core/table.js
var InlineForeignKeys, PgTable;
var init_table2 = __esm({
  "node_modules/drizzle-orm/pg-core/table.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    init_table();
    InlineForeignKeys = /* @__PURE__ */ Symbol.for("drizzle:PgInlineForeignKeys");
    PgTable = class extends Table {
      static {
        __name(this, "PgTable");
      }
      static [entityKind] = "PgTable";
      /** @internal */
      static Symbol = Object.assign({}, Table.Symbol, {
        InlineForeignKeys
      });
      /**@internal */
      [InlineForeignKeys] = [];
      /** @internal */
      [Table.Symbol.ExtraConfigBuilder] = void 0;
    };
  }
});

// node_modules/drizzle-orm/pg-core/primary-keys.js
var PrimaryKeyBuilder, PrimaryKey;
var init_primary_keys = __esm({
  "node_modules/drizzle-orm/pg-core/primary-keys.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    init_table2();
    PrimaryKeyBuilder = class {
      static {
        __name(this, "PrimaryKeyBuilder");
      }
      static [entityKind] = "PgPrimaryKeyBuilder";
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
    PrimaryKey = class {
      static {
        __name(this, "PrimaryKey");
      }
      constructor(table, columns, name) {
        this.table = table;
        this.columns = columns;
        this.name = name;
      }
      static [entityKind] = "PgPrimaryKey";
      columns;
      name;
      getName() {
        return this.name ?? `${this.table[PgTable.Symbol.Name]}_${this.columns.map((column) => column.name).join("_")}_pk`;
      }
    };
  }
});

// node_modules/drizzle-orm/column-builder.js
var ColumnBuilder;
var init_column_builder = __esm({
  "node_modules/drizzle-orm/column-builder.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    ColumnBuilder = class {
      static {
        __name(this, "ColumnBuilder");
      }
      static [entityKind] = "ColumnBuilder";
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
  }
});

// node_modules/drizzle-orm/pg-core/foreign-keys.js
var ForeignKeyBuilder, ForeignKey;
var init_foreign_keys = __esm({
  "node_modules/drizzle-orm/pg-core/foreign-keys.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    init_table2();
    ForeignKeyBuilder = class {
      static {
        __name(this, "ForeignKeyBuilder");
      }
      static [entityKind] = "PgForeignKeyBuilder";
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
    ForeignKey = class {
      static {
        __name(this, "ForeignKey");
      }
      constructor(table, builder) {
        this.table = table;
        this.reference = builder.reference;
        this.onUpdate = builder._onUpdate;
        this.onDelete = builder._onDelete;
      }
      static [entityKind] = "PgForeignKey";
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
  }
});

// node_modules/drizzle-orm/tracing-utils.js
function iife(fn, ...args) {
  return fn(...args);
}
var init_tracing_utils = __esm({
  "node_modules/drizzle-orm/tracing-utils.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    __name(iife, "iife");
  }
});

// node_modules/drizzle-orm/pg-core/unique-constraint.js
function uniqueKeyName(table, columns) {
  return `${table[PgTable.Symbol.Name]}_${columns.join("_")}_unique`;
}
var UniqueConstraintBuilder, UniqueOnConstraintBuilder, UniqueConstraint;
var init_unique_constraint = __esm({
  "node_modules/drizzle-orm/pg-core/unique-constraint.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    init_table2();
    __name(uniqueKeyName, "uniqueKeyName");
    UniqueConstraintBuilder = class {
      static {
        __name(this, "UniqueConstraintBuilder");
      }
      constructor(columns, name) {
        this.name = name;
        this.columns = columns;
      }
      static [entityKind] = "PgUniqueConstraintBuilder";
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
    UniqueOnConstraintBuilder = class {
      static {
        __name(this, "UniqueOnConstraintBuilder");
      }
      static [entityKind] = "PgUniqueOnConstraintBuilder";
      /** @internal */
      name;
      constructor(name) {
        this.name = name;
      }
      on(...columns) {
        return new UniqueConstraintBuilder(columns, this.name);
      }
    };
    UniqueConstraint = class {
      static {
        __name(this, "UniqueConstraint");
      }
      constructor(table, columns, nullsNotDistinct, name) {
        this.table = table;
        this.columns = columns;
        this.name = name ?? uniqueKeyName(this.table, this.columns.map((column) => column.name));
        this.nullsNotDistinct = nullsNotDistinct;
      }
      static [entityKind] = "PgUniqueConstraint";
      columns;
      name;
      nullsNotDistinct = false;
      getName() {
        return this.name;
      }
    };
  }
});

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
function parsePgArray(arrayString) {
  const [result] = parsePgNestedArray(arrayString, 1);
  return result;
}
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
var init_array = __esm({
  "node_modules/drizzle-orm/pg-core/utils/array.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    __name(parsePgArrayValue, "parsePgArrayValue");
    __name(parsePgNestedArray, "parsePgNestedArray");
    __name(parsePgArray, "parsePgArray");
    __name(makePgArray, "makePgArray");
  }
});

// node_modules/drizzle-orm/pg-core/columns/common.js
var PgColumnBuilder, PgColumn, ExtraConfigColumn, IndexedColumn, PgArrayBuilder, PgArray;
var init_common = __esm({
  "node_modules/drizzle-orm/pg-core/columns/common.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_column_builder();
    init_column();
    init_entity();
    init_foreign_keys();
    init_tracing_utils();
    init_unique_constraint();
    init_array();
    PgColumnBuilder = class extends ColumnBuilder {
      static {
        __name(this, "PgColumnBuilder");
      }
      foreignKeyConfigs = [];
      static [entityKind] = "PgColumnBuilder";
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
    PgColumn = class extends Column {
      static {
        __name(this, "PgColumn");
      }
      constructor(table, config) {
        if (!config.uniqueName) {
          config.uniqueName = uniqueKeyName(table, [config.name]);
        }
        super(table, config);
        this.table = table;
      }
      static [entityKind] = "PgColumn";
    };
    ExtraConfigColumn = class extends PgColumn {
      static {
        __name(this, "ExtraConfigColumn");
      }
      static [entityKind] = "ExtraConfigColumn";
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
    IndexedColumn = class {
      static {
        __name(this, "IndexedColumn");
      }
      static [entityKind] = "IndexedColumn";
      constructor(name, type, indexConfig) {
        this.name = name;
        this.type = type;
        this.indexConfig = indexConfig;
      }
      name;
      type;
      indexConfig;
    };
    PgArrayBuilder = class extends PgColumnBuilder {
      static {
        __name(this, "PgArrayBuilder");
      }
      static [entityKind] = "PgArrayBuilder";
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
    PgArray = class _PgArray extends PgColumn {
      static {
        __name(this, "PgArray");
      }
      constructor(table, config, baseColumn, range) {
        super(table, config);
        this.baseColumn = baseColumn;
        this.range = range;
        this.size = config.size;
      }
      size;
      static [entityKind] = "PgArray";
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
  }
});

// node_modules/drizzle-orm/pg-core/columns/enum.js
function isPgEnum(obj) {
  return !!obj && typeof obj === "function" && isPgEnumSym in obj && obj[isPgEnumSym] === true;
}
var isPgEnumSym, PgEnumColumnBuilder, PgEnumColumn;
var init_enum = __esm({
  "node_modules/drizzle-orm/pg-core/columns/enum.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    init_common();
    isPgEnumSym = /* @__PURE__ */ Symbol.for("drizzle:isPgEnum");
    __name(isPgEnum, "isPgEnum");
    PgEnumColumnBuilder = class extends PgColumnBuilder {
      static {
        __name(this, "PgEnumColumnBuilder");
      }
      static [entityKind] = "PgEnumColumnBuilder";
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
    PgEnumColumn = class extends PgColumn {
      static {
        __name(this, "PgEnumColumn");
      }
      static [entityKind] = "PgEnumColumn";
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
  }
});

// node_modules/drizzle-orm/subquery.js
var Subquery, WithSubquery;
var init_subquery = __esm({
  "node_modules/drizzle-orm/subquery.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    Subquery = class {
      static {
        __name(this, "Subquery");
      }
      static [entityKind] = "Subquery";
      constructor(sql3, selection, alias, isWith = false) {
        this._ = {
          brand: "Subquery",
          sql: sql3,
          selectedFields: selection,
          alias,
          isWith
        };
      }
      // getSQL(): SQL<unknown> {
      // 	return new SQL([this]);
      // }
    };
    WithSubquery = class extends Subquery {
      static {
        __name(this, "WithSubquery");
      }
      static [entityKind] = "WithSubquery";
    };
  }
});

// node_modules/drizzle-orm/version.js
var version;
var init_version = __esm({
  "node_modules/drizzle-orm/version.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    version = "0.32.2";
  }
});

// node_modules/drizzle-orm/tracing.js
var otel, rawTracer, tracer;
var init_tracing = __esm({
  "node_modules/drizzle-orm/tracing.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_tracing_utils();
    init_version();
    tracer = {
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
  }
});

// node_modules/drizzle-orm/view-common.js
var ViewBaseConfig;
var init_view_common = __esm({
  "node_modules/drizzle-orm/view-common.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    ViewBaseConfig = /* @__PURE__ */ Symbol.for("drizzle:ViewBaseConfig");
  }
});

// node_modules/drizzle-orm/sql/sql.js
function isSQLWrapper(value) {
  return value !== null && value !== void 0 && typeof value.getSQL === "function";
}
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
function isDriverValueEncoder(value) {
  return typeof value === "object" && value !== null && "mapToDriverValue" in value && typeof value.mapToDriverValue === "function";
}
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
var FakePrimitiveParam, StringChunk, SQL, Name, noopDecoder, noopEncoder, noopMapper, Param, Placeholder, View;
var init_sql = __esm({
  "node_modules/drizzle-orm/sql/sql.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    init_enum();
    init_subquery();
    init_tracing();
    init_view_common();
    init_column();
    init_table();
    FakePrimitiveParam = class {
      static {
        __name(this, "FakePrimitiveParam");
      }
      static [entityKind] = "FakePrimitiveParam";
    };
    __name(isSQLWrapper, "isSQLWrapper");
    __name(mergeQueries, "mergeQueries");
    StringChunk = class {
      static {
        __name(this, "StringChunk");
      }
      static [entityKind] = "StringChunk";
      value;
      constructor(value) {
        this.value = Array.isArray(value) ? value : [value];
      }
      getSQL() {
        return new SQL([this]);
      }
    };
    SQL = class _SQL {
      static {
        __name(this, "SQL");
      }
      constructor(queryChunks) {
        this.queryChunks = queryChunks;
      }
      static [entityKind] = "SQL";
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
    Name = class {
      static {
        __name(this, "Name");
      }
      constructor(value) {
        this.value = value;
      }
      static [entityKind] = "Name";
      brand;
      getSQL() {
        return new SQL([this]);
      }
    };
    __name(isDriverValueEncoder, "isDriverValueEncoder");
    noopDecoder = {
      mapFromDriverValue: /* @__PURE__ */ __name((value) => value, "mapFromDriverValue")
    };
    noopEncoder = {
      mapToDriverValue: /* @__PURE__ */ __name((value) => value, "mapToDriverValue")
    };
    noopMapper = {
      ...noopDecoder,
      ...noopEncoder
    };
    Param = class {
      static {
        __name(this, "Param");
      }
      /**
       * @param value - Parameter value
       * @param encoder - Encoder to convert the value to a driver parameter
       */
      constructor(value, encoder2 = noopEncoder) {
        this.value = value;
        this.encoder = encoder2;
      }
      static [entityKind] = "Param";
      brand;
      getSQL() {
        return new SQL([this]);
      }
    };
    __name(sql, "sql");
    ((sql22) => {
      function empty() {
        return new SQL([]);
      }
      __name(empty, "empty");
      sql22.empty = empty;
      function fromList(list) {
        return new SQL(list);
      }
      __name(fromList, "fromList");
      sql22.fromList = fromList;
      function raw2(str) {
        return new SQL([new StringChunk(str)]);
      }
      __name(raw2, "raw");
      sql22.raw = raw2;
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
      sql22.join = join;
      function identifier(value) {
        return new Name(value);
      }
      __name(identifier, "identifier");
      sql22.identifier = identifier;
      function placeholder2(name2) {
        return new Placeholder(name2);
      }
      __name(placeholder2, "placeholder2");
      sql22.placeholder = placeholder2;
      function param2(value, encoder2) {
        return new Param(value, encoder2);
      }
      __name(param2, "param2");
      sql22.param = param2;
    })(sql || (sql = {}));
    ((SQL2) => {
      class Aliased {
        static {
          __name(this, "Aliased");
        }
        constructor(sql22, fieldAlias) {
          this.sql = sql22;
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
      SQL2.Aliased = Aliased;
    })(SQL || (SQL = {}));
    Placeholder = class {
      static {
        __name(this, "Placeholder");
      }
      constructor(name2) {
        this.name = name2;
      }
      static [entityKind] = "Placeholder";
      getSQL() {
        return new SQL([this]);
      }
    };
    __name(fillPlaceholders, "fillPlaceholders");
    View = class {
      static {
        __name(this, "View");
      }
      static [entityKind] = "View";
      /** @internal */
      [ViewBaseConfig];
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
    Column.prototype.getSQL = function() {
      return new SQL([this]);
    };
    Table.prototype.getSQL = function() {
      return new SQL([this]);
    };
    Subquery.prototype.getSQL = function() {
      return new SQL([this]);
    };
  }
});

// node_modules/drizzle-orm/sql/expressions/conditions.js
function bindIfParam(value, column) {
  if (isDriverValueEncoder(column) && !isSQLWrapper(value) && !is(value, Param) && !is(value, Placeholder) && !is(value, Column) && !is(value, Table) && !is(value, View)) {
    return new Param(value, column);
  }
  return value;
}
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
function not(condition) {
  return sql`not ${condition}`;
}
function inArray(column, values) {
  if (Array.isArray(values)) {
    if (values.length === 0) {
      return sql`false`;
    }
    return sql`${column} in ${values.map((v) => bindIfParam(v, column))}`;
  }
  return sql`${column} in ${bindIfParam(values, column)}`;
}
function notInArray(column, values) {
  if (Array.isArray(values)) {
    if (values.length === 0) {
      return sql`true`;
    }
    return sql`${column} not in ${values.map((v) => bindIfParam(v, column))}`;
  }
  return sql`${column} not in ${bindIfParam(values, column)}`;
}
function isNull(value) {
  return sql`${value} is null`;
}
function isNotNull(value) {
  return sql`${value} is not null`;
}
function exists(subquery) {
  return sql`exists ${subquery}`;
}
function notExists(subquery) {
  return sql`not exists ${subquery}`;
}
function between(column, min, max) {
  return sql`${column} between ${bindIfParam(min, column)} and ${bindIfParam(
    max,
    column
  )}`;
}
function notBetween(column, min, max) {
  return sql`${column} not between ${bindIfParam(
    min,
    column
  )} and ${bindIfParam(max, column)}`;
}
function like(column, value) {
  return sql`${column} like ${value}`;
}
function notLike(column, value) {
  return sql`${column} not like ${value}`;
}
function ilike(column, value) {
  return sql`${column} ilike ${value}`;
}
function notIlike(column, value) {
  return sql`${column} not ilike ${value}`;
}
var eq, ne, gt, gte, lt, lte;
var init_conditions = __esm({
  "node_modules/drizzle-orm/sql/expressions/conditions.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_column();
    init_entity();
    init_table();
    init_sql();
    __name(bindIfParam, "bindIfParam");
    eq = /* @__PURE__ */ __name((left, right) => {
      return sql`${left} = ${bindIfParam(right, left)}`;
    }, "eq");
    ne = /* @__PURE__ */ __name((left, right) => {
      return sql`${left} <> ${bindIfParam(right, left)}`;
    }, "ne");
    __name(and, "and");
    __name(or, "or");
    __name(not, "not");
    gt = /* @__PURE__ */ __name((left, right) => {
      return sql`${left} > ${bindIfParam(right, left)}`;
    }, "gt");
    gte = /* @__PURE__ */ __name((left, right) => {
      return sql`${left} >= ${bindIfParam(right, left)}`;
    }, "gte");
    lt = /* @__PURE__ */ __name((left, right) => {
      return sql`${left} < ${bindIfParam(right, left)}`;
    }, "lt");
    lte = /* @__PURE__ */ __name((left, right) => {
      return sql`${left} <= ${bindIfParam(right, left)}`;
    }, "lte");
    __name(inArray, "inArray");
    __name(notInArray, "notInArray");
    __name(isNull, "isNull");
    __name(isNotNull, "isNotNull");
    __name(exists, "exists");
    __name(notExists, "notExists");
    __name(between, "between");
    __name(notBetween, "notBetween");
    __name(like, "like");
    __name(notLike, "notLike");
    __name(ilike, "ilike");
    __name(notIlike, "notIlike");
  }
});

// node_modules/drizzle-orm/sql/expressions/select.js
function asc(column) {
  return sql`${column} asc`;
}
function desc(column) {
  return sql`${column} desc`;
}
var init_select = __esm({
  "node_modules/drizzle-orm/sql/expressions/select.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_sql();
    __name(asc, "asc");
    __name(desc, "desc");
  }
});

// node_modules/drizzle-orm/sql/expressions/index.js
var init_expressions = __esm({
  "node_modules/drizzle-orm/sql/expressions/index.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_conditions();
    init_select();
  }
});

// node_modules/drizzle-orm/relations.js
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
function getOrderByOperators() {
  return {
    sql,
    asc,
    desc
  };
}
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
function createMany(sourceTable) {
  return /* @__PURE__ */ __name(function many(referencedTable, config) {
    return new Many(sourceTable, referencedTable, config);
  }, "many");
}
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
function createTableRelationsHelpers(sourceTable) {
  return {
    one: createOne(sourceTable),
    many: createMany(sourceTable)
  };
}
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
var Relation, Relations, One, Many;
var init_relations = __esm({
  "node_modules/drizzle-orm/relations.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_table();
    init_column();
    init_entity();
    init_primary_keys();
    init_expressions();
    init_sql();
    Relation = class {
      static {
        __name(this, "Relation");
      }
      constructor(sourceTable, referencedTable, relationName) {
        this.sourceTable = sourceTable;
        this.referencedTable = referencedTable;
        this.relationName = relationName;
        this.referencedTableName = referencedTable[Table.Symbol.Name];
      }
      static [entityKind] = "Relation";
      referencedTableName;
      fieldName;
    };
    Relations = class {
      static {
        __name(this, "Relations");
      }
      constructor(table, config) {
        this.table = table;
        this.config = config;
      }
      static [entityKind] = "Relations";
    };
    One = class _One extends Relation {
      static {
        __name(this, "One");
      }
      constructor(sourceTable, referencedTable, config, isNullable) {
        super(sourceTable, referencedTable, config?.relationName);
        this.config = config;
        this.isNullable = isNullable;
      }
      static [entityKind] = "One";
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
    Many = class _Many extends Relation {
      static {
        __name(this, "Many");
      }
      constructor(sourceTable, referencedTable, config) {
        super(sourceTable, referencedTable, config?.relationName);
        this.config = config;
      }
      static [entityKind] = "Many";
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
    __name(getOperators, "getOperators");
    __name(getOrderByOperators, "getOrderByOperators");
    __name(extractTablesRelationalConfig, "extractTablesRelationalConfig");
    __name(relations, "relations");
    __name(createOne, "createOne");
    __name(createMany, "createMany");
    __name(normalizeRelation, "normalizeRelation");
    __name(createTableRelationsHelpers, "createTableRelationsHelpers");
    __name(mapRelationalRow, "mapRelationalRow");
  }
});

// node_modules/drizzle-orm/alias.js
function aliasedTable(table, tableAlias) {
  return new Proxy(table, new TableAliasProxyHandler(tableAlias, false));
}
function aliasedTableColumn(column, tableAlias) {
  return new Proxy(
    column,
    new ColumnAliasProxyHandler(new Proxy(column.table, new TableAliasProxyHandler(tableAlias, false)))
  );
}
function mapColumnsInAliasedSQLToAlias(query, alias) {
  return new SQL.Aliased(mapColumnsInSQLToAlias(query.sql, alias), query.fieldAlias);
}
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
var ColumnAliasProxyHandler, TableAliasProxyHandler, RelationTableAliasProxyHandler;
var init_alias = __esm({
  "node_modules/drizzle-orm/alias.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_column();
    init_entity();
    init_sql();
    init_table();
    init_view_common();
    ColumnAliasProxyHandler = class {
      static {
        __name(this, "ColumnAliasProxyHandler");
      }
      constructor(table) {
        this.table = table;
      }
      static [entityKind] = "ColumnAliasProxyHandler";
      get(columnObj, prop) {
        if (prop === "table") {
          return this.table;
        }
        return columnObj[prop];
      }
    };
    TableAliasProxyHandler = class {
      static {
        __name(this, "TableAliasProxyHandler");
      }
      constructor(alias, replaceOriginalName) {
        this.alias = alias;
        this.replaceOriginalName = replaceOriginalName;
      }
      static [entityKind] = "TableAliasProxyHandler";
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
    RelationTableAliasProxyHandler = class {
      static {
        __name(this, "RelationTableAliasProxyHandler");
      }
      constructor(alias) {
        this.alias = alias;
      }
      static [entityKind] = "RelationTableAliasProxyHandler";
      get(target, prop) {
        if (prop === "sourceTable") {
          return aliasedTable(target.sourceTable, this.alias);
        }
        return target[prop];
      }
    };
    __name(aliasedTable, "aliasedTable");
    __name(aliasedTableColumn, "aliasedTableColumn");
    __name(mapColumnsInAliasedSQLToAlias, "mapColumnsInAliasedSQLToAlias");
    __name(mapColumnsInSQLToAlias, "mapColumnsInSQLToAlias");
  }
});

// node_modules/drizzle-orm/selection-proxy.js
var SelectionProxyHandler;
var init_selection_proxy = __esm({
  "node_modules/drizzle-orm/selection-proxy.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_alias();
    init_column();
    init_entity();
    init_sql();
    init_subquery();
    init_view_common();
    SelectionProxyHandler = class _SelectionProxyHandler {
      static {
        __name(this, "SelectionProxyHandler");
      }
      static [entityKind] = "SelectionProxyHandler";
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
  }
});

// node_modules/drizzle-orm/query-promise.js
var QueryPromise;
var init_query_promise = __esm({
  "node_modules/drizzle-orm/query-promise.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    QueryPromise = class {
      static {
        __name(this, "QueryPromise");
      }
      static [entityKind] = "QueryPromise";
      [Symbol.toStringTag] = "QueryPromise";
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
  }
});

// node_modules/drizzle-orm/sqlite-core/table.js
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
var InlineForeignKeys2, SQLiteTable, sqliteTable;
var init_table3 = __esm({
  "node_modules/drizzle-orm/sqlite-core/table.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    init_table();
    InlineForeignKeys2 = /* @__PURE__ */ Symbol.for("drizzle:SQLiteInlineForeignKeys");
    SQLiteTable = class extends Table {
      static {
        __name(this, "SQLiteTable");
      }
      static [entityKind] = "SQLiteTable";
      /** @internal */
      static Symbol = Object.assign({}, Table.Symbol, {
        InlineForeignKeys: InlineForeignKeys2
      });
      /** @internal */
      [Table.Symbol.Columns];
      /** @internal */
      [InlineForeignKeys2] = [];
      /** @internal */
      [Table.Symbol.ExtraConfigBuilder] = void 0;
    };
    __name(sqliteTableBase, "sqliteTableBase");
    sqliteTable = /* @__PURE__ */ __name((name, columns, extraConfig) => {
      return sqliteTableBase(name, columns, extraConfig);
    }, "sqliteTable");
  }
});

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
function getTableColumns(table) {
  return table[Table.Symbol.Columns];
}
function getTableLikeName(table) {
  return is(table, Subquery) ? table._.alias : is(table, View) ? table[ViewBaseConfig].name : is(table, SQL) ? void 0 : table[Table.Symbol.IsAlias] ? table[Table.Symbol.Name] : table[Table.Symbol.BaseName];
}
var init_utils = __esm({
  "node_modules/drizzle-orm/utils.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_column();
    init_entity();
    init_sql();
    init_subquery();
    init_table();
    init_view_common();
    __name(mapResultRow, "mapResultRow");
    __name(orderSelectedFields, "orderSelectedFields");
    __name(haveSameKeys, "haveSameKeys");
    __name(mapUpdateSet, "mapUpdateSet");
    __name(applyMixins, "applyMixins");
    __name(getTableColumns, "getTableColumns");
    __name(getTableLikeName, "getTableLikeName");
  }
});

// node_modules/drizzle-orm/sqlite-core/query-builders/delete.js
var SQLiteDeleteBase;
var init_delete = __esm({
  "node_modules/drizzle-orm/sqlite-core/query-builders/delete.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    init_query_promise();
    init_table3();
    init_utils();
    SQLiteDeleteBase = class extends QueryPromise {
      static {
        __name(this, "SQLiteDeleteBase");
      }
      constructor(table, session, dialect, withList) {
        super();
        this.table = table;
        this.session = session;
        this.dialect = dialect;
        this.config = { table, withList };
      }
      static [entityKind] = "SQLiteDelete";
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
      run = /* @__PURE__ */ __name((placeholderValues) => {
        return this._prepare().run(placeholderValues);
      }, "run");
      all = /* @__PURE__ */ __name((placeholderValues) => {
        return this._prepare().all(placeholderValues);
      }, "all");
      get = /* @__PURE__ */ __name((placeholderValues) => {
        return this._prepare().get(placeholderValues);
      }, "get");
      values = /* @__PURE__ */ __name((placeholderValues) => {
        return this._prepare().values(placeholderValues);
      }, "values");
      async execute(placeholderValues) {
        return this._prepare().execute(placeholderValues);
      }
      $dynamic() {
        return this;
      }
    };
  }
});

// node_modules/drizzle-orm/sqlite-core/query-builders/insert.js
var SQLiteInsertBuilder, SQLiteInsertBase;
var init_insert = __esm({
  "node_modules/drizzle-orm/sqlite-core/query-builders/insert.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    init_query_promise();
    init_sql();
    init_table3();
    init_table();
    init_utils();
    SQLiteInsertBuilder = class {
      static {
        __name(this, "SQLiteInsertBuilder");
      }
      constructor(table, session, dialect, withList) {
        this.table = table;
        this.session = session;
        this.dialect = dialect;
        this.withList = withList;
      }
      static [entityKind] = "SQLiteInsertBuilder";
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
    SQLiteInsertBase = class extends QueryPromise {
      static {
        __name(this, "SQLiteInsertBase");
      }
      constructor(table, values, session, dialect, withList) {
        super();
        this.session = session;
        this.dialect = dialect;
        this.config = { table, values, withList };
      }
      static [entityKind] = "SQLiteInsert";
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
      run = /* @__PURE__ */ __name((placeholderValues) => {
        return this._prepare().run(placeholderValues);
      }, "run");
      all = /* @__PURE__ */ __name((placeholderValues) => {
        return this._prepare().all(placeholderValues);
      }, "all");
      get = /* @__PURE__ */ __name((placeholderValues) => {
        return this._prepare().get(placeholderValues);
      }, "get");
      values = /* @__PURE__ */ __name((placeholderValues) => {
        return this._prepare().values(placeholderValues);
      }, "values");
      async execute() {
        return this.config.returning ? this.all() : this.run();
      }
      $dynamic() {
        return this;
      }
    };
  }
});

// node_modules/drizzle-orm/errors.js
var DrizzleError, TransactionRollbackError;
var init_errors = __esm({
  "node_modules/drizzle-orm/errors.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    DrizzleError = class extends Error {
      static {
        __name(this, "DrizzleError");
      }
      static [entityKind] = "DrizzleError";
      constructor({ message: message2, cause }) {
        super(message2);
        this.name = "DrizzleError";
        this.cause = cause;
      }
    };
    TransactionRollbackError = class extends DrizzleError {
      static {
        __name(this, "TransactionRollbackError");
      }
      static [entityKind] = "TransactionRollbackError";
      constructor() {
        super({ message: "Rollback" });
      }
    };
  }
});

// node_modules/drizzle-orm/sql/functions/aggregate.js
var init_aggregate = __esm({
  "node_modules/drizzle-orm/sql/functions/aggregate.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
  }
});

// node_modules/drizzle-orm/sql/functions/vector.js
var init_vector = __esm({
  "node_modules/drizzle-orm/sql/functions/vector.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
  }
});

// node_modules/drizzle-orm/sql/functions/index.js
var init_functions = __esm({
  "node_modules/drizzle-orm/sql/functions/index.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_aggregate();
    init_vector();
  }
});

// node_modules/drizzle-orm/sql/index.js
var init_sql2 = __esm({
  "node_modules/drizzle-orm/sql/index.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_expressions();
    init_functions();
    init_sql();
  }
});

// node_modules/drizzle-orm/sqlite-core/foreign-keys.js
var ForeignKeyBuilder2, ForeignKey2;
var init_foreign_keys2 = __esm({
  "node_modules/drizzle-orm/sqlite-core/foreign-keys.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    init_table3();
    ForeignKeyBuilder2 = class {
      static {
        __name(this, "ForeignKeyBuilder");
      }
      static [entityKind] = "SQLiteForeignKeyBuilder";
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
    ForeignKey2 = class {
      static {
        __name(this, "ForeignKey");
      }
      constructor(table, builder) {
        this.table = table;
        this.reference = builder.reference;
        this.onUpdate = builder._onUpdate;
        this.onDelete = builder._onDelete;
      }
      static [entityKind] = "SQLiteForeignKey";
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
  }
});

// node_modules/drizzle-orm/sqlite-core/unique-constraint.js
function uniqueKeyName2(table, columns) {
  return `${table[SQLiteTable.Symbol.Name]}_${columns.join("_")}_unique`;
}
var UniqueConstraintBuilder2, UniqueOnConstraintBuilder2, UniqueConstraint2;
var init_unique_constraint2 = __esm({
  "node_modules/drizzle-orm/sqlite-core/unique-constraint.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    init_table3();
    __name(uniqueKeyName2, "uniqueKeyName");
    UniqueConstraintBuilder2 = class {
      static {
        __name(this, "UniqueConstraintBuilder");
      }
      constructor(columns, name) {
        this.name = name;
        this.columns = columns;
      }
      static [entityKind] = "SQLiteUniqueConstraintBuilder";
      /** @internal */
      columns;
      /** @internal */
      build(table) {
        return new UniqueConstraint2(table, this.columns, this.name);
      }
    };
    UniqueOnConstraintBuilder2 = class {
      static {
        __name(this, "UniqueOnConstraintBuilder");
      }
      static [entityKind] = "SQLiteUniqueOnConstraintBuilder";
      /** @internal */
      name;
      constructor(name) {
        this.name = name;
      }
      on(...columns) {
        return new UniqueConstraintBuilder2(columns, this.name);
      }
    };
    UniqueConstraint2 = class {
      static {
        __name(this, "UniqueConstraint");
      }
      constructor(table, columns, name) {
        this.table = table;
        this.columns = columns;
        this.name = name ?? uniqueKeyName2(this.table, this.columns.map((column) => column.name));
      }
      static [entityKind] = "SQLiteUniqueConstraint";
      columns;
      name;
      getName() {
        return this.name;
      }
    };
  }
});

// node_modules/drizzle-orm/sqlite-core/columns/common.js
var SQLiteColumnBuilder, SQLiteColumn;
var init_common2 = __esm({
  "node_modules/drizzle-orm/sqlite-core/columns/common.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_column_builder();
    init_column();
    init_entity();
    init_foreign_keys2();
    init_unique_constraint2();
    SQLiteColumnBuilder = class extends ColumnBuilder {
      static {
        __name(this, "SQLiteColumnBuilder");
      }
      static [entityKind] = "SQLiteColumnBuilder";
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
    SQLiteColumn = class extends Column {
      static {
        __name(this, "SQLiteColumn");
      }
      constructor(table, config) {
        if (!config.uniqueName) {
          config.uniqueName = uniqueKeyName2(table, [config.name]);
        }
        super(table, config);
        this.table = table;
      }
      static [entityKind] = "SQLiteColumn";
    };
  }
});

// node_modules/drizzle-orm/sqlite-core/columns/blob.js
var SQLiteBigIntBuilder, SQLiteBigInt, SQLiteBlobJsonBuilder, SQLiteBlobJson, SQLiteBlobBufferBuilder, SQLiteBlobBuffer;
var init_blob = __esm({
  "node_modules/drizzle-orm/sqlite-core/columns/blob.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    init_common2();
    SQLiteBigIntBuilder = class extends SQLiteColumnBuilder {
      static {
        __name(this, "SQLiteBigIntBuilder");
      }
      static [entityKind] = "SQLiteBigIntBuilder";
      constructor(name) {
        super(name, "bigint", "SQLiteBigInt");
      }
      /** @internal */
      build(table) {
        return new SQLiteBigInt(table, this.config);
      }
    };
    SQLiteBigInt = class extends SQLiteColumn {
      static {
        __name(this, "SQLiteBigInt");
      }
      static [entityKind] = "SQLiteBigInt";
      getSQLType() {
        return "blob";
      }
      mapFromDriverValue(value) {
        return BigInt(value.toString());
      }
      mapToDriverValue(value) {
        return Buffer.from(value.toString());
      }
    };
    SQLiteBlobJsonBuilder = class extends SQLiteColumnBuilder {
      static {
        __name(this, "SQLiteBlobJsonBuilder");
      }
      static [entityKind] = "SQLiteBlobJsonBuilder";
      constructor(name) {
        super(name, "json", "SQLiteBlobJson");
      }
      /** @internal */
      build(table) {
        return new SQLiteBlobJson(
          table,
          this.config
        );
      }
    };
    SQLiteBlobJson = class extends SQLiteColumn {
      static {
        __name(this, "SQLiteBlobJson");
      }
      static [entityKind] = "SQLiteBlobJson";
      getSQLType() {
        return "blob";
      }
      mapFromDriverValue(value) {
        return JSON.parse(value.toString());
      }
      mapToDriverValue(value) {
        return Buffer.from(JSON.stringify(value));
      }
    };
    SQLiteBlobBufferBuilder = class extends SQLiteColumnBuilder {
      static {
        __name(this, "SQLiteBlobBufferBuilder");
      }
      static [entityKind] = "SQLiteBlobBufferBuilder";
      constructor(name) {
        super(name, "buffer", "SQLiteBlobBuffer");
      }
      /** @internal */
      build(table) {
        return new SQLiteBlobBuffer(table, this.config);
      }
    };
    SQLiteBlobBuffer = class extends SQLiteColumn {
      static {
        __name(this, "SQLiteBlobBuffer");
      }
      static [entityKind] = "SQLiteBlobBuffer";
      getSQLType() {
        return "blob";
      }
    };
  }
});

// node_modules/drizzle-orm/sqlite-core/columns/custom.js
var SQLiteCustomColumnBuilder, SQLiteCustomColumn;
var init_custom = __esm({
  "node_modules/drizzle-orm/sqlite-core/columns/custom.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    init_common2();
    SQLiteCustomColumnBuilder = class extends SQLiteColumnBuilder {
      static {
        __name(this, "SQLiteCustomColumnBuilder");
      }
      static [entityKind] = "SQLiteCustomColumnBuilder";
      constructor(name, fieldConfig, customTypeParams) {
        super(name, "custom", "SQLiteCustomColumn");
        this.config.fieldConfig = fieldConfig;
        this.config.customTypeParams = customTypeParams;
      }
      /** @internal */
      build(table) {
        return new SQLiteCustomColumn(
          table,
          this.config
        );
      }
    };
    SQLiteCustomColumn = class extends SQLiteColumn {
      static {
        __name(this, "SQLiteCustomColumn");
      }
      static [entityKind] = "SQLiteCustomColumn";
      sqlName;
      mapTo;
      mapFrom;
      constructor(table, config) {
        super(table, config);
        this.sqlName = config.customTypeParams.dataType(config.fieldConfig);
        this.mapTo = config.customTypeParams.toDriver;
        this.mapFrom = config.customTypeParams.fromDriver;
      }
      getSQLType() {
        return this.sqlName;
      }
      mapFromDriverValue(value) {
        return typeof this.mapFrom === "function" ? this.mapFrom(value) : value;
      }
      mapToDriverValue(value) {
        return typeof this.mapTo === "function" ? this.mapTo(value) : value;
      }
    };
  }
});

// node_modules/drizzle-orm/sqlite-core/columns/integer.js
function integer(name, config) {
  if (config?.mode === "timestamp" || config?.mode === "timestamp_ms") {
    return new SQLiteTimestampBuilder(name, config.mode);
  }
  if (config?.mode === "boolean") {
    return new SQLiteBooleanBuilder(name, config.mode);
  }
  return new SQLiteIntegerBuilder(name);
}
var SQLiteBaseIntegerBuilder, SQLiteBaseInteger, SQLiteIntegerBuilder, SQLiteInteger, SQLiteTimestampBuilder, SQLiteTimestamp, SQLiteBooleanBuilder, SQLiteBoolean;
var init_integer = __esm({
  "node_modules/drizzle-orm/sqlite-core/columns/integer.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    init_sql();
    init_common2();
    SQLiteBaseIntegerBuilder = class extends SQLiteColumnBuilder {
      static {
        __name(this, "SQLiteBaseIntegerBuilder");
      }
      static [entityKind] = "SQLiteBaseIntegerBuilder";
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
    SQLiteBaseInteger = class extends SQLiteColumn {
      static {
        __name(this, "SQLiteBaseInteger");
      }
      static [entityKind] = "SQLiteBaseInteger";
      autoIncrement = this.config.autoIncrement;
      getSQLType() {
        return "integer";
      }
    };
    SQLiteIntegerBuilder = class extends SQLiteBaseIntegerBuilder {
      static {
        __name(this, "SQLiteIntegerBuilder");
      }
      static [entityKind] = "SQLiteIntegerBuilder";
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
    SQLiteInteger = class extends SQLiteBaseInteger {
      static {
        __name(this, "SQLiteInteger");
      }
      static [entityKind] = "SQLiteInteger";
    };
    SQLiteTimestampBuilder = class extends SQLiteBaseIntegerBuilder {
      static {
        __name(this, "SQLiteTimestampBuilder");
      }
      static [entityKind] = "SQLiteTimestampBuilder";
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
    SQLiteTimestamp = class extends SQLiteBaseInteger {
      static {
        __name(this, "SQLiteTimestamp");
      }
      static [entityKind] = "SQLiteTimestamp";
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
    SQLiteBooleanBuilder = class extends SQLiteBaseIntegerBuilder {
      static {
        __name(this, "SQLiteBooleanBuilder");
      }
      static [entityKind] = "SQLiteBooleanBuilder";
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
    SQLiteBoolean = class extends SQLiteBaseInteger {
      static {
        __name(this, "SQLiteBoolean");
      }
      static [entityKind] = "SQLiteBoolean";
      mode = this.config.mode;
      mapFromDriverValue(value) {
        return Number(value) === 1;
      }
      mapToDriverValue(value) {
        return value ? 1 : 0;
      }
    };
    __name(integer, "integer");
  }
});

// node_modules/drizzle-orm/sqlite-core/columns/numeric.js
var SQLiteNumericBuilder, SQLiteNumeric;
var init_numeric = __esm({
  "node_modules/drizzle-orm/sqlite-core/columns/numeric.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    init_common2();
    SQLiteNumericBuilder = class extends SQLiteColumnBuilder {
      static {
        __name(this, "SQLiteNumericBuilder");
      }
      static [entityKind] = "SQLiteNumericBuilder";
      constructor(name) {
        super(name, "string", "SQLiteNumeric");
      }
      /** @internal */
      build(table) {
        return new SQLiteNumeric(
          table,
          this.config
        );
      }
    };
    SQLiteNumeric = class extends SQLiteColumn {
      static {
        __name(this, "SQLiteNumeric");
      }
      static [entityKind] = "SQLiteNumeric";
      getSQLType() {
        return "numeric";
      }
    };
  }
});

// node_modules/drizzle-orm/sqlite-core/columns/real.js
function real(name) {
  return new SQLiteRealBuilder(name);
}
var SQLiteRealBuilder, SQLiteReal;
var init_real = __esm({
  "node_modules/drizzle-orm/sqlite-core/columns/real.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    init_common2();
    SQLiteRealBuilder = class extends SQLiteColumnBuilder {
      static {
        __name(this, "SQLiteRealBuilder");
      }
      static [entityKind] = "SQLiteRealBuilder";
      constructor(name) {
        super(name, "number", "SQLiteReal");
      }
      /** @internal */
      build(table) {
        return new SQLiteReal(table, this.config);
      }
    };
    SQLiteReal = class extends SQLiteColumn {
      static {
        __name(this, "SQLiteReal");
      }
      static [entityKind] = "SQLiteReal";
      getSQLType() {
        return "real";
      }
    };
    __name(real, "real");
  }
});

// node_modules/drizzle-orm/sqlite-core/columns/text.js
function text(name, config = {}) {
  return config.mode === "json" ? new SQLiteTextJsonBuilder(name) : new SQLiteTextBuilder(name, config);
}
var SQLiteTextBuilder, SQLiteText, SQLiteTextJsonBuilder, SQLiteTextJson;
var init_text = __esm({
  "node_modules/drizzle-orm/sqlite-core/columns/text.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    init_common2();
    SQLiteTextBuilder = class extends SQLiteColumnBuilder {
      static {
        __name(this, "SQLiteTextBuilder");
      }
      static [entityKind] = "SQLiteTextBuilder";
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
    SQLiteText = class extends SQLiteColumn {
      static {
        __name(this, "SQLiteText");
      }
      static [entityKind] = "SQLiteText";
      enumValues = this.config.enumValues;
      length = this.config.length;
      constructor(table, config) {
        super(table, config);
      }
      getSQLType() {
        return `text${this.config.length ? `(${this.config.length})` : ""}`;
      }
    };
    SQLiteTextJsonBuilder = class extends SQLiteColumnBuilder {
      static {
        __name(this, "SQLiteTextJsonBuilder");
      }
      static [entityKind] = "SQLiteTextJsonBuilder";
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
    SQLiteTextJson = class extends SQLiteColumn {
      static {
        __name(this, "SQLiteTextJson");
      }
      static [entityKind] = "SQLiteTextJson";
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
    __name(text, "text");
  }
});

// node_modules/drizzle-orm/sqlite-core/columns/index.js
var init_columns = __esm({
  "node_modules/drizzle-orm/sqlite-core/columns/index.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_blob();
    init_common2();
    init_custom();
    init_integer();
    init_numeric();
    init_real();
    init_text();
  }
});

// node_modules/drizzle-orm/sqlite-core/view-base.js
var SQLiteViewBase;
var init_view_base = __esm({
  "node_modules/drizzle-orm/sqlite-core/view-base.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    init_sql();
    SQLiteViewBase = class extends View {
      static {
        __name(this, "SQLiteViewBase");
      }
      static [entityKind] = "SQLiteViewBase";
    };
  }
});

// node_modules/drizzle-orm/sqlite-core/dialect.js
var SQLiteDialect, SQLiteSyncDialect, SQLiteAsyncDialect;
var init_dialect = __esm({
  "node_modules/drizzle-orm/sqlite-core/dialect.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_alias();
    init_column();
    init_entity();
    init_errors();
    init_relations();
    init_sql2();
    init_sql();
    init_columns();
    init_table3();
    init_subquery();
    init_table();
    init_utils();
    init_view_common();
    init_view_base();
    SQLiteDialect = class {
      static {
        __name(this, "SQLiteDialect");
      }
      static [entityKind] = "SQLiteDialect";
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
      sqlToQuery(sql22, invokeSource) {
        return sql22.toQuery({
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
    SQLiteSyncDialect = class extends SQLiteDialect {
      static {
        __name(this, "SQLiteSyncDialect");
      }
      static [entityKind] = "SQLiteSyncDialect";
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
    SQLiteAsyncDialect = class extends SQLiteDialect {
      static {
        __name(this, "SQLiteAsyncDialect");
      }
      static [entityKind] = "SQLiteAsyncDialect";
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
  }
});

// node_modules/drizzle-orm/query-builders/query-builder.js
var TypedQueryBuilder;
var init_query_builder = __esm({
  "node_modules/drizzle-orm/query-builders/query-builder.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    TypedQueryBuilder = class {
      static {
        __name(this, "TypedQueryBuilder");
      }
      static [entityKind] = "TypedQueryBuilder";
      /** @internal */
      getSelectedFields() {
        return this._.selectedFields;
      }
    };
  }
});

// node_modules/drizzle-orm/sqlite-core/query-builders/select.js
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
var SQLiteSelectBuilder, SQLiteSelectQueryBuilderBase, SQLiteSelectBase, getSQLiteSetOperators, union, unionAll, intersect, except;
var init_select2 = __esm({
  "node_modules/drizzle-orm/sqlite-core/query-builders/select.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    init_query_builder();
    init_query_promise();
    init_selection_proxy();
    init_sql();
    init_subquery();
    init_table();
    init_utils();
    init_view_common();
    init_view_base();
    SQLiteSelectBuilder = class {
      static {
        __name(this, "SQLiteSelectBuilder");
      }
      static [entityKind] = "SQLiteSelectBuilder";
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
    SQLiteSelectQueryBuilderBase = class extends TypedQueryBuilder {
      static {
        __name(this, "SQLiteSelectQueryBuilderBase");
      }
      static [entityKind] = "SQLiteSelectQueryBuilder";
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
    SQLiteSelectBase = class extends SQLiteSelectQueryBuilderBase {
      static {
        __name(this, "SQLiteSelectBase");
      }
      static [entityKind] = "SQLiteSelect";
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
      run = /* @__PURE__ */ __name((placeholderValues) => {
        return this._prepare().run(placeholderValues);
      }, "run");
      all = /* @__PURE__ */ __name((placeholderValues) => {
        return this._prepare().all(placeholderValues);
      }, "all");
      get = /* @__PURE__ */ __name((placeholderValues) => {
        return this._prepare().get(placeholderValues);
      }, "get");
      values = /* @__PURE__ */ __name((placeholderValues) => {
        return this._prepare().values(placeholderValues);
      }, "values");
      async execute() {
        return this.all();
      }
    };
    applyMixins(SQLiteSelectBase, [QueryPromise]);
    __name(createSetOperator, "createSetOperator");
    getSQLiteSetOperators = /* @__PURE__ */ __name(() => ({
      union,
      unionAll,
      intersect,
      except
    }), "getSQLiteSetOperators");
    union = createSetOperator("union", false);
    unionAll = createSetOperator("union", true);
    intersect = createSetOperator("intersect", false);
    except = createSetOperator("except", false);
  }
});

// node_modules/drizzle-orm/sqlite-core/query-builders/query-builder.js
var QueryBuilder;
var init_query_builder2 = __esm({
  "node_modules/drizzle-orm/sqlite-core/query-builders/query-builder.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    init_selection_proxy();
    init_dialect();
    init_subquery();
    init_select2();
    QueryBuilder = class {
      static {
        __name(this, "QueryBuilder");
      }
      static [entityKind] = "SQLiteQueryBuilder";
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
  }
});

// node_modules/drizzle-orm/sqlite-core/query-builders/select.types.js
var init_select_types = __esm({
  "node_modules/drizzle-orm/sqlite-core/query-builders/select.types.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
  }
});

// node_modules/drizzle-orm/sqlite-core/query-builders/update.js
var SQLiteUpdateBuilder, SQLiteUpdateBase;
var init_update = __esm({
  "node_modules/drizzle-orm/sqlite-core/query-builders/update.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    init_query_promise();
    init_table3();
    init_utils();
    SQLiteUpdateBuilder = class {
      static {
        __name(this, "SQLiteUpdateBuilder");
      }
      constructor(table, session, dialect, withList) {
        this.table = table;
        this.session = session;
        this.dialect = dialect;
        this.withList = withList;
      }
      static [entityKind] = "SQLiteUpdateBuilder";
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
    SQLiteUpdateBase = class extends QueryPromise {
      static {
        __name(this, "SQLiteUpdateBase");
      }
      constructor(table, set, session, dialect, withList) {
        super();
        this.session = session;
        this.dialect = dialect;
        this.config = { set, table, withList };
      }
      static [entityKind] = "SQLiteUpdate";
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
      run = /* @__PURE__ */ __name((placeholderValues) => {
        return this._prepare().run(placeholderValues);
      }, "run");
      all = /* @__PURE__ */ __name((placeholderValues) => {
        return this._prepare().all(placeholderValues);
      }, "all");
      get = /* @__PURE__ */ __name((placeholderValues) => {
        return this._prepare().get(placeholderValues);
      }, "get");
      values = /* @__PURE__ */ __name((placeholderValues) => {
        return this._prepare().values(placeholderValues);
      }, "values");
      async execute() {
        return this.config.returning ? this.all() : this.run();
      }
      $dynamic() {
        return this;
      }
    };
  }
});

// node_modules/drizzle-orm/sqlite-core/query-builders/index.js
var init_query_builders = __esm({
  "node_modules/drizzle-orm/sqlite-core/query-builders/index.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_delete();
    init_insert();
    init_query_builder2();
    init_select2();
    init_select_types();
    init_update();
  }
});

// node_modules/drizzle-orm/sqlite-core/query-builders/query.js
var RelationalQueryBuilder, SQLiteRelationalQuery, SQLiteSyncRelationalQuery;
var init_query = __esm({
  "node_modules/drizzle-orm/sqlite-core/query-builders/query.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    init_query_promise();
    init_relations();
    RelationalQueryBuilder = class {
      static {
        __name(this, "RelationalQueryBuilder");
      }
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
      static [entityKind] = "SQLiteAsyncRelationalQueryBuilder";
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
    SQLiteRelationalQuery = class extends QueryPromise {
      static {
        __name(this, "SQLiteRelationalQuery");
      }
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
      static [entityKind] = "SQLiteAsyncRelationalQuery";
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
    SQLiteSyncRelationalQuery = class extends SQLiteRelationalQuery {
      static {
        __name(this, "SQLiteSyncRelationalQuery");
      }
      static [entityKind] = "SQLiteSyncRelationalQuery";
      sync() {
        return this.executeRaw();
      }
    };
  }
});

// node_modules/drizzle-orm/sqlite-core/query-builders/raw.js
var SQLiteRaw;
var init_raw = __esm({
  "node_modules/drizzle-orm/sqlite-core/query-builders/raw.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    init_query_promise();
    SQLiteRaw = class extends QueryPromise {
      static {
        __name(this, "SQLiteRaw");
      }
      constructor(execute, getSQL, action, dialect, mapBatchResult) {
        super();
        this.execute = execute;
        this.getSQL = getSQL;
        this.dialect = dialect;
        this.mapBatchResult = mapBatchResult;
        this.config = { action };
      }
      static [entityKind] = "SQLiteRaw";
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
  }
});

// node_modules/drizzle-orm/sqlite-core/db.js
var BaseSQLiteDatabase;
var init_db = __esm({
  "node_modules/drizzle-orm/sqlite-core/db.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    init_selection_proxy();
    init_query_builders();
    init_subquery();
    init_query();
    init_raw();
    BaseSQLiteDatabase = class {
      static {
        __name(this, "BaseSQLiteDatabase");
      }
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
      static [entityKind] = "BaseSQLiteDatabase";
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
        const sql3 = query.getSQL();
        if (this.resultKind === "async") {
          return new SQLiteRaw(
            async () => this.session.run(sql3),
            () => sql3,
            "run",
            this.dialect,
            this.session.extractRawRunValueFromBatchResult.bind(this.session)
          );
        }
        return this.session.run(sql3);
      }
      all(query) {
        const sql3 = query.getSQL();
        if (this.resultKind === "async") {
          return new SQLiteRaw(
            async () => this.session.all(sql3),
            () => sql3,
            "all",
            this.dialect,
            this.session.extractRawAllValueFromBatchResult.bind(this.session)
          );
        }
        return this.session.all(sql3);
      }
      get(query) {
        const sql3 = query.getSQL();
        if (this.resultKind === "async") {
          return new SQLiteRaw(
            async () => this.session.get(sql3),
            () => sql3,
            "get",
            this.dialect,
            this.session.extractRawGetValueFromBatchResult.bind(this.session)
          );
        }
        return this.session.get(sql3);
      }
      values(query) {
        const sql3 = query.getSQL();
        if (this.resultKind === "async") {
          return new SQLiteRaw(
            async () => this.session.values(sql3),
            () => sql3,
            "values",
            this.dialect,
            this.session.extractRawValuesValueFromBatchResult.bind(this.session)
          );
        }
        return this.session.values(sql3);
      }
      transaction(transaction, config) {
        return this.session.transaction(transaction, config);
      }
    };
  }
});

// node_modules/drizzle-orm/sqlite-core/alias.js
var init_alias2 = __esm({
  "node_modules/drizzle-orm/sqlite-core/alias.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
  }
});

// node_modules/drizzle-orm/sqlite-core/checks.js
var CheckBuilder, Check;
var init_checks = __esm({
  "node_modules/drizzle-orm/sqlite-core/checks.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    CheckBuilder = class {
      static {
        __name(this, "CheckBuilder");
      }
      constructor(name, value) {
        this.name = name;
        this.value = value;
      }
      static [entityKind] = "SQLiteCheckBuilder";
      brand;
      build(table) {
        return new Check(table, this);
      }
    };
    Check = class {
      static {
        __name(this, "Check");
      }
      constructor(table, builder) {
        this.table = table;
        this.name = builder.name;
        this.value = builder.value;
      }
      static [entityKind] = "SQLiteCheck";
      name;
      value;
    };
  }
});

// node_modules/drizzle-orm/sqlite-core/indexes.js
function uniqueIndex(name) {
  return new IndexBuilderOn(name, true);
}
var IndexBuilderOn, IndexBuilder, Index;
var init_indexes = __esm({
  "node_modules/drizzle-orm/sqlite-core/indexes.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    IndexBuilderOn = class {
      static {
        __name(this, "IndexBuilderOn");
      }
      constructor(name, unique) {
        this.name = name;
        this.unique = unique;
      }
      static [entityKind] = "SQLiteIndexBuilderOn";
      on(...columns) {
        return new IndexBuilder(this.name, columns, this.unique);
      }
    };
    IndexBuilder = class {
      static {
        __name(this, "IndexBuilder");
      }
      static [entityKind] = "SQLiteIndexBuilder";
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
    Index = class {
      static {
        __name(this, "Index");
      }
      static [entityKind] = "SQLiteIndex";
      config;
      constructor(config, table) {
        this.config = { ...config, table };
      }
    };
    __name(uniqueIndex, "uniqueIndex");
  }
});

// node_modules/drizzle-orm/sqlite-core/primary-keys.js
var PrimaryKeyBuilder2, PrimaryKey2;
var init_primary_keys2 = __esm({
  "node_modules/drizzle-orm/sqlite-core/primary-keys.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    init_table3();
    PrimaryKeyBuilder2 = class {
      static {
        __name(this, "PrimaryKeyBuilder");
      }
      static [entityKind] = "SQLitePrimaryKeyBuilder";
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
        return new PrimaryKey2(table, this.columns, this.name);
      }
    };
    PrimaryKey2 = class {
      static {
        __name(this, "PrimaryKey");
      }
      constructor(table, columns, name) {
        this.table = table;
        this.columns = columns;
        this.name = name;
      }
      static [entityKind] = "SQLitePrimaryKey";
      columns;
      name;
      getName() {
        return this.name ?? `${this.table[SQLiteTable.Symbol.Name]}_${this.columns.map((column) => column.name).join("_")}_pk`;
      }
    };
  }
});

// node_modules/drizzle-orm/sqlite-core/session.js
var ExecuteResultSync, SQLitePreparedQuery, SQLiteSession, SQLiteTransaction;
var init_session = __esm({
  "node_modules/drizzle-orm/sqlite-core/session.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    init_errors();
    init_query_promise();
    init_db();
    ExecuteResultSync = class extends QueryPromise {
      static {
        __name(this, "ExecuteResultSync");
      }
      constructor(resultCb) {
        super();
        this.resultCb = resultCb;
      }
      static [entityKind] = "ExecuteResultSync";
      async execute() {
        return this.resultCb();
      }
      sync() {
        return this.resultCb();
      }
    };
    SQLitePreparedQuery = class {
      static {
        __name(this, "SQLitePreparedQuery");
      }
      constructor(mode, executeMethod, query) {
        this.mode = mode;
        this.executeMethod = executeMethod;
        this.query = query;
      }
      static [entityKind] = "PreparedQuery";
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
    SQLiteSession = class {
      static {
        __name(this, "SQLiteSession");
      }
      constructor(dialect) {
        this.dialect = dialect;
      }
      static [entityKind] = "SQLiteSession";
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
    SQLiteTransaction = class extends BaseSQLiteDatabase {
      static {
        __name(this, "SQLiteTransaction");
      }
      constructor(resultType, dialect, session, schema, nestedIndex = 0) {
        super(resultType, dialect, session, schema);
        this.schema = schema;
        this.nestedIndex = nestedIndex;
      }
      static [entityKind] = "SQLiteTransaction";
      rollback() {
        throw new TransactionRollbackError();
      }
    };
  }
});

// node_modules/drizzle-orm/sqlite-core/subquery.js
var init_subquery2 = __esm({
  "node_modules/drizzle-orm/sqlite-core/subquery.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
  }
});

// node_modules/drizzle-orm/sqlite-core/view-common.js
var SQLiteViewConfig;
var init_view_common2 = __esm({
  "node_modules/drizzle-orm/sqlite-core/view-common.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    SQLiteViewConfig = /* @__PURE__ */ Symbol.for("drizzle:SQLiteViewConfig");
  }
});

// node_modules/drizzle-orm/sqlite-core/utils.js
var init_utils2 = __esm({
  "node_modules/drizzle-orm/sqlite-core/utils.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
  }
});

// node_modules/drizzle-orm/sqlite-core/view.js
var ViewBuilderCore, ViewBuilder, ManualViewBuilder, SQLiteView;
var init_view = __esm({
  "node_modules/drizzle-orm/sqlite-core/view.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_entity();
    init_selection_proxy();
    init_utils();
    init_query_builder2();
    init_table3();
    init_view_base();
    init_view_common2();
    ViewBuilderCore = class {
      static {
        __name(this, "ViewBuilderCore");
      }
      constructor(name) {
        this.name = name;
      }
      static [entityKind] = "SQLiteViewBuilderCore";
      config = {};
    };
    ViewBuilder = class extends ViewBuilderCore {
      static {
        __name(this, "ViewBuilder");
      }
      static [entityKind] = "SQLiteViewBuilder";
      as(qb) {
        if (typeof qb === "function") {
          qb = qb(new QueryBuilder());
        }
        const selectionProxy = new SelectionProxyHandler({
          alias: this.name,
          sqlBehavior: "error",
          sqlAliasedBehavior: "alias",
          replaceOriginalName: true
        });
        const aliasedSelectedFields = qb.getSelectedFields();
        return new Proxy(
          new SQLiteView({
            sqliteConfig: this.config,
            config: {
              name: this.name,
              schema: void 0,
              selectedFields: aliasedSelectedFields,
              query: qb.getSQL().inlineParams()
            }
          }),
          selectionProxy
        );
      }
    };
    ManualViewBuilder = class extends ViewBuilderCore {
      static {
        __name(this, "ManualViewBuilder");
      }
      static [entityKind] = "SQLiteManualViewBuilder";
      columns;
      constructor(name, columns) {
        super(name);
        this.columns = getTableColumns(sqliteTable(name, columns));
      }
      existing() {
        return new Proxy(
          new SQLiteView({
            sqliteConfig: void 0,
            config: {
              name: this.name,
              schema: void 0,
              selectedFields: this.columns,
              query: void 0
            }
          }),
          new SelectionProxyHandler({
            alias: this.name,
            sqlBehavior: "error",
            sqlAliasedBehavior: "alias",
            replaceOriginalName: true
          })
        );
      }
      as(query) {
        return new Proxy(
          new SQLiteView({
            sqliteConfig: this.config,
            config: {
              name: this.name,
              schema: void 0,
              selectedFields: this.columns,
              query: query.inlineParams()
            }
          }),
          new SelectionProxyHandler({
            alias: this.name,
            sqlBehavior: "error",
            sqlAliasedBehavior: "alias",
            replaceOriginalName: true
          })
        );
      }
    };
    SQLiteView = class extends SQLiteViewBase {
      static {
        __name(this, "SQLiteView");
      }
      static [entityKind] = "SQLiteView";
      /** @internal */
      [SQLiteViewConfig];
      constructor({ sqliteConfig, config }) {
        super(config);
        this[SQLiteViewConfig] = sqliteConfig;
      }
    };
  }
});

// node_modules/drizzle-orm/sqlite-core/index.js
var init_sqlite_core = __esm({
  "node_modules/drizzle-orm/sqlite-core/index.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_alias2();
    init_checks();
    init_columns();
    init_db();
    init_dialect();
    init_foreign_keys2();
    init_indexes();
    init_primary_keys2();
    init_query_builders();
    init_session();
    init_subquery2();
    init_table3();
    init_unique_constraint2();
    init_utils2();
    init_view();
  }
});

// node_modules/drizzle-orm/expressions.js
var init_expressions2 = __esm({
  "node_modules/drizzle-orm/expressions.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_expressions();
  }
});

// node_modules/drizzle-orm/operations.js
var init_operations = __esm({
  "node_modules/drizzle-orm/operations.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
  }
});

// node_modules/drizzle-orm/index.js
var init_drizzle_orm = __esm({
  "node_modules/drizzle-orm/index.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_alias();
    init_column_builder();
    init_column();
    init_entity();
    init_errors();
    init_expressions2();
    init_logger();
    init_operations();
    init_query_promise();
    init_relations();
    init_sql2();
    init_subquery();
    init_table();
    init_utils();
    init_view_common();
  }
});

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  gameLineSnapshots: () => gameLineSnapshots,
  leagueMembers: () => leagueMembers,
  leagueMembersRelations: () => leagueMembersRelations,
  leagues: () => leagues,
  leaguesRelations: () => leaguesRelations,
  matchups: () => matchups,
  matchupsRelations: () => matchupsRelations,
  nflGames: () => nflGames,
  nflPlayers: () => nflPlayers,
  nflPlayersRelations: () => nflPlayersRelations,
  passwordResetTokens: () => passwordResetTokens,
  playerNews: () => playerNews,
  playerNewsRelations: () => playerNewsRelations,
  playerProjections: () => playerProjections,
  playerProjectionsRelations: () => playerProjectionsRelations,
  playerWeeklyStats: () => playerWeeklyStats,
  playerWeeklyStatsRelations: () => playerWeeklyStatsRelations,
  projectionLineSnapshots: () => projectionLineSnapshots,
  rosterSpots: () => rosterSpots,
  rosterSpotsRelations: () => rosterSpotsRelations,
  sessions: () => sessions,
  sessionsRelations: () => sessionsRelations,
  teams: () => teams,
  teamsRelations: () => teamsRelations,
  tradeItems: () => tradeItems,
  trades: () => trades,
  transactions: () => transactions,
  userFeedback: () => userFeedback,
  users: () => users,
  usersRelations: () => usersRelations
});
var users, sessions, leagues, leagueMembers, teams, rosterSpots, nflPlayers, playerWeeklyStats, playerProjections, projectionLineSnapshots, gameLineSnapshots, matchups, transactions, trades, tradeItems, nflGames, playerNews, usersRelations, sessionsRelations, leaguesRelations, leagueMembersRelations, teamsRelations, rosterSpotsRelations, nflPlayersRelations, playerWeeklyStatsRelations, playerProjectionsRelations, matchupsRelations, playerNewsRelations, passwordResetTokens, userFeedback;
var init_schema = __esm({
  "src/db/schema.ts"() {
    "use strict";
    init_checked_fetch();
    init_modules_watch_stub();
    init_sqlite_core();
    init_drizzle_orm();
    users = sqliteTable("users", {
      id: text("id").primaryKey(),
      email: text("email").notNull().unique(),
      passwordHash: text("password_hash"),
      username: text("username").notNull().unique(),
      googleId: text("google_id"),
      yahooAccessToken: text("yahoo_access_token"),
      yahooRefreshToken: text("yahoo_refresh_token"),
      yahooTokenExpiresAt: integer("yahoo_token_expires_at", { mode: "timestamp" }),
      avatarUrl: text("avatar_url"),
      preferredScoring: text("preferred_scoring").default("ppr"),
      darkMode: integer("dark_mode", { mode: "boolean" }).default(true),
      notificationsEnabled: integer("notifications_enabled", { mode: "boolean" }).default(true),
      createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => /* @__PURE__ */ new Date()),
      updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => /* @__PURE__ */ new Date())
    });
    sessions = sqliteTable("sessions", {
      id: text("id").primaryKey(),
      userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
      token: text("token").notNull().unique(),
      expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
      createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => /* @__PURE__ */ new Date())
    });
    leagues = sqliteTable("leagues", {
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
    leagueMembers = sqliteTable("league_members", {
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
    teams = sqliteTable("teams", {
      id: text("id").primaryKey(),
      leagueId: text("league_id").notNull().references(() => leagues.id, { onDelete: "cascade" }),
      ownerId: text("owner_id").notNull().references(() => users.id),
      externalOwnerId: text("external_owner_id"),
      // Sleeper/ESPN user ID - identifies which platform user owns this team
      ownerDisplayName: text("owner_display_name"),
      // Display name from Sleeper/ESPN/Yahoo (so we don't show the app user for every team)
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
    rosterSpots = sqliteTable("roster_spots", {
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
    nflPlayers = sqliteTable("nfl_players", {
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
    playerWeeklyStats = sqliteTable("player_weekly_stats", {
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
      // Snap counts (from Sleeper - for played detection and snap %)
      offSnaps: integer("off_snaps").default(0),
      defSnaps: integer("def_snaps").default(0),
      stSnaps: integer("st_snaps").default(0),
      tmOffSnaps: integer("tm_off_snaps").default(0),
      tmDefSnaps: integer("tm_def_snaps").default(0),
      tmStSnaps: integer("tm_st_snaps").default(0),
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
    playerProjections = sqliteTable("player_projections", {
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
    projectionLineSnapshots = sqliteTable("projection_line_snapshots", {
      id: text("id").primaryKey(),
      playerId: text("player_id").notNull().references(() => nflPlayers.id, { onDelete: "cascade" }),
      week: integer("week").notNull(),
      seasonYear: integer("season_year").notNull(),
      scoringFormat: text("scoring_format").notNull(),
      snapshotAt: integer("snapshot_at", { mode: "timestamp" }).notNull(),
      projectedPoints: real("projected_points").notNull(),
      projPassYards: real("proj_pass_yards"),
      projPassTDs: real("proj_pass_tds"),
      projRushYards: real("proj_rush_yards"),
      projRushTDs: real("proj_rush_tds"),
      projReceptions: real("proj_receptions"),
      projRecYards: real("proj_rec_yards"),
      projRecTDs: real("proj_rec_tds")
    }, (table) => ({
      snapPlayerWeekIdx: uniqueIndex("proj_snap_player_week").on(table.playerId, table.week, table.seasonYear, table.scoringFormat, table.snapshotAt)
    }));
    gameLineSnapshots = sqliteTable("game_line_snapshots", {
      id: text("id").primaryKey(),
      gameId: text("game_id").notNull().references(() => nflGames.id, { onDelete: "cascade" }),
      snapshotAt: integer("snapshot_at", { mode: "timestamp" }).notNull(),
      spread: real("spread"),
      overUnder: real("over_under")
    }, (table) => ({
      snapGameIdx: uniqueIndex("game_snap_game").on(table.gameId, table.snapshotAt)
    }));
    matchups = sqliteTable("matchups", {
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
    transactions = sqliteTable("transactions", {
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
    trades = sqliteTable("trades", {
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
    tradeItems = sqliteTable("trade_items", {
      id: text("id").primaryKey(),
      tradeId: text("trade_id").notNull().references(() => trades.id, { onDelete: "cascade" }),
      fromTeamId: text("from_team_id").notNull().references(() => teams.id),
      toTeamId: text("to_team_id").notNull().references(() => teams.id),
      playerId: text("player_id").references(() => nflPlayers.id),
      draftPickYear: integer("draft_pick_year"),
      draftPickRound: integer("draft_pick_round")
    });
    nflGames = sqliteTable("nfl_games", {
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
    playerNews = sqliteTable("player_news", {
      id: text("id").primaryKey(),
      playerId: text("player_id").notNull().references(() => nflPlayers.id, { onDelete: "cascade" }),
      headline: text("headline").notNull(),
      content: text("content").notNull(),
      source: text("source"),
      sourceUrl: text("source_url"),
      aiSummary: text("ai_summary"),
      impactLevel: text("impact_level"),
      // 'high' | 'medium' | 'low'
      publishedAt: integer("published_at", { mode: "timestamp" }).notNull(),
      createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => /* @__PURE__ */ new Date())
    });
    usersRelations = relations(users, ({ many }) => ({
      sessions: many(sessions),
      leagueMemberships: many(leagueMembers),
      teams: many(teams)
    }));
    sessionsRelations = relations(sessions, ({ one }) => ({
      user: one(users, { fields: [sessions.userId], references: [users.id] })
    }));
    leaguesRelations = relations(leagues, ({ many }) => ({
      members: many(leagueMembers),
      teams: many(teams),
      matchups: many(matchups),
      transactions: many(transactions),
      trades: many(trades)
    }));
    leagueMembersRelations = relations(leagueMembers, ({ one }) => ({
      user: one(users, { fields: [leagueMembers.userId], references: [users.id] }),
      league: one(leagues, { fields: [leagueMembers.leagueId], references: [leagues.id] })
    }));
    teamsRelations = relations(teams, ({ one, many }) => ({
      league: one(leagues, { fields: [teams.leagueId], references: [leagues.id] }),
      owner: one(users, { fields: [teams.ownerId], references: [users.id] }),
      roster: many(rosterSpots),
      homeMatchups: many(matchups, { relationName: "homeTeam" }),
      awayMatchups: many(matchups, { relationName: "awayTeam" })
    }));
    rosterSpotsRelations = relations(rosterSpots, ({ one }) => ({
      team: one(teams, { fields: [rosterSpots.teamId], references: [teams.id] }),
      player: one(nflPlayers, { fields: [rosterSpots.playerId], references: [nflPlayers.id] })
    }));
    nflPlayersRelations = relations(nflPlayers, ({ many }) => ({
      weeklyStats: many(playerWeeklyStats),
      projections: many(playerProjections),
      news: many(playerNews),
      rosterSpots: many(rosterSpots)
    }));
    playerWeeklyStatsRelations = relations(playerWeeklyStats, ({ one }) => ({
      player: one(nflPlayers, { fields: [playerWeeklyStats.playerId], references: [nflPlayers.id] })
    }));
    playerProjectionsRelations = relations(playerProjections, ({ one }) => ({
      player: one(nflPlayers, { fields: [playerProjections.playerId], references: [nflPlayers.id] })
    }));
    matchupsRelations = relations(matchups, ({ one }) => ({
      league: one(leagues, { fields: [matchups.leagueId], references: [leagues.id] }),
      homeTeam: one(teams, { fields: [matchups.homeTeamId], references: [teams.id], relationName: "homeTeam" }),
      awayTeam: one(teams, { fields: [matchups.awayTeamId], references: [teams.id], relationName: "awayTeam" })
    }));
    playerNewsRelations = relations(playerNews, ({ one }) => ({
      player: one(nflPlayers, { fields: [playerNews.playerId], references: [nflPlayers.id] })
    }));
    passwordResetTokens = sqliteTable("password_reset_tokens", {
      id: text("id").primaryKey(),
      userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
      tokenHash: text("token_hash").notNull(),
      // SHA-256 hash of the token (never store raw)
      expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
      usedAt: integer("used_at", { mode: "timestamp" }),
      // null until used
      createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => /* @__PURE__ */ new Date())
    });
    userFeedback = sqliteTable("user_feedback", {
      id: text("id").primaryKey(),
      userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
      // Optional - allow anonymous
      type: text("type").notNull(),
      // 'bug' | 'feature' | 'general'
      message: text("message").notNull(),
      email: text("email"),
      // Optional contact email
      page: text("page"),
      // Which page they were on
      userAgent: text("user_agent"),
      status: text("status").notNull().default("new"),
      // 'new' | 'reviewed' | 'resolved'
      createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => /* @__PURE__ */ new Date())
    });
  }
});

// node_modules/jose/dist/browser/runtime/webcrypto.js
var webcrypto_default, isCryptoKey;
var init_webcrypto = __esm({
  "node_modules/jose/dist/browser/runtime/webcrypto.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    webcrypto_default = crypto;
    isCryptoKey = /* @__PURE__ */ __name((key) => key instanceof CryptoKey, "isCryptoKey");
  }
});

// node_modules/jose/dist/browser/lib/buffer_utils.js
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
var encoder, decoder, MAX_INT32;
var init_buffer_utils = __esm({
  "node_modules/jose/dist/browser/lib/buffer_utils.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    encoder = new TextEncoder();
    decoder = new TextDecoder();
    MAX_INT32 = 2 ** 32;
    __name(concat, "concat");
  }
});

// node_modules/jose/dist/browser/runtime/base64url.js
var encodeBase64, encode, decodeBase64, decode;
var init_base64url = __esm({
  "node_modules/jose/dist/browser/runtime/base64url.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_buffer_utils();
    encodeBase64 = /* @__PURE__ */ __name((input) => {
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
    encode = /* @__PURE__ */ __name((input) => {
      return encodeBase64(input).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    }, "encode");
    decodeBase64 = /* @__PURE__ */ __name((encoded) => {
      const binary = atob(encoded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }, "decodeBase64");
    decode = /* @__PURE__ */ __name((input) => {
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
  }
});

// node_modules/jose/dist/browser/util/errors.js
var JOSEError, JWTClaimValidationFailed, JWTExpired, JOSEAlgNotAllowed, JOSENotSupported, JWEDecryptionFailed, JWEInvalid, JWSInvalid, JWTInvalid, JWKInvalid, JWKSInvalid, JWKSNoMatchingKey, JWKSMultipleMatchingKeys, JWKSTimeout, JWSSignatureVerificationFailed;
var init_errors2 = __esm({
  "node_modules/jose/dist/browser/util/errors.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    JOSEError = class extends Error {
      static {
        __name(this, "JOSEError");
      }
      constructor(message2, options) {
        super(message2, options);
        this.code = "ERR_JOSE_GENERIC";
        this.name = this.constructor.name;
        Error.captureStackTrace?.(this, this.constructor);
      }
    };
    JOSEError.code = "ERR_JOSE_GENERIC";
    JWTClaimValidationFailed = class extends JOSEError {
      static {
        __name(this, "JWTClaimValidationFailed");
      }
      constructor(message2, payload, claim = "unspecified", reason = "unspecified") {
        super(message2, { cause: { claim, reason, payload } });
        this.code = "ERR_JWT_CLAIM_VALIDATION_FAILED";
        this.claim = claim;
        this.reason = reason;
        this.payload = payload;
      }
    };
    JWTClaimValidationFailed.code = "ERR_JWT_CLAIM_VALIDATION_FAILED";
    JWTExpired = class extends JOSEError {
      static {
        __name(this, "JWTExpired");
      }
      constructor(message2, payload, claim = "unspecified", reason = "unspecified") {
        super(message2, { cause: { claim, reason, payload } });
        this.code = "ERR_JWT_EXPIRED";
        this.claim = claim;
        this.reason = reason;
        this.payload = payload;
      }
    };
    JWTExpired.code = "ERR_JWT_EXPIRED";
    JOSEAlgNotAllowed = class extends JOSEError {
      static {
        __name(this, "JOSEAlgNotAllowed");
      }
      constructor() {
        super(...arguments);
        this.code = "ERR_JOSE_ALG_NOT_ALLOWED";
      }
    };
    JOSEAlgNotAllowed.code = "ERR_JOSE_ALG_NOT_ALLOWED";
    JOSENotSupported = class extends JOSEError {
      static {
        __name(this, "JOSENotSupported");
      }
      constructor() {
        super(...arguments);
        this.code = "ERR_JOSE_NOT_SUPPORTED";
      }
    };
    JOSENotSupported.code = "ERR_JOSE_NOT_SUPPORTED";
    JWEDecryptionFailed = class extends JOSEError {
      static {
        __name(this, "JWEDecryptionFailed");
      }
      constructor(message2 = "decryption operation failed", options) {
        super(message2, options);
        this.code = "ERR_JWE_DECRYPTION_FAILED";
      }
    };
    JWEDecryptionFailed.code = "ERR_JWE_DECRYPTION_FAILED";
    JWEInvalid = class extends JOSEError {
      static {
        __name(this, "JWEInvalid");
      }
      constructor() {
        super(...arguments);
        this.code = "ERR_JWE_INVALID";
      }
    };
    JWEInvalid.code = "ERR_JWE_INVALID";
    JWSInvalid = class extends JOSEError {
      static {
        __name(this, "JWSInvalid");
      }
      constructor() {
        super(...arguments);
        this.code = "ERR_JWS_INVALID";
      }
    };
    JWSInvalid.code = "ERR_JWS_INVALID";
    JWTInvalid = class extends JOSEError {
      static {
        __name(this, "JWTInvalid");
      }
      constructor() {
        super(...arguments);
        this.code = "ERR_JWT_INVALID";
      }
    };
    JWTInvalid.code = "ERR_JWT_INVALID";
    JWKInvalid = class extends JOSEError {
      static {
        __name(this, "JWKInvalid");
      }
      constructor() {
        super(...arguments);
        this.code = "ERR_JWK_INVALID";
      }
    };
    JWKInvalid.code = "ERR_JWK_INVALID";
    JWKSInvalid = class extends JOSEError {
      static {
        __name(this, "JWKSInvalid");
      }
      constructor() {
        super(...arguments);
        this.code = "ERR_JWKS_INVALID";
      }
    };
    JWKSInvalid.code = "ERR_JWKS_INVALID";
    JWKSNoMatchingKey = class extends JOSEError {
      static {
        __name(this, "JWKSNoMatchingKey");
      }
      constructor(message2 = "no applicable key found in the JSON Web Key Set", options) {
        super(message2, options);
        this.code = "ERR_JWKS_NO_MATCHING_KEY";
      }
    };
    JWKSNoMatchingKey.code = "ERR_JWKS_NO_MATCHING_KEY";
    JWKSMultipleMatchingKeys = class extends JOSEError {
      static {
        __name(this, "JWKSMultipleMatchingKeys");
      }
      constructor(message2 = "multiple matching keys found in the JSON Web Key Set", options) {
        super(message2, options);
        this.code = "ERR_JWKS_MULTIPLE_MATCHING_KEYS";
      }
    };
    JWKSMultipleMatchingKeys.code = "ERR_JWKS_MULTIPLE_MATCHING_KEYS";
    JWKSTimeout = class extends JOSEError {
      static {
        __name(this, "JWKSTimeout");
      }
      constructor(message2 = "request timed out", options) {
        super(message2, options);
        this.code = "ERR_JWKS_TIMEOUT";
      }
    };
    JWKSTimeout.code = "ERR_JWKS_TIMEOUT";
    JWSSignatureVerificationFailed = class extends JOSEError {
      static {
        __name(this, "JWSSignatureVerificationFailed");
      }
      constructor(message2 = "signature verification failed", options) {
        super(message2, options);
        this.code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
      }
    };
    JWSSignatureVerificationFailed.code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
  }
});

// node_modules/jose/dist/browser/lib/crypto_key.js
function unusable(name, prop = "algorithm.name") {
  return new TypeError(`CryptoKey does not support this operation, its ${prop} must be ${name}`);
}
function isAlgorithm(algorithm, name) {
  return algorithm.name === name;
}
function getHashLength(hash) {
  return parseInt(hash.name.slice(4), 10);
}
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
var init_crypto_key = __esm({
  "node_modules/jose/dist/browser/lib/crypto_key.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    __name(unusable, "unusable");
    __name(isAlgorithm, "isAlgorithm");
    __name(getHashLength, "getHashLength");
    __name(getNamedCurve, "getNamedCurve");
    __name(checkUsage, "checkUsage");
    __name(checkSigCryptoKey, "checkSigCryptoKey");
  }
});

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
function withAlg(alg, actual, ...types2) {
  return message(`Key for the ${alg} algorithm must be `, actual, ...types2);
}
var invalid_key_input_default;
var init_invalid_key_input = __esm({
  "node_modules/jose/dist/browser/lib/invalid_key_input.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    __name(message, "message");
    invalid_key_input_default = /* @__PURE__ */ __name((actual, ...types2) => {
      return message("Key must be ", actual, ...types2);
    }, "default");
    __name(withAlg, "withAlg");
  }
});

// node_modules/jose/dist/browser/runtime/is_key_like.js
var is_key_like_default, types;
var init_is_key_like = __esm({
  "node_modules/jose/dist/browser/runtime/is_key_like.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_webcrypto();
    is_key_like_default = /* @__PURE__ */ __name((key) => {
      if (isCryptoKey(key)) {
        return true;
      }
      return key?.[Symbol.toStringTag] === "KeyObject";
    }, "default");
    types = ["CryptoKey"];
  }
});

// node_modules/jose/dist/browser/lib/is_disjoint.js
var isDisjoint, is_disjoint_default;
var init_is_disjoint = __esm({
  "node_modules/jose/dist/browser/lib/is_disjoint.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    isDisjoint = /* @__PURE__ */ __name((...headers) => {
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
    is_disjoint_default = isDisjoint;
  }
});

// node_modules/jose/dist/browser/lib/is_object.js
function isObjectLike(value) {
  return typeof value === "object" && value !== null;
}
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
var init_is_object = __esm({
  "node_modules/jose/dist/browser/lib/is_object.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    __name(isObjectLike, "isObjectLike");
    __name(isObject, "isObject");
  }
});

// node_modules/jose/dist/browser/runtime/check_key_length.js
var check_key_length_default;
var init_check_key_length = __esm({
  "node_modules/jose/dist/browser/runtime/check_key_length.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    check_key_length_default = /* @__PURE__ */ __name((alg, key) => {
      if (alg.startsWith("RS") || alg.startsWith("PS")) {
        const { modulusLength } = key.algorithm;
        if (typeof modulusLength !== "number" || modulusLength < 2048) {
          throw new TypeError(`${alg} requires key modulusLength to be 2048 bits or larger`);
        }
      }
    }, "default");
  }
});

// node_modules/jose/dist/browser/lib/is_jwk.js
function isJWK(key) {
  return isObject(key) && typeof key.kty === "string";
}
function isPrivateJWK(key) {
  return key.kty !== "oct" && typeof key.d === "string";
}
function isPublicJWK(key) {
  return key.kty !== "oct" && typeof key.d === "undefined";
}
function isSecretJWK(key) {
  return isJWK(key) && key.kty === "oct" && typeof key.k === "string";
}
var init_is_jwk = __esm({
  "node_modules/jose/dist/browser/lib/is_jwk.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_is_object();
    __name(isJWK, "isJWK");
    __name(isPrivateJWK, "isPrivateJWK");
    __name(isPublicJWK, "isPublicJWK");
    __name(isSecretJWK, "isSecretJWK");
  }
});

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
var parse, jwk_to_key_default;
var init_jwk_to_key = __esm({
  "node_modules/jose/dist/browser/runtime/jwk_to_key.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_webcrypto();
    init_errors2();
    __name(subtleMapping, "subtleMapping");
    parse = /* @__PURE__ */ __name(async (jwk) => {
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
    jwk_to_key_default = parse;
  }
});

// node_modules/jose/dist/browser/runtime/normalize_key.js
var exportKeyValue, privCache, pubCache, isKeyObject, importAndCache, normalizePublicKey, normalizePrivateKey, normalize_key_default;
var init_normalize_key = __esm({
  "node_modules/jose/dist/browser/runtime/normalize_key.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_is_jwk();
    init_base64url();
    init_jwk_to_key();
    exportKeyValue = /* @__PURE__ */ __name((k) => decode(k), "exportKeyValue");
    isKeyObject = /* @__PURE__ */ __name((key) => {
      return key?.[Symbol.toStringTag] === "KeyObject";
    }, "isKeyObject");
    importAndCache = /* @__PURE__ */ __name(async (cache, key, jwk, alg, freeze = false) => {
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
    normalizePublicKey = /* @__PURE__ */ __name((key, alg) => {
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
    normalizePrivateKey = /* @__PURE__ */ __name((key, alg) => {
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
    normalize_key_default = { normalizePublicKey, normalizePrivateKey };
  }
});

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
var init_import = __esm({
  "node_modules/jose/dist/browser/key/import.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_base64url();
    init_jwk_to_key();
    init_errors2();
    init_is_object();
    __name(importJWK, "importJWK");
  }
});

// node_modules/jose/dist/browser/lib/check_key_type.js
function checkKeyType(allowJwk, alg, key, usage) {
  const symmetric = alg.startsWith("HS") || alg === "dir" || alg.startsWith("PBES2") || /^A\d{3}(?:GCM)?KW$/.test(alg);
  if (symmetric) {
    symmetricTypeCheck(alg, key, usage, allowJwk);
  } else {
    asymmetricTypeCheck(alg, key, usage, allowJwk);
  }
}
var tag, jwkMatchesOp, symmetricTypeCheck, asymmetricTypeCheck, check_key_type_default, checkKeyTypeWithJwk;
var init_check_key_type = __esm({
  "node_modules/jose/dist/browser/lib/check_key_type.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_invalid_key_input();
    init_is_key_like();
    init_is_jwk();
    tag = /* @__PURE__ */ __name((key) => key?.[Symbol.toStringTag], "tag");
    jwkMatchesOp = /* @__PURE__ */ __name((alg, key, usage) => {
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
    symmetricTypeCheck = /* @__PURE__ */ __name((alg, key, usage, allowJwk) => {
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
    asymmetricTypeCheck = /* @__PURE__ */ __name((alg, key, usage, allowJwk) => {
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
    __name(checkKeyType, "checkKeyType");
    check_key_type_default = checkKeyType.bind(void 0, false);
    checkKeyTypeWithJwk = checkKeyType.bind(void 0, true);
  }
});

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
var validate_crit_default;
var init_validate_crit = __esm({
  "node_modules/jose/dist/browser/lib/validate_crit.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_errors2();
    __name(validateCrit, "validateCrit");
    validate_crit_default = validateCrit;
  }
});

// node_modules/jose/dist/browser/lib/validate_algorithms.js
var validateAlgorithms, validate_algorithms_default;
var init_validate_algorithms = __esm({
  "node_modules/jose/dist/browser/lib/validate_algorithms.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    validateAlgorithms = /* @__PURE__ */ __name((option, algorithms) => {
      if (algorithms !== void 0 && (!Array.isArray(algorithms) || algorithms.some((s) => typeof s !== "string"))) {
        throw new TypeError(`"${option}" option must be an array of strings`);
      }
      if (!algorithms) {
        return void 0;
      }
      return new Set(algorithms);
    }, "validateAlgorithms");
    validate_algorithms_default = validateAlgorithms;
  }
});

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
var init_subtle_dsa = __esm({
  "node_modules/jose/dist/browser/runtime/subtle_dsa.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_errors2();
    __name(subtleDsa, "subtleDsa");
  }
});

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
var init_get_sign_verify_key = __esm({
  "node_modules/jose/dist/browser/runtime/get_sign_verify_key.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_webcrypto();
    init_crypto_key();
    init_invalid_key_input();
    init_is_key_like();
    init_normalize_key();
    __name(getCryptoKey, "getCryptoKey");
  }
});

// node_modules/jose/dist/browser/runtime/verify.js
var verify, verify_default;
var init_verify = __esm({
  "node_modules/jose/dist/browser/runtime/verify.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_subtle_dsa();
    init_webcrypto();
    init_check_key_length();
    init_get_sign_verify_key();
    verify = /* @__PURE__ */ __name(async (alg, key, signature, data) => {
      const cryptoKey = await getCryptoKey(alg, key, "verify");
      check_key_length_default(alg, cryptoKey);
      const algorithm = subtleDsa(alg, cryptoKey.algorithm);
      try {
        return await webcrypto_default.subtle.verify(algorithm, cryptoKey, signature, data);
      } catch {
        return false;
      }
    }, "verify");
    verify_default = verify;
  }
});

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
var init_verify2 = __esm({
  "node_modules/jose/dist/browser/jws/flattened/verify.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_base64url();
    init_verify();
    init_errors2();
    init_buffer_utils();
    init_is_disjoint();
    init_is_object();
    init_check_key_type();
    init_validate_crit();
    init_validate_algorithms();
    init_is_jwk();
    init_import();
    __name(flattenedVerify, "flattenedVerify");
  }
});

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
var init_verify3 = __esm({
  "node_modules/jose/dist/browser/jws/compact/verify.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_verify2();
    init_errors2();
    init_buffer_utils();
    __name(compactVerify, "compactVerify");
  }
});

// node_modules/jose/dist/browser/lib/epoch.js
var epoch_default;
var init_epoch = __esm({
  "node_modules/jose/dist/browser/lib/epoch.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    epoch_default = /* @__PURE__ */ __name((date) => Math.floor(date.getTime() / 1e3), "default");
  }
});

// node_modules/jose/dist/browser/lib/secs.js
var minute, hour, day, week, year, REGEX, secs_default;
var init_secs = __esm({
  "node_modules/jose/dist/browser/lib/secs.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    minute = 60;
    hour = minute * 60;
    day = hour * 24;
    week = day * 7;
    year = day * 365.25;
    REGEX = /^(\+|\-)? ?(\d+|\d+\.\d+) ?(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)(?: (ago|from now))?$/i;
    secs_default = /* @__PURE__ */ __name((str) => {
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
  }
});

// node_modules/jose/dist/browser/lib/jwt_claims_set.js
var normalizeTyp, checkAudiencePresence, jwt_claims_set_default;
var init_jwt_claims_set = __esm({
  "node_modules/jose/dist/browser/lib/jwt_claims_set.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_errors2();
    init_buffer_utils();
    init_epoch();
    init_secs();
    init_is_object();
    normalizeTyp = /* @__PURE__ */ __name((value) => value.toLowerCase().replace(/^application\//, ""), "normalizeTyp");
    checkAudiencePresence = /* @__PURE__ */ __name((audPayload, audOption) => {
      if (typeof audPayload === "string") {
        return audOption.includes(audPayload);
      }
      if (Array.isArray(audPayload)) {
        return audOption.some(Set.prototype.has.bind(new Set(audPayload)));
      }
      return false;
    }, "checkAudiencePresence");
    jwt_claims_set_default = /* @__PURE__ */ __name((protectedHeader, encodedPayload, options = {}) => {
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
  }
});

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
var init_verify4 = __esm({
  "node_modules/jose/dist/browser/jwt/verify.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_verify3();
    init_jwt_claims_set();
    init_errors2();
    __name(jwtVerify, "jwtVerify");
  }
});

// node_modules/jose/dist/browser/runtime/sign.js
var sign, sign_default;
var init_sign = __esm({
  "node_modules/jose/dist/browser/runtime/sign.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_subtle_dsa();
    init_webcrypto();
    init_check_key_length();
    init_get_sign_verify_key();
    sign = /* @__PURE__ */ __name(async (alg, key, data) => {
      const cryptoKey = await getCryptoKey(alg, key, "sign");
      check_key_length_default(alg, cryptoKey);
      const signature = await webcrypto_default.subtle.sign(subtleDsa(alg, cryptoKey.algorithm), cryptoKey, data);
      return new Uint8Array(signature);
    }, "sign");
    sign_default = sign;
  }
});

// node_modules/jose/dist/browser/jws/flattened/sign.js
var FlattenedSign;
var init_sign2 = __esm({
  "node_modules/jose/dist/browser/jws/flattened/sign.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_base64url();
    init_sign();
    init_is_disjoint();
    init_errors2();
    init_buffer_utils();
    init_check_key_type();
    init_validate_crit();
    FlattenedSign = class {
      static {
        __name(this, "FlattenedSign");
      }
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
  }
});

// node_modules/jose/dist/browser/jws/compact/sign.js
var CompactSign;
var init_sign3 = __esm({
  "node_modules/jose/dist/browser/jws/compact/sign.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_sign2();
    CompactSign = class {
      static {
        __name(this, "CompactSign");
      }
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
  }
});

// node_modules/jose/dist/browser/jwt/produce.js
function validateInput(label, input) {
  if (!Number.isFinite(input)) {
    throw new TypeError(`Invalid ${label} input`);
  }
  return input;
}
var ProduceJWT;
var init_produce = __esm({
  "node_modules/jose/dist/browser/jwt/produce.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_epoch();
    init_is_object();
    init_secs();
    __name(validateInput, "validateInput");
    ProduceJWT = class {
      static {
        __name(this, "ProduceJWT");
      }
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
  }
});

// node_modules/jose/dist/browser/jwt/sign.js
var SignJWT;
var init_sign4 = __esm({
  "node_modules/jose/dist/browser/jwt/sign.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_sign3();
    init_errors2();
    init_buffer_utils();
    init_produce();
    SignJWT = class extends ProduceJWT {
      static {
        __name(this, "SignJWT");
      }
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
  }
});

// node_modules/jose/dist/browser/jwks/local.js
function getKtyFromAlg(alg) {
  switch (typeof alg === "string" && alg.slice(0, 2)) {
    case "RS":
    case "PS":
      return "RSA";
    case "ES":
      return "EC";
    case "Ed":
      return "OKP";
    default:
      throw new JOSENotSupported('Unsupported "alg" value for a JSON Web Key Set');
  }
}
function isJWKSLike(jwks) {
  return jwks && typeof jwks === "object" && Array.isArray(jwks.keys) && jwks.keys.every(isJWKLike);
}
function isJWKLike(key) {
  return isObject(key);
}
function clone(obj) {
  if (typeof structuredClone === "function") {
    return structuredClone(obj);
  }
  return JSON.parse(JSON.stringify(obj));
}
async function importWithAlgCache(cache, jwk, alg) {
  const cached = cache.get(jwk) || cache.set(jwk, {}).get(jwk);
  if (cached[alg] === void 0) {
    const key = await importJWK({ ...jwk, ext: true }, alg);
    if (key instanceof Uint8Array || key.type !== "public") {
      throw new JWKSInvalid("JSON Web Key Set members must be public keys");
    }
    cached[alg] = key;
  }
  return cached[alg];
}
function createLocalJWKSet(jwks) {
  const set = new LocalJWKSet(jwks);
  const localJWKSet = /* @__PURE__ */ __name(async (protectedHeader, token) => set.getKey(protectedHeader, token), "localJWKSet");
  Object.defineProperties(localJWKSet, {
    jwks: {
      value: /* @__PURE__ */ __name(() => clone(set._jwks), "value"),
      enumerable: true,
      configurable: false,
      writable: false
    }
  });
  return localJWKSet;
}
var LocalJWKSet;
var init_local = __esm({
  "node_modules/jose/dist/browser/jwks/local.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_import();
    init_errors2();
    init_is_object();
    __name(getKtyFromAlg, "getKtyFromAlg");
    __name(isJWKSLike, "isJWKSLike");
    __name(isJWKLike, "isJWKLike");
    __name(clone, "clone");
    LocalJWKSet = class {
      static {
        __name(this, "LocalJWKSet");
      }
      constructor(jwks) {
        this._cached = /* @__PURE__ */ new WeakMap();
        if (!isJWKSLike(jwks)) {
          throw new JWKSInvalid("JSON Web Key Set malformed");
        }
        this._jwks = clone(jwks);
      }
      async getKey(protectedHeader, token) {
        const { alg, kid } = { ...protectedHeader, ...token?.header };
        const kty = getKtyFromAlg(alg);
        const candidates = this._jwks.keys.filter((jwk2) => {
          let candidate = kty === jwk2.kty;
          if (candidate && typeof kid === "string") {
            candidate = kid === jwk2.kid;
          }
          if (candidate && typeof jwk2.alg === "string") {
            candidate = alg === jwk2.alg;
          }
          if (candidate && typeof jwk2.use === "string") {
            candidate = jwk2.use === "sig";
          }
          if (candidate && Array.isArray(jwk2.key_ops)) {
            candidate = jwk2.key_ops.includes("verify");
          }
          if (candidate) {
            switch (alg) {
              case "ES256":
                candidate = jwk2.crv === "P-256";
                break;
              case "ES256K":
                candidate = jwk2.crv === "secp256k1";
                break;
              case "ES384":
                candidate = jwk2.crv === "P-384";
                break;
              case "ES512":
                candidate = jwk2.crv === "P-521";
                break;
              case "Ed25519":
                candidate = jwk2.crv === "Ed25519";
                break;
              case "EdDSA":
                candidate = jwk2.crv === "Ed25519" || jwk2.crv === "Ed448";
                break;
            }
          }
          return candidate;
        });
        const { 0: jwk, length } = candidates;
        if (length === 0) {
          throw new JWKSNoMatchingKey();
        }
        if (length !== 1) {
          const error = new JWKSMultipleMatchingKeys();
          const { _cached } = this;
          error[Symbol.asyncIterator] = async function* () {
            for (const jwk2 of candidates) {
              try {
                yield await importWithAlgCache(_cached, jwk2, alg);
              } catch {
              }
            }
          };
          throw error;
        }
        return importWithAlgCache(this._cached, jwk, alg);
      }
    };
    __name(importWithAlgCache, "importWithAlgCache");
    __name(createLocalJWKSet, "createLocalJWKSet");
  }
});

// node_modules/jose/dist/browser/runtime/fetch_jwks.js
var fetchJwks, fetch_jwks_default;
var init_fetch_jwks = __esm({
  "node_modules/jose/dist/browser/runtime/fetch_jwks.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_errors2();
    fetchJwks = /* @__PURE__ */ __name(async (url, timeout, options) => {
      let controller;
      let id;
      let timedOut = false;
      if (typeof AbortController === "function") {
        controller = new AbortController();
        id = setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeout);
      }
      const response = await fetch(url.href, {
        signal: controller ? controller.signal : void 0,
        redirect: "manual",
        headers: options.headers
      }).catch((err) => {
        if (timedOut)
          throw new JWKSTimeout();
        throw err;
      });
      if (id !== void 0)
        clearTimeout(id);
      if (response.status !== 200) {
        throw new JOSEError("Expected 200 OK from the JSON Web Key Set HTTP response");
      }
      try {
        return await response.json();
      } catch {
        throw new JOSEError("Failed to parse the JSON Web Key Set HTTP response as JSON");
      }
    }, "fetchJwks");
    fetch_jwks_default = fetchJwks;
  }
});

// node_modules/jose/dist/browser/jwks/remote.js
function isCloudflareWorkers() {
  return typeof WebSocketPair !== "undefined" || typeof navigator !== "undefined" && true || typeof EdgeRuntime !== "undefined" && EdgeRuntime === "vercel";
}
function isFreshJwksCache(input, cacheMaxAge) {
  if (typeof input !== "object" || input === null) {
    return false;
  }
  if (!("uat" in input) || typeof input.uat !== "number" || Date.now() - input.uat >= cacheMaxAge) {
    return false;
  }
  if (!("jwks" in input) || !isObject(input.jwks) || !Array.isArray(input.jwks.keys) || !Array.prototype.every.call(input.jwks.keys, isObject)) {
    return false;
  }
  return true;
}
function createRemoteJWKSet(url, options) {
  const set = new RemoteJWKSet(url, options);
  const remoteJWKSet = /* @__PURE__ */ __name(async (protectedHeader, token) => set.getKey(protectedHeader, token), "remoteJWKSet");
  Object.defineProperties(remoteJWKSet, {
    coolingDown: {
      get: /* @__PURE__ */ __name(() => set.coolingDown(), "get"),
      enumerable: true,
      configurable: false
    },
    fresh: {
      get: /* @__PURE__ */ __name(() => set.fresh(), "get"),
      enumerable: true,
      configurable: false
    },
    reload: {
      value: /* @__PURE__ */ __name(() => set.reload(), "value"),
      enumerable: true,
      configurable: false,
      writable: false
    },
    reloading: {
      get: /* @__PURE__ */ __name(() => !!set._pendingFetch, "get"),
      enumerable: true,
      configurable: false
    },
    jwks: {
      value: /* @__PURE__ */ __name(() => set._local?.jwks(), "value"),
      enumerable: true,
      configurable: false,
      writable: false
    }
  });
  return remoteJWKSet;
}
var USER_AGENT, jwksCache, RemoteJWKSet;
var init_remote = __esm({
  "node_modules/jose/dist/browser/jwks/remote.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_fetch_jwks();
    init_errors2();
    init_local();
    init_is_object();
    __name(isCloudflareWorkers, "isCloudflareWorkers");
    if (typeof navigator === "undefined" || !"Cloudflare-Workers"?.startsWith?.("Mozilla/5.0 ")) {
      const NAME = "jose";
      const VERSION = "v5.10.0";
      USER_AGENT = `${NAME}/${VERSION}`;
    }
    jwksCache = /* @__PURE__ */ Symbol();
    __name(isFreshJwksCache, "isFreshJwksCache");
    RemoteJWKSet = class {
      static {
        __name(this, "RemoteJWKSet");
      }
      constructor(url, options) {
        if (!(url instanceof URL)) {
          throw new TypeError("url must be an instance of URL");
        }
        this._url = new URL(url.href);
        this._options = { agent: options?.agent, headers: options?.headers };
        this._timeoutDuration = typeof options?.timeoutDuration === "number" ? options?.timeoutDuration : 5e3;
        this._cooldownDuration = typeof options?.cooldownDuration === "number" ? options?.cooldownDuration : 3e4;
        this._cacheMaxAge = typeof options?.cacheMaxAge === "number" ? options?.cacheMaxAge : 6e5;
        if (options?.[jwksCache] !== void 0) {
          this._cache = options?.[jwksCache];
          if (isFreshJwksCache(options?.[jwksCache], this._cacheMaxAge)) {
            this._jwksTimestamp = this._cache.uat;
            this._local = createLocalJWKSet(this._cache.jwks);
          }
        }
      }
      coolingDown() {
        return typeof this._jwksTimestamp === "number" ? Date.now() < this._jwksTimestamp + this._cooldownDuration : false;
      }
      fresh() {
        return typeof this._jwksTimestamp === "number" ? Date.now() < this._jwksTimestamp + this._cacheMaxAge : false;
      }
      async getKey(protectedHeader, token) {
        if (!this._local || !this.fresh()) {
          await this.reload();
        }
        try {
          return await this._local(protectedHeader, token);
        } catch (err) {
          if (err instanceof JWKSNoMatchingKey) {
            if (this.coolingDown() === false) {
              await this.reload();
              return this._local(protectedHeader, token);
            }
          }
          throw err;
        }
      }
      async reload() {
        if (this._pendingFetch && isCloudflareWorkers()) {
          this._pendingFetch = void 0;
        }
        const headers = new Headers(this._options.headers);
        if (USER_AGENT && !headers.has("User-Agent")) {
          headers.set("User-Agent", USER_AGENT);
          this._options.headers = Object.fromEntries(headers.entries());
        }
        this._pendingFetch || (this._pendingFetch = fetch_jwks_default(this._url, this._timeoutDuration, this._options).then((json) => {
          this._local = createLocalJWKSet(json);
          if (this._cache) {
            this._cache.uat = Date.now();
            this._cache.jwks = json;
          }
          this._jwksTimestamp = Date.now();
          this._pendingFetch = void 0;
        }).catch((err) => {
          this._pendingFetch = void 0;
          throw err;
        }));
        await this._pendingFetch;
      }
    };
    __name(createRemoteJWKSet, "createRemoteJWKSet");
  }
});

// node_modules/jose/dist/browser/util/base64url.js
var init_base64url2 = __esm({
  "node_modules/jose/dist/browser/util/base64url.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
  }
});

// node_modules/jose/dist/browser/index.js
var init_browser = __esm({
  "node_modules/jose/dist/browser/index.js"() {
    init_checked_fetch();
    init_modules_watch_stub();
    init_verify4();
    init_sign4();
    init_remote();
    init_errors2();
    init_base64url2();
  }
});

// src/middleware/auth.ts
var authMiddleware, optionalAuthMiddleware;
var init_auth = __esm({
  "src/middleware/auth.ts"() {
    "use strict";
    init_checked_fetch();
    init_modules_watch_stub();
    init_browser();
    init_drizzle_orm();
    init_schema();
    authMiddleware = /* @__PURE__ */ __name(async (c, next) => {
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
        const session = await db.query.sessions.findFirst({
          where: and(
            eq(sessions.token, token),
            gt(sessions.expiresAt, /* @__PURE__ */ new Date())
          )
        });
        if (!session) {
          return c.json({ error: "Unauthorized - Session expired or revoked" }, 401);
        }
        const user = await db.query.users.findFirst({
          where: eq(users.id, payload.sub)
        });
        if (!user) {
          return c.json({ error: "Unauthorized - User not found" }, 401);
        }
        c.set("user", user);
        await next();
      } catch {
        return c.json({ error: "Unauthorized - Invalid token" }, 401);
      }
    }, "authMiddleware");
    optionalAuthMiddleware = /* @__PURE__ */ __name(async (c, next) => {
      const authHeader = c.req.header("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        try {
          const secret = new TextEncoder().encode(c.env.JWT_SECRET);
          const { payload } = await jwtVerify(token, secret);
          if (payload.sub) {
            const db = c.get("db");
            const session = await db.query.sessions.findFirst({
              where: and(
                eq(sessions.token, token),
                gt(sessions.expiresAt, /* @__PURE__ */ new Date())
              )
            });
            if (session) {
              const user = await db.query.users.findFirst({
                where: eq(users.id, payload.sub)
              });
              if (user) {
                c.set("user", user);
              }
            }
          }
        } catch {
        }
      }
      await next();
    }, "optionalAuthMiddleware");
  }
});

// src/routes/yahoo.ts
var yahoo_exports = {};
__export(yahoo_exports, {
  getYahooToken: () => getYahooToken,
  yahooApiFetch: () => yahooApiFetch,
  yahooRoutes: () => yahooRoutes
});
async function createOAuthState(userId, secret) {
  const key = new TextEncoder().encode(secret);
  return new SignJWT({ sub: userId, purpose: "yahoo_oauth" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m").sign(key);
}
async function verifyOAuthState(state, secret) {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(state, key);
  if (payload.purpose !== "yahoo_oauth" || !payload.sub) {
    throw new Error("Invalid OAuth state");
  }
  return payload.sub;
}
async function refreshYahooToken(refreshToken, clientId, clientSecret) {
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(YAHOO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken
    }).toString()
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Yahoo token refresh failed: ${errText}`);
  }
  return res.json();
}
async function getYahooToken(db, user, env) {
  if (!user.yahooAccessToken || !user.yahooRefreshToken) {
    throw new Error("Yahoo account not connected. Please connect your Yahoo account first.");
  }
  const now = /* @__PURE__ */ new Date();
  const expiresAt = user.yahooTokenExpiresAt;
  if (expiresAt && expiresAt.getTime() > now.getTime() + 5 * 60 * 1e3) {
    return user.yahooAccessToken;
  }
  const tokens = await refreshYahooToken(
    user.yahooRefreshToken,
    env.YAHOO_CLIENT_ID,
    env.YAHOO_CLIENT_SECRET
  );
  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1e3);
  await db.update(users).set({
    yahooAccessToken: tokens.access_token,
    yahooRefreshToken: tokens.refresh_token,
    yahooTokenExpiresAt: newExpiresAt,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq(users.id, user.id));
  return tokens.access_token;
}
async function yahooApiFetch(accessToken, path) {
  const url = `${YAHOO_API_BASE}${path}${path.includes("?") ? "&" : "?"}format=json`;
  const res = await fetch(url, {
    headers: { "Authorization": `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Yahoo API error (${res.status}): ${errText}`);
  }
  return res.json();
}
function parseYahooLeagues(data) {
  const leagues2 = [];
  try {
    const users2 = data?.fantasy_content?.users;
    if (!users2) return leagues2;
    const userObj = users2["0"]?.user;
    if (!userObj) return leagues2;
    const games = userObj[1]?.games;
    if (!games) return leagues2;
    let gameIdx = 0;
    while (games[String(gameIdx)]) {
      const game = games[String(gameIdx)].game;
      if (!game) {
        gameIdx++;
        continue;
      }
      const gameLeagues = game[1]?.leagues;
      if (!gameLeagues) {
        gameIdx++;
        continue;
      }
      let leagueIdx = 0;
      while (gameLeagues[String(leagueIdx)]) {
        const leagueArr = gameLeagues[String(leagueIdx)].league;
        if (leagueArr && leagueArr[0]) {
          const l = leagueArr[0];
          const leagueKey = l.league_key || "";
          const parts = leagueKey.split(".l.");
          const externalId = parts[1] || leagueKey;
          leagues2.push({
            externalId,
            leagueKey,
            name: l.name || `Yahoo League`,
            seasonYear: parseInt(l.season) || (/* @__PURE__ */ new Date()).getFullYear(),
            teamCount: parseInt(l.num_teams) || 12,
            scoringFormat: l.scoring_type === "headpoint" ? "ppr" : "standard",
            currentWeek: parseInt(l.current_week) || 1
          });
        }
        leagueIdx++;
      }
      gameIdx++;
    }
  } catch (e) {
    console.error("Error parsing Yahoo leagues response:", e);
  }
  return leagues2;
}
function getCallbackHtml(success, error) {
  return `<!DOCTYPE html>
<html>
<head><title>Yahoo Authorization</title></head>
<body style="background:#0f172a;color:white;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<div style="text-align:center">
  <h2>${success ? "Yahoo Connected!" : "Connection Failed"}</h2>
  <p>${success ? "You can close this window." : error || "Unknown error"}</p>
</div>
<script>
  if (window.opener) {
    window.opener.postMessage({ type: 'yahoo_oauth', success: ${success}, error: ${error ? JSON.stringify(error) : "null"} }, window.location.origin);
    setTimeout(() => window.close(), 1500);
  }
<\/script>
</body>
</html>`;
}
var yahooRoutes, YAHOO_AUTH_URL, YAHOO_TOKEN_URL, YAHOO_API_BASE;
var init_yahoo = __esm({
  "src/routes/yahoo.ts"() {
    "use strict";
    init_checked_fetch();
    init_modules_watch_stub();
    init_dist();
    init_browser();
    init_drizzle_orm();
    init_schema();
    init_auth();
    yahooRoutes = new Hono2();
    YAHOO_AUTH_URL = "https://api.login.yahoo.com/oauth2/request_auth";
    YAHOO_TOKEN_URL = "https://api.login.yahoo.com/oauth2/get_token";
    YAHOO_API_BASE = "https://fantasysports.yahooapis.com/fantasy/v2";
    __name(createOAuthState, "createOAuthState");
    __name(verifyOAuthState, "verifyOAuthState");
    __name(refreshYahooToken, "refreshYahooToken");
    __name(getYahooToken, "getYahooToken");
    __name(yahooApiFetch, "yahooApiFetch");
    yahooRoutes.post("/auth-url", authMiddleware, async (c) => {
      const user = c.get("user");
      if (!user) return c.json({ error: "Not authenticated" }, 401);
      if (!c.env.YAHOO_CLIENT_ID || !c.env.YAHOO_CLIENT_SECRET) {
        return c.json({ error: "Yahoo OAuth is not configured. Set YAHOO_CLIENT_ID and YAHOO_CLIENT_SECRET." }, 500);
      }
      const state = await createOAuthState(user.id, c.env.JWT_SECRET);
      const reqUrl = new URL(c.req.url);
      const callbackUrl = `${reqUrl.protocol}//${reqUrl.host}/api/yahoo/callback`;
      const params = new URLSearchParams({
        client_id: c.env.YAHOO_CLIENT_ID,
        redirect_uri: callbackUrl,
        response_type: "code",
        scope: "fspt-r",
        state
      });
      return c.json({ url: `${YAHOO_AUTH_URL}?${params.toString()}` });
    });
    yahooRoutes.get("/callback", async (c) => {
      const code = c.req.query("code");
      const state = c.req.query("state");
      const error = c.req.query("error");
      if (error) {
        return c.html(getCallbackHtml(false, `Yahoo authorization failed: ${error}`));
      }
      if (!code || !state) {
        return c.html(getCallbackHtml(false, "Missing authorization code or state"));
      }
      let userId;
      try {
        userId = await verifyOAuthState(state, c.env.JWT_SECRET);
      } catch {
        return c.html(getCallbackHtml(false, "Invalid or expired authorization state. Please try again."));
      }
      const reqUrl = new URL(c.req.url);
      const callbackUrl = `${reqUrl.protocol}//${reqUrl.host}/api/yahoo/callback`;
      const credentials = btoa(`${c.env.YAHOO_CLIENT_ID}:${c.env.YAHOO_CLIENT_SECRET}`);
      const tokenRes = await fetch(YAHOO_TOKEN_URL, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: callbackUrl
        }).toString()
      });
      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        console.error("Yahoo token exchange failed:", errText);
        return c.html(getCallbackHtml(false, "Failed to exchange authorization code"));
      }
      const tokens = await tokenRes.json();
      const db = c.get("db");
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1e3);
      await db.update(users).set({
        yahooAccessToken: tokens.access_token,
        yahooRefreshToken: tokens.refresh_token,
        yahooTokenExpiresAt: expiresAt,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq(users.id, userId));
      return c.html(getCallbackHtml(true));
    });
    yahooRoutes.get("/leagues", authMiddleware, async (c) => {
      const user = c.get("user");
      if (!user) return c.json({ error: "Not authenticated" }, 401);
      const db = c.get("db");
      const freshUser = await db.query.users.findFirst({
        where: eq(users.id, user.id)
      });
      if (!freshUser?.yahooAccessToken) {
        return c.json({ error: "Yahoo account not connected" }, 400);
      }
      try {
        const accessToken = await getYahooToken(db, freshUser, c.env);
        const data = await yahooApiFetch(
          accessToken,
          "/users;use_login=1/games;game_keys=nfl/leagues"
        );
        const leagues2 = parseYahooLeagues(data);
        return c.json({ leagues: leagues2 });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Failed to fetch Yahoo leagues";
        console.error("Yahoo leagues fetch error:", error);
        return c.json({ error: msg }, 500);
      }
    });
    yahooRoutes.post("/disconnect", authMiddleware, async (c) => {
      const user = c.get("user");
      if (!user) return c.json({ error: "Not authenticated" }, 401);
      const db = c.get("db");
      await db.update(users).set({
        yahooAccessToken: null,
        yahooRefreshToken: null,
        yahooTokenExpiresAt: null,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq(users.id, user.id));
      return c.json({ success: true });
    });
    __name(parseYahooLeagues, "parseYahooLeagues");
    __name(getCallbackHtml, "getCallbackHtml");
  }
});

// src/data/nfl-schedule-2025.json
var nfl_schedule_2025_default;
var init_nfl_schedule_2025 = __esm({
  "src/data/nfl-schedule-2025.json"() {
    nfl_schedule_2025_default = { weeks: { "1": [{ away: "DAL", home: "PHI", date: "2025-09-04T20:20:00-04:00", network: "NBC", stadium: "Lincoln Financial Field" }, { away: "KC", home: "LAC", date: "2025-09-05T20:00:00-04:00", network: "YouTube", stadium: "Corinthians Arena (S\xE3o Paulo)" }, { away: "TB", home: "ATL", date: "2025-09-07T13:00:00-04:00", network: "FOX", stadium: "Mercedes-Benz Stadium" }, { away: "CIN", home: "CLE", date: "2025-09-07T13:00:00-04:00", network: "CBS", stadium: "Cleveland Browns Stadium" }, { away: "WAS", home: "NYG", date: "2025-09-07T13:00:00-04:00", network: "FOX", stadium: "MetLife Stadium" }, { away: "DEN", home: "TEN", date: "2025-09-07T16:00:00-04:00", network: "FOX", stadium: "Nissan Stadium" }, { away: "SF", home: "SEA", date: "2025-09-07T16:00:00-04:00", network: "FOX", stadium: "Lumen Field" }, { away: "DET", home: "GB", date: "2025-09-07T16:00:00-04:00", network: "FOX", stadium: "Lambeau Field" }, { away: "LAR", home: "HOU", date: "2025-09-07T16:00:00-04:00", network: "FOX", stadium: "NRG Stadium" }, { away: "BAL", home: "BUF", date: "2025-09-07T20:20:00-04:00", network: "NBC", stadium: "Highmark Stadium" }, { away: "MIN", home: "CHI", date: "2025-09-08T20:15:00-04:00", network: "ESPN", stadium: "Soldier Field" }], "2": [{ away: "IND", home: "GB", date: "2025-09-11T20:15:00-04:00", network: "ESPN", stadium: "Lambeau Field" }, { away: "ATL", home: "PHI", date: "2025-09-14T13:00:00-04:00", network: "FOX", stadium: "Lincoln Financial Field" }, { away: "LAC", home: "CAR", date: "2025-09-14T13:00:00-04:00", network: "CBS", stadium: "Bank of America Stadium" }, { away: "NYJ", home: "TEN", date: "2025-09-14T13:00:00-04:00", network: "CBS", stadium: "Nissan Stadium" }, { away: "SEA", home: "NE", date: "2025-09-14T13:00:00-04:00", network: "FOX", stadium: "Gillette Stadium" }, { away: "NO", home: "DAL", date: "2025-09-14T13:00:00-04:00", network: "FOX", stadium: "AT&T Stadium" }, { away: "LV", home: "BAL", date: "2025-09-14T13:00:00-04:00", network: "CBS", stadium: "M&T Bank Stadium" }, { away: "CLE", home: "JAX", date: "2025-09-14T13:00:00-04:00", network: "CBS", stadium: "EverBank Stadium" }, { away: "CHI", home: "HOU", date: "2025-09-14T13:00:00-04:00", network: "FOX", stadium: "NRG Stadium" }, { away: "MIA", home: "BUF", date: "2025-09-14T13:00:00-04:00", network: "CBS", stadium: "Highmark Stadium" }, { away: "LAR", home: "ARI", date: "2025-09-14T16:05:00-04:00", network: "FOX", stadium: "State Farm Stadium" }, { away: "TB", home: "DET", date: "2025-09-14T16:05:00-04:00", network: "FOX", stadium: "Ford Field" }, { away: "KC", home: "CIN", date: "2025-09-14T16:25:00-04:00", network: "CBS", stadium: "Paycor Stadium" }, { away: "NE", home: "SEA", date: "2025-09-14T16:25:00-04:00", network: "CBS", stadium: "Lumen Field" }, { away: "DEN", home: "TB", date: "2025-09-14T20:20:00-04:00", network: "NBC", stadium: "Raymond James Stadium" }, { away: "PIT", home: "DEN", date: "2025-09-15T20:15:00-04:00", network: "ESPN", stadium: "Empower Field at Mile High" }], "3": [{ away: "MIA", home: "BUF", date: "2025-09-18T20:15:00-04:00", network: "Prime", stadium: "Highmark Stadium" }, { away: "ATL", home: "CAR", date: "2025-09-21T13:00:00-04:00", network: "FOX", stadium: "Bank of America Stadium" }, { away: "CIN", home: "MIN", date: "2025-09-21T13:00:00-04:00", network: "CBS", stadium: "U.S. Bank Stadium" }, { away: "GB", home: "CLE", date: "2025-09-21T13:00:00-04:00", network: "FOX", stadium: "Cleveland Browns Stadium" }, { away: "IND", home: "TEN", date: "2025-09-21T13:00:00-04:00", network: "CBS", stadium: "Nissan Stadium" }, { away: "HOU", home: "JAX", date: "2025-09-21T13:00:00-04:00", network: "CBS", stadium: "EverBank Stadium" }, { away: "PIT", home: "NE", date: "2025-09-21T13:00:00-04:00", network: "CBS", stadium: "Gillette Stadium" }, { away: "NYJ", home: "TB", date: "2025-09-21T13:00:00-04:00", network: "FOX", stadium: "Raymond James Stadium" }, { away: "LAR", home: "PHI", date: "2025-09-21T13:00:00-04:00", network: "FOX", stadium: "Lincoln Financial Field" }, { away: "LV", home: "WAS", date: "2025-09-21T13:00:00-04:00", network: "FOX", stadium: "FedExField" }, { away: "DEN", home: "LAC", date: "2025-09-21T16:05:00-04:00", network: "CBS", stadium: "SoFi Stadium" }, { away: "NO", home: "SEA", date: "2025-09-21T16:05:00-04:00", network: "FOX", stadium: "Lumen Field" }, { away: "DAL", home: "CHI", date: "2025-09-21T16:25:00-04:00", network: "FOX", stadium: "Soldier Field" }, { away: "ARI", home: "SF", date: "2025-09-21T16:25:00-04:00", network: "FOX", stadium: "Levi's Stadium" }, { away: "KC", home: "NYG", date: "2025-09-21T20:20:00-04:00", network: "NBC", stadium: "MetLife Stadium" }, { away: "DET", home: "BAL", date: "2025-09-22T20:15:00-04:00", network: "ESPN", stadium: "M&T Bank Stadium" }], "4": [{ away: "SEA", home: "ARI", date: "2025-09-25T20:15:00-04:00", network: "Prime", stadium: "State Farm Stadium" }, { away: "MIN", home: "PIT", date: "2025-09-28T09:30:00-04:00", network: "NFLN", stadium: "Acrisure Stadium" }, { away: "WAS", home: "ATL", date: "2025-09-28T13:00:00-04:00", network: "FOX", stadium: "Mercedes-Benz Stadium" }, { away: "NO", home: "BUF", date: "2025-09-28T13:00:00-04:00", network: "FOX", stadium: "Highmark Stadium" }, { away: "CAR", home: "NE", date: "2025-09-28T13:00:00-04:00", network: "FOX", stadium: "Gillette Stadium" }, { away: "CLE", home: "DET", date: "2025-09-28T13:00:00-04:00", network: "FOX", stadium: "Ford Field" }, { away: "TEN", home: "HOU", date: "2025-09-28T13:00:00-04:00", network: "CBS", stadium: "NRG Stadium" }, { away: "LAC", home: "NYG", date: "2025-09-28T13:00:00-04:00", network: "CBS", stadium: "MetLife Stadium" }, { away: "PHI", home: "TB", date: "2025-09-28T13:00:00-04:00", network: "FOX", stadium: "Raymond James Stadium" }, { away: "IND", home: "LAR", date: "2025-09-28T16:05:00-04:00", network: "CBS", stadium: "SoFi Stadium" }, { away: "JAX", home: "SF", date: "2025-09-28T16:05:00-04:00", network: "CBS", stadium: "Levi's Stadium" }, { away: "CHI", home: "LV", date: "2025-09-28T16:25:00-04:00", network: "FOX", stadium: "Allegiant Stadium" }, { away: "BAL", home: "KC", date: "2025-09-28T16:25:00-04:00", network: "FOX", stadium: "Arrowhead Stadium" }, { away: "GB", home: "DAL", date: "2025-09-28T20:20:00-04:00", network: "NBC", stadium: "AT&T Stadium" }, { away: "NYJ", home: "MIA", date: "2025-09-29T19:15:00-04:00", network: "ESPN", stadium: "Hard Rock Stadium" }, { away: "CIN", home: "DEN", date: "2025-09-29T20:15:00-04:00", network: "ESPN", stadium: "Empower Field at Mile High" }], "5": [{ away: "SF", home: "LAR", date: "2025-10-02T20:15:00-04:00", network: "Prime", stadium: "SoFi Stadium" }, { away: "MIN", home: "CLE", date: "2025-10-05T09:30:00-04:00", network: "NFLN", stadium: "Cleveland Browns Stadium" }, { away: "MIA", home: "CAR", date: "2025-10-05T13:00:00-04:00", network: "FOX", stadium: "Bank of America Stadium" }, { away: "LV", home: "IND", date: "2025-10-05T13:00:00-04:00", network: "CBS", stadium: "Lucas Oil Stadium" }, { away: "DAL", home: "NYJ", date: "2025-10-05T13:00:00-04:00", network: "FOX", stadium: "MetLife Stadium" }, { away: "DEN", home: "PHI", date: "2025-10-05T13:00:00-04:00", network: "CBS", stadium: "Lincoln Financial Field" }, { away: "HOU", home: "BAL", date: "2025-10-05T13:00:00-04:00", network: "CBS", stadium: "M&T Bank Stadium" }, { away: "NYG", home: "NO", date: "2025-10-05T13:00:00-04:00", network: "FOX", stadium: "Caesars Superdome" }, { away: "TEN", home: "ARI", date: "2025-10-05T16:05:00-04:00", network: "CBS", stadium: "State Farm Stadium" }, { away: "TB", home: "SEA", date: "2025-10-05T16:05:00-04:00", network: "FOX", stadium: "Lumen Field" }, { away: "DET", home: "CIN", date: "2025-10-05T16:25:00-04:00", network: "FOX", stadium: "Paycor Stadium" }, { away: "WAS", home: "LAC", date: "2025-10-05T16:25:00-04:00", network: "FOX", stadium: "SoFi Stadium" }, { away: "NE", home: "BUF", date: "2025-10-05T20:20:00-04:00", network: "NBC", stadium: "Highmark Stadium" }, { away: "KC", home: "JAX", date: "2025-10-06T20:15:00-04:00", network: "ESPN", stadium: "EverBank Stadium" }], "6": [{ away: "PHI", home: "NYG", date: "2025-10-09T20:15:00-04:00", network: "Prime", stadium: "MetLife Stadium" }, { away: "DEN", home: "NYJ", date: "2025-10-12T09:30:00-04:00", network: "NFLN", stadium: "MetLife Stadium" }, { away: "DAL", home: "CAR", date: "2025-10-12T13:00:00-04:00", network: "FOX", stadium: "Bank of America Stadium" }, { away: "CLE", home: "PIT", date: "2025-10-12T13:00:00-04:00", network: "CBS", stadium: "Acrisure Stadium" }, { away: "ARI", home: "IND", date: "2025-10-12T13:00:00-04:00", network: "CBS", stadium: "Lucas Oil Stadium" }, { away: "SEA", home: "JAX", date: "2025-10-12T13:00:00-04:00", network: "FOX", stadium: "EverBank Stadium" }, { away: "LAC", home: "MIA", date: "2025-10-12T13:00:00-04:00", network: "CBS", stadium: "Hard Rock Stadium" }, { away: "NE", home: "NO", date: "2025-10-12T13:00:00-04:00", network: "FOX", stadium: "Caesars Superdome" }, { away: "LAR", home: "BAL", date: "2025-10-12T13:00:00-04:00", network: "FOX", stadium: "M&T Bank Stadium" }, { away: "TEN", home: "LV", date: "2025-10-12T16:05:00-04:00", network: "CBS", stadium: "Allegiant Stadium" }, { away: "CIN", home: "GB", date: "2025-10-12T16:25:00-04:00", network: "FOX", stadium: "Lambeau Field" }, { away: "SF", home: "TB", date: "2025-10-12T16:25:00-04:00", network: "FOX", stadium: "Raymond James Stadium" }, { away: "DET", home: "KC", date: "2025-10-12T20:20:00-04:00", network: "NBC", stadium: "Arrowhead Stadium" }, { away: "BUF", home: "ATL", date: "2025-10-13T19:15:00-04:00", network: "ESPN", stadium: "Mercedes-Benz Stadium" }, { away: "CHI", home: "WAS", date: "2025-10-13T20:15:00-04:00", network: "ESPN", stadium: "FedExField" }], "7": [{ away: "PIT", home: "CIN", date: "2025-10-16T20:15:00-04:00", network: "Prime", stadium: "Paycor Stadium" }, { away: "LAR", home: "JAX", date: "2025-10-19T09:30:00-04:00", network: "NFLN", stadium: "EverBank Stadium" }, { away: "NO", home: "CHI", date: "2025-10-19T13:00:00-04:00", network: "FOX", stadium: "Soldier Field" }, { away: "PHI", home: "MIN", date: "2025-10-19T13:00:00-04:00", network: "FOX", stadium: "U.S. Bank Stadium" }, { away: "CAR", home: "NYJ", date: "2025-10-19T13:00:00-04:00", network: "FOX", stadium: "MetLife Stadium" }, { away: "MIA", home: "CLE", date: "2025-10-19T13:00:00-04:00", network: "CBS", stadium: "Cleveland Browns Stadium" }, { away: "LV", home: "KC", date: "2025-10-19T13:00:00-04:00", network: "CBS", stadium: "Arrowhead Stadium" }, { away: "NE", home: "TEN", date: "2025-10-19T13:00:00-04:00", network: "CBS", stadium: "Nissan Stadium" }, { away: "IND", home: "LAC", date: "2025-10-19T16:05:00-04:00", network: "CBS", stadium: "SoFi Stadium" }, { away: "NYG", home: "DEN", date: "2025-10-19T16:05:00-04:00", network: "FOX", stadium: "Empower Field at Mile High" }, { away: "GB", home: "ARI", date: "2025-10-19T16:25:00-04:00", network: "FOX", stadium: "State Farm Stadium" }, { away: "WAS", home: "DAL", date: "2025-10-19T16:25:00-04:00", network: "FOX", stadium: "AT&T Stadium" }, { away: "ATL", home: "SF", date: "2025-10-19T20:20:00-04:00", network: "NBC", stadium: "Levi's Stadium" }, { away: "TB", home: "DET", date: "2025-10-20T19:00:00-04:00", network: "ESPN", stadium: "Ford Field" }, { away: "HOU", home: "SEA", date: "2025-10-20T22:00:00-04:00", network: "ESPN", stadium: "Lumen Field" }], "8": [{ away: "MIN", home: "LAC", date: "2025-10-23T20:15:00-04:00", network: "Prime", stadium: "SoFi Stadium" }, { away: "ATL", home: "MIA", date: "2025-10-26T13:00:00-04:00", network: "FOX", stadium: "Hard Rock Stadium" }, { away: "BUF", home: "CAR", date: "2025-10-26T13:00:00-04:00", network: "CBS", stadium: "Bank of America Stadium" }, { away: "CHI", home: "BAL", date: "2025-10-26T13:00:00-04:00", network: "FOX", stadium: "M&T Bank Stadium" }, { away: "SF", home: "HOU", date: "2025-10-26T13:00:00-04:00", network: "FOX", stadium: "NRG Stadium" }, { away: "NYJ", home: "CIN", date: "2025-10-26T13:00:00-04:00", network: "CBS", stadium: "Paycor Stadium" }, { away: "CLE", home: "NE", date: "2025-10-26T13:00:00-04:00", network: "CBS", stadium: "Gillette Stadium" }, { away: "NYG", home: "PHI", date: "2025-10-26T13:00:00-04:00", network: "FOX", stadium: "Lincoln Financial Field" }, { away: "TB", home: "NO", date: "2025-10-26T16:05:00-04:00", network: "FOX", stadium: "Caesars Superdome" }, { away: "TEN", home: "IND", date: "2025-10-26T16:25:00-04:00", network: "CBS", stadium: "Lucas Oil Stadium" }, { away: "DAL", home: "DEN", date: "2025-10-26T16:25:00-04:00", network: "CBS", stadium: "Empower Field at Mile High" }, { away: "GB", home: "PIT", date: "2025-10-26T20:20:00-04:00", network: "NBC", stadium: "Acrisure Stadium" }, { away: "KC", home: "WAS", date: "2025-10-27T20:15:00-04:00", network: "ESPN", stadium: "FedExField" }], "9": [{ away: "BAL", home: "MIA", date: "2025-10-30T20:15:00-04:00", network: "Prime", stadium: "Hard Rock Stadium" }, { away: "ATL", home: "NE", date: "2025-11-02T13:00:00-04:00", network: "FOX", stadium: "Gillette Stadium" }, { away: "CHI", home: "CIN", date: "2025-11-02T13:00:00-04:00", network: "FOX", stadium: "Paycor Stadium" }, { away: "MIN", home: "DET", date: "2025-11-02T13:00:00-04:00", network: "FOX", stadium: "Ford Field" }, { away: "CAR", home: "GB", date: "2025-11-02T13:00:00-04:00", network: "FOX", stadium: "Lambeau Field" }, { away: "IND", home: "PIT", date: "2025-11-02T13:00:00-04:00", network: "CBS", stadium: "Acrisure Stadium" }, { away: "DEN", home: "HOU", date: "2025-11-02T13:00:00-04:00", network: "CBS", stadium: "NRG Stadium" }, { away: "SF", home: "NYG", date: "2025-11-02T13:00:00-04:00", network: "FOX", stadium: "MetLife Stadium" }, { away: "LAC", home: "TEN", date: "2025-11-02T13:00:00-04:00", network: "CBS", stadium: "Nissan Stadium" }, { away: "JAX", home: "LV", date: "2025-11-02T16:05:00-04:00", network: "CBS", stadium: "Allegiant Stadium" }, { away: "NO", home: "LAR", date: "2025-11-02T16:05:00-04:00", network: "FOX", stadium: "SoFi Stadium" }, { away: "KC", home: "BUF", date: "2025-11-02T16:25:00-04:00", network: "CBS", stadium: "Highmark Stadium" }, { away: "SEA", home: "WAS", date: "2025-11-02T20:20:00-04:00", network: "NBC", stadium: "FedExField" }, { away: "ARI", home: "DAL", date: "2025-11-03T20:15:00-04:00", network: "ESPN", stadium: "AT&T Stadium" }], "10": [{ away: "LV", home: "DEN", date: "2025-11-06T20:15:00-04:00", network: "Prime", stadium: "Empower Field at Mile High" }, { away: "ATL", home: "IND", date: "2025-11-09T09:30:00-04:00", network: "NFLN", stadium: "Lucas Oil Stadium" }, { away: "BUF", home: "MIA", date: "2025-11-09T13:00:00-04:00", network: "CBS", stadium: "Hard Rock Stadium" }, { away: "NYG", home: "CHI", date: "2025-11-09T13:00:00-04:00", network: "FOX", stadium: "Soldier Field" }, { away: "CLE", home: "NYJ", date: "2025-11-09T13:00:00-04:00", network: "CBS", stadium: "MetLife Stadium" }, { away: "JAX", home: "HOU", date: "2025-11-09T13:00:00-04:00", network: "CBS", stadium: "NRG Stadium" }, { away: "BAL", home: "MIN", date: "2025-11-09T13:00:00-04:00", network: "FOX", stadium: "U.S. Bank Stadium" }, { away: "NO", home: "CAR", date: "2025-11-09T13:00:00-04:00", network: "FOX", stadium: "Bank of America Stadium" }, { away: "NE", home: "TB", date: "2025-11-09T13:00:00-04:00", network: "CBS", stadium: "Raymond James Stadium" }, { away: "ARI", home: "SEA", date: "2025-11-09T16:05:00-04:00", network: "FOX", stadium: "Lumen Field" }, { away: "DET", home: "WAS", date: "2025-11-09T16:25:00-04:00", network: "FOX", stadium: "FedExField" }, { away: "LAR", home: "SF", date: "2025-11-09T16:25:00-04:00", network: "FOX", stadium: "Levi's Stadium" }, { away: "PIT", home: "LAC", date: "2025-11-09T20:20:00-04:00", network: "NBC", stadium: "SoFi Stadium" }, { away: "PHI", home: "GB", date: "2025-11-10T20:15:00-04:00", network: "ESPN", stadium: "Lambeau Field" }], "11": [{ away: "NYJ", home: "NE", date: "2025-11-13T20:15:00-04:00", network: "Prime", stadium: "Gillette Stadium" }, { away: "WAS", home: "MIA", date: "2025-11-16T09:30:00-04:00", network: "NFLN", stadium: "Hard Rock Stadium" }, { away: "CAR", home: "ATL", date: "2025-11-16T13:00:00-04:00", network: "FOX", stadium: "Mercedes-Benz Stadium" }, { away: "TB", home: "BUF", date: "2025-11-16T13:00:00-04:00", network: "FOX", stadium: "Highmark Stadium" }, { away: "CHI", home: "MIN", date: "2025-11-16T13:00:00-04:00", network: "FOX", stadium: "U.S. Bank Stadium" }, { away: "CIN", home: "PIT", date: "2025-11-16T13:00:00-04:00", network: "CBS", stadium: "Acrisure Stadium" }, { away: "GB", home: "NYG", date: "2025-11-16T13:00:00-04:00", network: "FOX", stadium: "MetLife Stadium" }, { away: "HOU", home: "TEN", date: "2025-11-16T13:00:00-04:00", network: "CBS", stadium: "Nissan Stadium" }, { away: "LAC", home: "JAX", date: "2025-11-16T13:00:00-04:00", network: "CBS", stadium: "EverBank Stadium" }, { away: "SF", home: "ARI", date: "2025-11-16T16:05:00-04:00", network: "FOX", stadium: "State Farm Stadium" }, { away: "SEA", home: "LAR", date: "2025-11-16T16:05:00-04:00", network: "FOX", stadium: "SoFi Stadium" }, { away: "BAL", home: "CLE", date: "2025-11-16T16:25:00-04:00", network: "FOX", stadium: "Cleveland Browns Stadium" }, { away: "KC", home: "DEN", date: "2025-11-16T16:25:00-04:00", network: "FOX", stadium: "Empower Field at Mile High" }, { away: "DET", home: "PHI", date: "2025-11-16T20:20:00-04:00", network: "NBC", stadium: "Lincoln Financial Field" }, { away: "DAL", home: "LV", date: "2025-11-17T20:15:00-04:00", network: "ESPN", stadium: "Allegiant Stadium" }], "12": [{ away: "BUF", home: "HOU", date: "2025-11-20T20:15:00-04:00", network: "Prime", stadium: "NRG Stadium" }, { away: "PIT", home: "CHI", date: "2025-11-23T13:00:00-04:00", network: "CBS", stadium: "Soldier Field" }, { away: "NE", home: "CIN", date: "2025-11-23T13:00:00-04:00", network: "CBS", stadium: "Paycor Stadium" }, { away: "IND", home: "KC", date: "2025-11-23T13:00:00-04:00", network: "CBS", stadium: "Arrowhead Stadium" }, { away: "NYG", home: "DET", date: "2025-11-23T13:00:00-04:00", network: "FOX", stadium: "Ford Field" }, { away: "MIN", home: "GB", date: "2025-11-23T13:00:00-04:00", network: "FOX", stadium: "Lambeau Field" }, { away: "NYJ", home: "BAL", date: "2025-11-23T13:00:00-04:00", network: "CBS", stadium: "M&T Bank Stadium" }, { away: "SEA", home: "TEN", date: "2025-11-23T13:00:00-04:00", network: "FOX", stadium: "Nissan Stadium" }, { away: "CLE", home: "LV", date: "2025-11-23T16:05:00-04:00", network: "FOX", stadium: "Allegiant Stadium" }, { away: "JAX", home: "ARI", date: "2025-11-23T16:05:00-04:00", network: "CBS", stadium: "State Farm Stadium" }, { away: "ATL", home: "NO", date: "2025-11-23T16:25:00-04:00", network: "FOX", stadium: "Caesars Superdome" }, { away: "PHI", home: "DAL", date: "2025-11-23T16:25:00-04:00", network: "FOX", stadium: "AT&T Stadium" }, { away: "TB", home: "LAR", date: "2025-11-23T20:20:00-04:00", network: "NBC", stadium: "SoFi Stadium" }, { away: "CAR", home: "SF", date: "2025-11-24T20:15:00-04:00", network: "ESPN", stadium: "Levi's Stadium" }], "13": [{ away: "GB", home: "DET", date: "2025-11-27T13:00:00-04:00", network: "FOX", stadium: "Ford Field" }, { away: "KC", home: "DAL", date: "2025-11-27T16:30:00-05:00", network: "CBS", stadium: "AT&T Stadium" }, { away: "CIN", home: "BAL", date: "2025-11-27T20:20:00-05:00", network: "NBC", stadium: "M&T Bank Stadium" }, { away: "CHI", home: "PHI", date: "2025-11-28T15:00:00-05:00", network: "FOX", stadium: "Lincoln Financial Field" }, { away: "ATL", home: "NYJ", date: "2025-11-30T13:00:00-05:00", network: "CBS", stadium: "MetLife Stadium" }, { away: "SF", home: "CLE", date: "2025-11-30T13:00:00-05:00", network: "FOX", stadium: "Cleveland Browns Stadium" }, { away: "HOU", home: "IND", date: "2025-11-30T13:00:00-05:00", network: "CBS", stadium: "Lucas Oil Stadium" }, { away: "ARI", home: "TB", date: "2025-11-30T13:00:00-05:00", network: "FOX", stadium: "Raymond James Stadium" }, { away: "JAX", home: "TEN", date: "2025-11-30T13:00:00-05:00", network: "CBS", stadium: "Nissan Stadium" }, { away: "NO", home: "MIA", date: "2025-11-30T13:00:00-05:00", network: "FOX", stadium: "Hard Rock Stadium" }, { away: "LAR", home: "CAR", date: "2025-11-30T13:00:00-05:00", network: "FOX", stadium: "Bank of America Stadium" }, { away: "MIN", home: "SEA", date: "2025-11-30T16:05:00-05:00", network: "FOX", stadium: "Lumen Field" }, { away: "BUF", home: "PIT", date: "2025-11-30T16:25:00-05:00", network: "CBS", stadium: "Acrisure Stadium" }, { away: "LV", home: "LAC", date: "2025-11-30T16:25:00-05:00", network: "CBS", stadium: "SoFi Stadium" }, { away: "DEN", home: "WAS", date: "2025-11-30T20:20:00-05:00", network: "NBC", stadium: "FedExField" }, { away: "NYG", home: "NE", date: "2025-12-01T20:15:00-05:00", network: "ESPN", stadium: "Gillette Stadium" }], "14": [{ away: "DAL", home: "DET", date: "2025-12-04T20:15:00-05:00", network: "Prime", stadium: "Ford Field" }, { away: "ATL", home: "SEA", date: "2025-12-07T13:00:00-05:00", network: "FOX", stadium: "Lumen Field" }, { away: "CIN", home: "BUF", date: "2025-12-07T13:00:00-05:00", network: "CBS", stadium: "Highmark Stadium" }, { away: "TEN", home: "CLE", date: "2025-12-07T13:00:00-05:00", network: "CBS", stadium: "Cleveland Browns Stadium" }, { away: "IND", home: "JAX", date: "2025-12-07T13:00:00-05:00", network: "CBS", stadium: "EverBank Stadium" }, { away: "MIA", home: "NYJ", date: "2025-12-07T13:00:00-05:00", network: "FOX", stadium: "MetLife Stadium" }, { away: "WAS", home: "MIN", date: "2025-12-07T13:00:00-05:00", network: "FOX", stadium: "U.S. Bank Stadium" }, { away: "NO", home: "TB", date: "2025-12-07T13:00:00-05:00", network: "FOX", stadium: "Raymond James Stadium" }, { away: "PIT", home: "BAL", date: "2025-12-07T13:00:00-05:00", network: "CBS", stadium: "M&T Bank Stadium" }, { away: "DEN", home: "LV", date: "2025-12-07T16:05:00-05:00", network: "FOX", stadium: "Allegiant Stadium" }, { away: "CHI", home: "GB", date: "2025-12-07T16:25:00-05:00", network: "FOX", stadium: "Lambeau Field" }, { away: "LAR", home: "ARI", date: "2025-12-07T16:25:00-05:00", network: "FOX", stadium: "State Farm Stadium" }, { away: "HOU", home: "KC", date: "2025-12-07T20:20:00-05:00", network: "NBC", stadium: "Arrowhead Stadium" }, { away: "PHI", home: "LAC", date: "2025-12-08T20:15:00-05:00", network: "ESPN", stadium: "SoFi Stadium" }], "15": [{ away: "ATL", home: "TB", date: "2025-12-11T20:15:00-05:00", network: "Prime", stadium: "Raymond James Stadium" }, { away: "BUF", home: "NE", date: "2025-12-14T13:00:00-05:00", network: "CBS", stadium: "Gillette Stadium" }, { away: "CLE", home: "CHI", date: "2025-12-14T13:00:00-05:00", network: "CBS", stadium: "Soldier Field" }, { away: "BAL", home: "CIN", date: "2025-12-14T13:00:00-05:00", network: "CBS", stadium: "Paycor Stadium" }, { away: "ARI", home: "HOU", date: "2025-12-14T13:00:00-05:00", network: "FOX", stadium: "NRG Stadium" }, { away: "NYJ", home: "JAX", date: "2025-12-14T13:00:00-05:00", network: "CBS", stadium: "EverBank Stadium" }, { away: "LAC", home: "KC", date: "2025-12-14T13:00:00-05:00", network: "CBS", stadium: "Arrowhead Stadium" }, { away: "WAS", home: "NYG", date: "2025-12-14T13:00:00-05:00", network: "FOX", stadium: "MetLife Stadium" }, { away: "LV", home: "PHI", date: "2025-12-14T13:00:00-05:00", network: "FOX", stadium: "Lincoln Financial Field" }, { away: "CAR", home: "NO", date: "2025-12-14T16:25:00-05:00", network: "FOX", stadium: "Caesars Superdome" }, { away: "IND", home: "SEA", date: "2025-12-14T16:25:00-05:00", network: "CBS", stadium: "Lumen Field" }, { away: "GB", home: "DEN", date: "2025-12-14T16:25:00-05:00", network: "CBS", stadium: "Empower Field at Mile High" }, { away: "DET", home: "LAR", date: "2025-12-14T16:25:00-05:00", network: "FOX", stadium: "SoFi Stadium" }, { away: "TEN", home: "SF", date: "2025-12-14T16:25:00-05:00", network: "FOX", stadium: "Levi's Stadium" }, { away: "MIN", home: "DAL", date: "2025-12-14T20:20:00-05:00", network: "NBC", stadium: "AT&T Stadium" }, { away: "MIA", home: "PIT", date: "2025-12-15T20:15:00-05:00", network: "ESPN", stadium: "Acrisure Stadium" }], "16": [{ away: "LAR", home: "SEA", date: "2025-12-18T20:15:00-05:00", network: "Prime", stadium: "Lumen Field" }, { away: "PHI", home: "WAS", date: "2025-12-20T17:00:00-05:00", network: "NFLN", stadium: "FedExField" }, { away: "GB", home: "CHI", date: "2025-12-20T20:20:00-05:00", network: "NFLN", stadium: "Soldier Field" }, { away: "BUF", home: "CLE", date: "2025-12-21T13:00:00-05:00", network: "CBS", stadium: "Cleveland Browns Stadium" }, { away: "TB", home: "CAR", date: "2025-12-21T13:00:00-05:00", network: "FOX", stadium: "Bank of America Stadium" }, { away: "MIA", home: "CIN", date: "2025-12-21T13:00:00-05:00", network: "CBS", stadium: "Paycor Stadium" }, { away: "LAC", home: "DAL", date: "2025-12-21T13:00:00-05:00", network: "CBS", stadium: "AT&T Stadium" }, { away: "KC", home: "TEN", date: "2025-12-21T13:00:00-05:00", network: "FOX", stadium: "Nissan Stadium" }, { away: "MIN", home: "NYG", date: "2025-12-21T13:00:00-05:00", network: "FOX", stadium: "MetLife Stadium" }, { away: "NYJ", home: "NO", date: "2025-12-21T13:00:00-05:00", network: "CBS", stadium: "Caesars Superdome" }, { away: "ATL", home: "ARI", date: "2025-12-21T16:05:00-05:00", network: "FOX", stadium: "State Farm Stadium" }, { away: "JAX", home: "DEN", date: "2025-12-21T16:05:00-05:00", network: "CBS", stadium: "Empower Field at Mile High" }, { away: "PIT", home: "DET", date: "2025-12-21T16:25:00-05:00", network: "FOX", stadium: "Ford Field" }, { away: "LV", home: "HOU", date: "2025-12-21T16:25:00-05:00", network: "FOX", stadium: "NRG Stadium" }, { away: "NE", home: "BAL", date: "2025-12-21T20:20:00-05:00", network: "NBC", stadium: "M&T Bank Stadium" }, { away: "SF", home: "IND", date: "2025-12-22T20:15:00-05:00", network: "ESPN", stadium: "Lucas Oil Stadium" }], "17": [{ away: "WAS", home: "DAL", date: "2025-12-25T13:00:00-05:00", network: "FOX", stadium: "AT&T Stadium" }, { away: "DET", home: "MIN", date: "2025-12-25T16:30:00-05:00", network: "CBS", stadium: "U.S. Bank Stadium" }, { away: "KC", home: "DEN", date: "2025-12-25T20:15:00-05:00", network: "NBC", stadium: "Empower Field at Mile High" }, { away: "HOU", home: "LAC", date: "2025-12-27T16:30:00-05:00", network: "NFLN", stadium: "SoFi Stadium" }, { away: "GB", home: "BAL", date: "2025-12-27T20:00:00-05:00", network: "NFLN", stadium: "M&T Bank Stadium" }, { away: "CAR", home: "SEA", date: "2025-12-28T13:00:00-05:00", network: "FOX", stadium: "Bank of America Stadium" }, { away: "ARI", home: "CIN", date: "2025-12-28T13:00:00-05:00", network: "FOX", stadium: "Paycor Stadium" }, { away: "PIT", home: "CLE", date: "2025-12-28T13:00:00-05:00", network: "CBS", stadium: "Cleveland Browns Stadium" }, { away: "JAX", home: "IND", date: "2025-12-28T13:00:00-05:00", network: "CBS", stadium: "Lucas Oil Stadium" }, { away: "TB", home: "MIA", date: "2025-12-28T13:00:00-05:00", network: "FOX", stadium: "Hard Rock Stadium" }, { away: "TEN", home: "NO", date: "2025-12-28T13:00:00-05:00", network: "FOX", stadium: "Nissan Stadium" }, { away: "NYJ", home: "NE", date: "2025-12-28T13:00:00-05:00", network: "CBS", stadium: "MetLife Stadium" }, { away: "LV", home: "NYG", date: "2025-12-28T16:05:00-05:00", network: "FOX", stadium: "MetLife Stadium" }, { away: "BUF", home: "PHI", date: "2025-12-28T16:25:00-05:00", network: "FOX", stadium: "Lincoln Financial Field" }, { away: "CHI", home: "SF", date: "2025-12-28T20:20:00-05:00", network: "NBC", stadium: "Levi's Stadium" }, { away: "LAR", home: "ATL", date: "2025-12-29T20:15:00-05:00", network: "ESPN", stadium: "Mercedes-Benz Stadium" }], "18": [{ away: "CAR", home: "TB", date: "2026-01-03T16:30:00-05:00", network: "FOX", stadium: "Raymond James Stadium" }, { away: "SEA", home: "SF", date: "2026-01-03T20:00:00-05:00", network: "NBC", stadium: "Levi's Stadium" }, { away: "NO", home: "ATL", date: "2026-01-04T13:00:00-05:00", network: "FOX", stadium: "Mercedes-Benz Stadium" }, { away: "CLE", home: "CIN", date: "2026-01-04T13:00:00-05:00", network: "CBS", stadium: "Paycor Stadium" }, { away: "IND", home: "HOU", date: "2026-01-04T13:00:00-05:00", network: "CBS", stadium: "NRG Stadium" }, { away: "DAL", home: "NYG", date: "2026-01-04T13:00:00-05:00", network: "FOX", stadium: "MetLife Stadium" }, { away: "GB", home: "MIN", date: "2026-01-04T13:00:00-05:00", network: "FOX", stadium: "U.S. Bank Stadium" }, { away: "TEN", home: "JAX", date: "2026-01-04T13:00:00-05:00", network: "CBS", stadium: "EverBank Stadium" }, { away: "NYJ", home: "BUF", date: "2026-01-04T16:25:00-05:00", network: "CBS", stadium: "Highmark Stadium" }, { away: "CHI", home: "DET", date: "2026-01-04T16:25:00-05:00", network: "FOX", stadium: "Ford Field" }, { away: "ARI", home: "LAR", date: "2026-01-04T16:25:00-05:00", network: "FOX", stadium: "SoFi Stadium" }, { away: "LAC", home: "DEN", date: "2026-01-04T16:25:00-05:00", network: "FOX", stadium: "Empower Field at Mile High" }, { away: "KC", home: "LV", date: "2026-01-04T16:25:00-05:00", network: "CBS", stadium: "Allegiant Stadium" }, { away: "MIA", home: "NE", date: "2026-01-04T16:25:00-05:00", network: "CBS", stadium: "Gillette Stadium" }, { away: "PHI", home: "WAS", date: "2026-01-04T16:25:00-05:00", network: "FOX", stadium: "Lincoln Financial Field" }, { away: "BAL", home: "PIT", date: "2026-01-04T20:20:00-05:00", network: "NBC", stadium: "Acrisure Stadium" }] } };
  }
});

// src/services/espn.ts
var espn_exports = {};
__export(espn_exports, {
  fetchEspnScoreboard: () => fetchEspnScoreboard,
  getNflSeasonContext: () => getNflSeasonContext,
  getStaticNetwork: () => getStaticNetwork,
  getTeamDisplayName: () => getTeamDisplayName
});
function getTeamDisplayName(abbrev) {
  return TEAM_NAMES[abbrev] ?? abbrev;
}
function getNflSeasonContext() {
  const now = /* @__PURE__ */ new Date();
  const year2 = now.getFullYear();
  const month = now.getMonth();
  const day2 = now.getDate();
  if (month === 0 || month === 1 && day2 <= 15) {
    return { season: year2 - 1, seasontype: "3" };
  }
  if (month <= 6) {
    return { season: year2 - 1, seasontype: "2" };
  }
  if (month === 7 || month === 8 && day2 <= 4) {
    return { season: year2, seasontype: "1" };
  }
  return { season: year2, seasontype: "2" };
}
function loadStaticSchedule(week2, season, seasonType) {
  const weeks = nfl_schedule_2025_default.weeks;
  const weekGames = weeks?.[String(week2)] ?? [];
  const st = seasonType === "1" ? "preseason" : seasonType === "3" ? "postseason" : "regular";
  const games = [];
  const dbRows = [];
  weekGames.forEach((g, i) => {
    const id = `static-${season}-w${week2}-${i}`;
    const gameTime = new Date(g.date);
    const awayName = getTeamDisplayName(g.away);
    const homeName = getTeamDisplayName(g.home);
    const network = g.network ?? "TBD";
    games.push({
      id,
      awayTeam: awayName,
      awayTeamLogo: g.away,
      homeTeam: homeName,
      homeTeamLogo: g.home,
      gameTime: g.date,
      gameTimeDisplay: gameTime.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" }),
      spread: null,
      favoredTeam: "home",
      overUnder: null,
      tvNetwork: network,
      weather: INDOOR_TEAMS.has(g.home) ? { displayValue: "Indoor", temperature: 72 } : gameTime.getTime() < Date.now() ? { displayValue: "Outdoor" } : null
    });
    const weatherObj = INDOOR_TEAMS.has(g.home) ? { displayValue: "Indoor", temperature: 72 } : gameTime.getTime() < Date.now() ? { displayValue: "Outdoor" } : null;
    dbRows.push({
      id,
      week: week2,
      seasonYear: season,
      seasonType: st,
      homeTeam: g.home,
      awayTeam: g.away,
      gameTime,
      spread: null,
      overUnder: null,
      tvNetwork: network,
      stadium: g.stadium ?? null,
      weather: weatherObj ? JSON.stringify(weatherObj) : null
    });
  });
  return { games, dbRows };
}
function parseEspnEvents(events, resolvedWeek, s, st) {
  const games = [];
  const dbRows = [];
  for (const ev of events) {
    const comp = ev.competitions?.[0];
    const home = comp?.competitors?.find((c) => c.homeAway === "home");
    const away = comp?.competitors?.find((c) => c.homeAway === "away");
    const homeTeam = home?.team;
    const awayTeam = away?.team;
    const homeAbbrev = homeTeam?.abbreviation ?? "";
    const awayAbbrev = awayTeam?.abbreviation ?? "";
    const odds = ev.odds?.[0];
    const spreadVal = odds?.spread ?? odds?.pointSpread?.away?.close?.line;
    const overUnderVal = odds?.overUnder ?? odds?.total?.over?.close?.line;
    const awayFavorite = odds?.awayTeamOdds?.favorite ?? String(odds?.pointSpread?.away?.close?.line || "").startsWith("-");
    const venue = comp?.venue;
    const weather = ev.weather;
    const broadcast = ev.broadcasts?.[0]?.names?.[0] ?? ev.broadcast;
    const absSpread = spreadVal != null ? Math.abs(parseFloat(String(spreadVal).replace(/[+-]/g, "")) || 0) : null;
    const signedSpread = absSpread != null ? awayFavorite ? absSpread : -absSpread : null;
    const overUnder = overUnderVal ? parseFloat(String(overUnderVal).replace(/[ou]/gi, "")) || null : null;
    const isIndoor = venue?.indoor || INDOOR_TEAMS.has(homeAbbrev);
    const isFinalOrPast = ev.status?.type?.name === "STATUS_FINAL" || new Date(ev.date).getTime() < Date.now() - 4 * 36e5;
    const weatherObj = weather ? { displayValue: weather.displayValue, temperature: weather.temperature } : isIndoor ? { displayValue: "Indoor", temperature: 72 } : isFinalOrPast ? { displayValue: "Outdoor" } : null;
    const gameTime = new Date(ev.date);
    const statusName = ev.status?.type?.name;
    const isFinal = statusName === "STATUS_FINAL";
    const gameTimeDisplay = isFinal ? gameTime.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" }) : ev.status?.type?.detail ?? ev.shortName ?? gameTime.toLocaleString("en-US", {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short"
    });
    games.push({
      id: ev.id,
      awayTeam: awayTeam?.displayName ?? getTeamDisplayName(awayAbbrev),
      awayTeamLogo: awayAbbrev,
      homeTeam: homeTeam?.displayName ?? getTeamDisplayName(homeAbbrev),
      homeTeamLogo: homeAbbrev,
      gameTime: ev.date,
      gameTimeDisplay,
      spread: absSpread,
      favoredTeam: awayFavorite ? "away" : "home",
      overUnder,
      tvNetwork: (Array.isArray(broadcast) ? broadcast[0] : broadcast) || (isFinal ? "" : "TBD"),
      weather: weatherObj,
      homeScore: home?.score != null ? parseInt(String(home.score), 10) : void 0,
      awayScore: away?.score != null ? parseInt(String(away.score), 10) : void 0,
      status: isFinal ? "final" : statusName === "STATUS_IN_PROGRESS" || statusName === "STATUS_HALFTIME" || statusName === "STATUS_END_PERIOD" ? "in_progress" : "scheduled"
    });
    dbRows.push({
      id: ev.id,
      week: resolvedWeek,
      seasonYear: s,
      seasonType: st === "1" ? "preseason" : st === "3" ? "postseason" : "regular",
      homeTeam: homeAbbrev,
      awayTeam: awayAbbrev,
      gameTime,
      spread: signedSpread,
      overUnder,
      tvNetwork: (Array.isArray(broadcast) ? broadcast[0] : broadcast) || void 0,
      stadium: venue?.fullName ?? null,
      weather: weatherObj ? JSON.stringify(weatherObj) : null,
      homeScore: home?.score != null ? parseInt(String(home.score), 10) : void 0,
      awayScore: away?.score != null ? parseInt(String(away.score), 10) : void 0
    });
  }
  return { games, dbRows };
}
async function fetchEspnByWeek(week2, season, seasonType) {
  try {
    const params = new URLSearchParams({ season: String(season), seasontype: seasonType });
    if (week2 != null) params.set("week", String(week2));
    const res = await fetch(`${ESPN_SCOREBOARD}?${params}`, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data !== "object") return null;
    const events = data.events || [];
    const resolvedWeek = week2 ?? data.week?.number ?? 1;
    return { events, resolvedWeek };
  } catch {
    return null;
  }
}
async function fetchEspnByDateRange(week2, season, seasonType) {
  const weeks = nfl_schedule_2025_default.weeks;
  const weekGames = weeks?.[String(week2)] ?? [];
  if (weekGames.length === 0) return null;
  const dates = weekGames.map((g) => new Date(g.date));
  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
  minDate.setDate(minDate.getDate() - 1);
  maxDate.setDate(maxDate.getDate() + 1);
  const fmt = /* @__PURE__ */ __name((d) => d.toISOString().slice(0, 10).replace(/-/g, ""), "fmt");
  const dateRange = `${fmt(minDate)}-${fmt(maxDate)}`;
  try {
    const res = await fetch(`${ESPN_SCOREBOARD}?dates=${dateRange}`, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data !== "object") return null;
    return { events: data.events || [] };
  } catch {
    return null;
  }
}
async function fetchEspnScoreboard(week2, season, seasonType) {
  const ctx = getNflSeasonContext();
  const s = season ?? ctx.season;
  const st = seasonType ?? ctx.seasontype;
  const weekNum = week2 ?? 1;
  const weekResult = await fetchEspnByWeek(week2, s, st);
  if (weekResult && weekResult.events.length > 0) {
    const parsed = parseEspnEvents(weekResult.events, weekResult.resolvedWeek, s, st);
    return { ...parsed, week: weekResult.resolvedWeek, season: s, source: "espn" };
  }
  const dateResult = await fetchEspnByDateRange(weekNum, s, st);
  if (dateResult && dateResult.events.length > 0) {
    const parsed = parseEspnEvents(dateResult.events, weekNum, s, st);
    return { ...parsed, week: weekNum, season: s, source: "espn" };
  }
  if (st === "2") {
    console.warn(`ESPN API unavailable for ${s} week ${weekNum}, using static schedule`);
    try {
      const fallback = loadStaticSchedule(weekNum, s, st);
      if (fallback.games.length > 0) {
        return { ...fallback, week: weekNum, season: s, source: "static" };
      }
    } catch {
    }
  }
  throw new Error(`ESPN unavailable and no static schedule for season ${s} week ${weekNum}`);
}
function teamMatch(a, b) {
  return a === b || TEAM_ALIASES[a] === b;
}
function getStaticNetwork(week2, homeTeam, awayTeam) {
  const weeks = nfl_schedule_2025_default.weeks;
  const weekGames = weeks?.[String(week2)] ?? [];
  const match2 = weekGames.find(
    (g) => teamMatch(g.home, homeTeam) && teamMatch(g.away, awayTeam) || teamMatch(g.home, awayTeam) && teamMatch(g.away, homeTeam)
  );
  return match2?.network ?? null;
}
var ESPN_SCOREBOARD, TEAM_NAMES, INDOOR_TEAMS, TEAM_ALIASES;
var init_espn = __esm({
  "src/services/espn.ts"() {
    "use strict";
    init_checked_fetch();
    init_modules_watch_stub();
    init_nfl_schedule_2025();
    ESPN_SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
    TEAM_NAMES = {
      ARI: "Arizona Cardinals",
      ATL: "Atlanta Falcons",
      BAL: "Baltimore Ravens",
      BUF: "Buffalo Bills",
      CAR: "Carolina Panthers",
      CHI: "Chicago Bears",
      CIN: "Cincinnati Bengals",
      CLE: "Cleveland Browns",
      DAL: "Dallas Cowboys",
      DEN: "Denver Broncos",
      DET: "Detroit Lions",
      GB: "Green Bay Packers",
      HOU: "Houston Texans",
      IND: "Indianapolis Colts",
      JAX: "Jacksonville Jaguars",
      KC: "Kansas City Chiefs",
      LAC: "Los Angeles Chargers",
      LAR: "Los Angeles Rams",
      LV: "Las Vegas Raiders",
      MIA: "Miami Dolphins",
      MIN: "Minnesota Vikings",
      NE: "New England Patriots",
      NO: "New Orleans Saints",
      NYG: "New York Giants",
      NYJ: "New York Jets",
      PHI: "Philadelphia Eagles",
      PIT: "Pittsburgh Steelers",
      SEA: "Seattle Seahawks",
      SF: "San Francisco 49ers",
      TB: "Tampa Bay Buccaneers",
      TEN: "Tennessee Titans",
      WAS: "Washington Commanders",
      WSH: "Washington Commanders"
    };
    __name(getTeamDisplayName, "getTeamDisplayName");
    INDOOR_TEAMS = /* @__PURE__ */ new Set(["NO", "DET", "MIN", "LV", "IND", "ATL", "DAL", "HOU", "ARI"]);
    __name(getNflSeasonContext, "getNflSeasonContext");
    __name(loadStaticSchedule, "loadStaticSchedule");
    __name(parseEspnEvents, "parseEspnEvents");
    __name(fetchEspnByWeek, "fetchEspnByWeek");
    __name(fetchEspnByDateRange, "fetchEspnByDateRange");
    __name(fetchEspnScoreboard, "fetchEspnScoreboard");
    TEAM_ALIASES = { WSH: "WAS", WAS: "WSH" };
    __name(teamMatch, "teamMatch");
    __name(getStaticNetwork, "getStaticNetwork");
  }
});

// .wrangler/tmp/bundle-n6Y6qc/middleware-loader.entry.ts
init_checked_fetch();
init_modules_watch_stub();

// .wrangler/tmp/bundle-n6Y6qc/middleware-insertion-facade.js
init_checked_fetch();
init_modules_watch_stub();

// src/index.ts
init_checked_fetch();
init_modules_watch_stub();
init_dist();

// node_modules/hono/dist/middleware/cors/index.js
init_checked_fetch();
init_modules_watch_stub();
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

// node_modules/hono/dist/middleware/logger/index.js
init_checked_fetch();
init_modules_watch_stub();

// node_modules/hono/dist/utils/color.js
init_checked_fetch();
init_modules_watch_stub();
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
  const { navigator: navigator2 } = globalThis;
  const cfWorkers = "cloudflare:workers";
  const isNoColor = navigator2 !== void 0 && navigator2.userAgent === "Cloudflare-Workers" ? await (async () => {
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

// node_modules/drizzle-orm/d1/driver.js
init_checked_fetch();
init_modules_watch_stub();
init_entity();
init_logger();
init_relations();
init_db();
init_dialect();

// node_modules/drizzle-orm/d1/session.js
init_checked_fetch();
init_modules_watch_stub();
init_entity();
init_logger();
init_sql();
init_sqlite_core();
init_session();
init_utils();
var SQLiteD1Session = class extends SQLiteSession {
  static {
    __name(this, "SQLiteD1Session");
  }
  constructor(client, dialect, schema, options = {}) {
    super(dialect);
    this.client = client;
    this.schema = schema;
    this.options = options;
    this.logger = options.logger ?? new NoopLogger();
  }
  static [entityKind] = "SQLiteD1Session";
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
var D1Transaction = class _D1Transaction extends SQLiteTransaction {
  static {
    __name(this, "D1Transaction");
  }
  static [entityKind] = "D1Transaction";
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
function d1ToRawMapping(results) {
  const rows = [];
  for (const row of results) {
    const entry = Object.keys(row).map((k) => row[k]);
    rows.push(entry);
  }
  return rows;
}
__name(d1ToRawMapping, "d1ToRawMapping");
var D1PreparedQuery = class extends SQLitePreparedQuery {
  static {
    __name(this, "D1PreparedQuery");
  }
  constructor(stmt, query, logger2, fields, executeMethod, _isResponseInArrayMode, customResultMapper) {
    super("async", executeMethod, query);
    this.logger = logger2;
    this._isResponseInArrayMode = _isResponseInArrayMode;
    this.customResultMapper = customResultMapper;
    this.fields = fields;
    this.stmt = stmt;
  }
  static [entityKind] = "D1PreparedQuery";
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

// node_modules/drizzle-orm/d1/driver.js
var DrizzleD1Database = class extends BaseSQLiteDatabase {
  static {
    __name(this, "DrizzleD1Database");
  }
  static [entityKind] = "D1Database";
  async batch(batch) {
    return this.session.batch(batch);
  }
};
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

// src/index.ts
init_schema();

// src/middleware/rateLimit.ts
init_checked_fetch();
init_modules_watch_stub();
var memoryStore = /* @__PURE__ */ new Map();
var lastCleanup = 0;
function cleanupMemory() {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (now > entry.resetAt) {
      memoryStore.delete(key);
    }
  }
}
__name(cleanupMemory, "cleanupMemory");
function checkMemory(key, maxRequests, windowMs) {
  const now = Date.now();
  if (now - lastCleanup > 6e4) {
    cleanupMemory();
    lastCleanup = now;
  }
  const entry = memoryStore.get(key);
  if (entry && now < entry.resetAt) {
    entry.count++;
    return { allowed: entry.count <= maxRequests, count: entry.count, resetAt: entry.resetAt };
  }
  const resetAt = now + windowMs;
  memoryStore.set(key, { count: 1, resetAt });
  return { allowed: true, count: 1, resetAt };
}
__name(checkMemory, "checkMemory");
async function checkD1(db, key, maxRequests, windowMs) {
  const now = Date.now();
  const resetAt = now + windowMs;
  try {
    await db.prepare(`
      INSERT INTO rate_limits (\`key\`, count, reset_at)
      VALUES (?1, 1, ?2)
      ON CONFLICT(\`key\`) DO UPDATE SET
        count = CASE
          WHEN reset_at <= ?3 THEN 1
          ELSE count + 1
        END,
        reset_at = CASE
          WHEN reset_at <= ?3 THEN ?2
          ELSE reset_at
        END
    `).bind(key, resetAt, now).run();
    const row = await db.prepare(
      "SELECT count, reset_at FROM rate_limits WHERE `key` = ?1"
    ).bind(key).first();
    if (!row) {
      return { allowed: true, count: 1, resetAt };
    }
    return {
      allowed: row.count <= maxRequests,
      count: row.count,
      resetAt: row.reset_at
    };
  } catch (err) {
    console.error("[rate-limit] D1 check failed, using memory fallback:", err);
    return checkMemory(key, maxRequests, windowMs);
  }
}
__name(checkD1, "checkD1");
function rateLimit(maxRequests, windowMs) {
  return async (c, next) => {
    const ip = c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || "unknown";
    const path = c.req.path;
    const key = `${ip}:${path}`;
    let result;
    if (c.env.DB) {
      result = await checkD1(c.env.DB, key, maxRequests, windowMs);
    } else {
      result = checkMemory(key, maxRequests, windowMs);
    }
    c.header("X-RateLimit-Limit", String(maxRequests));
    c.header("X-RateLimit-Remaining", String(Math.max(0, maxRequests - result.count)));
    c.header("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1e3)));
    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1e3);
      c.header("Retry-After", String(Math.max(1, retryAfter)));
      return c.json({ error: "Too many requests. Please try again later." }, 429);
    }
    await next();
  };
}
__name(rateLimit, "rateLimit");
async function cleanupExpiredRateLimits(db) {
  const now = Date.now();
  const result = await db.prepare(
    "DELETE FROM rate_limits WHERE reset_at <= ?1"
  ).bind(now).run();
  return result.meta.changes ?? 0;
}
__name(cleanupExpiredRateLimits, "cleanupExpiredRateLimits");

// src/routes/auth.ts
init_checked_fetch();
init_modules_watch_stub();
init_dist();
init_browser();
init_drizzle_orm();
init_schema();
init_auth();

// src/utils/password.ts
init_checked_fetch();
init_modules_watch_stub();
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

// src/utils/id.ts
init_checked_fetch();
init_modules_watch_stub();
var generateId = /* @__PURE__ */ __name(() => crypto.randomUUID(), "generateId");

// src/routes/auth.ts
var authRoutes = new Hono2();
var authRateLimit = rateLimit(10, 15 * 60 * 1e3);
var passwordResetRateLimit = rateLimit(5, 15 * 60 * 1e3);
var generateToken = /* @__PURE__ */ __name(async (userId, secret) => {
  const secretKey = new TextEncoder().encode(secret);
  return new SignJWT({ sub: userId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("24h").sign(secretKey);
}, "generateToken");
async function sha256(input) {
  const encoder2 = new TextEncoder();
  const data = encoder2.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(sha256, "sha256");
async function sendPasswordResetEmail(to, resetUrl, resendApiKey) {
  if (!resendApiKey) {
    console.warn("[Password Reset] No RESEND_API_KEY configured \u2014 email not sent.");
    return;
  }
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "FilmRoom <noreply@filmroomfantasy.com>",
      to: [to],
      subject: "Reset your FilmRoom password",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="color: #1e293b; margin-bottom: 16px;">Reset your password</h2>
          <p style="color: #475569; line-height: 1.6;">
            We received a request to reset your FilmRoom password. Click the button below to choose a new password.
          </p>
          <a href="${resetUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 24px 0;">
            Reset Password
          </a>
          <p style="color: #94a3b8; font-size: 14px; line-height: 1.5;">
            This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
          </p>
        </div>
      `
    })
  });
}
__name(sendPasswordResetEmail, "sendPasswordResetEmail");
var GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs")
);
async function verifyGoogleIdToken(idToken, clientId) {
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId
  });
  return payload;
}
__name(verifyGoogleIdToken, "verifyGoogleIdToken");
authRoutes.post("/register", authRateLimit, async (c) => {
  try {
    const { email, password, username } = await c.req.json();
    if (!email || !password || !username) {
      return c.json({ error: "Email, password, and username are required" }, 400);
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json({ error: "Invalid email format" }, 400);
    }
    if (username.length < 3 || username.length > 30) {
      return c.json({ error: "Username must be between 3 and 30 characters" }, 400);
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return c.json({ error: "Username can only contain letters, numbers, hyphens, and underscores" }, 400);
    }
    if (password.length < 8) {
      return c.json({ error: "Password must be at least 8 characters" }, 400);
    }
    const db = c.get("db");
    const existingEmail = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase())
    });
    const existingUsername = await db.query.users.findFirst({
      where: eq(users.username, username)
    });
    if (existingEmail || existingUsername) {
      return c.json({ error: "Email or username already taken" }, 400);
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
    const sessionId = generateId();
    await db.insert(sessions).values({
      id: sessionId,
      userId,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1e3)
      // 24h
    });
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
authRoutes.post("/login", authRateLimit, async (c) => {
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
    if (!user.passwordHash) {
      return c.json({ error: "Invalid email or password" }, 401);
    }
    const validPassword = await verifyPassword(password, user.passwordHash);
    if (!validPassword) {
      return c.json({ error: "Invalid email or password" }, 401);
    }
    const token = await generateToken(user.id, c.env.JWT_SECRET);
    const sessionId = generateId();
    await db.insert(sessions).values({
      id: sessionId,
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1e3)
      // 24h
    });
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
      createdAt: user.createdAt,
      preferredScoring: user.preferredScoring ?? "ppr",
      darkMode: user.darkMode ?? true,
      notificationsEnabled: user.notificationsEnabled ?? true,
      hasGoogle: !!user.googleId,
      hasPassword: !!user.passwordHash
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
    const body = await c.req.json();
    const { username, email: newEmail, avatarUrl, preferredScoring, darkMode, notificationsEnabled } = body;
    if (!user) {
      return c.json({ error: "Not authenticated" }, 401);
    }
    const db = c.get("db");
    if (username && username !== user.username) {
      if (username.length < 3 || username.length > 30) {
        return c.json({ error: "Username must be between 3 and 30 characters" }, 400);
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        return c.json({ error: "Username can only contain letters, numbers, hyphens, and underscores" }, 400);
      }
      const existingUsername = await db.query.users.findFirst({
        where: eq(users.username, username)
      });
      if (existingUsername) {
        return c.json({ error: "Username already taken" }, 400);
      }
    }
    if (newEmail && newEmail.toLowerCase() !== user.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        return c.json({ error: "Invalid email format" }, 400);
      }
      const existingEmail = await db.query.users.findFirst({
        where: eq(users.email, newEmail.toLowerCase())
      });
      if (existingEmail) {
        return c.json({ error: "Email already taken" }, 400);
      }
    }
    const updates = {
      username: username ?? user.username,
      avatarUrl: avatarUrl !== void 0 ? avatarUrl : user.avatarUrl,
      updatedAt: /* @__PURE__ */ new Date()
    };
    if (newEmail && newEmail.toLowerCase() !== user.email) updates.email = newEmail.toLowerCase();
    if (preferredScoring !== void 0) updates.preferredScoring = preferredScoring;
    if (darkMode !== void 0) updates.darkMode = darkMode;
    if (notificationsEnabled !== void 0) updates.notificationsEnabled = notificationsEnabled;
    await db.update(users).set(updates).where(eq(users.id, user.id));
    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: { id: true, email: true, username: true, avatarUrl: true, preferredScoring: true, darkMode: true, notificationsEnabled: true }
    });
    return c.json({
      user: {
        id: updated.id,
        email: updated.email,
        username: updated.username,
        avatarUrl: updated.avatarUrl,
        preferredScoring: updated.preferredScoring ?? "ppr",
        darkMode: updated.darkMode ?? true,
        notificationsEnabled: updated.notificationsEnabled ?? true
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
    if (!newPassword) {
      return c.json({ error: "New password is required" }, 400);
    }
    if (newPassword.length < 8) {
      return c.json({ error: "New password must be at least 8 characters" }, 400);
    }
    const db = c.get("db");
    if (user.passwordHash) {
      if (!currentPassword) {
        return c.json({ error: "Current password is required" }, 400);
      }
      const validPassword = await verifyPassword(currentPassword, user.passwordHash);
      if (!validPassword) {
        return c.json({ error: "Current password is incorrect" }, 401);
      }
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
authRoutes.post("/google", authRateLimit, async (c) => {
  try {
    const { credential, username } = await c.req.json();
    if (!credential) {
      return c.json({ error: "Google credential is required" }, 400);
    }
    let googlePayload;
    try {
      googlePayload = await verifyGoogleIdToken(credential, c.env.GOOGLE_CLIENT_ID);
    } catch (err) {
      console.error("Google token verification failed:", err);
      return c.json({ error: "Invalid Google credential" }, 401);
    }
    if (!googlePayload.email_verified) {
      return c.json({ error: "Google email is not verified" }, 400);
    }
    const db = c.get("db");
    const email = googlePayload.email.toLowerCase();
    const googleId = googlePayload.sub;
    let user = await db.query.users.findFirst({
      where: eq(users.googleId, googleId)
    });
    if (!user) {
      user = await db.query.users.findFirst({
        where: eq(users.email, email)
      });
      if (user) {
        await db.update(users).set({
          googleId,
          avatarUrl: user.avatarUrl || googlePayload.picture || null,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(users.id, user.id));
        user = await db.query.users.findFirst({
          where: eq(users.id, user.id)
        });
      } else {
        if (!username) {
          return c.json({ needsUsername: true, email }, 200);
        }
        if (username.length < 3 || username.length > 30) {
          return c.json({ error: "Username must be between 3 and 30 characters" }, 400);
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
          return c.json({ error: "Username can only contain letters, numbers, hyphens, and underscores" }, 400);
        }
        const existingUsername = await db.query.users.findFirst({
          where: eq(users.username, username)
        });
        if (existingUsername) {
          return c.json({ error: "Username already taken" }, 400);
        }
        const userId = generateId();
        await db.insert(users).values({
          id: userId,
          email,
          passwordHash: null,
          username,
          googleId,
          avatarUrl: googlePayload.picture || null
        });
        user = await db.query.users.findFirst({
          where: eq(users.id, userId)
        });
      }
    }
    if (!user) {
      return c.json({ error: "Failed to create or find user" }, 500);
    }
    const token = await generateToken(user.id, c.env.JWT_SECRET);
    const sessionId = generateId();
    await db.insert(sessions).values({
      id: sessionId,
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1e3)
      // 24h
    });
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
    console.error("Google auth error:", error);
    return c.json({ error: "Google authentication failed" }, 500);
  }
});
authRoutes.post("/logout", authMiddleware, async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    const token = authHeader?.substring(7);
    if (!token) {
      return c.json({ error: "No token provided" }, 400);
    }
    const db = c.get("db");
    await db.delete(sessions).where(eq(sessions.token, token));
    return c.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    return c.json({ error: "Logout failed" }, 500);
  }
});
authRoutes.post("/forgot-password", passwordResetRateLimit, async (c) => {
  try {
    const { email } = await c.req.json();
    if (!email) {
      return c.json({ error: "Email is required" }, 400);
    }
    const db = c.get("db");
    const successResponse = { message: "If an account with that email exists, a password reset link has been sent." };
    const user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase())
    });
    if (!user) {
      return c.json(successResponse);
    }
    const rawToken = crypto.randomUUID() + "-" + crypto.randomUUID();
    const tokenHash = await sha256(rawToken);
    await db.insert(passwordResetTokens).values({
      id: generateId(),
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1e3)
      // 1 hour
    });
    const appUrl = c.env.APP_URL || "http://localhost:5173";
    const resetUrl = `${appUrl}/#reset_token=${encodeURIComponent(rawToken)}`;
    await sendPasswordResetEmail(user.email, resetUrl, c.env.RESEND_API_KEY);
    return c.json(successResponse);
  } catch (error) {
    console.error("Forgot password error:", error);
    return c.json({ message: "If an account with that email exists, a password reset link has been sent." });
  }
});
authRoutes.post("/reset-password", passwordResetRateLimit, async (c) => {
  try {
    const { token, newPassword } = await c.req.json();
    if (!token || !newPassword) {
      return c.json({ error: "Token and new password are required" }, 400);
    }
    if (newPassword.length < 8) {
      return c.json({ error: "Password must be at least 8 characters" }, 400);
    }
    const db = c.get("db");
    const tokenHash = await sha256(token);
    const resetToken = await db.query.passwordResetTokens.findFirst({
      where: and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, /* @__PURE__ */ new Date())
      )
    });
    if (!resetToken) {
      return c.json({ error: "Invalid or expired reset link. Please request a new one." }, 400);
    }
    const passwordHash = await hashPassword(newPassword);
    await db.update(users).set({
      passwordHash,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(users.id, resetToken.userId));
    await db.update(passwordResetTokens).set({
      usedAt: /* @__PURE__ */ new Date()
    }).where(eq(passwordResetTokens.id, resetToken.id));
    await db.delete(sessions).where(eq(sessions.userId, resetToken.userId));
    return c.json({ message: "Password has been reset successfully. Please sign in with your new password." });
  } catch (error) {
    console.error("Reset password error:", error);
    return c.json({ error: "Password reset failed" }, 500);
  }
});

// src/routes/leagues.ts
init_checked_fetch();
init_modules_watch_stub();
init_dist();
init_drizzle_orm();
init_schema();

// src/services/sleeper.ts
init_checked_fetch();
init_modules_watch_stub();
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
function buildHeadshotUrl(player, sleeperId) {
  if (player.espn_id != null) {
    return `https://a.espncdn.com/i/headshots/nfl/players/full/${player.espn_id}.png`;
  }
  const id = player.player_id ?? sleeperId;
  if (id) {
    return `https://sleepercdn.com/content/nfl/players/${id}.jpg`;
  }
  return null;
}
__name(buildHeadshotUrl, "buildHeadshotUrl");
function mapStatus(sleeperStatus, injuryStatus) {
  const status = (sleeperStatus || "Active").toLowerCase();
  const injury = (injuryStatus || "").toLowerCase();
  if (status === "injured_reserve" || injury === "ir") return "injured_reserve";
  if (status === "out" || injury === "out") return "out";
  if (injury === "doubtful") return "doubtful";
  if (injury === "questionable") return "questionable";
  if (status === "inactive") return "inactive";
  if (status === "invalid" || injury === "invalid") return "active";
  return "active";
}
__name(mapStatus, "mapStatus");
function parseWeight(weight) {
  if (weight == null) return null;
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
  if (!position || !FANTASY_POSITIONS.has(position)) return null;
  const team = player.team || "FA";
  if (team === "FA" && position !== "DEF") {
  }
  const name = player.full_name || [player.first_name, player.last_name].filter(Boolean).join(" ") || `Player ${sleeperId}`;
  const status = mapStatus(player.status, player.injury_status);
  const headshotUrl = buildHeadshotUrl(player, sleeperId);
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
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
__name(sleep, "sleep");
async function throttledFetchAll(urls2, concurrency = 5, delayMs = 200) {
  const results = new Array(urls2.length).fill(null);
  for (let i = 0; i < urls2.length; i += concurrency) {
    const batch = urls2.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(
        (url) => fetch(url).then((res) => res.ok ? res.json() : null).catch(() => null)
      )
    );
    for (let j = 0; j < batchResults.length; j++) {
      results[i + j] = batchResults[j];
    }
    if (i + concurrency < urls2.length) {
      await sleep(delayMs);
    }
  }
  return results;
}
__name(throttledFetchAll, "throttledFetchAll");
function isValidSleeperRoster(obj) {
  if (typeof obj !== "object" || obj === null) return false;
  const r = obj;
  return typeof r.roster_id === "number" && typeof r.owner_id === "string";
}
__name(isValidSleeperRoster, "isValidSleeperRoster");
function isValidSleeperUser(obj) {
  if (typeof obj !== "object" || obj === null) return false;
  const u = obj;
  return typeof u.user_id === "string";
}
__name(isValidSleeperUser, "isValidSleeperUser");
function isValidSleeperMatchup(obj) {
  if (typeof obj !== "object" || obj === null) return false;
  const m = obj;
  return typeof m.roster_id === "number";
}
__name(isValidSleeperMatchup, "isValidSleeperMatchup");
function validateSleeperArray(data, validator, label) {
  if (!Array.isArray(data)) {
    console.warn(`[sleeper] Expected array for ${label}, got ${typeof data}`);
    return [];
  }
  const valid = [];
  let invalidCount = 0;
  for (const item of data) {
    if (validator(item)) {
      valid.push(item);
    } else {
      invalidCount++;
    }
  }
  if (invalidCount > 0) {
    console.warn(`[sleeper] ${label}: skipped ${invalidCount} invalid entries out of ${data.length}`);
  }
  return valid;
}
__name(validateSleeperArray, "validateSleeperArray");
async function getMappedPlayers() {
  const raw2 = await fetchSleeperPlayers();
  const mapped = [];
  const seenDef = /* @__PURE__ */ new Set();
  for (const [sleeperId, player] of Object.entries(raw2)) {
    if (!player) continue;
    const m = mapSleeperPlayerToDb(sleeperId, player);
    if (m) {
      if (m.position === "DEF") {
        if (seenDef.has(m.team)) continue;
        seenDef.add(m.team);
      }
      mapped.push(m);
    }
  }
  for (const team of NFL_TEAMS) {
    if (seenDef.has(team)) continue;
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

// src/routes/leagues.ts
init_auth();
var leagueRoutes = new Hono2();
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
    const leagueId = generateId();
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
      id: generateId(),
      userId: user.id,
      leagueId,
      role: "commissioner"
    });
    const teamId = generateId();
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
  const sleeperUserMap = /* @__PURE__ */ new Map();
  if (league.platform === "sleeper" && league.externalId) {
    try {
      const usersRes = await fetch(`https://api.sleeper.app/v1/league/${league.externalId}/users`);
      if (usersRes.ok) {
        const sleeperUsers = await usersRes.json();
        for (const su of sleeperUsers) {
          sleeperUserMap.set(su.user_id, su);
          if (membership.externalUsername && (su.display_name?.toLowerCase() === membership.externalUsername.toLowerCase() || su.username?.toLowerCase() === membership.externalUsername.toLowerCase())) {
            userSleeperUserId = su.user_id;
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
        const sleeperUser = t.externalOwnerId ? sleeperUserMap.get(t.externalOwnerId) : void 0;
        const ownerUsername = sleeperUser?.display_name || sleeperUser?.username || t.ownerDisplayName || t.owner.username;
        return {
          id: t.id,
          name: t.name,
          wins: t.wins,
          losses: t.losses,
          ties: t.ties,
          pointsFor: t.pointsFor,
          pointsAgainst: t.pointsAgainst,
          externalOwnerId: t.externalOwnerId,
          waiverPriority: t.waiverPriority,
          faabBudget: t.faabBudget,
          isCurrentUserTeam,
          owner: {
            id: t.owner.id,
            username: ownerUsername,
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
      id: generateId(),
      userId: user.id,
      leagueId,
      role: "member"
    });
    const teamId = generateId();
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
        id: generateId(),
        userId: user.id,
        leagueId: existingLeague.id,
        role: "member",
        externalUsername: sleeperUsername || null
      });
      const teamId2 = generateId();
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
    const leagueId = generateId();
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
      id: generateId(),
      userId: user.id,
      leagueId,
      role: "commissioner",
      externalUsername: sleeperUsername || null
    });
    const teamId = generateId();
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
      const rostersRaw = await rostersResponse.json();
      const rosters = validateSleeperArray(rostersRaw, isValidSleeperRoster, "rosters");
      if (rosters.length === 0) {
        return c.json({ error: "No valid rosters returned from Sleeper" }, 500);
      }
      const usersResponse = await fetch(`https://api.sleeper.app/v1/league/${league.externalId}/users`);
      if (!usersResponse.ok) {
        return c.json({ error: "Failed to fetch users from Sleeper" }, 500);
      }
      const sleeperUsersRaw = await usersResponse.json();
      const sleeperUsers = validateSleeperArray(sleeperUsersRaw, isValidSleeperUser, "users");
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
      const INVALID_PLAYER_IDS = /* @__PURE__ */ new Set(["invalid", "0", ""]);
      const allExternalPlayerIds = /* @__PURE__ */ new Set();
      for (const roster of rosters) {
        if (roster.players) {
          for (const pid of roster.players) {
            if (pid && !INVALID_PLAYER_IDS.has(String(pid).toLowerCase())) {
              allExternalPlayerIds.add(String(pid));
            }
          }
        }
      }
      const externalIdArray = Array.from(allExternalPlayerIds);
      const existingPlayersByExtId = /* @__PURE__ */ new Map();
      if (externalIdArray.length > 0) {
        for (let i = 0; i < externalIdArray.length; i += 500) {
          const chunk = externalIdArray.slice(i, i + 500);
          const found = await db.query.nflPlayers.findMany({
            where: inArray(nflPlayers.externalId, chunk),
            columns: { id: true, externalId: true }
          });
          for (const p of found) {
            if (p.externalId) existingPlayersByExtId.set(p.externalId, { id: p.id });
          }
        }
      }
      for (const roster of rosters) {
        const sleeperUser = userMap.get(roster.owner_id);
        const teamName = sleeperUser?.metadata?.team_name || sleeperUser?.display_name || `Team ${roster.roster_id}`;
        const ownerDisplayName = sleeperUser?.display_name || sleeperUser?.username || `Owner ${roster.roster_id}`;
        const isUserTeam = userTeam && !userRosterAssigned && userSleeperUserId && roster.owner_id === userSleeperUserId;
        let team;
        if (isUserTeam) {
          team = userTeam;
          userRosterAssigned = true;
          await db.update(teams).set({
            externalOwnerId: String(roster.owner_id),
            ownerDisplayName,
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
              ownerDisplayName,
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
            const teamId = generateId();
            await db.insert(teams).values({
              id: teamId,
              leagueId: league.id,
              ownerId: user.id,
              externalOwnerId: String(roster.owner_id),
              ownerDisplayName,
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
            if (!playerId || INVALID_PLAYER_IDS.has(String(playerId).toLowerCase())) continue;
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
            let player = existingPlayersByExtId.get(playerId) || null;
            if (!player) {
              const playerData = sleeperPlayers[playerId];
              const newPlayerId = generateId();
              await db.insert(nflPlayers).values({
                id: newPlayerId,
                externalId: playerId,
                name: playerData ? `${playerData.first_name || ""} ${playerData.last_name || ""}`.trim() || `Player ${playerId}` : `Player ${playerId}`,
                firstName: playerData?.first_name,
                lastName: playerData?.last_name,
                team: playerData?.team || "FA",
                position: playerData?.position || "UNK",
                status: mapStatus(playerData?.status, playerData?.injury_status),
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
              existingPlayersByExtId.set(playerId, { id: newPlayerId });
            }
            if (player) {
              await db.insert(rosterSpots).values({
                id: generateId(),
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
      let regularSeasonWeeks = 14;
      let effectiveCurrentWeek = league.currentWeek || 1;
      try {
        const sleeperLeagueRes = await fetch(`https://api.sleeper.app/v1/league/${league.externalId}`);
        if (sleeperLeagueRes.ok) {
          const sleeperLeague = await sleeperLeagueRes.json();
          const settings = sleeperLeague?.settings || {};
          const playoffWeekStart = settings.playoff_week_start || 15;
          regularSeasonWeeks = playoffWeekStart - 1;
          const sleeperLeg = settings.leg || 1;
          const leagueStatus = sleeperLeague?.status || "in_season";
          const sleeperPlayoffTeams = settings.playoff_teams || league.playoffTeams || 6;
          const sleeperTeamCount = settings.num_teams || league.teamCount || 12;
          if (leagueStatus === "complete" || sleeperLeg > regularSeasonWeeks) {
            effectiveCurrentWeek = regularSeasonWeeks + 1;
          } else {
            effectiveCurrentWeek = sleeperLeg;
          }
          await db.update(leagues).set({
            currentWeek: effectiveCurrentWeek,
            playoffTeams: sleeperPlayoffTeams,
            teamCount: sleeperTeamCount,
            playoffWeeks: settings.playoff_round_type === 2 ? 2 : 3,
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq(leagues.id, league.id));
        }
      } catch (e) {
        console.log("Could not fetch Sleeper league metadata, using stored currentWeek");
      }
      const weekNumbers = Array.from({ length: regularSeasonWeeks }, (_, i) => i + 1);
      const matchupUrls = weekNumbers.map(
        (week2) => `https://api.sleeper.app/v1/league/${league.externalId}/matchups/${week2}`
      );
      const matchupResponses = await throttledFetchAll(matchupUrls, 5, 200);
      for (let i = 0; i < weekNumbers.length; i++) {
        const week2 = weekNumbers[i];
        const rawMatchups = matchupResponses[i];
        if (!rawMatchups) continue;
        const weekMatchups = validateSleeperArray(rawMatchups, isValidSleeperMatchup, `matchups week ${week2}`);
        if (weekMatchups.length === 0) continue;
        const matchupGroups = /* @__PURE__ */ new Map();
        for (const m of weekMatchups) {
          if (m.matchup_id) {
            if (!matchupGroups.has(m.matchup_id)) {
              matchupGroups.set(m.matchup_id, []);
            }
            matchupGroups.get(m.matchup_id).push(m);
          }
        }
        for (const [, teams2] of matchupGroups) {
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
                  id: generateId(),
                  leagueId: league.id,
                  week: week2,
                  homeTeamId,
                  awayTeamId,
                  homeScore: team1.points || 0,
                  awayScore: team2.points || 0,
                  homeProjectedScore: team1.projected_points || 0,
                  awayProjectedScore: team2.projected_points || 0,
                  isComplete: week2 < effectiveCurrentWeek,
                  isPlayoff: false,
                  isChampionship: false
                });
                matchupsImported++;
              } else {
                await db.update(matchups).set({
                  homeScore: team1.points || 0,
                  awayScore: team2.points || 0,
                  isComplete: week2 < effectiveCurrentWeek
                }).where(eq(matchups.id, existingMatchup.id));
              }
            }
          }
        }
      }
      let statsImported = 0;
      const allRosteredPlayerIds = /* @__PURE__ */ new Set();
      for (const roster of rosters) {
        if (roster.players) {
          for (const playerId of roster.players) {
            if (playerId && !INVALID_PLAYER_IDS.has(String(playerId).toLowerCase())) {
              allRosteredPlayerIds.add(playerId);
            }
          }
        }
      }
      const statsWeekLimit = Math.min(effectiveCurrentWeek, regularSeasonWeeks);
      for (let week2 = 1; week2 <= statsWeekLimit; week2++) {
        try {
          if (week2 > 1) await sleep(150);
          const statsResponse = await fetch(
            `https://api.sleeper.com/stats/nfl/${league.seasonYear}/${week2}?season_type=regular`
          );
          if (!statsResponse.ok) {
            console.log(`No stats available for week ${week2} (HTTP ${statsResponse.status})`);
            continue;
          }
          const weekStats = await statsResponse.json();
          for (const sleeperPlayerId of allRosteredPlayerIds) {
            const playerStats = weekStats[sleeperPlayerId];
            if (!playerStats) continue;
            const player = await db.query.nflPlayers.findFirst({
              where: eq(nflPlayers.externalId, sleeperPlayerId)
            });
            if (!player) continue;
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
              // Snap counts
              offSnaps: Math.round(playerStats.off_snp || 0),
              defSnaps: Math.round(playerStats.def_snp || 0),
              stSnaps: Math.round(playerStats.st_snp || 0),
              tmOffSnaps: Math.round(playerStats.tm_off_snp || 0),
              tmDefSnaps: Math.round(playerStats.tm_def_snp || 0),
              tmStSnaps: Math.round(playerStats.tm_st_snp || 0),
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
                id: generateId(),
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
      const projectionWeek = Math.min(effectiveCurrentWeek, regularSeasonWeeks);
      try {
        const projectionsResponse = await fetch(
          `https://api.sleeper.com/projections/nfl/${league.seasonYear}/${projectionWeek}?season_type=regular`
        );
        if (projectionsResponse.ok) {
          const projections = await projectionsResponse.json();
          const gamesForWeek = await db.query.nflGames.findMany({
            where: and(eq(nflGames.week, projectionWeek), eq(nflGames.seasonYear, league.seasonYear)),
            columns: { isComplete: true, homeScore: true, awayScore: true }
          });
          const weekComplete = gamesForWeek.length > 0 && gamesForWeek.every((g) => g.isComplete || g.homeScore != null && g.awayScore != null);
          for (const [sleeperPlayerId, playerProj] of Object.entries(projections)) {
            if (!playerProj) continue;
            const player = await db.query.nflPlayers.findFirst({
              where: eq(nflPlayers.externalId, sleeperPlayerId)
            });
            if (!player) continue;
            const scoringFormat = league.scoringFormat || "ppr";
            const existingProj = await db.query.playerProjections.findFirst({
              where: and(
                eq(playerProjections.playerId, player.id),
                eq(playerProjections.week, projectionWeek),
                eq(playerProjections.seasonYear, league.seasonYear),
                eq(playerProjections.scoringFormat, scoringFormat)
              )
            });
            const projData = {
              playerId: player.id,
              week: projectionWeek,
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
              if (!weekComplete) {
                await db.insert(projectionLineSnapshots).values({
                  id: generateId(),
                  playerId: player.id,
                  week: projectionWeek,
                  seasonYear: league.seasonYear,
                  scoringFormat,
                  snapshotAt: /* @__PURE__ */ new Date(),
                  projectedPoints: existingProj.projectedPoints,
                  projPassYards: existingProj.projPassYards ?? null,
                  projPassTDs: existingProj.projPassTDs ?? null,
                  projRushYards: existingProj.projRushYards ?? null,
                  projRushTDs: existingProj.projRushTDs ?? null,
                  projReceptions: existingProj.projReceptions ?? null,
                  projRecYards: existingProj.projRecYards ?? null,
                  projRecTDs: existingProj.projRecTDs ?? null
                });
              }
              await db.update(playerProjections).set(projData).where(eq(playerProjections.id, existingProj.id));
            } else {
              await db.insert(playerProjections).values({
                id: generateId(),
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
  if (league.platform === "yahoo" && league.externalId) {
    try {
      const { getYahooToken: getYahooToken2, yahooApiFetch: yahooApiFetch2 } = await Promise.resolve().then(() => (init_yahoo(), yahoo_exports));
      const freshUser = await db.query.users.findFirst({
        where: eq(users.id, user.id)
      });
      if (!freshUser?.yahooAccessToken) {
        return c.json({ error: "Yahoo account not connected. Please connect your Yahoo account in Settings." }, 400);
      }
      const accessToken = await getYahooToken2(db, freshUser, c.env);
      const leagueKey = league.externalId;
      const settingsData = await yahooApiFetch2(accessToken, `/league/${leagueKey}/settings`);
      const settings = settingsData?.fantasy_content?.league?.[1]?.settings?.[0] || {};
      const teamsData = await yahooApiFetch2(accessToken, `/league/${leagueKey}/teams/roster`);
      const teamsObj = teamsData?.fantasy_content?.league?.[1]?.teams;
      let teamsImported = 0;
      let playersImported = 0;
      if (teamsObj) {
        let teamIdx = 0;
        while (teamsObj[String(teamIdx)]) {
          const teamArr = teamsObj[String(teamIdx)].team;
          if (!teamArr) {
            teamIdx++;
            continue;
          }
          const teamInfo = teamArr[0];
          let teamName = "Unknown Team";
          let teamKey = "";
          let managerEmail = "";
          if (Array.isArray(teamInfo)) {
            for (const item of teamInfo) {
              if (typeof item === "object" && item !== null) {
                if ("name" in item) teamName = item.name;
                if ("team_key" in item) teamKey = item.team_key;
                if ("managers" in item) {
                  const mgr = Array.isArray(item.managers) ? item.managers[0]?.manager : null;
                  if (mgr?.email) managerEmail = mgr.email;
                }
              }
            }
          }
          const teamExternalId = teamKey.split(".t.").pop() || String(teamIdx + 1);
          const existingTeam = league.teams.find((t) => t.externalOwnerId === teamExternalId);
          let teamId;
          if (existingTeam) {
            teamId = existingTeam.id;
            await db.update(teams).set({
              name: teamName,
              updatedAt: /* @__PURE__ */ new Date()
            }).where(eq(teams.id, existingTeam.id));
          } else {
            teamId = crypto.randomUUID();
            await db.insert(teams).values({
              id: teamId,
              name: teamName,
              leagueId: league.id,
              ownerId: user.id,
              // Default to current user; will be corrected if manager info available
              externalOwnerId: teamExternalId
            });
          }
          teamsImported++;
          const rosterData = teamArr[1]?.roster;
          const rosterPlayers = rosterData?.["0"]?.players;
          if (rosterPlayers) {
            let playerIdx = 0;
            while (rosterPlayers[String(playerIdx)]) {
              const playerArr = rosterPlayers[String(playerIdx)].player;
              if (!playerArr) {
                playerIdx++;
                continue;
              }
              const playerInfo = playerArr[0];
              let playerName = "Unknown";
              let position = "UNKNOWN";
              let nflTeam = "";
              let yahooPlayerId = "";
              if (Array.isArray(playerInfo)) {
                for (const item of playerInfo) {
                  if (typeof item === "object" && item !== null) {
                    if ("name" in item && typeof item.name === "object") {
                      playerName = item.name.full || playerName;
                    }
                    if ("display_position" in item) position = item.display_position;
                    if ("editorial_team_abbr" in item) nflTeam = item.editorial_team_abbr?.toUpperCase() || "";
                    if ("player_id" in item) yahooPlayerId = String(item.player_id);
                  }
                }
              }
              if (playerName !== "Unknown") {
                const nameParts = playerName.split(" ");
                const firstName = nameParts[0] || "";
                const lastName = nameParts.slice(1).join(" ") || "";
                let dbPlayer = null;
                if (firstName && lastName) {
                  dbPlayer = await db.query.nflPlayers.findFirst({
                    where: and(
                      eq(nflPlayers.firstName, firstName),
                      eq(nflPlayers.lastName, lastName),
                      eq(nflPlayers.position, position)
                    )
                  });
                }
                if (dbPlayer) {
                  const existingRoster = await db.query.rosterSpots.findFirst({
                    where: and(
                      eq(rosterSpots.teamId, teamId),
                      eq(rosterSpots.playerId, dbPlayer.id)
                    )
                  });
                  const selectedPosition = playerArr[1]?.selected_position?.[1]?.position || position;
                  if (!existingRoster) {
                    await db.insert(rosterSpots).values({
                      id: crypto.randomUUID(),
                      teamId,
                      playerId: dbPlayer.id,
                      slot: selectedPosition,
                      isStarter: selectedPosition !== "BN" && selectedPosition !== "IR"
                    });
                    playersImported++;
                  } else {
                    await db.update(rosterSpots).set({
                      slot: selectedPosition,
                      isStarter: selectedPosition !== "BN" && selectedPosition !== "IR"
                    }).where(eq(rosterSpots.id, existingRoster.id));
                  }
                }
              }
              playerIdx++;
            }
          }
          teamIdx++;
        }
      }
      let matchupsImported = 0;
      try {
        const currentWeek = settings.current_week || 1;
        const matchupData = await yahooApiFetch2(accessToken, `/league/${leagueKey}/scoreboard;week=${currentWeek}`);
        const matchups2 = matchupData?.fantasy_content?.league?.[1]?.scoreboard?.["0"]?.matchups;
        if (matchups2) {
          let matchupIdx = 0;
          while (matchups2[String(matchupIdx)]) {
            const matchup = matchups2[String(matchupIdx)].matchup;
            if (!matchup) {
              matchupIdx++;
              continue;
            }
            const matchupTeams = matchup["0"]?.teams;
            if (!matchupTeams) {
              matchupIdx++;
              continue;
            }
            const team1Info = matchupTeams["0"]?.team;
            const team2Info = matchupTeams["1"]?.team;
            if (team1Info && team2Info) {
              const getTeamExternalId = /* @__PURE__ */ __name((teamArr) => {
                if (!Array.isArray(teamArr[0])) return "";
                for (const item of teamArr[0]) {
                  if (typeof item === "object" && item !== null && "team_key" in item) {
                    return item.team_key.split(".t.").pop() || "";
                  }
                }
                return "";
              }, "getTeamExternalId");
              const getTeamScore = /* @__PURE__ */ __name((teamArr) => {
                if (!teamArr[1]?.team_points) return 0;
                return parseFloat(teamArr[1].team_points.total) || 0;
              }, "getTeamScore");
              const team1ExtId = getTeamExternalId(team1Info);
              const team2ExtId = getTeamExternalId(team2Info);
              const dbTeam1 = await db.query.teams.findFirst({
                where: and(eq(teams.leagueId, league.id), eq(teams.externalOwnerId, team1ExtId))
              });
              const dbTeam2 = await db.query.teams.findFirst({
                where: and(eq(teams.leagueId, league.id), eq(teams.externalOwnerId, team2ExtId))
              });
              if (dbTeam1 && dbTeam2) {
                const existingMatchup = await db.query.matchups.findFirst({
                  where: and(
                    eq(matchups.leagueId, league.id),
                    eq(matchups.week, currentWeek),
                    eq(matchups.homeTeamId, dbTeam1.id)
                  )
                });
                const score1 = getTeamScore(team1Info);
                const score2 = getTeamScore(team2Info);
                if (!existingMatchup) {
                  await db.insert(matchups).values({
                    id: crypto.randomUUID(),
                    leagueId: league.id,
                    week: currentWeek,
                    homeTeamId: dbTeam1.id,
                    awayTeamId: dbTeam2.id,
                    homeScore: score1,
                    awayScore: score2
                  });
                  matchupsImported++;
                } else {
                  await db.update(matchups).set({
                    homeScore: score1,
                    awayScore: score2
                  }).where(eq(matchups.id, existingMatchup.id));
                }
              }
            }
            matchupIdx++;
          }
        }
      } catch (matchupErr) {
        console.error("Yahoo matchup sync error (non-fatal):", matchupErr);
      }
      await db.update(leagues).set({
        teamCount: teamsImported || league.teamCount,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq(leagues.id, league.id));
      return c.json({
        success: true,
        message: `Synced from Yahoo: ${teamsImported} teams, ${playersImported} players, ${matchupsImported} matchups`,
        teamsImported,
        playersImported,
        matchupsImported
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("Yahoo sync error:", err);
      return c.json({ error: err.message || "Failed to sync league from Yahoo" }, 500);
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
  const league = await db.query.leagues.findFirst({
    where: eq(leagues.id, leagueId)
  });
  const teams2 = await db.query.teams.findMany({
    where: eq(teams.leagueId, leagueId),
    with: {
      owner: true
    }
  });
  let userSleeperUserId = null;
  const sleeperUserMap = /* @__PURE__ */ new Map();
  if (league?.platform === "sleeper" && league.externalId) {
    try {
      const usersRes = await fetch(`https://api.sleeper.app/v1/league/${league.externalId}/users`);
      if (usersRes.ok) {
        const sleeperUsers = await usersRes.json();
        for (const su of sleeperUsers) {
          sleeperUserMap.set(su.user_id, su);
          if (membership.externalUsername && (su.display_name?.toLowerCase() === membership.externalUsername.toLowerCase() || su.username?.toLowerCase() === membership.externalUsername.toLowerCase())) {
            userSleeperUserId = su.user_id;
          }
        }
      }
    } catch {
    }
  }
  const standings = teams2.map((t) => {
    const isCurrentUserTeam = userSleeperUserId ? t.externalOwnerId === userSleeperUserId : t.ownerId === user.id && teams2.filter((x) => x.ownerId === user.id).length === 1;
    const sleeperUser = t.externalOwnerId ? sleeperUserMap.get(t.externalOwnerId) : void 0;
    const ownerUsername = sleeperUser?.display_name || sleeperUser?.username || t.ownerDisplayName || t.owner.username;
    return {
      id: t.id,
      name: t.name,
      owner: {
        id: t.owner.id,
        username: ownerUsername
      },
      isCurrentUserTeam,
      wins: t.wins,
      losses: t.losses,
      ties: t.ties,
      pointsFor: t.pointsFor,
      pointsAgainst: t.pointsAgainst,
      winPct: t.wins + t.losses + t.ties > 0 ? t.wins / (t.wins + t.losses + t.ties) : 0,
      streak: t.streak,
      playoffSeed: t.playoffSeed
    };
  }).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.pointsFor - a.pointsFor;
  }).map((t, i) => ({ ...t, rank: i + 1 }));
  return c.json({ standings });
});

// src/routes/teams.ts
init_checked_fetch();
init_modules_watch_stub();
init_dist();
init_drizzle_orm();
init_schema();
init_auth();
var teamRoutes = new Hono2();
async function getPlayerStatsSummary(db, playerId, seasonYear, position) {
  const stats = await db.query.playerWeeklyStats.findMany({
    where: and(
      eq(playerWeeklyStats.playerId, playerId),
      eq(playerWeeklyStats.seasonYear, seasonYear)
    )
  });
  if (stats.length === 0) return null;
  const isDef = position === "DEF";
  const totals = stats.reduce((acc, week2) => {
    const played = isDef || (week2.offSnaps ?? 0) > 0 || (week2.defSnaps ?? 0) > 0 || (week2.stSnaps ?? 0) > 0 || ((week2.passAttempts ?? 0) > 0 || (week2.rushAttempts ?? 0) > 0 || (week2.targets ?? 0) > 0 || (week2.receptions ?? 0) > 0 || (week2.fgAttempts ?? 0) > 0 || (week2.xpAttempts ?? 0) > 0 || (week2.sacks ?? 0) > 0 || (week2.defInterceptions ?? 0) > 0);
    const snapPct = (() => {
      const off = week2.offSnaps ?? 0, def = week2.defSnaps ?? 0, st = week2.stSnaps ?? 0;
      const tmOff = week2.tmOffSnaps ?? 0, tmDef = week2.tmDefSnaps ?? 0, tmSt = week2.tmStSnaps ?? 0;
      if (off > 0 && tmOff > 0) return off / tmOff * 100;
      if (def > 0 && tmDef > 0) return def / tmDef * 100;
      if (st > 0 && tmSt > 0) return st / tmSt * 100;
      return null;
    })();
    return {
      games: acc.games + 1,
      gamesPlayed: acc.gamesPlayed + (played ? 1 : 0),
      snapPctSum: acc.snapPctSum + (snapPct != null ? snapPct : 0),
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
    };
  }, {
    games: 0,
    gamesPlayed: 0,
    snapPctSum: 0,
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
  const gp = totals.gamesPlayed ?? totals.games;
  const averageSnapPct = totals.snapPctSum > 0 && gp > 0 ? Math.round(totals.snapPctSum / gp * 10) / 10 : null;
  return {
    ...totals,
    averageSnapPct,
    avgPointsPPR: gp > 0 ? Math.round(totals.fantasyPointsPPR / gp * 10) / 10 : 0,
    avgPointsHalf: gp > 0 ? Math.round(totals.fantasyPointsHalf / gp * 10) / 10 : 0,
    avgPointsStd: gp > 0 ? Math.round(totals.fantasyPointsStd / gp * 10) / 10 : 0
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
    const seasonStats = await getPlayerStatsSummary(db, r.player.id, seasonYear, r.player.position);
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
          gamesPlayed: seasonStats.gamesPlayed ?? seasonStats.games,
          averageSnapPct: seasonStats.averageSnapPct ?? null,
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
      id: generateId(),
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
init_checked_fetch();
init_modules_watch_stub();
init_dist();
init_drizzle_orm();
init_schema();
init_auth();
var playerRoutes = new Hono2();
playerRoutes.get("/", optionalAuthMiddleware, async (c) => {
  const db = c.get("db");
  const page = parseInt(c.req.query("page") || "1");
  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 200);
  const offset = (page - 1) * limit;
  const position = c.req.query("position");
  const team = c.req.query("team");
  const search = c.req.query("search");
  const status = c.req.query("status");
  const sortBy = c.req.query("sortBy") || "name";
  const sortOrder = c.req.query("sortOrder") || "asc";
  const leagueId = c.req.query("leagueId");
  const includeStats = c.req.query("includeStats") === "true";
  const availableOnly = c.req.query("availableOnly") === "true";
  const season = parseInt(c.req.query("season") || String((/* @__PURE__ */ new Date()).getFullYear()));
  const weekParam = c.req.query("week");
  const week2 = weekParam ? parseInt(weekParam) : void 0;
  const scoringFormatParam = c.req.query("scoringFormat") || "ppr";
  const scoringFormat = scoringFormatParam === "half_ppr" || scoringFormatParam === "half-ppr" ? "half-ppr" : scoringFormatParam === "standard" ? "standard" : "ppr";
  try {
    const conditions = [];
    if (position && position !== "ALL") conditions.push(eq(nflPlayers.position, position));
    if (team) conditions.push(eq(nflPlayers.team, team));
    if (status) conditions.push(eq(nflPlayers.status, status));
    if (search) conditions.push(like(nflPlayers.name, `%${search}%`));
    let weekComplete = false;
    if (week2 !== void 0 && week2 >= 1 && week2 <= 18) {
      const gamesForWeek = await db.query.nflGames.findMany({
        where: and(eq(nflGames.week, week2), eq(nflGames.seasonYear, season)),
        columns: { id: true, isComplete: true, homeScore: true, awayScore: true }
      });
      weekComplete = gamesForWeek.length > 0 && gamesForWeek.every((g) => g.isComplete || g.homeScore != null && g.awayScore != null);
      if (!weekComplete && includeStats) {
        const anyStat = await db.query.playerWeeklyStats.findFirst({
          where: and(
            eq(playerWeeklyStats.week, week2),
            eq(playerWeeklyStats.seasonYear, season)
          ),
          columns: { id: true }
        });
        if (anyStat) weekComplete = true;
      }
      if (!weekComplete) {
        const currentMonth = (/* @__PURE__ */ new Date()).getMonth();
        if (currentMonth >= 1 && currentMonth <= 7) weekComplete = true;
      }
    }
    if (week2 !== void 0 && weekComplete && includeStats && !availableOnly) {
      const ptsOrderCol = scoringFormat === "standard" ? playerWeeklyStats.fantasyPointsStd : scoringFormat === "half-ppr" ? playerWeeklyStats.fantasyPointsHalf : playerWeeklyStats.fantasyPointsPPR;
      const stats = await db.query.playerWeeklyStats.findMany({
        where: and(
          eq(playerWeeklyStats.week, week2),
          eq(playerWeeklyStats.seasonYear, season)
        ),
        orderBy: desc(ptsOrderCol),
        limit: 500
      });
      const played = /* @__PURE__ */ __name((s) => {
        const hasDefStats = (s.defSnaps ?? 0) > 0 || (s.sacks ?? 0) > 0 || (s.defInterceptions ?? 0) > 0 || (s.fumblesRecovered ?? 0) > 0 || (s.defenseTDs ?? 0) > 0 || (s.safeties ?? 0) > 0;
        const noOffStats = (s.offSnaps ?? 0) === 0 && (s.passAttempts ?? 0) === 0 && (s.rushAttempts ?? 0) === 0 && (s.targets ?? 0) === 0;
        if (hasDefStats && noOffStats) return true;
        return (s.offSnaps ?? 0) > 0 || (s.defSnaps ?? 0) > 0 || (s.stSnaps ?? 0) > 0 || (s.passAttempts ?? 0) > 0 || (s.rushAttempts ?? 0) > 0 || (s.targets ?? 0) > 0 || (s.receptions ?? 0) > 0 || (s.passCompletions ?? 0) > 0 || (s.passYards ?? 0) > 0 || (s.rushYards ?? 0) > 0 || (s.receivingYards ?? 0) > 0 || (s.fgAttempts ?? 0) > 0 || (s.xpAttempts ?? 0) > 0 || (s.fgMade ?? 0) > 0 || (s.xpMade ?? 0) > 0 || (s.sacks ?? 0) > 0 || (s.defInterceptions ?? 0) > 0 || (s.fumblesRecovered ?? 0) > 0 || (s.defenseTDs ?? 0) > 0 || (s.safeties ?? 0) > 0 || (s.fumbles ?? 0) > 0 || (s.twoPointConversions ?? 0) > 0;
      }, "played");
      const ptsCol = scoringFormat === "standard" ? "fantasyPointsStd" : scoringFormat === "half-ppr" ? "fantasyPointsHalf" : "fantasyPointsPPR";
      const playedStats = stats.filter(played);
      const playerIdsFromStats = [...new Set(playedStats.map((s) => s.playerId))];
      if (playerIdsFromStats.length === 0) {
        return c.json({
          players: [],
          pagination: { page: 1, limit, total: 0, totalPages: 0 },
          weekComplete: true,
          pointsType: "actual"
        });
      }
      const CHUNK = 50;
      const idChunks = [];
      for (let i = 0; i < playerIdsFromStats.length; i += CHUNK) idChunks.push(playerIdsFromStats.slice(i, i + CHUNK));
      const playerPromises = idChunks.map((chunk) => {
        const cond = conditions.length > 0 ? and(...conditions, inArray(nflPlayers.id, chunk)) : inArray(nflPlayers.id, chunk);
        return db.query.nflPlayers.findMany({ where: cond });
      });
      const playerChunkResults = await Promise.all(playerPromises);
      const playersPast = playerChunkResults.flat();
      const ptsByPlayer = /* @__PURE__ */ new Map();
      const statsByPlayer = /* @__PURE__ */ new Map();
      for (const s of playedStats) {
        const pts = s[ptsCol] ?? 0;
        ptsByPlayer.set(s.playerId, pts);
        statsByPlayer.set(s.playerId, s);
      }
      let enriched = playersPast.map((p) => {
        const pts = ptsByPlayer.get(p.id) ?? 0;
        const s = statsByPlayer.get(p.id);
        const isDef = p.position === "DEF";
        const snapPct = (() => {
          if (!s) return null;
          const off = s.offSnaps ?? 0, def = s.defSnaps ?? 0, st = s.stSnaps ?? 0;
          const tmOff = s.tmOffSnaps ?? 0, tmDef = s.tmDefSnaps ?? 0, tmSt = s.tmStSnaps ?? 0;
          if (off > 0 && tmOff > 0) return off / tmOff * 100;
          if (def > 0 && tmDef > 0) return def / tmDef * 100;
          if (st > 0 && tmSt > 0) return st / tmSt * 100;
          return null;
        })();
        const seasonStats = s ? {
          games: 1,
          gamesPlayed: 1,
          fantasyPointsPPR: s.fantasyPointsPPR ?? 0,
          fantasyPointsHalf: s.fantasyPointsHalf ?? 0,
          fantasyPointsStd: s.fantasyPointsStd ?? 0,
          passYards: s.passYards ?? 0,
          passTDs: s.passTDs ?? 0,
          rushYards: s.rushYards ?? 0,
          rushTDs: s.rushTDs ?? 0,
          receptions: s.receptions ?? 0,
          receivingYards: s.receivingYards ?? 0,
          receivingTDs: s.receivingTDs ?? 0,
          averageSnapPct: snapPct != null ? Math.round(snapPct * 10) / 10 : null
        } : void 0;
        return {
          ...p,
          projectedPoints: pts,
          avgPointsPPR: pts,
          seasonStats,
          isRostered: false
        };
      });
      let rosteredPlayerIds2 = [];
      if (leagueId) {
        const teams2 = await db.query.teams.findMany({
          where: eq(teams.leagueId, leagueId),
          with: { roster: true }
        });
        rosteredPlayerIds2 = teams2.flatMap((t) => t.roster.map((r) => r.playerId));
      }
      enriched = enriched.map((p) => ({ ...p, isRostered: rosteredPlayerIds2.includes(p.id) }));
      if (position && position !== "ALL" && position !== "FLEX") enriched = enriched.filter((p) => p.position === position);
      if (position === "FLEX") enriched = enriched.filter((p) => ["RB", "WR", "TE"].includes(p.position));
      if (team) enriched = enriched.filter((p) => p.team === team);
      if (search) enriched = enriched.filter((p) => p.name?.toLowerCase().includes(search?.toLowerCase()));
      if (availableOnly && leagueId) enriched = enriched.filter((p) => !p.isRostered);
      enriched.sort((a, b) => (b.projectedPoints ?? 0) - (a.projectedPoints ?? 0));
      const total2 = enriched.length;
      const paginated = enriched.slice(offset, offset + limit);
      return c.json({
        players: paginated,
        pagination: { page, limit, total: total2, totalPages: Math.ceil(total2 / limit) },
        weekComplete: true,
        pointsType: "actual"
      });
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
    const sortByComputed = sortBy === "projectedPoints" || sortBy === "avgPointsPPR";
    const availableMultiplier = availableOnly && leagueId ? 3 : 1;
    const fetchLimit = sortByComputed && includeStats || availableOnly ? Math.max((limit + offset) * availableMultiplier, 500) : limit + offset;
    const fetchOffset = sortByComputed && includeStats || availableOnly ? 0 : offset;
    const players = await db.query.nflPlayers.findMany({
      where: conditions.length > 0 ? and(...conditions) : void 0,
      limit: fetchLimit,
      offset: fetchOffset,
      orderBy: sortByComputed ? asc(nflPlayers.name) : sortOrder === "desc" ? desc(getSortColumn()) : asc(getSortColumn())
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
      const CHUNK = 50;
      const chunks = [];
      for (let i = 0; i < playerIds.length; i += CHUNK) {
        chunks.push(playerIds.slice(i, i + CHUNK));
      }
      const chunkResults = await Promise.all(
        chunks.map((chunk) => {
          const projCond = week2 !== void 0 ? and(inArray(playerProjections.playerId, chunk), eq(playerProjections.seasonYear, season), eq(playerProjections.week, week2), eq(playerProjections.scoringFormat, scoringFormat)) : and(inArray(playerProjections.playerId, chunk), eq(playerProjections.seasonYear, season));
          return Promise.all([
            db.query.playerWeeklyStats.findMany({
              where: and(
                inArray(playerWeeklyStats.playerId, chunk),
                eq(playerWeeklyStats.seasonYear, season)
              )
            }),
            db.query.playerProjections.findMany({
              where: projCond,
              orderBy: week2 !== void 0 ? void 0 : desc(playerProjections.week)
            })
          ]);
        })
      );
      const allStats = [];
      const allProjections = [];
      for (const [statsChunk, projChunk] of chunkResults) {
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
        if (!projectionByPlayer.has(p.playerId)) projectionByPlayer.set(p.playerId, p);
      }
      enrichedPlayers = players.map((player) => {
        const stats = statsByPlayer.get(player.id) || [];
        const isDef = player.position === "DEF";
        const seasonStats = stats.reduce((acc, week3) => {
          const played = isDef || (week3.offSnaps ?? 0) > 0 || (week3.defSnaps ?? 0) > 0 || (week3.stSnaps ?? 0) > 0 || ((week3.passAttempts ?? 0) > 0 || (week3.rushAttempts ?? 0) > 0 || (week3.targets ?? 0) > 0 || (week3.receptions ?? 0) > 0 || (week3.fgAttempts ?? 0) > 0 || (week3.xpAttempts ?? 0) > 0 || (week3.sacks ?? 0) > 0 || (week3.defInterceptions ?? 0) > 0);
          const snapPct = (() => {
            const off = week3.offSnaps ?? 0, def = week3.defSnaps ?? 0, st = week3.stSnaps ?? 0;
            const tmOff = week3.tmOffSnaps ?? 0, tmDef = week3.tmDefSnaps ?? 0, tmSt = week3.tmStSnaps ?? 0;
            if (off > 0 && tmOff > 0) return off / tmOff * 100;
            if (def > 0 && tmDef > 0) return def / tmDef * 100;
            if (st > 0 && tmSt > 0) return st / tmSt * 100;
            return null;
          })();
          return {
            games: acc.games + 1,
            gamesPlayed: acc.gamesPlayed + (played ? 1 : 0),
            snapPctSum: acc.snapPctSum + (snapPct != null ? snapPct : 0),
            fantasyPointsPPR: acc.fantasyPointsPPR + (week3.fantasyPointsPPR || 0),
            fantasyPointsHalf: acc.fantasyPointsHalf + (week3.fantasyPointsHalf || 0),
            fantasyPointsStd: acc.fantasyPointsStd + (week3.fantasyPointsStd || 0),
            passYards: acc.passYards + (week3.passYards || 0),
            passTDs: acc.passTDs + (week3.passTDs || 0),
            rushYards: acc.rushYards + (week3.rushYards || 0),
            rushTDs: acc.rushTDs + (week3.rushTDs || 0),
            receptions: acc.receptions + (week3.receptions || 0),
            receivingYards: acc.receivingYards + (week3.receivingYards || 0),
            receivingTDs: acc.receivingTDs + (week3.receivingTDs || 0)
          };
        }, {
          games: 0,
          gamesPlayed: 0,
          snapPctSum: 0,
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
        const gp = seasonStats.gamesPlayed ?? seasonStats.games;
        const avgSnapPct = seasonStats.snapPctSum > 0 && gp > 0 ? Math.round(seasonStats.snapPctSum / gp * 10) / 10 : null;
        const avgPts = gp > 0 ? Math.round(seasonStats.fantasyPointsPPR / gp * 10) / 10 : 0;
        let projPts = 0;
        if (weekComplete && week2 !== void 0) {
          const weekStat = stats.find((s) => s.week === week2);
          if (weekStat) {
            const ptsCol = scoringFormat === "standard" ? "fantasyPointsStd" : scoringFormat === "half-ppr" ? "fantasyPointsHalf" : "fantasyPointsPPR";
            projPts = weekStat[ptsCol] ?? 0;
          }
        } else {
          projPts = projection?.projectedPoints || 0;
        }
        const { snapPctSum, ...ss } = seasonStats;
        return {
          ...player,
          seasonStats: { ...ss, averageSnapPct: avgSnapPct },
          avgPointsPPR: avgPts,
          projectedPoints: projPts,
          isRostered: rosteredPlayerIds.includes(player.id)
        };
      });
      if (availableOnly && leagueId) {
        enrichedPlayers = enrichedPlayers.filter((p) => !p.isRostered);
      }
      if (sortByComputed) {
        const key = sortBy === "projectedPoints" ? "projectedPoints" : "avgPointsPPR";
        enrichedPlayers = [...enrichedPlayers].sort((a, b) => {
          const aVal = a[key] ?? 0;
          const bVal = b[key] ?? 0;
          return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
        });
        enrichedPlayers = enrichedPlayers.slice(offset, offset + limit);
      }
    } else {
      enrichedPlayers = players.map((player) => ({
        ...player,
        isRostered: rosteredPlayerIds.includes(player.id)
      }));
      if (availableOnly && leagueId) {
        enrichedPlayers = enrichedPlayers.filter((p) => !p.isRostered);
      }
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
      },
      weekComplete,
      pointsType: weekComplete ? "actual" : "projected"
    });
  } catch (error) {
    console.error("Get players error:", error);
    return c.json({ error: "Failed to fetch players" }, 500);
  }
});
playerRoutes.get("/projection-movements", optionalAuthMiddleware, async (c) => {
  const db = c.get("db");
  const week2 = parseInt(c.req.query("week") || "1");
  const season = parseInt(c.req.query("season") || String((/* @__PURE__ */ new Date()).getFullYear()));
  const scoringFormat = c.req.query("scoringFormat") || "ppr";
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 50);
  try {
    const currentProjections = await db.query.playerProjections.findMany({
      where: and(
        eq(playerProjections.week, week2),
        eq(playerProjections.seasonYear, season),
        eq(playerProjections.scoringFormat, scoringFormat)
      ),
      with: { player: true }
    });
    const playerIds = currentProjections.map((p) => p.playerId);
    if (playerIds.length === 0) return c.json({ movements: [] });
    const CHUNK = 50;
    const snapshots = [];
    for (let i = 0; i < playerIds.length; i += CHUNK) {
      const chunk = playerIds.slice(i, i + CHUNK);
      const rows = await db.query.projectionLineSnapshots.findMany({
        where: and(
          inArray(projectionLineSnapshots.playerId, chunk),
          eq(projectionLineSnapshots.week, week2),
          eq(projectionLineSnapshots.seasonYear, season),
          eq(projectionLineSnapshots.scoringFormat, scoringFormat)
        ),
        orderBy: asc(projectionLineSnapshots.snapshotAt)
      });
      snapshots.push(...rows.map((r) => ({ playerId: r.playerId, projectedPoints: r.projectedPoints, snapshotAt: r.snapshotAt })));
    }
    const earliestByPlayer = /* @__PURE__ */ new Map();
    for (const s of snapshots) {
      if (!earliestByPlayer.has(s.playerId)) earliestByPlayer.set(s.playerId, { projectedPoints: s.projectedPoints, snapshotAt: s.snapshotAt });
    }
    const movements = currentProjections.map((p) => {
      const prev = earliestByPlayer.get(p.playerId);
      const prevPts = prev?.projectedPoints ?? p.projectedPoints;
      const movement = p.projectedPoints - prevPts;
      return {
        playerId: p.playerId,
        name: p.player?.name,
        team: p.player?.team,
        position: p.player?.position,
        previousProjectedPoints: prevPts,
        projectedPoints: p.projectedPoints,
        movement
      };
    }).filter((m) => Math.abs(m.movement) > 0.01).sort((a, b) => Math.abs(b.movement) - Math.abs(a.movement)).slice(0, limit);
    return c.json({ movements });
  } catch (error) {
    console.error("Projection movements error:", error);
    return c.json({ error: "Failed to fetch projection movements" }, 500);
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
  const limit = Math.min(parseInt(c.req.query("limit") || "10"), 50);
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
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1e3);
    let trendingRows;
    if (direction === "up") {
      trendingRows = await db.select({
        playerId: transactions.playerId,
        count: sql`count(*)`.as("cnt")
      }).from(transactions).where(
        and(
          sql`${transactions.type} IN ('add', 'waiver')`,
          eq(transactions.status, "processed"),
          sql`${transactions.createdAt} >= ${cutoff.getTime() / 1e3}`,
          sql`${transactions.playerId} IS NOT NULL`
        )
      ).groupBy(transactions.playerId).orderBy(sql`cnt DESC`).limit(10);
    } else {
      trendingRows = await db.select({
        playerId: transactions.dropPlayerId,
        count: sql`count(*)`.as("cnt")
      }).from(transactions).where(
        and(
          sql`${transactions.type} IN ('drop', 'waiver')`,
          eq(transactions.status, "processed"),
          sql`${transactions.createdAt} >= ${cutoff.getTime() / 1e3}`,
          sql`${transactions.dropPlayerId} IS NOT NULL`
        )
      ).groupBy(transactions.dropPlayerId).orderBy(sql`cnt DESC`).limit(10);
    }
    if (!trendingRows || trendingRows.length === 0) {
      const fallbackPlayers = await db.query.nflPlayers.findMany({
        where: eq(nflPlayers.status, "active"),
        limit: 10
      });
      return c.json({
        trending: fallbackPlayers.map((p) => ({
          ...p,
          trendDirection: direction,
          trendValue: 0,
          ownedPct: 0
        }))
      });
    }
    const playerIds = trendingRows.map((r) => r.playerId).filter(Boolean);
    const players = playerIds.length > 0 ? await db.query.nflPlayers.findMany({
      where: inArray(nflPlayers.id, playerIds)
    }) : [];
    const playerMap = new Map(players.map((p) => [p.id, p]));
    const teamCountResult = await db.select({ total: sql`count(*)` }).from(teams);
    const totalTeams = teamCountResult[0]?.total || 1;
    const trending = trendingRows.map((row) => {
      const player = playerMap.get(row.playerId);
      if (!player) return null;
      return {
        ...player,
        trendDirection: direction,
        trendValue: row.count,
        ownedPct: 0
        // Will be filled below
      };
    }).filter(Boolean);
    if (playerIds.length > 0) {
      const rosterCounts = await db.select({
        playerId: rosterSpots.playerId,
        count: sql`count(DISTINCT ${rosterSpots.teamId})`.as("cnt")
      }).from(rosterSpots).where(inArray(rosterSpots.playerId, playerIds)).groupBy(rosterSpots.playerId);
      const ownershipMap = new Map(
        rosterCounts.map((r) => [r.playerId, Math.round(r.count / totalTeams * 100)])
      );
      for (const t of trending) {
        if (t) t.ownedPct = ownershipMap.get(t.id) || 0;
      }
    }
    return c.json({ trending });
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
    const now = /* @__PURE__ */ new Date();
    const fallbackSeason = now.getMonth() <= 6 ? now.getFullYear() - 1 : now.getFullYear();
    return c.json({
      years: years.length > 0 ? years : [fallbackSeason, fallbackSeason - 1],
      latest: years[0] ?? fallbackSeason
    });
  } catch (error) {
    console.error("Get available years error:", error);
    const now = /* @__PURE__ */ new Date();
    const fallbackSeason = now.getMonth() <= 6 ? now.getFullYear() - 1 : now.getFullYear();
    return c.json({ years: [fallbackSeason, fallbackSeason - 1], latest: fallbackSeason });
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
          limit: 3
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
playerRoutes.get("/:id/stats/available-years", optionalAuthMiddleware, async (c) => {
  const db = c.get("db");
  let playerId = c.req.param("id");
  try {
    if (/^\d+$/.test(playerId)) {
      const player = await db.query.nflPlayers.findFirst({
        where: eq(nflPlayers.externalId, playerId)
      });
      if (player) playerId = player.id;
    }
    const result = await db.select({ seasonYear: playerWeeklyStats.seasonYear }).from(playerWeeklyStats).where(eq(playerWeeklyStats.playerId, playerId)).groupBy(playerWeeklyStats.seasonYear).orderBy(desc(playerWeeklyStats.seasonYear));
    const years = result.map((r) => r.seasonYear).filter((y) => y != null);
    return c.json({
      years: years.length > 0 ? years : [],
      latest: years[0] ?? null
    });
  } catch (error) {
    console.error("Get player available years error:", error);
    return c.json({ years: [], latest: null });
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
      const fallbackSeason = (/* @__PURE__ */ new Date()).getMonth() <= 6 ? (/* @__PURE__ */ new Date()).getFullYear() - 1 : (/* @__PURE__ */ new Date()).getFullYear();
      season = maxResult[0]?.maxYear ?? fallbackSeason;
    } else {
      const parsed = parseInt(seasonParam);
      const fallbackSeason = (/* @__PURE__ */ new Date()).getMonth() <= 6 ? (/* @__PURE__ */ new Date()).getFullYear() - 1 : (/* @__PURE__ */ new Date()).getFullYear();
      season = isNaN(parsed) ? fallbackSeason : parsed;
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
    const playerRow = await db.query.nflPlayers.findFirst({
      where: eq(nflPlayers.id, playerId),
      columns: { position: true }
    });
    const position = playerRow?.position ?? "";
    const seasonTotals = stats.reduce(
      (acc, week2) => {
        const isDef = position === "DEF";
        const played = isDef || (week2.offSnaps ?? 0) > 0 || (week2.defSnaps ?? 0) > 0 || (week2.stSnaps ?? 0) > 0 || ((week2.passAttempts ?? 0) > 0 || (week2.rushAttempts ?? 0) > 0 || (week2.targets ?? 0) > 0 || (week2.receptions ?? 0) > 0 || (week2.fgAttempts ?? 0) > 0 || (week2.xpAttempts ?? 0) > 0 || (week2.sacks ?? 0) > 0 || (week2.defInterceptions ?? 0) > 0);
        const snapPct = (() => {
          const off = week2.offSnaps ?? 0;
          const def = week2.defSnaps ?? 0;
          const st = week2.stSnaps ?? 0;
          const tmOff = week2.tmOffSnaps ?? 0;
          const tmDef = week2.tmDefSnaps ?? 0;
          const tmSt = week2.tmStSnaps ?? 0;
          if (off > 0 && tmOff > 0) return off / tmOff * 100;
          if (def > 0 && tmDef > 0) return def / tmDef * 100;
          if (st > 0 && tmSt > 0) return st / tmSt * 100;
          return null;
        })();
        return {
          games: acc.games + 1,
          gamesPlayed: acc.gamesPlayed + (played ? 1 : 0),
          snapPctSum: acc.snapPctSum + (snapPct != null ? snapPct : 0),
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
        };
      },
      {
        games: 0,
        gamesPlayed: 0,
        snapPctSum: 0,
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
    const computeSnapPct = /* @__PURE__ */ __name((row) => {
      const off = row.offSnaps ?? 0;
      const def = row.defSnaps ?? 0;
      const st = row.stSnaps ?? 0;
      const tmOff = row.tmOffSnaps ?? 0;
      const tmDef = row.tmDefSnaps ?? 0;
      const tmSt = row.tmStSnaps ?? 0;
      if (off > 0 && tmOff > 0) return Math.round(off / tmOff * 1e3) / 10;
      if (def > 0 && tmDef > 0) return Math.round(def / tmDef * 1e3) / 10;
      if (st > 0 && tmSt > 0) return Math.round(st / tmSt * 1e3) / 10;
      return null;
    }, "computeSnapPct");
    const normalize = /* @__PURE__ */ __name((row) => {
      const out = {};
      for (const [k, v] of Object.entries(row)) {
        out[k.includes("_") ? toCamel(k) : k] = v;
      }
      const snapPct = computeSnapPct(row);
      if (snapPct != null) out.snapPct = snapPct;
      return out;
    }, "normalize");
    const normalizedStats = stats.map(normalize);
    const { snapPctSum, ...totalsOut } = seasonTotals;
    const averageSnapPct = snapPctSum > 0 && (seasonTotals.gamesPlayed ?? seasonTotals.games) > 0 ? Math.round(snapPctSum / (seasonTotals.gamesPlayed ?? seasonTotals.games) * 10) / 10 : null;
    return c.json({
      weeklyStats: normalizedStats,
      seasonTotals: { ...totalsOut, averageSnapPct },
      resolvedSeason: season,
      averagePointsPPR: (seasonTotals.gamesPlayed ?? seasonTotals.games) > 0 ? Math.round(seasonTotals.fantasyPointsPPR / (seasonTotals.gamesPlayed ?? seasonTotals.games) * 10) / 10 : 0,
      averagePointsHalf: (seasonTotals.gamesPlayed ?? seasonTotals.games) > 0 ? Math.round(seasonTotals.fantasyPointsHalf / (seasonTotals.gamesPlayed ?? seasonTotals.games) * 10) / 10 : 0,
      averagePointsStd: (seasonTotals.gamesPlayed ?? seasonTotals.games) > 0 ? Math.round(seasonTotals.fantasyPointsStd / (seasonTotals.gamesPlayed ?? seasonTotals.games) * 10) / 10 : 0
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
      limit: 3
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
playerRoutes.get("/:id/matchup-grade", optionalAuthMiddleware, async (c) => {
  const db = c.get("db");
  let playerId = c.req.param("id");
  const seasonParam = c.req.query("season");
  const weekParam = c.req.query("week");
  const formatParam = c.req.query("format") || "ppr";
  try {
    let player = await db.query.nflPlayers.findFirst({
      where: eq(nflPlayers.id, playerId)
    });
    if (!player && /^\d+$/.test(playerId)) {
      player = await db.query.nflPlayers.findFirst({
        where: eq(nflPlayers.externalId, playerId)
      });
    }
    if (!player) return c.json({ error: "Player not found" }, 404);
    const position = player.position;
    const playerTeam = player.team;
    let season;
    if (seasonParam) {
      season = parseInt(seasonParam);
      if (isNaN(season)) season = (/* @__PURE__ */ new Date()).getFullYear();
    } else {
      const maxResult = await db.select({ maxYear: sql`max(${playerWeeklyStats.seasonYear})` }).from(playerWeeklyStats);
      season = maxResult[0]?.maxYear ?? (/* @__PURE__ */ new Date()).getFullYear();
    }
    let opponentTeam = null;
    let matchupWeek = null;
    if (weekParam) {
      const week2 = parseInt(weekParam);
      if (!isNaN(week2) && week2 >= 1 && week2 <= 22) {
        const game = await db.query.nflGames.findFirst({
          where: and(
            eq(nflGames.seasonYear, season),
            eq(nflGames.week, week2),
            sql`(${nflGames.homeTeam} = ${playerTeam} OR ${nflGames.awayTeam} = ${playerTeam})`
          )
        });
        if (game) {
          opponentTeam = game.homeTeam === playerTeam ? game.awayTeam : game.homeTeam;
          matchupWeek = week2;
        }
      }
    }
    if (!opponentTeam) {
      const nextGame = await db.query.nflGames.findFirst({
        where: and(
          eq(nflGames.seasonYear, season),
          eq(nflGames.seasonType, "regular"),
          sql`(${nflGames.homeTeam} = ${playerTeam} OR ${nflGames.awayTeam} = ${playerTeam})`,
          eq(nflGames.isComplete, false)
        ),
        orderBy: asc(nflGames.week)
      });
      if (nextGame) {
        opponentTeam = nextGame.homeTeam === playerTeam ? nextGame.awayTeam : nextGame.homeTeam;
        matchupWeek = nextGame.week;
      }
    }
    if (!opponentTeam) {
      const lastGame = await db.query.nflGames.findFirst({
        where: and(
          eq(nflGames.seasonYear, season),
          eq(nflGames.seasonType, "regular"),
          sql`(${nflGames.homeTeam} = ${playerTeam} OR ${nflGames.awayTeam} = ${playerTeam})`,
          eq(nflGames.isComplete, true)
        ),
        orderBy: desc(nflGames.week)
      });
      if (lastGame) {
        opponentTeam = lastGame.homeTeam === playerTeam ? lastGame.awayTeam : lastGame.homeTeam;
        matchupWeek = lastGame.week;
      }
    }
    if (!opponentTeam) {
      return c.json({
        grade: null,
        label: "Unknown",
        message: "No matchup data available",
        opponent: null,
        week: null
      });
    }
    const defGames = await db.select({
      week: nflGames.week,
      homeTeam: nflGames.homeTeam,
      awayTeam: nflGames.awayTeam
    }).from(nflGames).where(
      and(
        eq(nflGames.seasonYear, season),
        eq(nflGames.seasonType, "regular"),
        eq(nflGames.isComplete, true),
        sql`(${nflGames.homeTeam} = ${opponentTeam} OR ${nflGames.awayTeam} = ${opponentTeam})`,
        matchupWeek ? sql`${nflGames.week} < ${matchupWeek}` : sql`1=1`
      )
    ).orderBy(desc(nflGames.week)).limit(5);
    if (defGames.length === 0) {
      return c.json({
        grade: null,
        label: "Unknown",
        message: `No completed games found for ${opponentTeam} defense`,
        opponent: opponentTeam,
        week: matchupWeek
      });
    }
    const defWeeks = defGames.map((g) => g.week);
    const fpCol = formatParam === "std" ? playerWeeklyStats.fantasyPointsStd : formatParam === "half" ? playerWeeklyStats.fantasyPointsHalf : playerWeeklyStats.fantasyPointsPPR;
    const defAllowedStats = await db.select({
      week: playerWeeklyStats.week,
      fantasyPoints: fpCol,
      playerId: playerWeeklyStats.playerId
    }).from(playerWeeklyStats).innerJoin(nflPlayers, eq(playerWeeklyStats.playerId, nflPlayers.id)).where(
      and(
        eq(playerWeeklyStats.seasonYear, season),
        eq(nflPlayers.position, position),
        inArray(playerWeeklyStats.week, defWeeks),
        sql`(${playerWeeklyStats.opponent} = ${opponentTeam} OR ${playerWeeklyStats.opponent} = ${"@" + opponentTeam})`,
        // Must have actually played (non-zero stats)
        sql`(
            ${playerWeeklyStats.offSnaps} > 0
            OR ${playerWeeklyStats.defSnaps} > 0
            OR ${playerWeeklyStats.passAttempts} > 0
            OR ${playerWeeklyStats.rushAttempts} > 0
            OR ${playerWeeklyStats.targets} > 0
            OR ${playerWeeklyStats.receptions} > 0
            OR ${playerWeeklyStats.fgAttempts} > 0
            OR ${playerWeeklyStats.xpAttempts} > 0
            OR ${playerWeeklyStats.sacks} > 0
            OR ${playerWeeklyStats.defInterceptions} > 0
          )`
      )
    );
    const pointsByWeek = /* @__PURE__ */ new Map();
    for (const row of defAllowedStats) {
      const pts = row.fantasyPoints ?? 0;
      pointsByWeek.set(row.week, (pointsByWeek.get(row.week) ?? 0) + pts);
    }
    const weeksWithData = [...pointsByWeek.keys()];
    if (weeksWithData.length === 0) {
      return c.json({
        grade: null,
        label: "Unknown",
        message: `No ${position} stats available against ${opponentTeam}`,
        opponent: opponentTeam,
        week: matchupWeek
      });
    }
    const totalAllowed = [...pointsByWeek.values()].reduce((a, b) => a + b, 0);
    const avgAllowedPerGame = totalAllowed / weeksWithData.length;
    const leagueAvgResult = await db.select({
      week: playerWeeklyStats.week,
      totalPoints: sql`sum(${fpCol})`
    }).from(playerWeeklyStats).innerJoin(nflPlayers, eq(playerWeeklyStats.playerId, nflPlayers.id)).where(
      and(
        eq(playerWeeklyStats.seasonYear, season),
        eq(nflPlayers.position, position),
        inArray(playerWeeklyStats.week, defWeeks),
        sql`(
            ${playerWeeklyStats.offSnaps} > 0
            OR ${playerWeeklyStats.defSnaps} > 0
            OR ${playerWeeklyStats.passAttempts} > 0
            OR ${playerWeeklyStats.rushAttempts} > 0
            OR ${playerWeeklyStats.targets} > 0
            OR ${playerWeeklyStats.receptions} > 0
            OR ${playerWeeklyStats.fgAttempts} > 0
            OR ${playerWeeklyStats.xpAttempts} > 0
            OR ${playerWeeklyStats.sacks} > 0
            OR ${playerWeeklyStats.defInterceptions} > 0
          )`
      )
    ).groupBy(playerWeeklyStats.week);
    const teamsPerWeekResult = await db.select({
      week: nflGames.week,
      gameCount: sql`count(*)`
    }).from(nflGames).where(
      and(
        eq(nflGames.seasonYear, season),
        eq(nflGames.seasonType, "regular"),
        eq(nflGames.isComplete, true),
        inArray(nflGames.week, defWeeks)
      )
    ).groupBy(nflGames.week);
    const teamsPerWeek = new Map(teamsPerWeekResult.map((r) => [r.week, r.gameCount * 2]));
    let leagueTotalPerTeam = 0;
    let leagueWeekCount = 0;
    for (const row of leagueAvgResult) {
      const numTeams = teamsPerWeek.get(row.week) ?? 32;
      leagueTotalPerTeam += (row.totalPoints ?? 0) / numTeams;
      leagueWeekCount++;
    }
    const leagueAvgPerTeamPerGame = leagueWeekCount > 0 ? leagueTotalPerTeam / leagueWeekCount : 0;
    const ratio = leagueAvgPerTeamPerGame > 0 ? avgAllowedPerGame / leagueAvgPerTeamPerGame : 1;
    let grade;
    if (ratio >= 1.25) grade = "A+";
    else if (ratio >= 1.2) grade = "A";
    else if (ratio >= 1.15) grade = "A-";
    else if (ratio >= 1.1) grade = "B+";
    else if (ratio >= 1.05) grade = "B";
    else if (ratio >= 1) grade = "B-";
    else if (ratio >= 0.95) grade = "C+";
    else if (ratio >= 0.9) grade = "C";
    else if (ratio >= 0.85) grade = "C-";
    else if (ratio >= 0.8) grade = "D+";
    else if (ratio >= 0.75) grade = "D";
    else grade = "D-";
    const label = grade.startsWith("A") ? "Elite" : grade.startsWith("B") ? "Good" : grade.startsWith("C") ? "Average" : "Tough";
    const gameBreakdown = defGames.map((g) => ({
      week: g.week,
      pointsAllowed: Math.round((pointsByWeek.get(g.week) ?? 0) * 10) / 10
    }));
    return c.json({
      grade,
      label,
      opponent: opponentTeam,
      week: matchupWeek,
      season,
      position,
      format: formatParam,
      gamesAnalyzed: weeksWithData.length,
      avgPointsAllowed: Math.round(avgAllowedPerGame * 10) / 10,
      leagueAvg: Math.round(leagueAvgPerTeamPerGame * 10) / 10,
      ratio: Math.round(ratio * 100) / 100,
      gameBreakdown,
      message: `${opponentTeam} allows ${Math.round(avgAllowedPerGame * 10) / 10} ${formatParam.toUpperCase()} pts/game to ${position}s (league avg: ${Math.round(leagueAvgPerTeamPerGame * 10) / 10})`
    });
  } catch (error) {
    console.error("Matchup grade error:", error);
    return c.json({ error: "Failed to calculate matchup grade" }, 500);
  }
});

// src/routes/matchups.ts
init_checked_fetch();
init_modules_watch_stub();
init_dist();
init_drizzle_orm();
init_schema();
init_auth();
var matchupRoutes = new Hono2();
function getPointsColumn(scoringFormat) {
  switch (scoringFormat) {
    case "half_ppr":
    case "half-ppr":
      return playerWeeklyStats.fantasyPointsHalf;
    case "standard":
      return playerWeeklyStats.fantasyPointsStd;
    default:
      return playerWeeklyStats.fantasyPointsPPR;
  }
}
__name(getPointsColumn, "getPointsColumn");
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
    const allRosterPlayers = [
      ...matchup.homeTeam?.roster || [],
      ...matchup.awayTeam?.roster || []
    ];
    const allPlayerIds = allRosterPlayers.map((r) => r.player.id);
    const scoringFormat = matchup.league.scoringFormat || "ppr";
    const seasonYear = matchup.league.seasonYear;
    const week2 = matchup.week;
    const statsMap = /* @__PURE__ */ new Map();
    if (allPlayerIds.length > 0) {
      const pointsCol = getPointsColumn(scoringFormat);
      const stats = await db.select({
        playerId: playerWeeklyStats.playerId,
        points: pointsCol
      }).from(playerWeeklyStats).where(
        and(
          inArray(playerWeeklyStats.playerId, allPlayerIds),
          eq(playerWeeklyStats.week, week2),
          eq(playerWeeklyStats.seasonYear, seasonYear)
        )
      );
      for (const s of stats) {
        statsMap.set(s.playerId, s.points || 0);
      }
    }
    const projMap = /* @__PURE__ */ new Map();
    if (allPlayerIds.length > 0) {
      const projScoringFormat = scoringFormat === "half_ppr" ? "half-ppr" : scoringFormat;
      const projections = await db.select({
        playerId: playerProjections.playerId,
        projectedPoints: playerProjections.projectedPoints
      }).from(playerProjections).where(
        and(
          inArray(playerProjections.playerId, allPlayerIds),
          eq(playerProjections.week, week2),
          eq(playerProjections.seasonYear, seasonYear),
          eq(playerProjections.scoringFormat, projScoringFormat)
        )
      );
      for (const p of projections) {
        projMap.set(p.playerId, p.projectedPoints || 0);
      }
    }
    const formatTeam = /* @__PURE__ */ __name((team, score, projectedScore) => {
      const starters = team.roster.filter((r) => r.isStarter).map((r) => ({
        slot: r.slot,
        player: {
          id: r.player.id,
          name: r.player.name,
          team: r.player.team,
          position: r.player.position,
          status: r.player.status,
          headshotUrl: r.player.headshotUrl
        },
        points: statsMap.get(r.player.id) || 0,
        projectedPoints: projMap.get(r.player.id) || 0
      }));
      const calculatedScore = starters.reduce((sum, s) => sum + s.points, 0);
      const calculatedProjected = starters.reduce((sum, s) => sum + s.projectedPoints, 0);
      return {
        id: team.id,
        name: team.name,
        owner: {
          id: team.owner.id,
          username: team.owner.username,
          avatarUrl: team.owner.avatarUrl
        },
        record: `${team.wins}-${team.losses}${team.ties > 0 ? `-${team.ties}` : ""}`,
        score: score || calculatedScore,
        projectedScore: projectedScore || calculatedProjected,
        starters,
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
          points: statsMap.get(r.player.id) || 0,
          projectedPoints: projMap.get(r.player.id) || 0
        }))
      };
    }, "formatTeam");
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
    const league = await db.query.leagues.findFirst({
      where: eq(leagues.id, matchup.leagueId)
    });
    const scoringFormat = league?.scoringFormat || "ppr";
    const seasonYear = league?.seasonYear || (/* @__PURE__ */ new Date()).getFullYear();
    const pointsCol = getPointsColumn(scoringFormat);
    const homeRoster = await db.query.rosterSpots.findMany({
      where: and(
        eq(rosterSpots.teamId, matchup.homeTeamId),
        eq(rosterSpots.isStarter, true)
      )
    });
    const awayRoster = await db.query.rosterSpots.findMany({
      where: and(
        eq(rosterSpots.teamId, matchup.awayTeamId),
        eq(rosterSpots.isStarter, true)
      )
    });
    const allStarterIds = [
      ...homeRoster.map((r) => r.playerId),
      ...awayRoster.map((r) => r.playerId)
    ];
    const statsMap = /* @__PURE__ */ new Map();
    if (allStarterIds.length > 0) {
      const stats = await db.select({
        playerId: playerWeeklyStats.playerId,
        points: pointsCol
      }).from(playerWeeklyStats).where(
        and(
          inArray(playerWeeklyStats.playerId, allStarterIds),
          eq(playerWeeklyStats.week, matchup.week),
          eq(playerWeeklyStats.seasonYear, seasonYear)
        )
      );
      for (const s of stats) {
        statsMap.set(s.playerId, s.points || 0);
      }
    }
    const homeScore = homeRoster.reduce((sum, r) => sum + (statsMap.get(r.playerId) || 0), 0);
    const awayScore = awayRoster.reduce((sum, r) => sum + (statsMap.get(r.playerId) || 0), 0);
    return c.json({
      matchupId: matchup.id,
      homeScore: matchup.homeScore || Math.round(homeScore * 100) / 100,
      awayScore: matchup.awayScore || Math.round(awayScore * 100) / 100,
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
  if (isNaN(week2) || week2 < 1 || week2 > 22) {
    return c.json({ error: "Invalid week number" }, 400);
  }
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
          owner: m.homeTeam.ownerDisplayName || m.homeTeam.owner.username,
          score: m.homeScore || 0,
          projectedScore: m.homeProjectedScore || 0
        },
        awayTeam: {
          id: m.awayTeam.id,
          name: m.awayTeam.name,
          owner: m.awayTeam.ownerDisplayName || m.awayTeam.owner.username,
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
        owner: opponent.ownerDisplayName || opponent.owner.username,
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
    const league = await db.query.leagues.findFirst({
      where: eq(leagues.id, leagueId),
      columns: { currentWeek: true, externalId: true, platform: true }
    });
    let effectiveCurrentWeek = league?.currentWeek || 1;
    const currentMonth = (/* @__PURE__ */ new Date()).getMonth();
    const isOffseason = currentMonth >= 1 && currentMonth <= 7;
    if (league?.platform === "sleeper" && league.externalId) {
      try {
        const sleeperRes = await fetch(`https://api.sleeper.app/v1/league/${league.externalId}`);
        if (sleeperRes.ok) {
          const sleeperLeague = await sleeperRes.json();
          const settings = sleeperLeague?.settings || {};
          const playoffWeekStart = settings.playoff_week_start || 15;
          const regularSeasonWeeks = playoffWeekStart - 1;
          const sleeperLeg = settings.leg || 1;
          const leagueStatus = sleeperLeague?.status || "in_season";
          if (leagueStatus === "complete" || isOffseason || sleeperLeg > regularSeasonWeeks) {
            effectiveCurrentWeek = regularSeasonWeeks + 1;
          } else {
            effectiveCurrentWeek = sleeperLeg;
          }
        }
      } catch {
      }
    }
    if (isOffseason && effectiveCurrentWeek <= 1) {
      effectiveCurrentWeek = 19;
    }
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
      orderBy: /* @__PURE__ */ __name((matchups3, { asc: asc2 }) => [asc2(matchups3.week)], "orderBy")
    });
    return c.json({
      matchups: matchups2.map((m) => {
        const isComplete = m.isComplete || m.week < effectiveCurrentWeek;
        return {
          id: m.id,
          week: m.week,
          isPlayoff: m.isPlayoff,
          isChampionship: m.isChampionship,
          isComplete,
          homeTeam: {
            id: m.homeTeam.id,
            name: m.homeTeam.name,
            owner: m.homeTeam.ownerDisplayName || m.homeTeam.owner.username,
            score: m.homeScore || 0,
            projectedScore: m.homeProjectedScore || 0
          },
          awayTeam: {
            id: m.awayTeam.id,
            name: m.awayTeam.name,
            owner: m.awayTeam.ownerDisplayName || m.awayTeam.owner.username,
            score: m.awayScore || 0,
            projectedScore: m.awayProjectedScore || 0
          }
        };
      })
    });
  } catch (error) {
    console.error("Get all league matchups error:", error);
    return c.json({ error: "Failed to fetch matchups" }, 500);
  }
});

// src/routes/games.ts
init_checked_fetch();
init_modules_watch_stub();
init_dist();
init_drizzle_orm();
init_schema();
init_auth();
init_espn();
var gameRoutes = new Hono2();
async function persistGamesToDb(db, rows) {
  for (const row of rows) {
    const existing = await db.query.nflGames.findFirst({
      where: eq(nflGames.id, row.id)
    });
    const values = {
      id: row.id,
      externalId: row.id,
      week: row.week,
      seasonYear: row.seasonYear,
      seasonType: row.seasonType,
      homeTeam: row.homeTeam,
      awayTeam: row.awayTeam,
      gameTime: row.gameTime,
      spread: row.spread,
      overUnder: row.overUnder,
      tvNetwork: row.tvNetwork,
      stadium: row.stadium,
      weather: row.weather,
      homeScore: row.homeScore ?? null,
      awayScore: row.awayScore ?? null,
      isComplete: row.homeScore != null && row.awayScore != null
    };
    if (existing) {
      if (values.tvNetwork == null && existing.tvNetwork) delete values.tvNetwork;
      if (values.spread == null && existing.spread != null) delete values.spread;
      if (values.overUnder == null && existing.overUnder != null) delete values.overUnder;
      await db.update(nflGames).set(values).where(eq(nflGames.id, row.id));
    } else {
      await db.insert(nflGames).values(values);
    }
  }
}
__name(persistGamesToDb, "persistGamesToDb");
var INDOOR_TEAMS2 = /* @__PURE__ */ new Set(["NO", "DET", "MIN", "LV", "IND", "ATL", "DAL", "HOU", "ARI"]);
function normalizeTeam(abbrev) {
  return abbrev === "WSH" ? "WAS" : abbrev;
}
__name(normalizeTeam, "normalizeTeam");
function dbGameToSlateGame(g) {
  let weather = g.weather ? JSON.parse(g.weather) : null;
  const gameTime = new Date(g.gameTime);
  const isFinalOrPast = g.isComplete || gameTime.getTime() < Date.now() - 4 * 36e5;
  if (!weather) {
    if (INDOOR_TEAMS2.has(g.homeTeam)) {
      weather = { displayValue: "Indoor", temperature: 72 };
    } else if (isFinalOrPast) {
      weather = { displayValue: "Outdoor" };
    }
  }
  return {
    id: g.id,
    awayTeam: getTeamDisplayName(g.awayTeam),
    awayTeamLogo: g.awayTeam,
    homeTeam: getTeamDisplayName(g.homeTeam),
    homeTeamLogo: g.homeTeam,
    gameTime: gameTime.toISOString(),
    gameTimeDisplay: gameTime.toLocaleString("en-US", {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short"
    }),
    spread: g.spread != null ? Math.abs(g.spread) : null,
    favoredTeam: g.spread != null && g.spread < 0 ? "home" : "away",
    overUnder: g.overUnder,
    tvNetwork: g.tvNetwork || getStaticNetwork(g.week, g.homeTeam, g.awayTeam) || "TBD",
    weather,
    homeScore: g.homeScore ?? void 0,
    awayScore: g.awayScore ?? void 0,
    status: g.isComplete ? "final" : isFinalOrPast ? "final" : "scheduled"
  };
}
__name(dbGameToSlateGame, "dbGameToSlateGame");
function buildStatLine(position, stats) {
  switch (position) {
    case "QB": {
      const parts = [];
      if (stats.passYards) parts.push(`${Math.round(stats.passYards)} YDS`);
      if (stats.passTDs) parts.push(`${stats.passTDs} TD`);
      if (stats.passInterceptions) parts.push(`${stats.passInterceptions} INT`);
      if (stats.rushYards && stats.rushYards >= 20) parts.push(`${Math.round(stats.rushYards)} RUSH`);
      return parts.join(", ");
    }
    case "RB": {
      const parts = [];
      if (stats.rushYards) parts.push(`${Math.round(stats.rushYards)} YDS`);
      if (stats.rushTDs) parts.push(`${stats.rushTDs} TD`);
      if (stats.receptions && stats.receptions >= 2) parts.push(`${stats.receptions} REC`);
      return parts.join(", ");
    }
    case "WR":
    case "TE": {
      const parts = [];
      if (stats.receptions) parts.push(`${stats.receptions} REC`);
      if (stats.receivingYards) parts.push(`${Math.round(stats.receivingYards)} YDS`);
      if (stats.receivingTDs) parts.push(`${stats.receivingTDs} TD`);
      return parts.join(", ");
    }
    case "K": {
      const parts = [];
      if (stats.fgMade != null) parts.push(`${stats.fgMade}/${stats.fgAttempts} FG`);
      if (stats.xpMade != null) parts.push(`${stats.xpMade}/${stats.xpAttempts} XP`);
      return parts.join(", ");
    }
    case "DEF": {
      const parts = [];
      if (stats.sacks) parts.push(`${stats.sacks} SCK`);
      if (stats.defInterceptions) parts.push(`${stats.defInterceptions} INT`);
      if (stats.pointsAllowed != null) parts.push(`${stats.pointsAllowed} PA`);
      return parts.join(", ");
    }
    default:
      return "";
  }
}
__name(buildStatLine, "buildStatLine");
async function getTopPerformersForWeek(db, week2, seasonYear, completedTeamPairs) {
  const result = /* @__PURE__ */ new Map();
  if (completedTeamPairs.length === 0) return result;
  const allTeams = /* @__PURE__ */ new Set();
  for (const pair of completedTeamPairs) {
    allTeams.add(normalizeTeam(pair.homeTeam));
    allTeams.add(normalizeTeam(pair.awayTeam));
  }
  const stats = await db.query.playerWeeklyStats.findMany({
    where: and(
      eq(playerWeeklyStats.week, week2),
      eq(playerWeeklyStats.seasonYear, seasonYear)
    )
  });
  if (stats.length === 0) return result;
  const playerIdSet = /* @__PURE__ */ new Set();
  for (const s of stats) {
    playerIdSet.add(s.playerId);
  }
  const playerIdsWithStats = [...playerIdSet];
  const CHUNK_SIZE = 80;
  const players = [];
  for (let i = 0; i < playerIdsWithStats.length; i += CHUNK_SIZE) {
    const chunk = playerIdsWithStats.slice(i, i + CHUNK_SIZE);
    const chunkPlayers = await db.query.nflPlayers.findMany({
      where: inArray(nflPlayers.id, chunk),
      columns: { id: true, name: true, firstName: true, lastName: true, position: true, team: true, headshotUrl: true }
    });
    players.push(...chunkPlayers);
  }
  const statsMap = /* @__PURE__ */ new Map();
  for (const s of stats) {
    statsMap.set(s.playerId, s);
  }
  const playerMap = /* @__PURE__ */ new Map();
  const playersByTeam = /* @__PURE__ */ new Map();
  for (const p of players) {
    playerMap.set(p.id, p);
    const normTeam = normalizeTeam(p.team);
    if (allTeams.has(normTeam)) {
      if (!playersByTeam.has(normTeam)) playersByTeam.set(normTeam, []);
      playersByTeam.get(normTeam).push(p);
    }
  }
  for (const { homeTeam, awayTeam, gameId } of completedTeamPairs) {
    const findTopForTeam = /* @__PURE__ */ __name((teamAbbrev, opponentAbbrev) => {
      const teamPlayers = playersByTeam.get(normalizeTeam(teamAbbrev)) ?? [];
      let best = null;
      for (const player of teamPlayers) {
        const s = statsMap.get(player.id);
        if (!s) continue;
        const statOpponent = normalizeTeam((s.opponent ?? "").toString().toUpperCase());
        const normalizedOpp = normalizeTeam(opponentAbbrev.toUpperCase());
        if (statOpponent && statOpponent !== normalizedOpp) continue;
        const pts = s.fantasyPointsPPR ?? 0;
        if (!best || pts > best.points) {
          best = { player, stats: s, points: pts };
        }
      }
      if (!best || best.points <= 0) return null;
      return {
        playerName: best.player.name || `${best.player.firstName ?? ""} ${best.player.lastName ?? ""}`.trim(),
        position: best.player.position,
        fantasyPoints: best.points,
        statLine: buildStatLine(best.player.position, best.stats),
        headshotUrl: best.player.headshotUrl ?? null
      };
    }, "findTopForTeam");
    result.set(gameId, {
      home: findTopForTeam(homeTeam, awayTeam),
      away: findTopForTeam(awayTeam, homeTeam)
    });
  }
  return result;
}
__name(getTopPerformersForWeek, "getTopPerformersForWeek");
async function enrichGamesWithTopPerformers(db, games, week2, season) {
  const completedPairs = [];
  for (const g of games) {
    if (g.status === "final") {
      completedPairs.push({
        homeTeam: g.homeTeamLogo,
        awayTeam: g.awayTeamLogo,
        gameId: g.id
      });
    }
  }
  if (completedPairs.length === 0) return games;
  const topPerformers = await getTopPerformersForWeek(db, week2, season, completedPairs);
  return games.map((g) => {
    const performers = topPerformers.get(g.id);
    if (!performers) return g;
    return { ...g, topPerformers: performers };
  });
}
__name(enrichGamesWithTopPerformers, "enrichGamesWithTopPerformers");
gameRoutes.get("/slate", optionalAuthMiddleware, async (c) => {
  const db = c.get("db");
  const week2 = c.req.query("week") ? parseInt(c.req.query("week")) : void 0;
  const ctx = getNflSeasonContext();
  const season = ctx.season;
  const month = (/* @__PURE__ */ new Date()).getMonth();
  const isOffseason = month >= 1 && month <= 7;
  const effectiveWeek = week2 ?? (isOffseason ? 18 : void 0);
  const seasontype = effectiveWeek != null && effectiveWeek >= 1 && effectiveWeek <= 18 ? "2" : ctx.seasontype;
  try {
    let dbGames = [];
    const targetWeek = effectiveWeek ?? 18;
    if (effectiveWeek != null) {
      dbGames = await db.query.nflGames.findMany({
        where: and(eq(nflGames.week, targetWeek), eq(nflGames.seasonYear, season)),
        orderBy: asc(nflGames.gameTime)
      });
    }
    if (dbGames.length > 0) {
      const now = Date.now();
      const needsRefresh = dbGames.some((g) => {
        const gameStarted = new Date(g.gameTime).getTime() < now;
        const hasScores = g.isComplete && g.homeScore != null && g.awayScore != null;
        return gameStarted && !hasScores;
      });
      if (!needsRefresh) {
        const slateGames = dbGames.map(dbGameToSlateGame);
        const enriched = await enrichGamesWithTopPerformers(db, slateGames, targetWeek, season);
        return c.json({
          week: dbGames[0]?.week ?? targetWeek,
          season,
          weekLabel: `Week ${targetWeek}`,
          games: enriched
        });
      }
    }
    try {
      const result = await fetchEspnScoreboard(effectiveWeek, season, seasontype);
      if (result.source === "espn") {
        const hasStaticGames = dbGames.some((g) => String(g.id).startsWith("static-"));
        if (hasStaticGames) {
          await db.delete(nflGames).where(and(
            like(nflGames.id, `static-%-w${targetWeek}-%`),
            eq(nflGames.seasonYear, season)
          ));
        }
      }
      await persistGamesToDb(db, result.dbRows);
      for (const g of result.games) {
        if (!g.tvNetwork) {
          const dbMatch = dbGames.find((d) => String(d.id) === String(g.id));
          g.tvNetwork = dbMatch?.tvNetwork || getStaticNetwork(result.week, g.homeTeamLogo, g.awayTeamLogo) || "TBD";
        }
      }
      const enrichedEspn = await enrichGamesWithTopPerformers(db, result.games, result.week, season);
      return c.json({
        week: result.week,
        season: result.season,
        weekLabel: effectiveWeek != null ? `Week ${effectiveWeek}` : `Week ${result.week}`,
        games: enrichedEspn
      });
    } catch (espnError) {
      console.warn("ESPN fetch failed, falling back to DB:", espnError instanceof Error ? espnError.message : espnError);
    }
    if (dbGames.length > 0) {
      const fallbackGames = dbGames.map(dbGameToSlateGame);
      const enrichedFallback = await enrichGamesWithTopPerformers(db, fallbackGames, targetWeek, season);
      return c.json({
        week: dbGames[0]?.week ?? targetWeek,
        season,
        weekLabel: `Week ${targetWeek}`,
        games: enrichedFallback
      });
    }
    return c.json({
      week: targetWeek,
      season,
      weekLabel: `Week ${targetWeek}`,
      games: [],
      _espnUnavailable: true
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Slate games error:", msg, error);
    return c.json({ error: "Failed to fetch games", details: msg }, 500);
  }
});
gameRoutes.get("/espn/scoreboard", optionalAuthMiddleware, async (c) => {
  const week2 = c.req.query("week") ? parseInt(c.req.query("week")) : void 0;
  const season = c.req.query("season") ? parseInt(c.req.query("season")) : void 0;
  const ctx = getNflSeasonContext();
  try {
    const { games, dbRows, week: w, season: s } = await fetchEspnScoreboard(
      week2,
      season ?? ctx.season,
      ctx.seasontype
    );
    const db = c.get("db");
    await persistGamesToDb(db, dbRows);
    return c.json({
      week: w,
      season: s,
      weekLabel: `Week ${w}`,
      games
    });
  } catch (error) {
    console.error("ESPN scoreboard error:", error);
    return c.json({ error: "Failed to fetch ESPN scoreboard" }, 500);
  }
});
gameRoutes.get("/week/:week", optionalAuthMiddleware, async (c) => {
  const db = c.get("db");
  const week2 = parseInt(c.req.param("week"));
  const season = parseInt(c.req.query("season") || String((/* @__PURE__ */ new Date()).getFullYear()));
  if (isNaN(week2) || week2 < 1 || week2 > 22) {
    return c.json({ error: "Invalid week number" }, 400);
  }
  if (isNaN(season) || season < 2e3 || season > 2100) {
    return c.json({ error: "Invalid season year" }, 400);
  }
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
gameRoutes.get("/line-movements", optionalAuthMiddleware, async (c) => {
  const db = c.get("db");
  const week2 = parseInt(c.req.query("week") || "1");
  const season = parseInt(c.req.query("season") || String((/* @__PURE__ */ new Date()).getFullYear()));
  try {
    const games = await db.query.nflGames.findMany({
      where: and(eq(nflGames.week, week2), eq(nflGames.seasonYear, season)),
      columns: { id: true, homeTeam: true, awayTeam: true, spread: true, overUnder: true }
    });
    const movements = [];
    for (const game of games) {
      const snapshots = await db.query.gameLineSnapshots.findMany({
        where: eq(gameLineSnapshots.gameId, game.id),
        orderBy: asc(gameLineSnapshots.snapshotAt)
      });
      if (snapshots.length === 0) continue;
      const first = snapshots[0];
      const gameLabel = `${game.awayTeam} @ ${game.homeTeam}`;
      if (first.spread != null && game.spread != null && Math.abs((game.spread ?? 0) - first.spread) > 0.01) {
        const movement = (game.spread ?? 0) - first.spread;
        const fav = (game.spread ?? 0) > 0 ? game.homeTeam : game.awayTeam;
        movements.push({
          id: game.id,
          game: gameLabel,
          awayTeam: game.awayTeam,
          homeTeam: game.homeTeam,
          prop: "Spread",
          oldLine: `${fav} ${first.spread > 0 ? "" : "+"}${(-first.spread).toFixed(1)}`,
          newLine: `${fav} ${(game.spread ?? 0) > 0 ? "" : "+"}${(-(game.spread ?? 0)).toFixed(1)}`,
          movement,
          direction: movement > 0 ? "up" : "down"
        });
      }
      if (first.overUnder != null && game.overUnder != null && Math.abs((game.overUnder ?? 0) - first.overUnder) > 0.01) {
        const movement = (game.overUnder ?? 0) - first.overUnder;
        movements.push({
          id: `${game.id}-ou`,
          game: gameLabel,
          awayTeam: game.awayTeam,
          homeTeam: game.homeTeam,
          prop: "Total Points",
          oldLine: first.overUnder,
          newLine: game.overUnder,
          movement,
          direction: movement > 0 ? "up" : "down"
        });
      }
    }
    movements.sort((a, b) => Math.abs(b.movement) - Math.abs(a.movement));
    return c.json({ movements });
  } catch (error) {
    console.error("Line movements error:", error);
    return c.json({ error: "Failed to fetch line movements" }, 500);
  }
});
gameRoutes.get("/:id", optionalAuthMiddleware, async (c) => {
  const db = c.get("db");
  const gameId = c.req.param("id");
  const homeQ = c.req.query("home");
  const awayQ = c.req.query("away");
  try {
    let game = await db.query.nflGames.findFirst({
      where: eq(nflGames.id, gameId)
    });
    if (!game && homeQ && awayQ) {
      const games = await db.query.nflGames.findMany({
        where: and(
          eq(nflGames.homeTeam, homeQ.toUpperCase()),
          eq(nflGames.awayTeam, awayQ.toUpperCase()),
          eq(nflGames.seasonYear, getNflSeasonContext().season)
        ),
        orderBy: asc(nflGames.gameTime),
        limit: 1
      });
      game = games[0] ?? null;
    }
    if (!game) {
      return c.json({ error: "Game not found" }, 404);
    }
    const rosterStatuses = ["active", "questionable", "doubtful"];
    const homePlayers = await db.query.nflPlayers.findMany({
      where: and(
        eq(nflPlayers.team, game.homeTeam),
        inArray(nflPlayers.status, rosterStatuses)
      )
    });
    const awayPlayers = await db.query.nflPlayers.findMany({
      where: and(
        eq(nflPlayers.team, game.awayTeam),
        inArray(nflPlayers.status, rosterStatuses)
      )
    });
    const hasScores = game.homeScore != null && game.awayScore != null;
    const gameTimePast = new Date(game.gameTime).getTime() < Date.now() - 4 * 60 * 60 * 1e3;
    const gameComplete = !!game.isComplete || hasScores || gameTimePast;
    const pointsMap = /* @__PURE__ */ new Map();
    if (gameComplete) {
      const homeTeamUpper = game.homeTeam.toUpperCase();
      const awayTeamUpper = game.awayTeam.toUpperCase();
      const homePlayerIds = new Set(homePlayers.map((p) => p.id));
      const awayPlayerIds = new Set(awayPlayers.map((p) => p.id));
      const allPlayerIds = [...homePlayerIds, ...awayPlayerIds];
      const stats = await db.query.playerWeeklyStats.findMany({
        where: and(
          eq(playerWeeklyStats.week, game.week),
          eq(playerWeeklyStats.seasonYear, game.seasonYear),
          inArray(playerWeeklyStats.playerId, allPlayerIds)
        )
      });
      for (const s of stats) {
        const statOpponent = (s.opponent ?? "").toString().toUpperCase();
        if (statOpponent) {
          const isHome = homePlayerIds.has(s.playerId);
          const expectedOpponent = isHome ? awayTeamUpper : homeTeamUpper;
          if (statOpponent !== expectedOpponent) continue;
        }
        const played = (s.offSnaps ?? 0) > 0 || (s.defSnaps ?? 0) > 0 || (s.stSnaps ?? 0) > 0 || (s.passAttempts ?? 0) > 0 || (s.rushAttempts ?? 0) > 0 || (s.targets ?? 0) > 0 || (s.receptions ?? 0) > 0 || (s.passCompletions ?? 0) > 0 || (s.passYards ?? 0) > 0 || (s.rushYards ?? 0) > 0 || (s.receivingYards ?? 0) > 0 || (s.fgAttempts ?? 0) > 0 || (s.xpAttempts ?? 0) > 0 || (s.fgMade ?? 0) > 0 || (s.xpMade ?? 0) > 0 || (s.sacks ?? 0) > 0 || (s.defInterceptions ?? 0) > 0 || (s.fumblesRecovered ?? 0) > 0 || (s.defenseTDs ?? 0) > 0 || (s.safeties ?? 0) > 0 || (s.fumbles ?? 0) > 0 || (s.twoPointConversions ?? 0) > 0;
        if (played) {
          pointsMap.set(s.playerId, { points: s.fantasyPointsPPR ?? 0 });
        }
      }
    } else {
      const projections = await db.query.playerProjections.findMany({
        where: and(
          eq(playerProjections.week, game.week),
          eq(playerProjections.seasonYear, game.seasonYear),
          eq(playerProjections.scoringFormat, "ppr")
        ),
        columns: { playerId: true, projectedPoints: true, weekRank: true }
      });
      for (const p of projections) {
        pointsMap.set(p.playerId, {
          points: p.projectedPoints,
          weekRank: p.weekRank ?? void 0
        });
      }
    }
    const enrich = /* @__PURE__ */ __name((p) => {
      const data = pointsMap.get(p.id);
      return {
        ...p,
        projectedPoints: data?.points ?? 0,
        weekRank: data?.weekRank
      };
    }, "enrich");
    const POSITION_ORDER = ["QB", "RB", "WR", "TE", "K", "DEF"];
    const processPlayers = /* @__PURE__ */ __name((players) => {
      let list = players.map(enrich);
      if (gameComplete) {
        list = list.filter((p) => pointsMap.has(p.id));
      }
      const qbs = list.filter((p) => p.position === "QB");
      const nonQbs = list.filter((p) => p.position !== "QB");
      const starterQB = qbs.length === 0 ? [] : [qbs.reduce((best, p) => p.projectedPoints >= best.projectedPoints ? p : best)];
      list = [...nonQbs, ...starterQB];
      return list.sort((a, b) => {
        const posA = POSITION_ORDER.indexOf(a.position);
        const posB = POSITION_ORDER.indexOf(b.position);
        if (posA !== posB) return posA - posB;
        return b.projectedPoints - a.projectedPoints;
      });
    }, "processPlayers");
    return c.json({
      game,
      homePlayers: processPlayers(homePlayers),
      awayPlayers: processPlayers(awayPlayers)
    });
  } catch (error) {
    console.error("Get game error:", error);
    return c.json({ error: "Failed to fetch game" }, 500);
  }
});
gameRoutes.get("/:id/line-history", optionalAuthMiddleware, async (c) => {
  const db = c.get("db");
  const gameId = c.req.param("id");
  try {
    const game = await db.query.nflGames.findFirst({
      where: eq(nflGames.id, gameId)
    });
    if (!game) return c.json({ error: "Game not found" }, 404);
    const snapshots = await db.query.gameLineSnapshots.findMany({
      where: eq(gameLineSnapshots.gameId, gameId),
      orderBy: asc(gameLineSnapshots.snapshotAt)
    });
    return c.json({
      gameId,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      currentSpread: game.spread,
      currentOverUnder: game.overUnder,
      history: snapshots.map((s) => ({
        snapshotAt: s.snapshotAt,
        spread: s.spread,
        overUnder: s.overUnder
      }))
    });
  } catch (error) {
    console.error("Game line history error:", error);
    return c.json({ error: "Failed to fetch line history" }, 500);
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
    const rosterStatuses = ["active", "questionable", "doubtful"];
    const homePlayers = await db.query.nflPlayers.findMany({
      where: and(
        eq(nflPlayers.team, game.homeTeam),
        inArray(nflPlayers.status, rosterStatuses)
      )
    });
    const awayPlayers = await db.query.nflPlayers.findMany({
      where: and(
        eq(nflPlayers.team, game.awayTeam),
        inArray(nflPlayers.status, rosterStatuses)
      )
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
    const ctx = getNflSeasonContext();
    let espnGames = [];
    try {
      const params = new URLSearchParams({ season: String(ctx.season), seasontype: ctx.seasontype });
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?${params}`, {
        headers: { "Accept": "application/json" }
      });
      if (res.ok) {
        const data = await res.json();
        espnGames = data?.events ?? [];
      }
    } catch (espnErr) {
      console.warn("ESPN live fetch failed, falling back to DB:", espnErr);
    }
    if (espnGames.length > 0) {
      const liveResults = [];
      for (const ev of espnGames) {
        const comp = ev.competitions?.[0];
        const status = ev.status;
        const home = comp?.competitors?.find((c2) => c2.homeAway === "home");
        const away = comp?.competitors?.find((c2) => c2.homeAway === "away");
        const homeAbbrev = home?.team?.abbreviation ?? "";
        const awayAbbrev = away?.team?.abbreviation ?? "";
        const homeScore = home?.score != null ? parseInt(String(home.score), 10) : 0;
        const awayScore = away?.score != null ? parseInt(String(away.score), 10) : 0;
        const statusType = status?.type?.name;
        const isInProgress = statusType === "STATUS_IN_PROGRESS" || statusType === "STATUS_HALFTIME" || statusType === "STATUS_END_PERIOD";
        const isComplete = statusType === "STATUS_FINAL";
        const quarter = status?.period != null ? String(status.period) : null;
        const timeRemaining = status?.displayClock ?? null;
        const detail = status?.type?.detail ?? null;
        try {
          await db.update(nflGames).set({
            homeScore: homeScore || null,
            awayScore: awayScore || null,
            quarter: isComplete ? "Final" : quarter,
            timeRemaining: isComplete ? null : timeRemaining,
            isComplete
          }).where(eq(nflGames.externalId, ev.id));
        } catch {
        }
        if (isInProgress || isComplete) {
          liveResults.push({
            id: ev.id,
            homeTeam: homeAbbrev,
            awayTeam: awayAbbrev,
            homeScore,
            awayScore,
            quarter: isComplete ? "Final" : detail ?? `Q${quarter}`,
            timeRemaining: isComplete ? null : timeRemaining,
            isComplete
          });
        }
      }
      return c.json({
        games: liveResults,
        source: "espn",
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
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
      source: "db",
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

// src/routes/admin.ts
init_checked_fetch();
init_modules_watch_stub();
init_dist();
init_drizzle_orm();
init_schema();

// src/services/twitter.ts
init_checked_fetch();
init_modules_watch_stub();
function extractText(raw2) {
  if (!raw2) return "";
  const cdataMatch = raw2.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  const inner = cdataMatch ? cdataMatch[1] : raw2;
  return inner.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/<[^>]+>/g, "").trim();
}
__name(extractText, "extractText");
function parsePubDate(raw2) {
  if (!raw2) return /* @__PURE__ */ new Date();
  const d = new Date(raw2);
  return isNaN(d.getTime()) ? /* @__PURE__ */ new Date() : d;
}
__name(parsePubDate, "parsePubDate");
function extractUrl(block, desc2) {
  const clean = /* @__PURE__ */ __name((s) => (s || "").replace(/<[^>]+>/g, "").trim() || null, "clean");
  const linkMatch = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i) || block.match(/<link[^>]*>([^<]+)<\/link>/i);
  if (linkMatch) return clean(linkMatch[1]);
  const atomLink = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
  if (atomLink) return clean(atomLink[1]);
  const guidMatch = block.match(/<guid[^>]*>([^<]+)<\/guid>/i);
  if (guidMatch) {
    const g = clean(guidMatch[1]);
    if (g && /^https?:\/\//i.test(g)) return g;
  }
  const hrefMatch = desc2.match(/href=["'](https?:\/\/[^"']+)["']/i);
  if (hrefMatch) return hrefMatch[1].trim();
  return null;
}
__name(extractUrl, "extractUrl");
function parseItemBlock(block, defaultAuthor) {
  const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const descMatch = block.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
  const contentMatch = block.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i) || block.match(/<content[^>]*>([\s\S]*?)<\/content>/i);
  const pubMatch = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || block.match(/<published[^>]*>([\s\S]*?)<\/published>/i) || block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i);
  const title = titleMatch ? extractText(titleMatch[1]) : "";
  const desc2 = contentMatch ? contentMatch[1] : descMatch ? descMatch[1] : "";
  const text2 = extractText(desc2) || title;
  const pubDate = parsePubDate(pubMatch ? pubMatch[1].trim() : "");
  const link = extractUrl(block, desc2);
  if (!text2) return null;
  return { text: text2, author: defaultAuthor, url: link, publishedAt: pubDate };
}
__name(parseItemBlock, "parseItemBlock");
function parseRssXml(xml, defaultAuthor) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
  let match2;
  for (const regex of [itemRegex, entryRegex]) {
    regex.lastIndex = 0;
    while ((match2 = regex.exec(xml)) !== null) {
      const item = parseItemBlock(match2[1], defaultAuthor);
      if (item) items.push(item);
    }
  }
  return items;
}
__name(parseRssXml, "parseRssXml");
async function fetchRssFeed(url, author) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RSS-Reader/1.0; +https://example.com)",
        Accept: "application/rss+xml, application/xml, text/xml"
      },
      signal: AbortSignal.timeout(15e3)
    });
    if (!res.ok) {
      return { items: [], error: `HTTP ${res.status}` };
    }
    const xml = await res.text();
    const items = parseRssXml(xml, author);
    return { items };
  } catch (e) {
    return { items: [], error: e instanceof Error ? e.message : "Fetch failed" };
  }
}
__name(fetchRssFeed, "fetchRssFeed");
function parseRssUrls(config) {
  if (!config || !config.trim()) return [];
  return config.split(",").map((s) => {
    const t = s.trim();
    const pipe = t.indexOf("|");
    if (pipe >= 0) {
      return { url: t.slice(0, pipe).trim(), author: t.slice(pipe + 1).trim() || "Twitter" };
    }
    const m = t.match(/\/([^/]+)\/rss$/i);
    return { url: t, author: m ? m[1] : "Twitter" };
  }).filter((x) => x.url);
}
__name(parseRssUrls, "parseRssUrls");
async function fetchTwitterTweets(rssUrlsConfig) {
  const sources = parseRssUrls(rssUrlsConfig);
  const all = [];
  const diagnostics = [];
  for (const { url, author } of sources) {
    const { items, error } = await fetchRssFeed(url, author);
    diagnostics.push({ url, author, count: items.length, error });
    all.push(...items);
  }
  const seen = /* @__PURE__ */ new Set();
  const deduped = all.filter((t) => {
    const key = t.text.slice(0, 100);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { items: deduped, diagnostics };
}
__name(fetchTwitterTweets, "fetchTwitterTweets");

// src/services/ai.ts
init_checked_fetch();
init_modules_watch_stub();
async function checkNewsRelevance(text2, playerNames, apiKey) {
  if (!apiKey || !apiKey.trim()) return null;
  if (playerNames.length === 0) return null;
  const prompt = `You are a fantasy football assistant. Given this sports news or tweet, determine which of the listed NFL players this news is RELEVANT to for fantasy purposes.

RELEVANT means: injury/status update, performance, role change, trade, contract, lineup decision, snap count, targets, or other news that directly affects that player's fantasy value.
NOT RELEVANT: player is only mentioned in passing (e.g., "Team A beat Team B" where the player is just on the losing side), or the news is about someone else entirely.

News/tweet:
"""
${text2.slice(0, 600)}
"""

Players mentioned (check each for relevance): ${playerNames.join(", ")}

Respond with ONLY valid JSON, no other text:
{"relevantPlayerNames": ["Name1", "Name2"], "summary": "One sentence fantasy-relevant summary of this news"}

Rules: relevantPlayerNames must be a subset of the listed players. summary must be 1-2 sentences. If no players are relevant, use empty array [].`;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
        temperature: 0.2
      }),
      signal: AbortSignal.timeout(1e4)
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("OpenAI API error:", res.status, err);
      return null;
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return null;
    const jsonStr = content.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(jsonStr);
    if (!parsed || !Array.isArray(parsed.relevantPlayerNames)) {
      return null;
    }
    parsed.summary = (parsed.summary || "").trim() || text2.slice(0, 150);
    return parsed;
  } catch (e) {
    console.error("AI relevance check error:", e instanceof Error ? e.message : "Unknown error");
    return null;
  }
}
__name(checkNewsRelevance, "checkNewsRelevance");

// src/routes/admin.ts
var adminRoutes = new Hono2();
adminRoutes.use("*", async (c, next) => {
  const syncSecret = c.env.SYNC_SECRET;
  if (!syncSecret) {
    return c.json({ error: "SYNC_SECRET not configured" }, 500);
  }
  const adminKey = c.req.header("X-Admin-Key");
  if (adminKey !== syncSecret) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});
adminRoutes.post("/sync-players", async (c) => {
  const db = c.get("db");
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
    const invalidPlayers = await db.query.nflPlayers.findMany({
      where: or(
        inArray(nflPlayers.externalId, ["Invalid", "0"]),
        eq(nflPlayers.name, "Player Invalid")
      ),
      columns: { id: true }
    });
    let cleaned = 0;
    for (const p of invalidPlayers) {
      await db.delete(rosterSpots).where(eq(rosterSpots.playerId, p.id));
      await db.update(transactions).set({ playerId: null }).where(eq(transactions.playerId, p.id));
      await db.update(transactions).set({ dropPlayerId: null }).where(eq(transactions.dropPlayerId, p.id));
      await db.update(tradeItems).set({ playerId: null }).where(eq(tradeItems.playerId, p.id));
      await db.delete(nflPlayers).where(eq(nflPlayers.id, p.id));
      cleaned++;
    }
    return c.json({
      success: true,
      message: "Player sync completed",
      inserted,
      updated,
      cleaned,
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
adminRoutes.post("/sync-headshots", async (c) => {
  const db = c.get("db");
  try {
    const raw2 = await fetchSleeperPlayers();
    let updated = 0;
    for (const [sleeperId, player] of Object.entries(raw2)) {
      const headshotUrl = buildHeadshotUrl(player, sleeperId);
      if (headshotUrl == null) continue;
      const existing = await db.query.nflPlayers.findFirst({
        where: eq(nflPlayers.externalId, sleeperId)
      });
      if (existing && existing.headshotUrl !== headshotUrl) {
        await db.update(nflPlayers).set({ headshotUrl, updatedAt: /* @__PURE__ */ new Date() }).where(eq(nflPlayers.id, existing.id));
        updated++;
      }
    }
    return c.json({
      success: true,
      message: "Headshot sync completed",
      updated
    });
  } catch (err) {
    console.error("Sync headshots error:", err);
    return c.json(
      {
        error: "Sync failed",
        message: err instanceof Error ? err.message : "Unknown error"
      },
      500
    );
  }
});
adminRoutes.post("/sync-news", async (c) => {
  const db = c.get("db");
  try {
    const raw2 = await fetchSleeperPlayers();
    const INJURY_STATUSES = /* @__PURE__ */ new Set(["out", "doubtful", "questionable", "ir", "injured_reserve", "inactive", "probable"]);
    const EXCLUDED_STATUSES = /* @__PURE__ */ new Set(["invalid"]);
    let inserted = 0;
    for (const [sleeperId, p] of Object.entries(raw2)) {
      if (!p) continue;
      const injuryStatus = (p.injury_status || "").toLowerCase();
      const injuryNotes = (p.injury_notes || "").trim();
      const injuryBodyPart = (p.injury_body_part || "").trim();
      const status = (p.status || "").toLowerCase();
      if (EXCLUDED_STATUSES.has(injuryStatus) || EXCLUDED_STATUSES.has(status)) continue;
      const hasMeaningfulStatus = INJURY_STATUSES.has(injuryStatus) || INJURY_STATUSES.has(status) || injuryNotes.length > 0 || injuryBodyPart.length > 0;
      if (!hasMeaningfulStatus) continue;
      const existingPlayer = await db.query.nflPlayers.findFirst({
        where: eq(nflPlayers.externalId, sleeperId)
      });
      if (!existingPlayer) continue;
      const isInactiveOnly = (injuryStatus === "inactive" || status === "inactive") && injuryNotes.length === 0 && injuryBodyPart.length === 0;
      if (isInactiveOnly) {
        await db.delete(playerNews).where(
          and(
            eq(playerNews.playerId, existingPlayer.id),
            eq(playerNews.source, "Sleeper")
          )
        );
        continue;
      }
      const name = p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Player";
      const statusLabel = injuryStatus || status || "Update";
      const headline = injuryNotes.length > 0 ? `${name} - ${statusLabel}: ${injuryNotes}` : injuryBodyPart.length > 0 ? `${name} - ${statusLabel} (${injuryBodyPart})` : `${name} - ${statusLabel}`;
      const content = injuryNotes.length > 0 ? injuryNotes : injuryBodyPart.length > 0 ? `${name} is listed as ${statusLabel}, ${injuryBodyPart}.` : `${name} is listed as ${statusLabel}.`;
      const impactLevel = injuryStatus === "out" || injuryStatus === "ir" || status === "injured_reserve" || status === "ir" ? "high" : injuryStatus === "doubtful" || injuryStatus === "questionable" ? "medium" : "low";
      const newsUpdated = p.news_updated;
      const publishedAt = newsUpdated ? new Date(typeof newsUpdated === "number" ? newsUpdated : parseInt(String(newsUpdated), 10) || Date.now()) : /* @__PURE__ */ new Date();
      await db.delete(playerNews).where(
        and(
          eq(playerNews.playerId, existingPlayer.id),
          eq(playerNews.source, "Sleeper")
        )
      );
      await db.insert(playerNews).values({
        id: generateId(),
        playerId: existingPlayer.id,
        headline,
        content,
        source: "Sleeper",
        sourceUrl: null,
        impactLevel,
        publishedAt
      });
      inserted++;
    }
    return c.json({
      success: true,
      message: "News sync completed",
      inserted
    });
  } catch (err) {
    console.error("Sync news error:", err);
    return c.json(
      {
        error: "Sync failed",
        message: err instanceof Error ? err.message : "Unknown error"
      },
      500
    );
  }
});
adminRoutes.post("/sync-twitter-news", async (c) => {
  const db = c.get("db");
  const rssUrls = c.env.TWITTER_RSS_URLS;
  if (!rssUrls || !rssUrls.trim()) {
    return c.json({
      error: "TWITTER_RSS_URLS not configured",
      message: "Set TWITTER_RSS_URLS in wrangler.toml or secrets (comma-separated RSS URLs, e.g. https://nitter.net/AdamSchefter/rss)"
    }, 400);
  }
  try {
    const { items: tweets, diagnostics } = await fetchTwitterTweets(rssUrls);
    const allPlayers = await db.query.nflPlayers.findMany({ columns: { id: true, name: true, position: true } });
    const playersByNameLength = [...allPlayers].filter((p) => p.position && p.position !== "DEF").sort((a, b) => (b.name?.length ?? 0) - (a.name?.length ?? 0));
    let inserted = 0;
    let skipped = 0;
    const seen = /* @__PURE__ */ new Set();
    const openaiKey = c.env.OPENAI_API_KEY;
    const useAi = !!openaiKey?.trim();
    const MAX_ITEM_LENGTH = 800;
    for (const tweet of tweets) {
      if (tweet.text.length > MAX_ITEM_LENGTH) continue;
      if (!tweet.url || !tweet.url.trim()) continue;
      const text2 = tweet.text.toLowerCase();
      const textStart = text2.slice(0, 400);
      const mentionedPlayers = [];
      for (const player of playersByNameLength) {
        const name = player.name?.trim();
        if (!name || name.length < 4) continue;
        if (!text2.includes(name.toLowerCase())) continue;
        if (!textStart.includes(name.toLowerCase())) continue;
        const key = `${player.id}:${tweet.text.slice(0, 80)}`;
        if (seen.has(key)) continue;
        mentionedPlayers.push({ id: player.id, name });
      }
      if (mentionedPlayers.length === 0) continue;
      let playersToInsert = mentionedPlayers;
      let aiSummary = null;
      if (useAi) {
        const result = await checkNewsRelevance(
          tweet.text,
          mentionedPlayers.map((p) => p.name),
          openaiKey
        );
        if (result) {
          const relevantSet = new Set(result.relevantPlayerNames.map((n) => n.trim().toLowerCase()));
          playersToInsert = mentionedPlayers.filter(
            (p) => relevantSet.has(p.name.trim().toLowerCase())
          );
          aiSummary = result.summary || null;
        }
      }
      for (const player of playersToInsert) {
        const key = `${player.id}:${tweet.text.slice(0, 80)}`;
        seen.add(key);
        const existingEntry = await db.query.playerNews.findFirst({
          where: and(
            eq(playerNews.sourceUrl, tweet.url),
            eq(playerNews.playerId, player.id)
          ),
          columns: { id: true }
        });
        if (existingEntry) {
          skipped++;
          continue;
        }
        const headline = tweet.text.length > 150 ? tweet.text.slice(0, 147) + "..." : tweet.text;
        await db.insert(playerNews).values({
          id: generateId(),
          playerId: player.id,
          headline,
          content: tweet.text,
          source: tweet.author || "Twitter",
          sourceUrl: tweet.url,
          aiSummary,
          impactLevel: "medium",
          publishedAt: tweet.publishedAt
        });
        inserted++;
      }
    }
    return c.json({
      success: true,
      message: "Sports news sync completed",
      itemsFetched: tweets.length,
      inserted,
      skipped,
      diagnostics,
      aiFiltering: useAi
    });
  } catch (err) {
    console.error("Sync twitter news error:", err);
    return c.json(
      {
        error: "Sync failed",
        message: err instanceof Error ? err.message : "Unknown error"
      },
      500
    );
  }
});
adminRoutes.post("/sync-games", async (c) => {
  const db = c.get("db");
  try {
    let body = {};
    try {
      const raw2 = await c.req.json();
      body = raw2 && typeof raw2 === "object" ? raw2 : {};
    } catch {
    }
    const { getNflSeasonContext: getNflSeasonContext2, fetchEspnScoreboard: fetchEspnScoreboard2 } = await Promise.resolve().then(() => (init_espn(), espn_exports));
    const ctx = getNflSeasonContext2();
    const seasonYear = body.seasonYear ?? ctx.season;
    if (seasonYear < 2e3 || seasonYear > 2100) {
      return c.json({ error: "Invalid season year" }, 400);
    }
    const weeks = body.weeks ?? Array.from({ length: 18 }, (_, i) => i + 1);
    if (!Array.isArray(weeks) || weeks.length > 22 || weeks.some((w) => typeof w !== "number" || w < 1 || w > 22)) {
      return c.json({ error: "Invalid weeks array" }, 400);
    }
    const seasontype = body.weeks ? "2" : ctx.seasontype;
    let inserted = 0;
    let updated = 0;
    for (const week2 of weeks) {
      try {
        const { dbRows } = await fetchEspnScoreboard2(week2, seasonYear, seasontype);
        for (const row of dbRows) {
          const existing = await db.query.nflGames.findFirst({
            where: eq(nflGames.id, row.id)
          });
          const hasScores = row.homeScore != null && row.awayScore != null;
          const values = {
            id: row.id,
            externalId: row.id,
            week: row.week,
            seasonYear: row.seasonYear,
            seasonType: row.seasonType,
            homeTeam: row.homeTeam,
            awayTeam: row.awayTeam,
            gameTime: row.gameTime,
            spread: row.spread,
            overUnder: row.overUnder,
            tvNetwork: row.tvNetwork,
            stadium: row.stadium,
            weather: row.weather,
            homeScore: row.homeScore ?? null,
            awayScore: row.awayScore ?? null,
            isComplete: hasScores
          };
          if (existing) {
            if (!existing.isComplete && (existing.spread != null || existing.overUnder != null)) {
              await db.insert(gameLineSnapshots).values({
                id: crypto.randomUUID(),
                gameId: row.id,
                snapshotAt: /* @__PURE__ */ new Date(),
                spread: existing.spread ?? null,
                overUnder: existing.overUnder ?? null
              });
            }
            await db.update(nflGames).set(values).where(eq(nflGames.id, row.id));
            updated++;
          } else {
            await db.insert(nflGames).values(values);
            inserted++;
          }
        }
      } catch (e) {
        console.error(`Failed to sync week ${week2}:`, e);
      }
    }
    return c.json({
      success: true,
      message: "Games sync completed",
      seasonYear,
      weeks: weeks.length,
      inserted,
      updated
    });
  } catch (err) {
    console.error("Sync games error:", err);
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
  try {
    let body = {};
    try {
      const raw2 = await c.req.json();
      body = raw2 && typeof raw2 === "object" ? raw2 : {};
    } catch {
    }
    const now = /* @__PURE__ */ new Date();
    const defaultSeason = now.getMonth() <= 6 ? now.getFullYear() - 1 : now.getFullYear();
    const seasonYear = body.seasonYear ?? defaultSeason;
    if (seasonYear < 2e3 || seasonYear > 2100) {
      return c.json({ error: "Invalid season year" }, 400);
    }
    const maxWeeks = body.weeks ?? 18;
    if (typeof maxWeeks !== "number" || maxWeeks < 1 || maxWeeks > 22) {
      return c.json({ error: "Invalid weeks value" }, 400);
    }
    let statsImported = 0;
    let statsUpdated = 0;
    for (let week2 = 1; week2 <= maxWeeks; week2++) {
      try {
        if (week2 > 1) await sleep(150);
        const statsResponse = await fetch(
          `https://api.sleeper.com/stats/nfl/${seasonYear}/${week2}?season_type=regular`
        );
        if (!statsResponse.ok) {
          console.log(`No stats available for week ${week2} (HTTP ${statsResponse.status})`);
          continue;
        }
        const raw2 = await statsResponse.json();
        const weekEntries = [];
        if (Array.isArray(raw2)) {
          for (const item of raw2) {
            const pid = item?.player_id;
            if (!pid) continue;
            const s = item.stats || {};
            weekEntries.push({
              sleeperPlayerId: String(pid),
              playerStats: { ...s, opponent: item.opponent }
            });
          }
        } else if (raw2 && typeof raw2 === "object") {
          for (const sleeperPlayerId of Object.keys(raw2)) {
            const playerStats = raw2[sleeperPlayerId];
            if (playerStats) weekEntries.push({ sleeperPlayerId, playerStats });
          }
        }
        for (const { sleeperPlayerId, playerStats } of weekEntries) {
          const player = await db.query.nflPlayers.findFirst({
            where: eq(nflPlayers.externalId, sleeperPlayerId)
          });
          if (!player) continue;
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
            offSnaps: Math.round(playerStats.off_snp || 0),
            defSnaps: Math.round(playerStats.def_snp || 0),
            stSnaps: Math.round(playerStats.st_snp || 0),
            tmOffSnaps: Math.round(playerStats.tm_off_snp || 0),
            tmDefSnaps: Math.round(playerStats.tm_def_snp || 0),
            tmStSnaps: Math.round(playerStats.tm_st_snp || 0),
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
              id: generateId(),
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
adminRoutes.post("/sync-projections", async (c) => {
  const db = c.get("db");
  try {
    let body = {};
    try {
      const raw2 = await c.req.json();
      body = raw2 && typeof raw2 === "object" ? raw2 : {};
    } catch {
    }
    let currentWeek = body.week;
    if (!currentWeek) {
      const anyLeague = await db.query.leagues.findFirst({
        columns: { currentWeek: true },
        orderBy: /* @__PURE__ */ __name((leagues2, { desc: desc2 }) => [desc2(leagues2.updatedAt)], "orderBy")
      });
      currentWeek = anyLeague?.currentWeek || 1;
    }
    const seasonYear = body.seasonYear ?? (/* @__PURE__ */ new Date()).getFullYear();
    const scoringFormats = body.scoringFormats ?? ["ppr", "half_ppr", "standard"];
    let inserted = 0;
    let updated = 0;
    const projResponse = await fetch(
      `https://api.sleeper.com/projections/nfl/${seasonYear}/${currentWeek}?season_type=regular`
    );
    if (!projResponse.ok) {
      return c.json({
        success: false,
        error: `Sleeper projections API returned ${projResponse.status}`
      }, 502);
    }
    const projections = await projResponse.json();
    const allPlayers = await db.query.nflPlayers.findMany({
      columns: { id: true, externalId: true }
    });
    const playerByExtId = new Map(
      allPlayers.filter((p) => p.externalId).map((p) => [p.externalId, p.id])
    );
    for (const [sleeperPlayerId, playerProj] of Object.entries(projections)) {
      if (!playerProj) continue;
      const playerId = playerByExtId.get(sleeperPlayerId);
      if (!playerId) continue;
      for (const scoringFormat of scoringFormats) {
        const projectedPoints = scoringFormat === "ppr" ? playerProj.pts_ppr || 0 : scoringFormat === "half_ppr" ? playerProj.pts_half_ppr || 0 : playerProj.pts_std || 0;
        if (projectedPoints === 0 && !playerProj.pass_yd && !playerProj.rush_yd && !playerProj.rec_yd) continue;
        const dbFormat = scoringFormat === "half_ppr" ? "half-ppr" : scoringFormat;
        const existingProj = await db.query.playerProjections.findFirst({
          where: and(
            eq(playerProjections.playerId, playerId),
            eq(playerProjections.week, currentWeek),
            eq(playerProjections.seasonYear, seasonYear),
            eq(playerProjections.scoringFormat, dbFormat)
          )
        });
        const projData = {
          playerId,
          week: currentWeek,
          seasonYear,
          scoringFormat: dbFormat,
          projectedPoints,
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
          updated++;
        } else {
          await db.insert(playerProjections).values({
            id: generateId(),
            ...projData
          });
          inserted++;
        }
      }
    }
    return c.json({
      success: true,
      message: "Projections sync completed",
      seasonYear,
      week: currentWeek,
      scoringFormats,
      inserted,
      updated,
      total: inserted + updated
    });
  } catch (err) {
    console.error("Sync projections error:", err);
    return c.json(
      {
        error: "Sync failed",
        message: err instanceof Error ? err.message : "Unknown error"
      },
      500
    );
  }
});

// src/routes/feedback.ts
init_checked_fetch();
init_modules_watch_stub();
init_dist();
init_schema();
init_auth();
var feedbackRoutes = new Hono2();
feedbackRoutes.post("/", optionalAuthMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();
    const { type, message: message2, email, page } = body;
    if (!type || !message2) {
      return c.json({ error: "Type and message are required" }, 400);
    }
    const validTypes = ["bug", "feature", "general"];
    if (!validTypes.includes(type)) {
      return c.json({ error: "Invalid feedback type" }, 400);
    }
    if (message2.length < 10) {
      return c.json({ error: "Message must be at least 10 characters" }, 400);
    }
    if (message2.length > 5e3) {
      return c.json({ error: "Message must be less than 5000 characters" }, 400);
    }
    const db = c.get("db");
    const userAgent = c.req.header("User-Agent") || null;
    const feedbackId = generateId();
    const trimmedMessage = message2.trim();
    const trimmedEmail = email?.trim() || null;
    await db.insert(userFeedback).values({
      id: feedbackId,
      userId: user?.id || null,
      type,
      message: trimmedMessage,
      email: trimmedEmail,
      page: page || null,
      userAgent,
      status: "new"
    });
    const resendKey = c.env.RESEND_API_KEY;
    const feedbackEmail = c.env.FEEDBACK_EMAIL;
    if (resendKey && feedbackEmail) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: "FilmRoom <noreply@filmroomfantasy.com>",
            to: feedbackEmail,
            subject: `[FilmRoom Feedback] ${type.charAt(0).toUpperCase() + type.slice(1)} \u2014 ${trimmedMessage.slice(0, 60)}`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px;">
                <h2 style="color: #2563eb;">New Feedback Received</h2>
                <table style="border-collapse: collapse; width: 100%;">
                  <tr><td style="padding: 8px; font-weight: bold; color: #64748b;">Type</td><td style="padding: 8px;">${type}</td></tr>
                  <tr><td style="padding: 8px; font-weight: bold; color: #64748b;">From</td><td style="padding: 8px;">${user?.username || "Anonymous"}${trimmedEmail ? ` (${trimmedEmail})` : ""}</td></tr>
                  <tr><td style="padding: 8px; font-weight: bold; color: #64748b;">Page</td><td style="padding: 8px;">${page || "N/A"}</td></tr>
                </table>
                <div style="margin-top: 16px; padding: 16px; background: #f1f5f9; border-radius: 8px;">
                  <p style="margin: 0; white-space: pre-wrap;">${trimmedMessage}</p>
                </div>
                <p style="margin-top: 16px; color: #94a3b8; font-size: 12px;">Feedback ID: ${feedbackId}</p>
              </div>
            `
          })
        });
      } catch (emailErr) {
        console.error("[Feedback] Failed to send email notification:", emailErr);
      }
    }
    return c.json({
      success: true,
      message: "Thank you for your feedback!",
      feedbackId
    }, 201);
  } catch {
    return c.json({ error: "Failed to submit feedback" }, 500);
  }
});

// src/index.ts
init_yahoo();
var app = new Hono2();
app.use("*", logger());
app.use("*", async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set("requestId", requestId);
  c.header("X-Request-Id", requestId);
  console.log(`[${requestId}] ${c.req.method} ${c.req.path}`);
  await next();
});
var allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:5173"
];
app.use("*", cors({
  origin: /* @__PURE__ */ __name((origin, _c) => {
    if (!origin) return allowedOrigins[0];
    if (allowedOrigins.includes(origin)) return origin;
    if (origin.endsWith(".pages.dev") || origin.endsWith(".cloudflarepages.com") || origin.endsWith(".workers.dev")) return origin;
    return allowedOrigins[0];
  }, "origin"),
  allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));
app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-XSS-Protection", "1; mode=block");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  if (c.env.ENVIRONMENT === "production") {
    c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    // Tailwind uses inline styles
    "img-src 'self' https://sleepercdn.com https://a.espncdn.com https://*.googleusercontent.com data: blob:",
    "font-src 'self'",
    "connect-src 'self' https://accounts.google.com https://api.sleeper.app",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ];
  c.header("Content-Security-Policy", cspDirectives.join("; "));
});
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
app.route("/api/admin", adminRoutes);
app.route("/api/feedback", feedbackRoutes);
app.route("/api/yahoo", yahooRoutes);
app.notFound((c) => {
  return c.json({ error: "Not found", path: c.req.path }, 404);
});
app.onError((err, c) => {
  return c.json({
    error: "Internal server error",
    message: c.env.ENVIRONMENT === "development" ? err.message : void 0
  }, 500);
});
async function handleScheduled(event, env, ctx) {
  const baseUrl = "http://localhost";
  const headers = { "Content-Type": "application/json" };
  if (env.SYNC_SECRET) headers["X-Admin-Key"] = env.SYNC_SECRET;
  const callSync = /* @__PURE__ */ __name(async (path, body) => {
    const init = { method: "POST", headers };
    if (body) init.body = JSON.stringify(body);
    try {
      const res = await app.fetch(new Request(`${baseUrl}${path}`, init), env, ctx);
      const data = await res.json();
      console.log(`[cron] ${path}: ${data.message || "done"}`);
    } catch (err) {
      console.error(`[cron] ${path} failed:`, err);
    }
  }, "callSync");
  try {
    const deleted = await cleanupExpiredRateLimits(env.DB);
    if (deleted > 0) console.log(`[cron] Cleaned up ${deleted} expired rate limit entries`);
    const sessionResult = await env.DB.prepare(
      "DELETE FROM sessions WHERE expires_at <= ?1"
    ).bind(Date.now()).run();
    const sessionsDeleted = sessionResult.meta.changes ?? 0;
    if (sessionsDeleted > 0) console.log(`[cron] Cleaned up ${sessionsDeleted} expired sessions`);
  } catch (err) {
    console.error("[cron] Cleanup failed:", err);
  }
  if (event.cron === "0 6 * * *") {
    await callSync("/api/admin/sync-players");
    await callSync("/api/admin/sync-news");
    await callSync("/api/admin/sync-games");
  } else if (event.cron === "0 */4 * * *") {
    await callSync("/api/admin/sync-stats");
    await callSync("/api/admin/sync-projections");
  } else if (event.cron === "0 */6 * * *") {
    await callSync("/api/admin/sync-twitter-news");
  }
}
__name(handleScheduled, "handleScheduled");
var src_default = {
  fetch: app.fetch,
  scheduled: handleScheduled
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
init_checked_fetch();
init_modules_watch_stub();
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
init_checked_fetch();
init_modules_watch_stub();
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

// .wrangler/tmp/bundle-n6Y6qc/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
init_checked_fetch();
init_modules_watch_stub();
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

// .wrangler/tmp/bundle-n6Y6qc/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
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
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
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
