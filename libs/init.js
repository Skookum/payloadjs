;(function() {
  var page = require('webpage').create()
    , system = require('system');

  page.onResourceReceived = function (request) {

    console.log(JSON.stringify({ 
        location: request.url
      , mime: request.contentType
    }) + '*');

  }

  page.open(system.args[1], function(status) {
    phantom.exit();
  });
  
}())