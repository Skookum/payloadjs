;(function(global) {

  var path = require('path')
    , child = require('child_process')
    , async = require('async')
    , request = require('superagent')
    , _ = require('underscore');

  var Payload = (function() {

    function Payload() {}

    Payload.types = {
        'html': [
            'text/html'
        ]
      , 'css': [
            'text/css'
        ]
      , 'scripts': [
            'text/javascript'
          , 'application/javascript'
        ]
      , 'images': [
            'image/gif'
          , 'image/jpeg'
          , 'image/pjpeg'
          , 'image/png'
          , 'image/svg+xml'
          , 'image/tiff'
          , 'image/vnd.microsoft.icon'
        ]
      , 'videos': [
            'video/mpeg4'
          , 'video/mp4'
          , 'video/ogg'
          , 'video/quicktime'
          , 'video/webm'
          , 'video/x-matroska'
          , 'video/x-ms-wmv'
          , 'video/x-flv'
        ]
      , 'audios': [
            'audio/basic'
          , 'audio/L24'
          , 'audio/mp4'
          , 'audio/mpeg'
          , 'audio/ogg'
          , 'audio/vorbis'
          , 'audio/vnd.rn-realaudio'
          , 'audio/vnd.wave'
          , 'audio/webm'
        ]
      , 'application': []
      , 'fonts': []
      , 'icons': []
    };

    /**
     * Constructor for target location to test
     *
     * @constructor
     *
     * @param {String} location The URL of the target
     */
    Payload.target = function(location) {
      this.location = location;
      this.timing = {
          start: 0
        , end: 0
      };
      this.size = 0;
      this.assets = {};
    }

    Payload.target.prototype.clone = function() {

      function clone(target, original) {
        if(original instanceof Array)
          return original;
        if(toString.call(original) !== '[object Object]' || Object.keys(original).length === 0)
          return original;
        else {
          for(var property in original)
            target[property] = clone(target[property], original[property]);
          return target;
        }
      }

      return clone(new Payload.target(this.location), this)
    }

    /**
     * Constructor for a retrievable asset
     *
     * @constructor
     *
     * @param {String} type DOM Type associated with the asset
     * @param {String} location Location of the retrievable asset
     */
    Payload.asset = function(type, mime, location) {
      this.type = type;
      this.mime = mime;
      this.location = location;
      this.timing = {
          start: 0
        , end: 0
      }
      this.size = 0;
    }

    Payload.fn = Payload.prototype = {};

    /**
     * Ramps up request flooding
     *
     * @param {String} location The URL of the target location
     * @param {Array|String} asset_types Type of assets to request for
     * @param {Number} iterations Number of times to flood location
     * @param {Function} callback Callback to use after all requests have responded
     *    or an error has occured
     */
    Payload.fn.ramp = function(location, asset_types, iterations, callback) {
      var results = []
        , count = 0
        , self = this;

      var ramp = function(err, result) {
        if(!err && !result) return self.flood(location, asset_types, count + 1, ramp);
        if(err) return callback(err, null);
        results.push({ ramp: count + 1, results: result });
        if(++count === iterations) return callback(null, results);
        else return self.flood(location, asset_types, count + 1, ramp);
      }

      ramp();

    }

    /**
     * Floods the location with a series of requests
     *
     * @param {String} location The URL of the target location
     * @param {Array|String} asset_types Type of assets to request for
     * @param {Number} iterations Number of times to flood location
     * @param {Function} callback Callback to use after all requests have responded
     *    or an error has occured
     */
    Payload.fn.flood = function(location, asset_types, iterations, callback) {
      var results = [], self = this;

      async.forEach(_.range(iterations), function(i, done) {

        self.arm(location, asset_types, function(err, target) {
          self.unload(target, function(err, result) {
            results.push(result);  
            done(err);
          });
        });

      }, function(err) {
        return callback(err, results);
      });
    }

    /**
     * `Arms` a target with location details of all
     * target assets that are found within the asset_type parameter
     *
     * @param {String|Payload.target} location Location to drop request payload
     * @param {String|Array} asset_types Asset types to test load times for
     * @param {Function} callback Function to call once payload has been `armed`
     */
    Payload.fn.arm = function(location, asset_types, callback) {
      var target = location instanceof Payload.target ? location :
          new Payload.target(location.match('http') ? location : 'http://' + location)
        , self = this
        , checked = [];

      asset_types = asset_types instanceof Array ? asset_types : asset_types.split(',');

      var parseMime = function(mime_type) {
        for(var type in Payload.types)
          if(~Payload.types[type].indexOf(mime_type)) return type;
        return 'misc';
      }

      var phantom = child.spawn('phantomjs', [__dirname + '/init.js', location])
        , response_buffer = '';

      phantom.stdout.on('data', function(data) {
        response_buffer += data.toString(); // Add to response_buffer string to prevent 
                                            // weird on('data') calls for larger iterations
      });

      phantom.stderr.on('data', function(data) {
        console.log(data.toString());
        return callback(new Error(data.toString()), null);
      });

      phantom.on('exit', function(code) {
        if(code)
          return callback(new Error('PhantomJS exited with status code ' + code), null);
        else {
          var data_array = response_buffer.split('*')
          for(var i = 0, il = data_array.length - 1; i < il; i++) {
            var data = JSON.parse(data_array[i].replace(/(\r\n|\n|\r)/gm,''))
              , type = parseMime(data.mime);
            if(~asset_types.indexOf(type)) {
              if(!(target.assets[type] instanceof Array))
                target.assets[type] = [];
              if(!~checked.indexOf(data.location)) {
                target.assets[type].push(new Payload.asset(type, data.mime, data.location));
                checked.push(data.location);
              }
            }
          }
          target.timing.start = Date.now();
          request.get(target.location)
                  .end(function(res) {
                    target.timing.end = Date.now();
                    target.size = parseInt(res.headers['content-length']);
                    return callback(null, target);
                  });
        }
      });

    }

    /**
     * Unloads requests onto the `target's` list of assets
     *
     * @param {Payload.target} target The target to unload requests onto
     * @param {Function} callback Function to call after iteration has completed
     */
    Payload.fn.unload = function(target, callback) {
      target = target.clone();
      async.forEach(Object.keys(target.assets),
        function(assetType, next) {
          var asset = target.assets[assetType];
          async.forEach(
              asset
            , function(grabbing, n) {
                grabbing.timing.start = Date.now();
                request.get(grabbing.location)
                  .end(function(res) {
                    grabbing.size = parseInt(res.headers['content-length']);
                    grabbing.timing.end = Date.now();
                    n(res.status >= 400 ? new Error('Recieved ' + res.status +
                                                      ' for ' + grabbing.location) : null);
                  });
              }
            , function() {
                next();
              });
        },
        function(err) {
          callback(err, target);
        });
    }

    return Payload;

  }());

  if(typeof global !== 'undefined' && global.exports)
    global.exports = Payload;
  else if(typeof define === 'function' && define.amd)
    define(function() { return Payload });
  else if(typeof provide === 'function')
    provide('Payload', Payload);
  else
    global.Payload = Payload;

}(typeof window !== 'undefined' ? window : module))