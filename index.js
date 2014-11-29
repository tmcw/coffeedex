var React = require('react/addons'),
  Reflux = require('reflux'),
  Router = require('react-router'),
  { Navigation, State, Link, Route, RouteHandler, DefaultRoute } = Router,
  osmAuth = require('osm-auth'),
  haversine = require('haversine'),
  xhr = require('xhr'),
  currency = require('./currency_symbols.json'),
  qs = require('querystring');

window.React = React;

const KEYPAIR = { k: 'amenity', v: 'cafe' },
  TAG = 'cost:coffee',
  VERSION = 'COFFEE DEX 2001',
  API06 = 'http://api.openstreetmap.org/api/0.6/',
  OVERPASS = 'http://overpass-api.de/api/interpreter',
  MBX = 'pk.eyJ1IjoidG1jdyIsImEiOiIzczJRVGdRIn0.DKkDbTPnNUgHqTDBg7_zRQ',
  MAP = 'tmcw.kbh273ee',
  PIN = 'pin-l-cafe';

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
var escape = _ => _.replace(/&/g, '&amp;')
  .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
var changesetCreate = (comment) => `<osm><changeset>
    <tag k="created_by" v="${VERSION}" />
    <tag k="comment" v="${escape(comment)}" />
  </changeset></osm>`;
var changesetChange = (node, tag, id) => {
  a(node.getElementsByTagName('tag'))
    .filter(tag => tag.getAttribute('k') === tag.k)
    .forEach(tag =>  node.removeChild(tag));
  node.setAttribute('changeset', id);
  var newTag = node.appendChild(document.createElement('tag'));
  newTag.setAttribute('k', tag.k); newTag.setAttribute('v', tag.v);
  return `<osmChange version="0.3" generator="${VERSION}">
    <modify>${serialize(node)}</modify>
    </osmChange>`;
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
  getInitialState() { return this.nodes; },
  init() {
    this.listenTo(nodeLoad, this.load);
    this.listenTo(locationStore, this.load);
    this.listenTo(nodeSave, this.save);
  },
  load(center) {
    queryOverpass(center, KEYPAIR, (err, resp, map) => {
      if (err) return console.error(err);
      this.loadNodes(parser(resp.responseXML, KEYPAIR).map(node => node.id));
    });
  },
  loadNodes(ids) {
    ids = ids.filter(id => !this.nodes[id]);
    if (!ids.length) return this.trigger(this.nodes);
    xhr({ uri: `${API06}nodes/?nodes=${ids.join(',')}`, method: 'GET' }, (err, resp, body) => {
      parser(resp.responseXML, KEYPAIR).forEach(node => {
        if (!this.nodes[node.id]) this.nodes[node.id] = node;
      });
      this.trigger(this.nodes);
    });
  },
  save(res, price, currency) {
    const XMLHEADER = { header: { 'Content-Type': 'text/xml' } };
    var xml = res.xml;
    var tag = { k: TAG, v: currency + price };
    var comment = `Updating coffee price to ${currency} ${price} for ${res.tags.name}`;
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
  auto: true,
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

var StaticMap = React.createClass({
  render() {
    return (
      /* jshint ignore:start */
      <img src={`https://api.tiles.mapbox.com/v4/${MAP}/${PIN}` +
        `(${this.props.location.longitude},${this.props.location.latitude})` +
        `/${this.props.location.longitude},${this.props.location.latitude},15/300x200@2x.png?access_token=${MBX}`} />
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
    return (
    <div>
      <div className='clearfix col12'>
        <div className='pad2 fill-darken0 clearfix'>
          <div className='col4'>
            <img width={300/2} height={230/2} className='inline' src='assets/logo_inverted.png' />
          </div>
          <div className='col8 pad2y pad1x'>
            <h3>COFFEE DEX</h3>
            <p className='italic'>how much does a cup of coffee for here cost, everywhere?</p>
          </div>
        </div>
      </div>
      <div className='pad2'>
        {!values(this.state.nodes).length && <div className='pad4 center'>
          Loading...
        </div>}
        {values(this.state.nodes)
          .sort((a, b) => haversine(location, a.location) - haversine(location, b.location))
          .map(res => <Result key={res.id} res={res} />)}
      </div>
    </div>);
  }
  /* jshint ignore:end */
});

var Result = React.createClass({
  render() {
    /* jshint ignore:start */
    return <Link to='editor'
      params={{ osmId: this.props.res.id }}
      className='pad1 col12 clearfix fill-coffee space-bottom1'>
      <div className='price-tag round'>
        {this.props.res.tags[TAG] ?
              this.props.res.tags[TAG] : <span className='icon pencil'></span>}
      </div>
      <strong>{this.props.res.tags.name}</strong>
    </Link>;
    /* jshint ignore:end */
  }
});

var parseCurrency = str => {
  var number = str.match(/[\d\.]+/), currency = str.match(/[^\d\.]+/);
  return {
    currency: currency || '$',
    price: parseFloat((number && number[0]) || 0)
  };
};

var Success = React.createClass({
  mixins: [Navigation],
  componentDidMount() {
    setTimeout(() => {
      if (this.isMounted()) {
        this.transitionTo('list');
      }
    }, 1000);
  },
  /* jshint ignore:start */
  render() {
    return <Link to='list' className='col12 center pad4'>
      <h2><span className='big icon check'></span> Saved!</h2>
    </Link>;
  }
  /* jshint ignore:end */
});

var Editor = React.createClass({
  mixins: [Reflux.listenTo(nodeStore, 'onNodeLoad', 'onNodeLoad'), State, React.addons.LinkedStateMixin],
  onNodeLoad(nodes) {
    var node = nodes[this.getParams().osmId];
    if (node) {
      if (node.tags[TAG]) {
        var currency = parseCurrency(node.tags[TAG]);
        this.setState({
          currency: currency.currency,
          price: currency.price,
          node: node
        });
      } else {
        this.setState({ node: node });
      }
    }
  },
  getInitialState() {
    return {
      currency: '$',
      price: 0
    };
  },
  statics: {
    willTransitionTo(transition, params) {
      nodeStore.loadNodes([params.osmId]);
    },
  },
  save(e) {
    e.preventDefault();
    var node = this.state.node;
    nodeSave(node, this.state.price, this.state.currency);
  },
  render() {
    var node = this.state.node;
    /* jshint ignore:start */
    if (!node) return <div className='pad4 center'>
      Loading...
    </div>;
    return <div className='col12'>
      <Link
        to='list'
        className='home icon button fill-darken0 unround col12'>home</Link>
      <StaticMap location={node.location} />
      <div className='pad1 col12 clearfix'>
        <div className='col12'>
          <div className='center'>
            how much for a cup of joe at
          </div>
          <h1 className='center'>
            {node.tags.name}
          </h1>
        </div>
        <div className='limit-mobile'>
          <div className='col12 clearfix space-bottom1'>
            <select
              valueLink={this.linkState('currency')}
              className='coffee-select'>
              {currency.map(c => <option key={c[0]} value={c[0]}>{c[1]}</option>)}
            </select>
            <input valueLink={this.linkState('price')}
              className='coffee-input' type='number' />
          </div>
          <a href='#'
            onClick={this.save}
          className='fill-darken1 button col12 icon plus pad1 unround'>Save</a>
        </div>
      </div>
    </div>;
    /* jshint ignore:end */
  }
});

var routes = (
  /* jshint ignore:start */
  <Route handler={Page} path='/'>
    <DefaultRoute name='list' handler={List} />
    <Route name='success' path='/success' handler={Success} />
    <Route name='editor' path='/edit/:osmId' handler={Editor} />
  </Route>
  /* jshint ignore:end */
);

Router.run(routes, Handler => {
  /* jshint ignore:start */
  React.render(<Handler/>, document.body);
  /* jshint ignore:end */
});
