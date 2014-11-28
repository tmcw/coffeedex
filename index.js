var React = require('react/addons'),
  Reflux = require('reflux'),
  Router = require('react-router'),
  { State, Link, Route, RouteHandler, DefaultRoute } = Router,
  osmAuth = require('osm-auth'),
  haversine = require('haversine'),
  xhr = require('xhr'),
  qs = require('querystring');

window.React = React;

const KEYPAIR = { k: 'amenity', v: 'cafe' };
const VERSION = 'COFFEE DEX 2001';
const API06 = 'http://api.openstreetmap.org/api/0.6/';
const OVERPASS = 'http://overpass-api.de/api/interpreter';

// # Parsing & Producing XML
var a = (nl) => Array.prototype.slice.call(nl),
  attr = (n, k) => n.getAttribute(k),
  serializer = new XMLSerializer();
// Given an XML DOM in OSM format and an object of the form { k, v }
// Find all nodes with that key combination and return them
// in the form { xml: Node, tags: {}, id: 'osm-id' }
var parser = (xml, kv) =>
  a(xml.getElementsByTagName('node')).map(node =>
    a(node.getElementsByTagName('tag')).reduce((memo, tag) => {
      memo.tags[attr(tag, 'k')] = attr(tag, 'v'); return memo;
    }, {
      xml: node, tags: {}, id: attr(node, 'id'),
      location: {
        latitude: parseFloat(attr(node, 'lat')),
        longitude: parseFloat(attr(node, 'lon'))
      }
    }))
    .filter(node => node.tags[kv.k] === kv.v);
var serialize = (xml) => serializer.serializeToString(xml)
  .replace('xmlns="http://www.w3.org/1999/xhtml"', '');
var changesetChange = (comment) => `<osm><changeset>
    <tag k='created_by' v='${VERSION}' />
    <tag k='comment' v='${comment}' />
  </changeset></osm>`;
var changesetChange = (node, tag, id) => {
  a(node.getElementsByTagName('tag'))
    .filter(tag => tags.getAttribute('k') === tag.k)
    .forEach(tag =>  node.removeChild(tag));
  var newTag = node.appendChild(document.createElement('tag'));
  newTag.setAttribute('k', tag.k); newTag.setAttribute('v', tag.v);
  return `<osmChange version="0.3" generator="${VERSION}">
  <modify>${serialize(node)}</modify>
  </osmChange>`.replace(/changeset=\"\d+\"/, `changeset="${id}"`);
};
var queryOverpass = (center, kv, callback) => {
  const RADIUS = 0.01;
  var bbox = [
    center.latitude - RADIUS, center.longitude - RADIUS,
    center.latitude + RADIUS, center.longitude + RADIUS
  ].join(',');
  var query = `[out:xml][timeout:25];
  (node["${kv.k}"="${kv.v}"](${bbox});); out body; >; out skel qt;`;
  xhr({ uri: OVERPASS, method: 'POST', body: query }, callback);
};

// # Stores
var locationStore = Reflux.createStore({
  location: null,
  init() {
    this.watcher = navigator.geolocation.watchPosition(res => {
      if (!this.location || (this.location && haversine(this.location, res.coords) > 10)) {
        this.trigger(res.coords);
      }
      this.location = res.coords;
    });
  }
});

var nodeLoad = Reflux.createAction();
var nodeSave = Reflux.createAction();
var nodeStore = Reflux.createStore({
  nodes: {},
  getInitialState() {
    return this.nodes;
  },
  init() {
    this.listenTo(nodeLoad, this.load);
    this.listenTo(locationStore, this.load);
    this.listenTo(nodeSave, this.save);
  },
  load(center) {
    queryOverpass(center, KEYPAIR, (err, resp, map) => {
      if (err) return console.error(err);
      parser(resp.responseXML, KEYPAIR).forEach(node => this.nodes[node.id] = node);
      this.trigger(this.nodes);
    });
  },
  save(comment, xml, tag) {
    const XMLHEADER = { header: { 'Content-Type': 'text/xml' } };
    auth.xhr({ method: 'PUT', prefix: false, options: XMLHEADER,
      content: changesetCreate(comment),
      path: `${API06}changeset/create`
    }, (err, id) => {
      if (err) return console.error(err);
      auth.xhr({ method: 'POST', prefix: false, options: XMLHEADER,
        content: changesetChange(xml, tag, id),
        path: `${API06}changeset/${id}/upload`,
      }, (err, res) => {
        auth.xhr({ method: 'PUT', prefix: false,
          path: `${API06}changeset/${id}/close`
        }, (err, id) => {
            if (err) console.error(err);
            alert('Success!');
        });
      });
    });
  }
});

var auth = osmAuth({
  oauth_consumer_key: 'VTdXpqeoRiraqICAoLN3MkPghHR5nEG8cKfwPUdw',
  oauth_secret: 'ugrQJAmn1zgdn73rn9tKCRl6JQHaZkcen2z3JpAb',
  auto: false,
  landing: 'index.html',
  singlepage: true
});

var userLogin = Reflux.createAction();
var userStore = Reflux.createStore({
  user: null,
  init() { this.listenTo(userLogin, this.login); },
  login() {
    auth.authenticate((err, details) => {
      this.user = auth.authenticated();
      this.trigger(this.user);
    });
  }
});

// Utilities for views
var kill = (fn) => (e) => { e.preventDefault(); fn(); };

var Auth = React.createClass({
  mixins: [Reflux.connect(userStore, 'user')],
  render() {
    return (
      /* jshint ignore:start */
      <a href='#'
        className={(this.state.user ? 'icon account' : 'icon account quiet')}
        onClick={kill(userLogin)}></a>
      /* jshint ignore:end */
    );
  }
});

var Location = React.createClass({
  mixins: [Reflux.connect(locationStore, 'location')],
  render() {
    return (
      /* jshint ignore:start */
      <a href='#' className='icon compass'></a>
      /* jshint ignore:end */
    );
  }
});

var Page = React.createClass({
  componentDidMount() {
    if (location.search && !auth.authenticated()) {
      var oauth_token = qs.parse(location.search.replace('?', '')).oauth_token;
      auth.bootstrapToken(oauth_token, (err, res) => {
         location.href = location.href.replace(/\?.*$/, '');
      });
    }
  },
  render() {
    return (
      /* jshint ignore:start */
      <div className='margin3 col6'>
        <div className='col12 clearfix pad1y  space-bottom1'>
          <Auth />
          <Location />
        </div>
        <div className='col12'>
          <RouteHandler/>
        </div>
      </div>
      /* jshint ignore:end */
    );
  }
});

var values = obj => Object.keys(obj).map(key => obj[key]);
var List = React.createClass({
  mixins: [Reflux.connect(nodeStore, 'nodes')],
  /* jshint ignore:start */
  render() {
    return <div>
      {values(this.state.nodes)
        .sort((a, b) => haversine(location, a.location) - haversine(location, b.location))
        .map(res => <Result key={res.id} res={res} />)}
    </div>
  }
  /* jshint ignore:end */
});

var Result = React.createClass({
  render() {
    /* jshint ignore:start */
    return <div className='pad0 col12 clearfix'>
      <Link to='editor' params={{ osmId: this.props.res.id }}
          className='big'>
        {this.props.res.tags['cost:coffee'] ?
          (<div className='price text-right pad1x'>
              ${this.props.res.tags['cost:coffee']}
          </div>) :
          <div className='price pad1x text-right'>
              <span className='icon pencil'></span>
          </div>}
        {this.props.res.tags.name}
      </Link>
    </div>;
    /* jshint ignore:end */
  }
});

var Editor = React.createClass({
  mixins: [Reflux.connect(nodeStore, 'nodes'), State, React.addons.LinkedStateMixin],
  getInitialState() {
    return {
      price: 2
    };
  },
  save(e) {
    e.preventDefault();
    nodeSave(this.state.comment, { k: KEYPAIR.k, v: this.state.price },
      this.props.res.xml);
  },
  render() {
    console.log(this.state);
    /* jshint ignore:start */
    return <div className='pad0y'>
      $<input
        valueLink={this.linkState('price')}
        className='short' type='number' />
      <a href='#'
        onClick={this.save}
        className='button short unround icon plus'>Save</a>
    </div>;
    /* jshint ignore:end */
  }
});

var routes = (
  /* jshint ignore:start */
  <Route handler={Page} path='/'>
      <DefaultRoute name='list' handler={List} />
      <Route name='editor' path='/edit/:osmId' handler={Editor} />
  </Route>
  /* jshint ignore:end */
);

Router.run(routes, Handler => {
  /* jshint ignore:start */
  React.render(<Handler/>, document.body);
  /* jshint ignore:end */
});
