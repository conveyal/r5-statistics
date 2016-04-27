/** Root class showing all integration results */

import React, { Component } from 'react'
import ConfidencePlot from './confidence-plot'
import Spectrograph from './spectrograph'

export default class IntegrationResults extends Component {
  constructor (props) {
    super(props)

    this.state = { data: null }

    // fetch data
    fetch(`https://analyst-integration-results.s3-eu-west-1.amazonaws.com/${props.path}.json`)
      .then((res) => res.json())
      .then((data) => this.setState({ data }))
  }

  render () {
    if (this.state.data == null) return <span>loading...</span>

    if (this.state.data.spectrograph) return this.renderSpectrograph()
    else return this.renderCentralTendency()
  }

  renderCentralTendency () {
    return <div>
      <ConfidencePlot lower={0.025} upper={0.975} data={this.state.data.results} />
      <ConfidencePlot lower={0.025} upper={0.975} data={this.state.data.results} recenter />
      <ConfidencePlot lower={0.025} upper={0.975} data={this.state.data.results} percentage />
    </div>
  }

  renderSpectrograph () {
    return <div>
      <Spectrograph data={this.state.data.results} />
    </div>
  }
}
