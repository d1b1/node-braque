Braque
===========

Node.js API abstracter. Provides a simple way to implement and consume any API; github, twitter, etc. This
project grow out of the patterns in the ajaxorg/node-github project. This projects lets a developer implement
all or parts of other APIs without the need for more API specific packages.

Goals:
* Fewer API specific NPM dependencies.
* Standardized HTTP/HTTPS best practices for external APIs.
* Easier to share API version with consumers.
* Smaller codebases on Heroku.

### Available APIs
The following is a list of APIs available in in the APIS folder.

* Github v 3.0 API
* Twitter v 1.1 API

If you have an API file to add feel free to email or make a pull request.

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

  // Auth Object is object that will be passed to the 
  // authentication function. When working with express
  // and passport, used req.user. Your auth function can
  // then sign or alter the header to comply with the
  // designer endpoint authentication strategy.

  github.repos.get( { user: 'd1b1', 'node-braque' }, req.user, function(err, repo) {
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

Custom Authentication Callback - When an API needs to specific signing or
header values, this is the approach to use. Set the 

```
  var Braque = require('braque');

  var github = new Braque({
    version: '3.0.0',
    routeFile: './apis/github-v3.0.0.json',
    encode: true // Defauts to false. Escapes all body data. Requires reverse other end.
  });

  github.authenticate({
    type: "custom",

    /*
       This function runs after the request is build, but
       before it is transmitted. This provides for a late
       change to the header. 

       @Arguments:

        - api (Object) Self reference to generated API.
        - method (String) REST METHOD (get, post, put, delete etc)
        - url (String) Request URL
        - extras (String/Object): API call specific data that may be needed 
          in the auth callback. For example: User Profile 
          and/or Token Information.

        @return (String)

        @TODO This function needs to be rebuild
        to pass in the header and full request and
        all the function to change anything, data, url
        or header values. Currently only returns a value
        for Header.Authentication. 
    */

    custom: function(api, method, url, extras) {
      // Your Signing code.

      return 'aValue'
    }
  });

  github.repos.get( { user: 'd1b1', 'node-braque' }, req.user, function(err, repo) {
    if (err) return console.log(err);
    
    console.log(repo);
  });

```

### Request Callbacks
Callbacks in the API call process are for custom changes needed for specific APIs.

The following is an example of a header callback that will run after the request
headers have been setup. It will allow the API implimentation to define a value 
needed by the Heroku API. This might need to get moved to the API route file.

```
  var heroku = new Braque({
    version: "2.0.0",
    routeFile: "./heroku/heroku.json",

    // Use callbacks to provide access to the request before it is send.
    callbacks: {
      header: function(headers) {
        headers.Accept= "application/vnd.heroku+json; version=3";
      }
    }
  });
```

### Error
Braque assumes either a string or an stringified error message. The error object contains a parsed version of the 
response when an error code is received. This provides the ability to send and manage json validation or error message. 
This is designed to keep the API callback dry and easy to read. 


```
  myAPI.user.get({ id: 1111}, auth, function(err, User) {
     if (err) 
       console.log(err.data)

     // err data  = JSON object. 

     console.log(User)
  })

```

### Coming Soon

1. Adding the twitter routes file.
2. Adding the google geocoder routes file.
3. Abstracting the Auth pattern to allow for custom Auth Handlers.
4. Tests
5. Code assists. Looking for a way to generate local docs files to speed up development.
6. Review the way the code handles APIs that expect query values. 
7. Swagger Route file generator.
8. Add docs for the 'file' parameter type. 
9. Add better output for params.
10. Fix the GET method to allow the auto addition of URL query values when the path includes existing query values. Makes it easier to package GET calls.
11. Adding the Formagg.io Cheese API route file.
12. Add a sample site to outline documentation and usage and promote the abstraction and the artist.

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

Thanks [ajaxorg]https://github.com/ajaxorg

[![NPM](https://nodei.co/npm/braque.png?stars&downloads)](https://nodei.co/npm/braque/) [![NPM](https://nodei.co/npm-dl/braque.png)](https://nodei.co/npm/braque/)



