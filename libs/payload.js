;(function(global) {

  var path = require('path')
    , jsdom = require('jsdom')
    , async = require('async')
    , request = require('superagent');

  var Payload = (function() {
    
    function Payload() {}

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
    }

    /**
     * Time taken to load the retrievable asset
     * @return {Number} Load time for asset 
     */
    Payload.asset.prototype.time = function() {
      return this.timing.end - this.timing.start;
    }

    Payload.fn = Payload.prototype = {};


    Payload.fn.ramp = function(target, iterations, callback) {

    }

    Payload.fn.flood = function(location, asset_types, iterations, callback) {
      var results = []
        , count = 0
        , self = this;

      var flood = function(err, result) {
        if(err) return callback(err, null)
        results.push(result);
        if(++count === iterations)
          return callback(null, results)
        console.log(count, iterations);
      };

      for(var i = 0; i < iterations; i++) {
        this.arm(location, asset_types, function(err, target) {
          self.unload(target, flood)
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
        , self = this;
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
        var checked = []; // For memoization
        function check(p) {
          return p.match('http|www') ? p : location + p;
        }
        switch(type) {
          case 'link':
            for(var i = 0, il = list.length; i < il; i++) {
              var p = check($(list[i]).attr('href'));
              if(checked.indexOf(p) === -1) {
                target.assets[type]
                  .push(new Payload.asset(type, p));
                checked.push(p);
              }
            }
            break;
          case 'img':
          case 'script':
            for(var i = 0, il = list.length; i < il; i++) {
              var p = check($(list[i]).attr('src'));
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
            if(err) return(err, null)
            target.timing.end = Date.now();
            var $ = window.$
            for(var i = 0, il = asset_types.length; i < il; i++) {
              target.assets[asset_types[i]] = [];
              processAsset(asset_types[i], $(asset_types[i]), $);
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
                    grabbing.timing.end = Date.now();
                    n(res.status >= 400 ? new Error('Recieved ' + res.status + 
                                                      ' for ' + grabbing.location): null);
                  });
              }
            , function() {
                next();
              })
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