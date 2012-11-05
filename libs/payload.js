;(function(global) {

  var path = require('path')
    , jsdom = require('jsdom')
    , async = require('async')
    , request = require('superagent');

  var Payload = (function() {
    
    function Payload() {}

    Payload.types = {
        'css': {
            selector: 'link[type="text/css"], link[rel="stylesheet"]'
          , attr: 'href'
        }
      , 'scripts': {
            selector: 'script'
          , attr: 'src'
        }
      , 'images': {
            selector: 'img'
          , attr: 'src'
        }
      , 'video': {}
      , 'audio': {}
      , 'fonts': {}
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

    /**
     * Time taken to load the target page's HTML markup
     *
     * @return {Number} Load time for page markup 
     */
    Payload.target.prototype.time = function() {
      return this.timing.end - this.timing.start;
    }

    /**
     * Calculates total load time for target
     *
     * @returns {Number} The total load time for all assets
     */
    Payload.target.prototype.load = function() {}

    /**
     * Constructor for a retrievable asset
     *
     * @constructor
     *
     * @param {String} type DOM Type associated with the asset
     * @param {String} location Location of the retrievable asset
     */
    Payload.asset = function(type, location) {
      this.type = type;
      this.location = location;
      this.timing = {
          start: 0
        , end: 0
      }
      this.size = 0;
    }

    /**
     * Time taken to load the retrievable asset
     * @return {Number} Load time for asset 
     */
    Payload.asset.prototype.time = function() {
      return this.timing.end - this.timing.start;
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
      var results = []
        , count = 0
        , self = this;

      var flood = function(err, result) {
        if(err) return callback(err, null)
        result.iteration = ++count;
        results.push(result);
        if(count === iterations) return callback(null, results);
      };

      for(var i = 0; i < iterations; i++) {
        this.arm(location, asset_types, function(err, target) {
          self.unload(target, flood);
        })
      }
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
          target.timing.start = Date.now();

      /**
       * Processes a `list` of assets of a certain `type` and
       * adds them to the target
       *
       * @param {String} type The type of asset for request
       * @param {Array} list List of DOM nodes found on the target
       *    for the given type
       * @param {jQuery} $ jQuery selector to pick off DOM node attributes
       */
      function processAsset(type, list, $) {
        function check(p) {
          return p.match('http|www') ? p : location + p;
        }
        switch(type) {
          case 'css':
            for(var i = 0, il = list.length; i < il; i++) {
              var p = check($(list[i]).attr(Payload.types[type].attr));
              if(checked.indexOf(p) === -1) {
                target.assets[type]
                  .push(new Payload.asset(type, p));
                checked.push(p);
              }
            }
            break;
          case 'images':
          case 'scripts':
            for(var i = 0, il = list.length; i < il; i++) {
              var p = check($(list[i]).attr(Payload.types[type].attr));
              if(checked.indexOf(p) === -1) {
                target.assets[type]
                  .push(new Payload.asset(type, p));
                checked.push(p);
              }
            }
            break;
          case 'frame':
            break;
          case 'iframe':
            break;
          case 'font':
            break;
          default:
            break;
        }
      }

      jsdom.env(
          target.location
        , ['http://code.jquery.com/jquery.js']
        , function(err, window) {
            if(err) return callback(err, null)
            target.timing.end = Date.now();
            var $ = window.$
            for(var i = 0, il = asset_types.length; i < il; i++) {
              target.assets[asset_types[i]] = [];
              if(typeof Payload.types[asset_types[i]] !== 'undefined') // Ensure we're prepared to work with type
                processAsset(asset_types[i], $(Payload.types[asset_types[i]].selector), $);
            }
            return callback(null, target);
          }
        );

    }

    /**
     * Unloads requests onto the `target's` list of assets
     *
     * @param {Payload.target} target The target to unload requests onto
     * @param {Function} callback Function to call after iteration has completed
     */
    Payload.fn.unload = function(target, callback) {
      var count = 0;
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