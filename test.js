;(function() {

  var socket = new require('net').Socket()
    , Buffer = require('buffer');

  socket.connect(3333);

  socket.on('connect', function() {
    var options = { location: 'http://www.chuckpreslar.com', asset_types: ['img', 'link', 'script'], iterations: 2 };
    socket.write(JSON.stringify(options));
  });

  socket.on('data', function(data) {
    console.log(JSON.parse(data));
  });

}())