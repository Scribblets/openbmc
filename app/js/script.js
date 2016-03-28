//script.js
require('electron-cookies');

var _ipc    = window.require('electron').ipcRenderer;
var openbmc = angular.module('openbmc', ['ngRoute', 'ngResource', 'ngCookies', 'ngSanitize']);

var win = require('remote').getCurrentWindow();

// configure routes
openbmc.config(function($routeProvider, $httpProvider) {
  $routeProvider

  // route for the home page
  .when('/', {
    templateUrl: 'pages/login.html',
    controller: 'mainController'
  })

  // route for the login page
  .when('/login', {
    templateUrl: 'pages/login.html',
    controller: 'mainController'
  })

  // route for the app
  .when('/app', {
    templateUrl: 'pages/app.html',
    controller: 'appController'
  });

  $httpProvider.defaults.withCredentials = true;
});

openbmc.controller('mainController', function($rootScope, $scope, $http, $cookies, $location) {
  _ipc.send('resize', 396, 445);

  $scope.loginError = false;
  $scope.message = 'This is the login page!';
  $scope.regex = '^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$';

  $scope.expandWindow = function() {
    console.log("Expand the window!");
    _ipc.send('resize', 600, 800);
  };

  $scope.authenticateExternalIP = function() {
    console.log("CLICKED");
    require("shell").openExternal($scope.ipAddress);
  }

  $scope.login = function() {
    console.log("Form was submitted! Here's the data:");
    console.log($scope.ipAddress);
    console.log($scope.port);
    console.log($scope.username);
    console.log($scope.password);

    // $http.jsonp("http://9.41.164.53:10080/login?callback=?")
    // .then(function(json) {
    //   console.log(json);
    // });

    var ip = $scope.ipAddress;

    if($scope.port) {
      ip = $scope.ipAddress + ':' + $scope.port;
    }

    var startTime = new Date().getTime();

    $http({
      // url: 'http://9.41.164.53:10080/login',
      url: 'http://' + ip + '/login',
      method: 'POST',
      data: JSON.stringify({"data": [$scope.username, $scope.password]}),
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000,
    }).success(function(response) {

      if(typeof response != 'object') {
        console.log("AUTH ERROR");
        $scope.loginError = true;
        $scope.errorMessage = 'Cannot bypass firewall on <b>' + $scope.ipAddress + '</b>';
        return;
      }

      console.log(response);
      console.log(response.data);

      if(response.data === 'Invalid username or password') {
        // Error: Credentials Incorrect
        $scope.loginError = true;
        $scope.errorMessage = "Username or password was incorrect";
        console.error('Username or password was incorrect');
      } else {
        console.log('Logged in as ' + $scope.username);
        // Success!
        $scope.error = false;
        $rootScope.ip = $scope.ipAddress;
        $rootScope.user = $scope.username;
        $location.path('/app');
      }
      // I need to set the cookie here!
    }).error(function(result, status, header, config) {
      var respTime = new Date().getTime() - startTime;
      if(respTime >= config.timeout) {
        $scope.loginError = true;
        $scope.errorMessage = "Could not connect to " + ip;
        console.error('Could not connect to ' + ip);
      } else {
        $scope.loginError = true;
        $scope.errorMessage = "An unknown error occurred.";
        console.error('An unknown error occurred. See details:');
        console.log(result, status, header, config);
      }
    });
  }
});

openbmc.controller('appController', function($rootScope, $scope, $http, $location) {
  _ipc.send('resize', 1008, 617);
  _ipc.send('toggleResizable', true);

  $http({
    url: 'http://' + $rootScope.ip + ':20080/list',
    method: 'GET',
    headers: {
      'Content-Type' : 'application/json'
    }
  }).success(function(response) {
    console.log(response);

    $scope.paths = parsePathArray(response.data);
    $scope.navigate('/');
  }).error(function(error) {
    console.log(error);
  });

  // console.log($rootScope.user);
  // console.log($rootScope.ip);

  $scope.navigate = function(path) {
    $scope.currentPath = path;
    $scope.prettyPath = $scope.currentPath.split('/').join(' / ');
    $scope.options = getChildren($scope.currentPath);
    $scope.breadcrumb = getBreadcrumbs($scope.currentPath);
  }

  $scope.back = function() {
    var previous = $scope.currentPath.split('/');
    previous.pop();
    previous = previous.join('/');
    $scope.navigate(previous);
  }

  $scope.openGithub = function() {
    require("shell").openExternal("http://www.github.com/openbmc");
  }

  $scope.signout = function() {
    $location.path('/login');
    _ipc.send('toggleResizable', false);
  }

  function parsePathArray(paths) {
    var parsed = {};
    for(var i = 0; i < paths.length; i++) {
      var position = parsed;
      var split = paths[i].split('/');
      for(var j = 0; j < split.length; j++) {
        if(split[j] !== "") {
          if(typeof position[split[j]] === 'undefined') {
            position[split[j]] = {};
          }

          position = position[split[j]];
        }
      }
    }

    return parsed;
  }

  function getChildren(path) {
    var split = path.split('/');
    var position = $scope.paths;

    for (var i = 0; i < split.length; i++) {
      if(split[i] != "") {
        position = position[split[i]];
      }
    }

    var options = [];

    for (var key in position) {
      if(path === '/') {
        options.push({
          name: key,
          path: path + key,
          active: false
        });
      } else {
        options.push({
          name: key,
          path: path + '/' + key,
          active: false
        });
      }
    }
    // if(options.isEmpty()) {
    //   console.log("OPTIONS EMPTY");
    // }

    // getSchema($rootScope.ip, '20080', path);

    if(options.length === 0) {
      // Get Schema
      console.log("====================");
      console.log("SHOW SCHEMA!");
      console.log("====================");

      getSchema($rootScope.ip, '20080', path);

      options = $scope.options;
      for(var j = 0; j < options.length; j++) {
        options[j]['active'] = false;

        if(options[j].path === path) {
          options[j]['active'] = true;
        }
      }
    }

    return options;
    //console.log(position);
  }

  function getSchema(ip, port, path) {
    var query = 'http://' + ip + ':' + port + path + '/schema';
    console.log('Running schema on... ' + query);
    $http({
      url: query,
      method: 'GET',
      headers: {
        'Content-Type' : 'application/json'
      }
    }).success(function(response) {
      console.log(response.data);
      for (var key in response.data) {
        // Focus on methods, disregard signals for now
        // each object under method names is a parameter, so create an input
        // 'name' is the name of the parameter
        // before worrying about functions, present a list of methods
        console.log(key);
      }
    }).error(function(error) {
      console.log(error);
    });
  }

  function getBreadcrumbs(str) {
    var p = str.split('/');
    p.splice(0, 1);

    return p;
  }
});
