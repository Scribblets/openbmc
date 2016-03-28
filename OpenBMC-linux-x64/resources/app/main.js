'use strict';

const _ipcMain = require('electron').ipcMain;

var app = require('app');
var BrowserWindow = require('browser-window');

var mainWindow = null;

// CODE FOR THE SERVER
// var http = require('http');
// var fs = require('fs');
// var path = require('path');
// var mime = require('mime');
//
// function handleRequest(req, res) {
//   var file = path.join(app.getPathApp(), req.url);
//
//   fs.exists(file, function(exists) {
//     if(exists && fs.lstatSync(file).isFile()) {
//       res.setHeader("Content-Type", mime.lookup(file));
//       res.writeHead(200, {
//         'Access-Control-Allow-Origin' : '*'
//       });
//       fs.createReadStream(file).pipe(res);
//
//       return;
//     }
//
//     res.writeHead(404);
//     res.write('404 Not Found');
//     res.end();
//   });
// }
//
// var server = http.createServer(handleRequest);
// server.listen(8888, function() {
//   console.log('Server started at http://localhost:8888');
// });

app.on('ready', function() {
  mainWindow = new BrowserWindow({
      width: 396,
      height: 445,
      titleBarStyle: 'hidden'//,
      // resizable: false
  });

  mainWindow.loadURL('file://' + __dirname + '/app/index.html');
  mainWindow.setResizable(false);
  mainWindow.setMaximizable(false);
  mainWindow.setMinimizable(false);
  var session = mainWindow.webContents.session;
});

app.on('window-all-closed', app.quit);

_ipcMain.on('resize', function(event, width, height) {
  mainWindow.setSize(width, height);
  mainWindow.center();
});

_ipcMain.on('toggleResizable', function(event, boolean) {
  mainWindow.setResizable(boolean);
  mainWindow.setMaximizable(boolean);
  mainWindow.setMinimizable(boolean);

  if(boolean) {
    mainWindow.setMinimumSize(800, 550);
  } else {
    mainWindow.setMinimumSize(396, 445);
  }
});
