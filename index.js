var React = require('react');
var qs = require('querystring');
var parser = require('./lib/parser.js');
var changeset = require('./lib/changeset.js');
var Result = require('./components/result.jsx');
var Editor = require('./components/editor.jsx');
var queryOverpass = require('./lib/query_overpass.js');
var auth = require('./auth');

var Router = require('react-router');
var { Route, RouteHandler, DefaultRoute } = Router;

var results = [];

window.React = React;

/* jshint ignore:start */
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
    queryOverpass(this.state.location.coords, (err, resp, map) => {
      if (err) return console.error(err);
      results = parser(resp.responseXML, { k: 'amenity', v: 'cafe' });
      this.setState({
        results: results,
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
    return (
      <div className='col12 pad2y'>
        <div className='col12 clearfix pad1y  space-bottom1'>
          <div className='margin3 col6'>
            <div className='col3 center'>
              <img height='92' width='120' src='./assets/logo.png' />
            </div>
            <div className='col9 pad2y'>
                <a href='#'
                  className='fill-green button col6 unround icon user'
                  onClick={this.authenticate}>{this.state.user ? 'log out' : 'log in'}</a>
                {this.state.location ? (
                  <div className='col6 center pad1 fill-grey code'>
                    {this.state.location.coords.latitude.toFixed(3)}, {this.state.location.coords.longitude.toFixed(3)}
                  </div>
                ) : (<a href='#'
                  className='fill-blue button col6 unround icon compass'
                  onClick={this.locate}>find me</a>
                )}
            </div>
          </div>
        </div>
        <div className='col12'>
          <RouteHandler/>
        </div>
        <a className='col12 center pad1 quiet' href='https://github.com/tmcw/coffeedex'>?</a>
      </div>
    );
  }
});

var List = React.createClass({
  render() {
    return (<div>
      {results.map(res => <Result key={res.id} res={res} />)}
    </div>);
  }
});

var routes = (
  <Route handler={Page} path="/">
    <DefaultRoute handler={List} />
    <Route name="editor" path="/edit/:osmId" handler={Editor} />
  </Route>
);

Router.run(routes, function (Handler) {
  React.render(<Handler/>, document.body);
});
/* jshint ignore:end */
