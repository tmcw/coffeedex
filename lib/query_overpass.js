var xhr = require('xhr');

var RADIUS = 0.01;
const ENDPOINT = 'http://overpass-api.de/api/interpreter';

function queryOverpass(centerpoint, callback) {
   var bbox = [
    centerpoint.latitude - RADIUS,
    centerpoint.longitude - RADIUS,
    centerpoint.latitude + RADIUS,
    centerpoint.longitude + RADIUS
   ].join(',');

  var query = `[out:xml][timeout:25];
  (
    node["amenity"="cafe"](${bbox});
  );
  out body;
  >;
  out skel qt;`;

  xhr({
      uri: ENDPOINT,
      method: 'POST',
      body: query
  }, callback);
}

module.exports = queryOverpass;
