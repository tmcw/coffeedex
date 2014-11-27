var serializer = new XMLSerializer();

function create(comment) {
    return `
      <osm>
        <changeset>
          <tag k='created_by' v='COFFEE DEX 2000' />
          <tag k='comment' v='${comment}' />
         </changeset>
      </osm>`;
}

module.exports.create = create;

function serialize(xml) {
    return serializer.serializeToString(xml)
        .replace('xmlns="http://www.w3.org/1999/xhtml"', '');
}

function change(node, tag, id) {

    // remove old tag if it exists.
    var tags = node.getElementsByTagName('tag');
    for (var i = 0; i < tags.length; i++) {
        if (tags[i].getAttribute('k') === tag.k) {
            node.removeChild(tags[i]);
        }
    }

    var newTag = node.appendChild(document.createElement('tag'));
    newTag.setAttribute('k', tag.k);
    newTag.setAttribute('v', tag.v);
    return `<osmChange version="0.3" generator="Osmosis">
        <modify>
            ${serialize(node)}
        </modify>
    </osmChange>`.replace(/changeset=\"\d+\"/, `changeset="${id}"`);
}

module.exports.change = change;
