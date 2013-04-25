"use strict";

var error    = require("./error");
var Util     = require("./util");

var proto = {
    sendError: function(err, block, msg, callback) {
        Util.log(err, block, msg.user, "error");
        if (typeof err == "string")
            err = new error.InternalServerError(err);
        if (callback)
            callback(err);
    }
};

var Handler = module.exports = function(client) {
  this.client = client;
  this.routes = client.routes;
};

Handler.prototype = proto;