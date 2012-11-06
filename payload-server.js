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

      connection.detonate = function() {
        connection.destroy();
        // connectionDomain.dispose(); <-- Not doing what I think it's doing
      }

      connection.on('data', function(data) {
        try {
          var payload = new Payload()
            , data = JSON.parse(data);

          console.log('Data received:\n', data);
          if(typeof payload[data.method] !== 'undfined') {
            payload[data.method](data.location, data.asset_types, data.iterations || 1, function(err, results) {
              if(err) connection.write(err.toString());
              else connection.write(JSON.stringify(results));
              // connection.write(err ? err.toString() : JSON.stringify(results));
            });
          } else {
            connection.write(JSON.stringify({ err: new Error('Invalid operation') }));
            connection.detonate();
          }
        } catch(err) {
          // Handle errors caused by handling connection
          console.log('There was an error processing the data:\n', err);
          connection.detonate();
        }
      });

      // Dispose of domain on connection close
      connection.on('close', function() {
        connection.detonate();
      });

      connectionDomain.on('error', function(err) {
        console.log('An error occured handling the connection\n', err.toString());
        connection.detonate();
      });

      /*
      connection.setTimeout(1000 * 60 * 2.5, function() { // The train leaves the station in 2.5 minutes
        console.log('Connection idle timeout expired');
        connection.detonate();
      });
      */

    }).listen(3333, function() { console.log('Payload server listening on port 3333') });

  });

  serverDomain.on('error', function(err) {
    console.log('The server encountered an error:\n', err)
  });

}())