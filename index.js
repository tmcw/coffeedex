var React = require('react'),
  Router = require('react-router'),
  { Link, Route, RouteHandler, DefaultRoute } = Router,
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
var locationStartTracking = Reflux.createAction();
var locationStore = Reflux.createStore({
  location: null,
  init() {
    this.listenTo(startTracking, this.startTracking);
  },
  startTracking() {
    navigator.geolocation.getCurrentPosition(res => {
      this.location = res.coords;
      this.trigger();
    });
  }
});

var nodeLoad = Reflux.createAction();
var nodeSave = Reflux.createAction();
var nodeStore = Reflux.createStore({
  nodes: [],
  init() {
    this.listenTo(nodeLoad, this.load);
    this.listenTo(nodeSave, this.save);
  },
  load(centerpoint) {
    queryOverpass(center, KEYPAIR, (err, resp, map) => {
      if (err) return console.error(err);
      this.nodes = this.nodes.concat(parser(resp.responseXML, KEYPAIR));
      this.trigger();
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
  init() {
    this.listenTo(userLogin, this.login);
  },
  login() {
    auth.authenticate((err, details) => {
      this.user = auth.authenticated();
      this.trigger();
    });
  }
});

// Utilities for views
var kill = (fn) => (e) => { e.preventDefault(); fn(); };

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
      <div className='col12 pad2y'>
        <div className='col12 clearfix pad1y  space-bottom1'>
          <div className='margin3 col6'>
            <div className='col3 center'>
              <img height='92' width='120' src='./assets/logo.png' />
            </div>
            <div className='col9 pad2y'>
              <a href='#'
                className='fill-green button col6 unround icon user'
                onClick={kill(userLogin)}>{this.state.user ? 'log out' : 'log in'}</a>
              {this.state.location ? (
                <div className='col6 center pad1 fill-grey code'>
                  {this.state.location.coords.latitude.toFixed(3)}, {this.state.location.coords.longitude.toFixed(3)}
                </div>
              ) : (<a href='#'
                className='fill-blue button col6 unround icon compass'
                onClick={kill(locationStartTracking)}>find me</a>
              )}
            </div>
          </div>
        </div>
        <div className='col12'>
          <RouteHandler/>
        </div>
        <a className='col12 center pad1 quiet' href='https://github.com/tmcw/coffeedex'>?</a>
      </div>
      /* jshint ignore:end */
    );
  }
});

var List = React.createClass({
  mixins: [Reflux.connect(nodeStore, 'nodes')],
  /* jshint ignore:start */
  render: () => <div>
    {this.state.nodes
      .sort((a, b) => haversine(location, a.location) - haversine(location, b.location))
      .map(res => <Result key={res.id} res={res} />)}
  </div>
  /* jshint ignore:end */
});

var Result = React.createClass({
  render() {
    /* jshint ignore:start */
    return <div className='pad0 col12 clearfix'>
      <div className='margin3 col6 truncate pad0y'>
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
      </div>
    </div>;
    /* jshint ignore:end */
  }
});

var Editor = React.createClass({
    getInitialState() {
      return { price: this.props.res.tags['cost:coffee'] || 2 };
    },
    setPrice: (e) => this.setState({ price: e.target.value }),
    save(e) {
      e.preventDefault();
      nodeSave(this.state.comment, { k: KEYPAIR.k, v: this.state.price },
        this.props.res.xml);
    },
    render() {
      /* jshint ignore:start */
      return <div className='pad0y'>
        $<input
          onChange={this.setPrice}
          value={this.state.price}
          className='short'
          type='number' />
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
