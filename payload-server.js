;(function() {

  var net = require('net')
    , Buffer = require('buffer')
    , Payload = require('./libs/payload');

  var server = net.createServer(function(connection) {
    console.log('Client connected');
    connection.on('data', function(data) {
      var payload = new Payload()
        , data = JSON.parse(data);
      console.log('Data received - ', data);
      if(typeof payload[data.method] !== 'undfined') {
        payload[data.method](data.location, data.asset_types, data.iterations || 1, function(err, results) {
          console.log('Sending results');
          connection.write(JSON.stringify(results));
        });
      } else {
        connection.write(JSON.stringify({ err: 'Invalid operation' }));
      }
    });
  });

  server.listen(3333, function() { console.log('Payload server listening on port 3333') });

}())