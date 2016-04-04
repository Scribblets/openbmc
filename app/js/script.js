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
  console.log(navigator.platform);
  _ipc.send('resize', 396, 445);

  $scope.loginError = false;
  $scope.regex = '^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$';

  $scope.login = function() {
    var ip = $scope.ipAddress;

    if($scope.port) {
      ip = ip + ':' + $scope.port;
    }

    var startTime = new Date().getTime();

    $http({
      url: 'http://' + ip + '/list',
      method: 'GET',
      timeout: 5000,
      headers: {
        'Content-Type' : 'application/json'
      }
    }).success(function(response) {

      // Firewall Error
      if(typeof response != 'object') {
        $scope.loginError = true;
        $scope.errorMessage = 'Cannot bypass firewall on <b>' + $scope.ipAddress + '</b>';
        return;
      }

      $rootScope.ip = ip;
      $rootScope.user = $scope.username;

      $scope.error = false;
      $location.path('/app');
    }).error(function(result, status, header, config) {
      // Firewall Error
      if(typeof response != 'object') {
        $scope.loginError = true;
        $scope.errorMessage = 'Connection to <b>' + $scope.ipAddress + '</b> was refused.';
        return;
      }

      var respTime = new Date().getTime() - startTime;

      // Timeout Error (Probably incorrect IP)
      if(respTime >= config.timeout) {
          $scope.loginError = true;
          $scope.errorMessage = "Could not connect to " + ip;
        } else {
          $scope.loginError = true;
          $scope.errorMessage = "An unknown error occurred.";
        }
    });

    // Insert Login Block Here
  }
});

openbmc.controller('appController', function($rootScope, $scope, $http, $location) {
  _ipc.send('resize', 1008, 617);
  _ipc.send('toggleResizable', true);

  // Update the scope data
  $scope.update = function(currentPath) {
    $http({
      url: 'http://' + $rootScope.ip + '/list',
      method: 'GET',
      headers: {
        'Content-Type' : 'application/json'
      }
    }).success(function(response) {
      var p = parsePathArray(response.data);

      // Run if the current path is root
      // OR if the currentPath has been changed
      if(
        currentPath === '/' ||
        $scope.currentPath && $scope.currentPath != currentPath
      ) {
        $scope.paths = p;
        $scope.navigate(currentPath);

      // Runs if the paths array (in response.data) was updated
      } else if (
        response.data.indexOf(currentPath) > -1 &&
        $scope.paths &&
        $scope.paths != p
      ) {
        $scope.paths = p;
        $scope.options = getChildren($scope.currentPath);
      }
    }).error(function(error) {
      // There was an error making the request. Please try again.
      // console.log(error);
    });
  }

  $scope.update('/');

  $scope.navigate = function(path) {
    if(path != '/') {
      $scope.lastPath = path.split('/');
      $scope.lastPath = $scope.lastPath[$scope.lastPath.length - 1];
      $scope.lastPath = $scope.lastPath.charAt(0).toUpperCase() + $scope.lastPath.slice(1);
      console.log("Last Path" + $scope.lastPath);
      if($scope.lastPath === '') {
        $scope.lastPath = 'Root';
      }
    } else {
      $scope.lastPath = 'Root';
    }
    $scope.currentPath = path;
    $scope.prettyPath = $scope.currentPath.split('/').join(' / ');
    $scope.options = getChildren($scope.currentPath);
    $scope.breadcrumb = getBreadcrumbs($scope.currentPath);
    $scope.methods = [];
    $scope.properties = [];
    getSchema($rootScope.ip, path);

    if(path != '/' && path != '') {
      getProperties($rootScope.ip, path);
    }
  }

  $scope.back = function() {
    var previous = $scope.currentPath.split('/');
    previous.pop();
    previous = previous.join('/');
    $scope.update(previous);
  }

  $scope.openGithub = function() {
    require("shell").openExternal("http://www.github.com/openbmc");
  }

  $scope.signout = function() {
    $location.path('/login');
    _ipc.send('toggleResizable', false);
  }

  $scope.toggleMethod = function(method) {
    if(method.collapsed === false) {
      method.collapsed = true;
    } else {
      method.collapsed = false;
    }
  }

  $scope.runMethod = function(method) {
    if(method.parameters.length > 0) {
      var data = [];

      for (var i = 0; i < method.parameters.length; i++) {
        data.push(method.parameters[i].value);
      }

      $http({
        url: 'http://' + $rootScope.ip + $scope.currentPath + '/action/' + method.name,
        method: 'POST',
        data: JSON.stringify({"data": data}),
        headers: {'Content-Type': 'application/json'}
      }).success(function(response) {
        method.showResponse = true;
        method.response = JSON.stringify(response, null, 4);
        $scope.update($scope.currentPath);
      }).error(function(response) {
        method.showResponse = true;
        method.response = JSON.stringify(response, null, 4);
        $scope.update($scope.currentPath);
      });
    } else {
      $http({
        url: 'http://' + $rootScope.ip + $scope.currentPath + '/action/' + method.name,
        method: 'POST',
        data: {"data": []},
        headers: {'Content-Type': 'application/json'}
      }).success(function(response) {
        method.showResponse = true;
        method.response = JSON.stringify(response, null, 4);
        $scope.update($scope.currentPath);
      }).error(function(response) {
        method.showResponse = true;
        method.response = JSON.stringify(response, null, 4);
        $scope.update($scope.currentPath);
      });
    }
  }

  $scope.getDataType = function(type) {
    if(type === 'y') { return 'byte'; }
    else if(type === 'b') { return 'boolean' }
    else if(type === 'n') { return 'int16' }
    else if(type === 'q') { return 'uint16' }
    else if(type === 'i') { return 'int32' }
    else if(type === 'u') { return 'uint32' }
    else if(type === 'x') { return 'int64' }
    else if(type === 't') { return 'uint64' }
    else if(type === 'd') { return 'double' }
    else if(type === 'h') { return 'unix fd' }
    else if(type === 's') { return 'string' }
    else if(type === 'o') { return 'object path' }
    else if(type === 'g') { return 'signature' }
    else if(type === 'a') { return 'array' }
    else if(type.indexOf('(') != -1) { return 'struct'}
    else if(type.indexOf('a') != -1) { return 'array' }
    else { return 'undefined'}
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

    // order options
    console.log(options);

    return options;
  }

  function getProperties(ip, path) {
    var query = 'http://' + ip + path;
    $http({
      url: query,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }).success(function(response) {
      // Data should be object, not array...
      if(
        typeof response.data === 'object' &&
        Object.keys(response.data).length > 0
      ) {
          // Properties are available
          var properties = [];
          for (var key in response.data) {
            // response.data[key];
            var p = {
              'name': key,
              'value': JSON.stringify(response.data[key], null, 4),
              'collapsed': true
            }

            properties.push(p);
          }

          $scope.properties = properties;
      }
    });
  }

  function getSchema(ip, path) {
    var query = 'http://' + ip + path + '/schema';
    $http({
      url: query,
      method: 'GET',
      headers: {
        'Content-Type' : 'application/json'
      }
    }).success(function(response) {
      var methods = [];
      for (var key in response.data) {
        // Right now, we're just focusing on the list of
        // openbmc methods that are available
        if(key.indexOf('openbmc') > -1) {
          // Inside the method object are multiple arrays.
          // The keys of the arrays are the name of the method (from the selected openbmc interface).
          // The array itself is a list of objects that are the parameters for the method.
          // --- An input is created for each parameter.
          // Each parameter object contains three properties: direction, name, and type.
          // --- Direction (in / out) indicates the type of output from the server.
          // --- The name, is the name of the paramter.
          // --- The type is the datatype for the paramter.
          //     (Reference: https://dbus.freedesktop.org/doc/dbus-specification.html#type-system )

          // This is looping over each method
          for(var method in response.data[key].method) {

            // Create a better object to store the method data
            var m = {
              'name' : method,
              'hideParams': true,
              'parameters' : [],
              'response' : '',
              'showResponse': false
            };

            // This is looping over the parameters for each method
            for(var i = 0; i < response.data[key].method[method].length; i++) {

              // Create a better object to store the parameter data
              var paramObject = {};

              // If the direction of the parameter is 'in', add it to our array
              // of parameters in the method object.
              if(response.data[key].method[method][i].direction == 'in') {
                paramObject['type'] = $scope.getDataType(response.data[key].method[method][i].type);
                paramObject['index'] = response.data[key].method[method][i];
                paramObject['value'] = '';
                m.parameters.push(paramObject);
              }
            }

            // If the method doesn't have any parameters, just hide the section
            if(m.parameters.length == 0) {
              m['hideParams'] = true;
            } else {
              m['hideParams'] = false;
            }

            // Make sure all the panels start in a collapsed state
            m['collapsed'] = true;

            // Finished creating the method object.
            // Push it to the methods array.
            methods.push(m);
          }
        }
      }

      // Bind methods array to scope
      $scope.methods = methods;
    }).error(function(error) {
      // There are no methods for this url
      // We don't need to do anything here.
    });
  }

  function getBreadcrumbs(str) {
    var p = str.split('/');
    p.splice(0, 1);

    return p;
  }
});


// Login Block (Currently Disabled)
// $http({
//   url: 'http://' + ip + '/login',
//   method: 'POST',
//   data: JSON.stringify({"data": [$scope.username, $scope.password]}),
//   withCredentials: true,
//   headers: {
//     'Content-Type': 'application/json'
//   },
//   timeout: 5000,
// }).success(function(response) {
//
//   if(typeof response != 'object') {
//     console.log("AUTH ERROR");
//     $scope.loginError = true;
//     $scope.errorMessage = 'Cannot bypass firewall on <b>' + $scope.ipAddress + '</b>';
//     return;
//   }
//
//   console.log(response);
//   console.log(response.data);
//
//   if(response.data === 'Invalid username or password') {
//     // Error: Credentials Incorrect
//     $scope.loginError = true;
//     $scope.errorMessage = "Username or password was incorrect";
//     console.error('Username or password was incorrect');
//   } else {
//     console.log('Logged in as ' + $scope.username);
//     // Success!
//     $scope.error = false;
//     $rootScope.ip = $scope.ipAddress;
//     $rootScope.user = $scope.username;
//     $location.path('/app');
//   }
//   // I need to set the cookie here!
// }).error(function(result, status, header, config) {
//   var respTime = new Date().getTime() - startTime;
//   if(respTime >= config.timeout) {
//     $scope.loginError = true;
//     $scope.errorMessage = "Could not connect to " + ip;
//     console.error('Could not connect to ' + ip);
//   } else {
//     $scope.loginError = true;
//     $scope.errorMessage = "An unknown error occurred.";
//     console.error('An unknown error occurred. See details:');
//     console.log(result, status, header, config);
//   }
// });
