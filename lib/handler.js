"use strict";

var error    = require("./error");
var Util     = require("./util");

var proto = {
    sendError: function(err, block, msg, callback) {

        if (this.client.debug)
          Util.log(err, block, msg.user, "error");
        
        if (typeof err == "string")
            err = new error.InternalServerError(err);

        if (callback) {

          if (typeof err == "object") {
            try {
              err.data = JSON.parse(err.message);
            } catch(err) {
              err.data = err.message;
            }
          }

          callback(err);
        }
            
    }
};

var Handler = module.exports = function(client) {
  this.client = client;
  this.routes = client.routes;
};

Handler.prototype = proto;