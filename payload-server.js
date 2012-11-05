;(function() {

  var net = require('net')
    , Buffer = require('buffer')
    , domain = require('domain')
    , Payload = require('./libs/payload')
    , serverDomain = domain.create();

  serverDomain.run(function() {
    var server = net.createServer(function(connection) {

      console.log('Client connected');

      var connectionDomain = domain.create();
          connectionDomain.add(connection);

      connection.on('data', function(data) {
        try {
          var payload = new Payload()
            , data = JSON.parse(data);
          console.log('Data received:\n', data);
          if(typeof payload[data.method] !== 'undfined') {
            payload[data.method](data.location, data.asset_types, data.iterations || 1, function(err, results) {
              console.log('Sending results');
              connection.write(JSON.stringify(results));
            });
          } else {
            connection.write(JSON.stringify({ err: new Error('Invalid operation') }));
          }
        } catch(e) {
          // Handle errors caused by handling connection
          connection.destroy();
          connectionDomain.dispose();
        }
      });

      // Dispose of domain on connection close
      connection.on('close', function() { connectionDomain.dispose() });

    }).listen(3333, function() { console.log('Payload server listening on port 3333') });

  });

  serverDomain.on('error', function(err) {
    console.log('The server encountered an error:\n', err)
  });

}())