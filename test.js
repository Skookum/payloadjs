;(function() {

  var socket = new require('net').Socket()
    , Buffer = require('buffer');

  socket.connect(3333);

  socket.on('connect', function() {
    var options = { method: 'flood', location: 'http://www.chuckpreslar.com', asset_types: ['images', 'css', 'scripts'], iterations: 1 };
    socket.write(JSON.stringify(options));
  });

  socket.on('data', function(data) {
    console.log(JSON.parse(data)[0].assets.images);
  });

}())