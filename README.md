node-braque
===========

Node.js API abstracter. Provides a simple way to implement and consume any API; github, twitter, etc. This
project grow out of the patterns in the ajaxorg/node-github project. This projects lets a developer implement
all or parts of other APIs without the need for more API specific packages.

### Install
To install this package use the following

```
  npm install braque

  or 

  npm install git@github.com:d1b1/node-braque.git#master
```

### Implementation of Github
The following is an example of how to implement the github API using the sample route file.

Simple version using no Authentication.

```
  var Braque = require('braque');

  var github = new Braque({
    version: '3.0.0',
    routeFile: './apis/github-v3.0.0.json',
  });

  github.repos.get( { user: 'd1b1', 'node-braque' }, function(err, repo) {
    if (err) return console.log(err);

    console.log(repo);
  });

```

With Username and Password Authentcation.

```
  var Braque = require('braque');

  var github = new Braque({
    version: '3.0.0',
    routeFile: './apis/github-v3.0.0.json',
  });

  github.authenticate({
    type: "basic",
    username: 'XXXXXXXXXX',
    password: 'XXXXXXXXXX'
  });

  github.repos.get( { user: 'd1b1', 'node-braque' }, function(err, repo) {
    if (err) return console.log(err);
    
    console.log(repo);
  });

```

### Coming Soon

1. Adding the twitter routes file.
2. Adding the google geocoder routes file.
3. Abstracting the Auth pattern to allow for custom Auth Handlers.
4. Tests
5. Code assists. Looking for a way to generate local docs files to speed up development.

### Route file format
The route file provides the glue for any API abstraction. It tells braque about the endpoint infomation, protocal
validation requirements and finally the routes. The code attempts to make separate the API endpoint groups into 
local groups. It will camelCase all function calls.

For example 'pull-requests/get-all' becomes github.pullRequest.getAll();

### Attribution
This project grew out of the work on several other projects; node-ci and its implementations of the node-github project and 
the formagg.io API. I needed the ability to implement our API in client consumer applications. We needed to have a consistent 
authentication pattern, error handling and documentation. The node.js github API project provided the pattern. It provides
a node developer with a simple pattern to use when there is a need to integrate github into an larger feature set. The node-ci
server needed the ability to interact with specific portions of the github api. Once I started work on the formagg.io the github
pattern was a logic place to start.

Thanks [ajaxorg]|https://github.com/ajaxorg

