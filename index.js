var React = require('react');
var osmAuth = require('osm-auth');
var parser = require('./parser.js');
var qs = require('querystring');
var changeset = require('./changeset.js');

window.React = React;

var auth = osmAuth({
  oauth_consumer_key: 'VTdXpqeoRiraqICAoLN3MkPghHR5nEG8cKfwPUdw',
  oauth_secret: 'ugrQJAmn1zgdn73rn9tKCRl6JQHaZkcen2z3JpAb',
  auto: false,
  landing: 'index.html',
  singlepage: true
});

var RADIUS = 0.004;

var Editor = React.createClass({
    getInitialState() {
      return {
        price: this.props.res.tags['cost:coffee'] || 2
      };
    },
    setPrice(e) {
      this.setState({ price: e.target.value });
    },
    save(e) {
      e.preventDefault();
      var comment = prompt('Write a changeset message for OpenStreetMap');
      if (!comment) return;
      auth.xhr({
        method: 'PUT',
        options: { header: { 'Content-Type': 'text/xml' } },
        content: changeset.create(comment),
        prefix: false,
        path: 'http://api.openstreetmap.org/api/0.6/changeset/create'
      }, (err, id) => {
        if (err) return console.error(err);
        auth.xhr({
            method: 'POST',
            options: { header: { 'Content-Type': 'text/xml' } },
            content: changeset.change(this.props.res.xml, {
                k: 'cost:coffee',
                v: this.state.price
            }, id),
            prefix: false,
            path: `http://api.openstreetmap.org/api/0.6/changeset/${id}/upload`,
          }, (err, res) => {
            auth.xhr({
                method: 'PUT',
                prefix: false,
                path: `http://api.openstreetmap.org/api/0.6/changeset/${id}/close`
              }, (err, id) => {
                  if (err) console.error(err);
                  alert('Success!');
              });
          });
      });
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

var Result = React.createClass({
  getInitialState() {
    return { update: false };
  },
  setUpdate(e) {
    e.preventDefault();
    this.setState({ update: true });
  },
  render() {
    var osmURL = `http://openstreetmap.org/node/${this.props.res.id}`;
    /* jshint ignore:start */
    return <div className='keyline-bottom pad0 col12 clearfix'>
      <div className='col6'>
        <h2>
          <a href={osmURL}>
            {this.props.res.tags.name}
          </a>
        </h2>
      </div>
      <div className='col6'>
        {(!this.state.update && this.props.res.tags['cost:coffee']) ?
          (<div className='pad0y'>
             <strong>{this.props.res.tags['cost:coffee']}</strong>
             <a
              onClick={this.setUpdate}
              href='#'
              className='quiet icon pencil'></a>
          </div>) :
          <Editor res={this.props.res} />}
      </div>
    </div>;
    /* jshint ignore:end */
  }
});

var Page = React.createClass({
  getInitialState() {
    return {
      user: auth.authenticated(),
      location: null,
      results: [],
      loading: false
    };
  },
  componentDidMount() {
    this.locate();
    if (location.search && !auth.authenticated()) {
      var oauth_token = qs.parse(location.search.replace('?', '')).oauth_token;
      auth.bootstrapToken(oauth_token, (err, res) => {
         location.href = location.href.replace(/\?.*$/, '');
      });
    }
  },
  authenticate(e) {
    if (e) e.preventDefault();
    auth.authenticate((err, details) => {
        this.setState({ user: auth.authenticated() });
    });
  },
  load() {
    if (!this.state.location || !this.state.user) return;
    this.setState({ loading: true });
    var bbox = [
      this.state.location.coords.longitude - RADIUS,
      this.state.location.coords.latitude - RADIUS,
      this.state.location.coords.longitude + RADIUS,
      this.state.location.coords.latitude + RADIUS].join(',');
    auth.xhr({
      method: 'GET',
      path: `/api/0.6/map/?bbox=${bbox}`
    }, (err, map) => {
      if (err) return console.error(err);
      this.setState({
        results: parser(map, { k: 'amenity', v: 'cafe' }),
        loading: false
      });
    });
  },
  locate(e) {
    if (e) e.preventDefault();
    navigator.geolocation.getCurrentPosition(res => {
      this.setState({ location: res }, this.load);
    });
  },
  addPrice(res, e) {
    e.preventDefault();
  },
  render() {
    /* jshint ignore:start */
    return (
      <div className='col6 margin3'>
        <div className='pad1'>
          <h1 className='center'>COFFEE DEX</h1>
          <div className='pad1 center'>How much does a cup of house coffee for here cost, everywhere?</div>
        </div>
        {!this.state.user && <a href='#' className='fill-green dark center pad1 col12 icon user' onClick={this.authenticate}>AUTHENTICATE</a>}
        {!this.state.location && <a href='#' className='fill-blue center dark pad1 col12 icon compass' onClick={this.locate}>LOCATE</a>}
        {this.state.location && <div className='col12 center pad1 fill-grey code'>
          {this.state.location.coords.latitude.toFixed(3)},
          {this.state.location.coords.longitude.toFixed(3)}
          </div>}
        {this.state.loading && <h1 className='pad1 center'>LOADING</h1>}
        {this.state.results.map(res => <Result key={res.id} res={res} />)}
      </div>
    );
    /* jshint ignore:end */
  }
});

/* jshint ignore:start */
React.render(<Page />, document.getElementById('content'));
/* jshint ignore:end */
