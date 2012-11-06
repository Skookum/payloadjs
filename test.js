;(function() {

  var socket = new require('net').Socket()
    , Buffer = require('buffer');

  socket.connect(3333);

  socket.on('connect', function() {
    var options = { method: 'flood', location: 'http://www.chuckpreslar.com', asset_types: ['images', 'css', 'scripts'], iterations: 10 };
    socket.write(JSON.stringify(options));
  });

  socket.on('data', function(data) {
    try {
      console.log(JSON.parse(data));
    } catch(e) {
      console.log(data.toString());
    }
  });

}())