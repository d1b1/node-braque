var _ = require('underscore');
var Crypto = require('crypto');

exports.normalizeParams = function(paramDict) {
    
  var sortedParamKeys = _.sortBy(_.keys(paramDict), function(key) {
    return key;
  });

  var encodedParamArray = [];
  _.each(sortedParamKeys, function(key) {
      encodedParamArray.push( encodeURIComponent(key) + "=" + encodeURIComponent(paramDict[key]) );
  });

  return encodedParamArray.join('&');
}

exports.getRandomInt = function(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

exports.normalizeURL = function(uri) {
  var parts = uri.split('?');
  return parts[0];
}

exports.uid = function(len) {

  var buf = []
    , chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    , charlen = chars.length;

  for (var i = 0; i < len; ++i) {
    buf.push(chars[exports.getRandomInt(0, charlen - 1)]);
  }

  return buf.join('');
};

exports.getTime = function() {
 return (new Date()).getTime();
}

exports.hmacsha1 = function(key, text) {
  return Crypto.createHmac('sha1', key).update(text).digest('base64')
}

/**
 * Construct base string by encoding and concatenating components.
 *
 * References:
 *  - [String Construction](http://tools.ietf.org/html/rfc5849#section-3.4.1.1)
 *  - [Concatenate Request Elements](http://oauth.net/core/1.0a/#anchor13)
 *  - [Concatenate Request Elements](http://oauth.net/core/1.0/#anchor14)
 *
 * @param {String} method
 * @param {String} uri
 * @param {String} params
 * @api private
 */
exports.constructBaseString = function(method, uri, params) {
  return [ method.toUpperCase(), exports.encode(uri), exports.encode(params) ].join('&');
}

/**
 * Percent-encodes `str` per RFC 3986.
 *
 * References:
 *  - [Percent Encoding](http://tools.ietf.org/html/rfc5849#section-3.6)
 *  - [Parameter Encoding](http://oauth.net/core/1.0a/#encoding_parameters)
 *  - [Parameter Encoding](http://oauth.net/core/1.0/#encoding_parameters)
 *
 * @param {String} str
 * @api private
 */
exports.encode = function(str) {
  return encodeURIComponent(str)
    .replace(/!/g,'%21')
    .replace(/'/g,'%27')
    .replace(/\(/g,'%28')
    .replace(/\)/g,'%29')
    .replace(/\*/g,'%2A');
}

exports.normalizeURI =
exports.normalizeURL = function(uri) {

  var parts = uri.split('?');
  return parts[0];
}

exports.getQueryParamsFromURL = function(theURL) {

  var params = {};
  var parts = theURL.split('?');
  var paramSegments = null;

  if (parts.length === 2) {
     paramSegments = parts[1].split('&');
     _.each(paramSegments, function addSegmentToObject(segment) {
       var segmentParts = segment.split('=');
       params[segmentParts[0]] = segmentParts[1];
     });
  }

  return params;
}

exports.signRequest = function(params, options) {

  var signature = null;
  if (!options.method) {
      options.method = 'POST';
  }
  
  switch (params.oauth_signature_method) {

      case 'PLAINTEXT':
          signature = (options.consumerSecret + '%26');
          if (options.tokenSecret) {
              signature += options.tokenSecret;
          }
          break;

      case 'HMAC-SHA1':
          debugger;

          var queryParams = exports.getQueryParamsFromURL(options.url);
          if (_.size(queryParams) > 0) {
            params = _.extend(queryParams, params);
          }

          var normalizedURL    = exports.normalizeURI(options.url);                        
          var normalizedParams = exports.normalizeParams(params);

          var base = exports.constructBaseString(options.method, normalizedURL, normalizedParams);
          var key  = exports.encode(options.consumerSecret) + '&';

          if (options.tokenSecret) {
            debugger;
            key += exports.encode(options.tokenSecret);
          }
          
          signature = exports.hmacsha1(key, base);
              
          console.log('');
          console.log('DEBUG: NormalizedURL', normalizedURL);
          console.log('DEBUG: NormalizedParams', normalizedParams);
          console.log('DEBUG: ConsumerSecret', options.consumerSecret);
          console.log('DEBUG: key', key);
          console.log('DEBUG: base', base);
          console.log('DEBUG: signature', signature);
          console.log('')
          break;
  }

  return signature;
}
