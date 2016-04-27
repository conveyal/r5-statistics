/** A spectrograph of Analyst results */

import React, { Component } from 'react'
import chroma from 'chroma-js'

const CANVAS_HEIGHT = 500
const MINUTES = 120

export default class Spectrograph extends Component {
  constructor (props) {
    super(props)
    this.state = { count: 1 }
  }

  render () {
    return <div>
      {/* random key so it is replaced on re render */}
      <canvas ref={this.drawCanvas} width={MINUTES} height={CANVAS_HEIGHT} key={Math.random()} style={{ transformOrigin: 'left', transform: `scaleX(${1200 / MINUTES})` }} />
      <br/>
      <input type='range' min={1} max={this.props.data.length} step={1} value={this.state.count} onChange={(e) => this.setState({ count: parseInt(e.target.value) })} />
      {this.state.count} iterations
    </div>
  }

  drawCanvas = (canvas) => {
    // canvas is null when unmounting
    if (canvas == null) return

    // munge the data
    // first create a big grid of ints
    let data = this.props.data.slice(0, this.state.count)

    let iterations = data.length

    // make data cumulative
    let cumulative = []

    let maxAccessibility = 0

    for (let i = 0; i < iterations; i++) cumulative.push([data[i][0]])

    // make all values cumulative first
    for (let minute = 1; minute < MINUTES; minute++) {
      for (let iteration = 0; iteration < iterations; iteration++) {
        let val = cumulative[iteration][minute - 1] + data[iteration][minute]
        cumulative[iteration].push(val)
        maxAccessibility = Math.max(maxAccessibility, val)
      }
    }

    // grid is row-major order, with columns indicating a particular minute of the cumulative accessibiltiy graph
    // and rows indicating the number of iterations having the given accessibility value. So row 0 has the highest recorded accessibility of any iteration
    // at 120 minutes, and so on
    let grid = new Uint16Array(MINUTES * CANVAS_HEIGHT)

    let maxPixelValue = 0

    for (let iteration = 0; iteration < iterations; iteration++) {
      for (let minute = 0; minute < MINUTES; minute++) {
        let yPixel = CANVAS_HEIGHT - 1 - Math.floor(cumulative[iteration][minute] / maxAccessibility * (CANVAS_HEIGHT - 1))
        grid[yPixel * MINUTES + minute] += 1

        if (grid[yPixel * MINUTES + minute] === undefined) {
          console.log('undefined!!')
        }

        maxPixelValue = Math.max(maxPixelValue, grid[yPixel * MINUTES + minute])
      }
    }

    const colorScale = chroma
      .scale(['black', 'blue', 'orange', 'white'])
      .mode('lab')
      .domain([0, 0.01, 0.1, 1].map(i => i * maxPixelValue))

    // draw the canvas
    let ctx = canvas.getContext('2d')
    let id = ctx.createImageData(MINUTES, CANVAS_HEIGHT)

    for (let pixel = 0; pixel < grid.length; pixel++) {
      id.data.set(colorScale(grid[pixel]).rgb(), pixel * 4)
      id.data[pixel * 4 + 3] = 255 // opaque
    }

    ctx.putImageData(id, 0, 0)
  }

  log (x, base) {
    return Math.log(x) / Math.log(base)
  }
}
