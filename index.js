"use strict";

var Url      = require('url');
var Fs       = require('fs');
var _        = require('underscore');

var error    = require('./lib/error');
var Util     = require('./lib/util');
var authUtil = require('./lib/authUtil');
var customHandler = require('./lib/handler');
var oauth = require('./lib/oauth').oauth;

var Client = module.exports = function(config) {
   this.config = config;
   this.debug = Util.isTrue(config.debug);

   this.callbacks = config.callbacks || {};
   this.version = config.version;

   this.routes  = JSON.parse(Fs.readFileSync(config.routeFile, 'utf8'));;
   this[this.version] = new customHandler(this);;

   _.each(this.routes, function(api, name) {
     if (name != 'defines') {

         var groupName = Util.toCamelCase(name);

         var newAPI = module.exports = {};
         _.each(api, function(settings, fnName) {

             var funcName = Util.toCamelCase(fnName);

             newAPI[funcName] = function(msg, block, extras, callback) {
               var self = this;
               this.client.httpSend(msg, block, extras, function(err, res) {
                   if (err) return self.sendError(err, null, msg, callback);

                   var ret;
                   try {
                       ret = res.data && JSON.parse(res.data);
                   }
                   catch (ex) {
                     if (callback) callback(new error.InternalServerError(ex.message), res);
                     return;
                   }

                   if (!ret) ret = {};
                   if (!ret.meta) ret.meta = {};
                   ["x-ratelimit-limit", "x-ratelimit-remaining", "x-oauth-scopes", "link"].forEach(function(header) {
                       if (res.headers[header]) ret.meta[header] = res.headers[header];
                   });
                   if (callback) callback(null, ret);
               });
           };
         });

         var apiObj = {};
         apiObj[groupName] = newAPI;

         Util.extend(customHandler.prototype, apiObj);
     }
   });

   this.setupRoutes();
};

(function() {
   /**
    *  Client#setupRoutes() -> null
    *
    *  Configures the routes as defined in a routes.json file of an API version
    *
    *  [[Client#setupRoutes]] is invoked by the constructor, takes the
    *  contents of the JSON document that contains the definitions of all the
    *  available API routes and iterates over them.
    *
    *  It first recurses through each definition block until it reaches an API
    *  endpoint. It knows that an endpoint is found when the `url` and `param`
    *  definitions are found as a direct member of a definition block.
    *  Then the availability of an implementation by the API is checked; if it's
    *  not present, this means that a portion of the API as defined in the routes.json
    *  file is not implemented properly, thus an exception is thrown.
    *  After this check, a method is attached to the [[Client]] instance
    *  and becomes available for use. Inside this method, the parameter validation
    *  and typecasting is done, according to the definition of the parameters in
    *  the `params` block, upon invocation.
    *
    *  This mechanism ensures that the handlers ALWAYS receive normalized data
    *  that is of the correct format and type. JSON parameters are parsed, Strings
    *  are trimmed, Numbers and Floats are casted and checked for NaN after that.
    *
    *  Note: Query escaping for usage with SQL products is something that can be
    *  implemented additionally by adding an additional parameter type.
    **/
   this.setupRoutes = function() {
       var self = this;
       var api = this[this.version];

       var routes = api.routes;
       var defines = routes.defines;
       this.constants = defines.constants;
       delete routes.defines;

       function trim(s) {
           if (typeof s != "string")
               return s;
           return s.replace(/^[\s\t\r\n]+/, "").replace(/[\s\t\r\n]+$/, "");
       }

       function parseParams(msg, paramsStruct) {
           var params = Object.keys(paramsStruct);
           var paramName, def, value, type;
           for (var i = 0, l = params.length; i < l; ++i) {
               paramName = params[i];
               if (paramName.charAt(0) == "$") {
                   paramName = paramName.substr(1);
                   if (!defines.params[paramName]) {
                       throw new error.BadRequest("Invalid variable parameter name substitution; param '" +
                           paramName + "' not found in defines block", "fatal");
                   }
                   else
                       def = defines.params[paramName];
               }
               else
                   def = paramsStruct[paramName];

               value = trim(msg[paramName]);
               if (typeof value != "boolean" && !value) {
                   // we don't need to validation for undefined parameter values
                   // that are not required.
                   if (!def.required)
                       continue;
                   throw new error.BadRequest("Empty value for parameter '" +
                       paramName + "': " + value);
               }

               // validate the value and type of parameter:
               if (def.validation) {
                   if (!new RegExp(def.validation).test(value)) {
                       throw new error.BadRequest("Invalid value for parameter '" +
                           paramName + "': " + value);
                   }
               }

               if (def.type) {
                   type = def.type.toLowerCase();
                   if (type == "number") {
                       value = parseInt(value, 10);
                       if (isNaN(value)) {
                           throw new error.BadRequest("Invalid value for parameter '" +
                               paramName + "': " + msg[paramName] + " is NaN");
                       }
                   }
                   else if (type == "float") {
                       value = parseFloat(value);
                       if (isNaN(value)) {
                           throw new error.BadRequest("Invalid value for parameter '" +
                               paramName + "': " + msg[paramName] + " is NaN");
                       }
                   }
                   else if (type == "file") {
                       // value = parseFloat(value);
                       // if (isNaN(value)) {
                       //     throw new error.BadRequest("Invalid value for parameter '" +
                       //         paramName + "': " + msg[paramName] + " is NaN");
                       // }
                   }
                   else if (type == "json") {
                       if (typeof value == "string") {
                           try {
                               value = JSON.parse(value);
                           }
                           catch(ex) {
                               throw new error.BadRequest("JSON parse error of value for parameter '" +
                                   paramName + "': " + value);
                           }
                       }
                   }
                   else if (type == "date") {
                       value = new Date(value);
                   }
               }
               msg[paramName] = value;
           }
       }

       function prepareApi(struct, baseType) {
           if (!baseType)
               baseType = "";
           Object.keys(struct).forEach(function(routePart) {
               var block = struct[routePart];
               if (!block)
                   return;
               var messageType = baseType + "/" + routePart;
               if (block.url && block.params) {
                   // we ended up at an API definition part!
                   var endPoint = messageType.replace(/^[\/]+/g, "");
                   var parts = messageType.split("/");
                   var section = Util.toCamelCase(parts[1].toLowerCase());
                   parts.splice(0, 2);
                   var funcName = Util.toCamelCase(parts.join("-"));

                   if (!api[section]) {
                       throw new Error("Unsupported route section, not implemented in version " +
                           self.version + " for route '" + endPoint + "' and block: " +
                           JSON.stringify(block));
                   }

                   if (!api[section][funcName]) {
                       console.log(section, funcName);
                       if (self.debug)
                           Util.log("Tried to call " + funcName);
                       throw new Error("Unsupported route, not implemented in version " +
                           self.version + " for route '" + endPoint + "' and block: " +
                           JSON.stringify(block));
                   }

                   if (!self[section]) {
                       self[section] = {};
                       // add a utility function 'getFooApi()', which returns the
                       // section to which functions are attached.
                       self[Util.toCamelCase("get-" + section + "-api")] = function() {
                           return self[section];
                       };
                   }

                   // Note:
                   // Arguments for API calls
                   //  1. msg (({}) - key value fail for data.
                   //  2. extras (Optional) - provides route to pass in extra options.
                   //  3. callback (Required) - Provides the callback function.

                   self[section][funcName] = function(msg, extras, callback) {
                       try {
                           parseParams(msg, block.params);
                       }
                       catch (ex) {
                           // when the message was sent to the client, we can
                           // reply with the error directly.
                           api.sendError(ex, block, msg, callback);
                           if (self.debug)
                               Util.log(ex.message, "fatal");
                           // on error, there's no need to continue.
                           return;
                       }

                       // Extras is optional, and allows the user to pass in local
                       // scope and overrides for sigining. For example pass in 
                       // session for us in the signing code.

                       // SSMITH - Do not pass a function callback for the extras
                       // as it will f things up.
                       if (typeof extras == 'function') {
                         callback = extras;
                         extras = {};
                       }

                       api[section][funcName].call(api, msg, block, extras, callback);
                   };
               }
               else {
                   // recurse into this block next:
                   prepareApi(block, messageType);
               }
           });
       }

       prepareApi(routes);
   };

   /**
    *  Client#authenticate(options) -> null
    *      - options (Object): Object containing the authentication type and credentials
    *          - type (String): One of the following: `basic` or `oauth`
    *          - username (String): Github username
    *          - password (String): Password to your account
    *          - token (String): OAuth2 token
    *
    *  Set an authentication method to have access to protected resources.
    *
    *  ##### Example
    *
    *      // basic
    *      github.authenticate({
    *          type: "basic",
    *          username: "mikedeboertest",
    *          password: "test1324"
    *      });
    *
    *      // or oauth
    *      github.authenticate({
    *          type: "oauth",
    *          token: "e5a4a27487c26e571892846366de023349321a73"
    *      });
    **/
   this.authenticate = function(options) {
       if (!options) {
           this.auth = false;
           return;
       }

       if (!options.type || "basic|oauth|xauth|custom".indexOf(options.type) === -1)
           throw new Error("Invalid authentication type, must be 'basic', 'oauth', 'xauth', 'custom'.");

       if (options.type == "basic" && (!options.username || !options.password))
           throw new Error("Basic authentication requires both a username and password to be set");

       if (options.type == "xauth" && (!options.consumer_key || !options.consumer_secret))
           throw new Error("XAuth authentication requires both an Consumer Key and Consumer Secret to be set");

       if (options.type == "oauth" && !options.token)
           throw new Error("OAuth2 authentication requires a token to be set");

       this.auth = options;
   };

   function getPageLinks(link) {
       if (typeof link == "object" && (link.link || link.meta.link))
           link = link.link || link.meta.link;

       var links = {};
       if (typeof link != "string")
           return links;

       // link format:
       // '<https://api.github.com/users/aseemk/followers?page=2>; rel="next", <https://api.github.com/users/aseemk/followers?page=2>; rel="last"'
       link.replace(/<([^>]*)>;\s*rel="([\w]*)\"/g, function(m, uri, type) {
           links[type] = uri;
       });
       return links;
   }

   /**
    *  Client#hasNextPage(link) -> null
    *      - link (mixed): response of a request or the contents of the Link header
    *
    *  Check if a request result contains a link to the next page
    **/
   this.hasNextPage = function(link) {
       return getPageLinks(link).next;
   };

   /**
    *  Client#hasPreviousPage(link) -> null
    *      - link (mixed): response of a request or the contents of the Link header
    *
    *  Check if a request result contains a link to the previous page
    **/
   this.hasPreviousPage = function(link) {
       return getPageLinks(link).prev;
   };

   /**
    *  Client#hasLastPage(link) -> null
    *      - link (mixed): response of a request or the contents of the Link header
    *
    *  Check if a request result contains a link to the last page
    **/
   this.hasLastPage = function(link) {
       return getPageLinks(link).last;
   };

   /**
    *  Client#hasFirstPage(link) -> null
    *      - link (mixed): response of a request or the contents of the Link header
    *
    *  Check if a request result contains a link to the first page
    **/
   this.hasFirstPage = function(link) {
       return getPageLinks(link).first;
   };

   function getPage(link, which, callback) {
       var url = getPageLinks(link)[which];
       if (!url)
           return callback(new error.NotFound("No " + which + " page found"));

       var api = this[this.version];
       var parsedUrl = Url.parse(url, true);
       var block = {
           url: parsedUrl.pathname,
           method: "GET",
           params: parsedUrl.query
       };
       this.httpSend(parsedUrl.query, block, extras, function(err, res) {
           if (err)
               return api.sendError(err, null, parsedUrl.query, callback);

           var ret;
           try {
               ret = res.data && JSON.parse(res.data);
           }
           catch (ex) {
               if (callback)
                   callback(new error.InternalServerError(ex.message), res);
               return;
           }

           if (!ret)
               ret = {};
           if (!ret.meta)
               ret.meta = {};
           ["x-ratelimit-limit", "x-ratelimit-remaining", "link"].forEach(function(header) {
               if (res.headers[header])
                   ret.meta[header] = res.headers[header];
           });

           if (callback)
               callback(null, ret);
       });
   }

   /**
    *  Client#getNextPage(link, callback) -> null
    *      - link (mixed): response of a request or the contents of the Link header
    *      - callback (Function): function to call when the request is finished with an error as first argument and result data as second argument.
    *
    *  Get the next page, based on the contents of the `Link` header
    **/
   this.getNextPage = function(link, callback) {
       getPage.call(this, link, "next", callback);
   };

   /**
    *  Client#getPreviousPage(link, callback) -> null
    *      - link (mixed): response of a request or the contents of the Link header
    *      - callback (Function): function to call when the request is finished with an error as first argument and result data as second argument.
    *
    *  Get the previous page, based on the contents of the `Link` header
    **/
   this.getPreviousPage = function(link, callback) {
       getPage.call(this, link, "prev", callback);
   };

   /**
    *  Client#getLastPage(link, callback) -> null
    *      - link (mixed): response of a request or the contents of the Link header
    *      - callback (Function): function to call when the request is finished with an error as first argument and result data as second argument.
    *
    *  Get the last page, based on the contents of the `Link` header
    **/
   this.getLastPage = function(link, callback) {
       getPage.call(this, link, "last", callback);
   };

   /**
    *  Client#getFirstPage(link, callback) -> null
    *      - link (mixed): response of a request or the contents of the Link header
    *      - callback (Function): function to call when the request is finished with an error as first argument and result data as second argument.
    *
    *  Get the first page, based on the contents of the `Link` header
    **/
   this.getFirstPage = function(link, callback) {
       getPage.call(this, link, "first", callback);
   };

   function getQueryAndUrl(msg, def, format) {
       var ret = {
           url: def.url,
           query: format == "json" ? {} : []
       };
       if (!def || !def.params)
           return ret;
       var url = def.url;
       Object.keys(def.params).forEach(function(paramName) {
           paramName = paramName.replace(/^[$]+/, "");
           if (!(paramName in msg))
               return;

           var isUrlParam = url.indexOf(":" + paramName) !== -1;
           var valFormat = isUrlParam || format != "json" ? "query" : format;
           var val;
           if (valFormat != "json" && typeof msg[paramName] == "object") {
               try {
                   msg[paramName] = JSON.stringify(msg[paramName]);
                   val = encodeURIComponent(msg[paramName]);
               }
               catch (ex) {
                   return Util.log("httpSend: Error while converting object to JSON: "
                       + (ex.message || ex), "error");
               }
           }
           else
              val = valFormat == "json" ? msg[paramName] : encodeURIComponent(msg[paramName]);
  
           if (isUrlParam) {
               url = url.replace(":" + paramName, val);
           }
           else {
               if (format == "json")
                   ret.query[paramName] = val;
               else
                   ret.query.push(paramName + "=" + val);
           }
       });
       ret.url = url;
       return ret;
   }

   /**
    *  Client#httpSend(msg, block, callback) -> null
    *      - msg (Object): parameters to send as the request body
    *      - block (Object): parameter definition from the `routes.json` file that
    *          contains validation rules
    *      - extras (Object): parameters to give access to extra data; session etc.
    *      - callback (Function): function to be called when the request returns.
    *          If the the request returns with an error, the error is passed to
    *          the callback as its first argument (NodeJS-style).
    *
    *  Send an HTTP request to the server and pass the result to a callback.
    *  
    **/
   this.httpSend = function(msg, block, extras, callback) {

       var method = block.method.toLowerCase();
       var hasBody = ("head|get|delete".indexOf(method) === -1);
       var format = hasBody && this.constants.requestFormat
           ? this.constants.requestFormat
           : "query";
       var obj = getQueryAndUrl(msg, block, format);
       var query = obj.query;
       var url = this.config.url ? this.config.url + obj.url : obj.url;

       var path = (!hasBody && query.length)
           ? url + "?" + query.join("&")
           : url;

       var protocol = this.config.protocol || this.constants.protocol || "http";

       var host = this.config.host || this.constants.host;
       var port = this.config.port || this.constants.port || (protocol == "https" ? 443 : 80);
       if (this.config.proxy) {
           host = this.config.proxy.host;
           port = this.config.proxy.port || 3128;
       }

       var fullUrl = protocol + '://' + host + path;

       var headers = {
           "host": host,
           "user-agent": "NodeJS HTTP Client",
           "content-length": "0"
       };

       if (hasBody) {

           // Hack to remove the key value when we get a body value.
           // This allows us to have a more open body process. The heroku 
           // PATCH does not play well with a traditional key value option.

           // This solution will wipe other body values in the query.
           if (query.body) query = query.body;
           
           //-----------------------------------------
           // This hack handles the header for when we need to put in 
           // this is a hack and needs to be handled better.

           var form = null;
           if (query.files) {
              var FormData   = require('form-data');
              var fs = require('fs');
              form = new FormData();

              _.each(query.files, function(val, key) {
                console.log('file opt', key, val);
                // TODO: check the format of the val this might cause an error
                form.append(key, fs.createReadStream(val));
              });

              delete query.files;
              // Remove the files so they do not get attached to the body.
           }

           //-----------------------------------------

           if (format == "json")
               query = JSON.stringify(query);
           else
               query = query.join("&");

           if (form) {
             // Set the header from form.
             headers = form.getHeaders()
           } else {
             headers["content-length"] = query.length;
             headers["content-type"] = format == "json"
                 ? "application/json"
                 : "application/x-www-form-urlencoded";
           }
       }

       if (this.auth) {
           var basic;
           switch (this.auth.type) {
              case "custom": 
                   try{
                     headers.authorization = this.auth.custom(this, method, fullUrl, extras);
                   } catch(err) {
                     headers.authorization = "ERROR IN CUSTOM";
                   }
                   break;
              case "xauth":
                   // Update the Header with the required elements.

                   var params = {
                      oauth_nonce:            authUtil.uid(16),
                      oauth_timestamp:        authUtil.getTime(),
                      oauth_version:          '1.0',
                      oauth_consumer_key:     this.auth.consumer_key,
                      oauth_signature_method: 'HMAC-SHA1',      
                   };

                    if (this.auth.token) { 
                      params.oauth_token = this.auth.token;
                    }

                    var options = { 
                      method: method, 
                      url: fullUrl, 
                      consumerSecret: this.auth.consumer_secret  // Never shared. Only part of the signing process.
                    };

                    if (this.auth.token_secret) {
                      options.tokenSecret = this.auth.token_secret;
                    }                    

                    var authDict = {};
                    if (params.oauth_token) {
                      authDict['oauth_token']          = params.oauth_token;
                    }
                    authDict['oauth_version']          = params.oauth_version;
                    authDict['oauth_consumer_key']     = params.oauth_consumer_key;
                    authDict['oauth_signature_method'] = params.oauth_signature_method;
                    authDict['oauth_nonce']            = params.oauth_nonce;
                    authDict['oauth_timestamp']        = params.oauth_timestamp;

                    if (params.access_token && params.access_token_secret) { 
                      authDict.oauth_token = params.access_token;
                      authDict.oauth_token_secret = params.access_token_secret;
                    }

                    // Sign the header.
                    authDict['oauth_signature']        = authUtil.signRequest(params, options);

                    var paramArray = _.map(authDict, 
                        function convertPairTo2ElementArray(value, key) {
                            return [key, value];
                        });
                    var authHeaderValue = oauth.getAuthorizationHeader('', paramArray);

                    headers['authorization'] = authHeaderValue;

                    break;
               case "apikey":
                   path += (path.indexOf("?") === -1 ? "?" : "&") + "api_key=" + encodeURIComponent(this.auth.api_key);
                   break;
               case "oauth":
                   path += (path.indexOf("?") === -1 ? "?" : "&") + "access_token=" + encodeURIComponent(this.auth.token);
                   break;
               case "token":
                   basic = new Buffer(this.auth.username + "/token:" + this.auth.token, "ascii").toString("base64");
                   headers.authorization = "Basic " + basic;
                   break;
               case "basic":
                   basic = new Buffer(this.auth.username + ":" + this.auth.password, "ascii").toString("base64");
                   headers.authorization = "Basic " + basic;
                   break;
               default:
                   break;
           }
       }

       var options = {
           host: host,
           port: port,
           path: path,
           method: method,
           headers: headers
       };

       // If we have a header callback.
       if (this.callbacks && typeof this.callbacks.header == "function") {
         this.callbacks.header(headers);
       }

       if (this.debug)
           console.log("REQUEST: ", options);

       var self = this;
       var req = require(protocol).request(options, function(res) {
           if (self.debug) {
               console.log("STATUS: " + res.statusCode);
               console.log("HEADERS: " + JSON.stringify(res.headers));
           }
           res.setEncoding("utf8");
           var data = "";
           res.on("data", function(chunk) {
               data += chunk;
           });
           res.on("end", function() {
               if (res.statusCode >= 400 && res.statusCode < 600 || res.statusCode < 10) {
                   callback(new error.HttpError(data, res.statusCode));
               }
               else {
                   res.data = data;
                   callback(null, res);
               }
           });
       });

       if (this.config.timeout) {
           req.setTimeout(this.config.timeout);
       }

       req.on("error", function(e) {
           if (self.debug)
               console.log("problem with request: " + e.message);

           callback(e.message);
       });

       if (form) {
         console.log('ddddddddddddd')
         form.pipe(req);
       } else {

         // write data to request body
         if (hasBody && query.length) {
             if (self.debug)
                 console.log("REQUEST BODYTT: " + query + "\n");
             req.write(query + "\n");
         }

         req.end();      
       }

   };
}).call(Client.prototype);
