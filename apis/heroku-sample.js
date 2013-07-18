var Braque = require("braque");

var heroku = new Braque({
  version: "1.0.0",
  routeFile: "./heroku-v1.0.0.json",
  debug: true
});

// Implements a custom Auth.

heroku.authenticate({
  type: "custom",
  token: process.env.HEROKU_API,
  custom: function(res) {
  	return "Basic " + new Buffer(":" + (process.env.HEROKU_API)).toString("base64");
  }
});

// Get all the Apps associated with a given API.

heroku.apps.all({}, function(err, data) {
  console.log(data);
});
