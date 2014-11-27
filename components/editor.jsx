var React = require('react');
var auth = require('../auth');

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
