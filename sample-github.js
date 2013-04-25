var Braque = require('./index');

var github = new Braque({

    // required
    version: '1.0.0',

    routeFile: './apis/github-v3.0.0.json',

    // optional
    timeout:  5000,

    // host: 'localhost',
    // port: 3000,
    // protocol: 'http',
    // debug:    true,
});

// github.authenticate({

//     // type: "basic",
//     // username: username,
//     // password: password

//     // Legacy API Key
//     // ----------------------
//     // type:    'apikey',
//     // api_key: 'XXXXXXX'

//     // XAuth
//     // --------------------
//     // type: 'xauth',
//     // consumer_key:    'XXXX',
//     // consumer_secret: 'XXXX',

//     // access_token: 'XXXXX',
//     // access_token_secret: 'XXXX',

// });

github.repos.get( { user: 'd1b1', repo: 'node-braque' }, function(err, repo) {
  if (err) return console.log(err);

  console.log(repo);
});