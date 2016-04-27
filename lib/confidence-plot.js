/** Show the accessibility plot with percentile confidence bands */

import React, { Component } from 'react'
import { data_graphic } from 'metrics-graphics'

export default class ConfidencePlot extends Component {
  render () {
    return <div ref={this.renderPlot}></div>
  }

  renderPlot = (node) => {
    let dataWithConfidenceBand = this.getDataWithConfidenceBand()
    data_graphic({
      title: 'Confidence band',
      data: dataWithConfidenceBand,
      width: 600,
      height: 400,
      target: node,
      show_confidence_band: ['lower', 'upper'],
      x_accessor: 'minute',
      y_accessor: 'value',
      min_y: dataWithConfidenceBand.map((d) => d.lower).reduce((a, b) => Math.min(a, b)) * 1.25,
      max_y: dataWithConfidenceBand.map((d) => d.upper).reduce((a, b) => Math.max(a, b)) * 1.25,
      area: false,
      interpolate_tension: 1
    })
  }

  getDataWithConfidenceBand () {
    let { data } = this.props
    let iterations = data.length
    let minutes = Math.min(data[0].length, 120)

    let cumulative = []

    for (let i = 0; i < iterations; i++) cumulative.push([data[i][0]])

    // make all values cumulative first
    for (let minute = 1; minute < minutes; minute++) {
      for (let iteration = 0; iteration < iterations; iteration++) {
        cumulative[iteration].push(cumulative[iteration][minute - 1] + data[iteration][minute])
      }
    }

    // now get bounds at each minute
    let ret = []

    for (let minute = 1; minute < minutes; minute++) {
      let valuesThisMinute = []

      for (let iteration = 0; iteration < iterations; iteration++) {
        valuesThisMinute.push(cumulative[iteration][minute])
      }

      // let value = valuesThisMinute.reduce((a, b) => a + b) / valuesThisMinute.length
      valuesThisMinute.sort()
      let value = valuesThisMinute[Math.floor(valuesThisMinute.length * 0.5)]
      let lower = valuesThisMinute[Math.floor(this.props.lower * valuesThisMinute.length)]
      let upper = valuesThisMinute[Math.ceil(this.props.upper * valuesThisMinute.length)]

      ret.push({ value, upper, lower, minute })
    }

    // subract off the mean, recenter at zero
    if (this.props.recenter) {
      ret.forEach((datum) => {
        datum.upper -= datum.value
        datum.lower -= datum.value
        datum.value = 0
      })
    } else if (this.props.percentage) {
      ret.forEach((datum) => {
        datum.upper -= datum.value
        datum.upper /= datum.value
        datum.lower -= datum.value
        datum.lower /= datum.value
        datum.value = 0
      })
    }

    return ret
  }
}
