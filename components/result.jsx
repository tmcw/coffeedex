var React = require('react');

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
    return <div className='pad0 col12 clearfix'>
      <div className='margin3 col6 truncate pad0y'>
        <div className='big'>
          {this.props.res.tags['cost:coffee'] ?
            (<div className='price text-right pad1x'>
                ${this.props.res.tags['cost:coffee']}
            </div>) :
            <div className='price pad1x text-right'>
                <span className='icon pencil'></span>
            </div>}
          {this.props.res.tags.name}
        </div>
      </div>
    </div>;
    /* jshint ignore:end */
  }
});

module.exports = Result;
