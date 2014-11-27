// Given an XML DOM in OSM format and an object of the form
//
//     { k: key, v: value }
//
// Find all nodes with that key combination and return them
// in the form
//
//     { xml: Node, tags: {}, id: 'osm-id' }
//
var a = (nl) => Array.prototype.slice.call(nl);
var attr = (n, k) => n.getAttribute(k);
module.exports = (xml, kv) =>
  a(xml.getElementsByTagName('node')).map(node =>
    a(node.getElementsByTagName('tag')).reduce((memo, tag) => {
      memo.tags[attr(tag, 'k')] = attr(tag, 'v');
      return memo;
    }, {
      xml: node, tags: {}, id: attr(node, 'id'),
      location: {
        latitude: parseFloat(attr(node, 'lat')),
        longitude: parseFloat(attr(node, 'lon'))
      }
    }))
    .filter(node => node.tags[kv.k] === kv.v);
