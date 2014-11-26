function parser(xml, kv) {
    var nodes = xml.getElementsByTagName('node'), results = [];
    for (var i = 0; i < nodes.length; i++) {
        var tags = nodes[i].getElementsByTagName('tag'), obj = {};
        for (var j = 0; j < tags.length; j++) {
            var v = tags[j].getAttribute('v'), k = tags[j].getAttribute('k');
            obj[k] = v;
            if (k === kv.k && v === kv.v) {
                results.push({
                  xml: nodes[i],
                  tags: obj,
                  id: nodes[i].getAttribute('id')
                });
            }
        }
    }
    return results;
}

module.exports = parser;
