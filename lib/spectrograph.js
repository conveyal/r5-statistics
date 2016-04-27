/** A spectrograph of Analyst results */

import React, { Component } from 'react'
import chroma from 'chroma-js'

const STEPS = 200
const MINUTES = 120
const SCALE_X = 13
const SCALE_Y = 4

export default class Spectrograph extends Component {
  constructor (props) {
    super(props)
    this.state = {
      count: 1,
      scale: 'linear'
    }
  }

  assignState = (state) => {
    this.setState(Object.assign({}, this.state, state))
  }

  render () {
    return <div>
      {/* random key so it is replaced on re render */}
      <canvas ref={(canvas) => { this.canvas = canvas }} width={MINUTES * SCALE_X} height={STEPS * SCALE_Y} />
      <br/>
      <label>
        <input type='range' min={1} max={this.props.data.length} step={1} value={this.state.count} onChange={(e) => this.assignState({ count: parseInt(e.target.value) })} />
        {this.state.count} iterations
      </label>

      Y scale:
      <label>
        <input type='radio' name='scale' checked={this.state.scale === 'linear'} value='linear' onChange={(e) => { if (e.target.checked) this.assignState({ scale: e.target.value }) }} />
        Linear
      </label>
      <label>
        <input type='radio' name='scale' checked={this.state.scale === 'log'} value='log' onChange={(e) => { if (e.target.checked) this.assignState({ scale: e.target.value }) }} />
        Logarithmic
      </label>
      <label>
        <input type='radio' name='scale' checked={this.state.scale === 'sqrt'} value='sqrt' onChange={(e) => { if (e.target.checked) this.assignState({ scale: e.target.value }) }} />
        Square root
      </label>
    </div>
  }

  componentDidMount () {
    this.drawCanvas()
  }

  componentDidUpdate () {
    this.drawCanvas()
  }

  drawCanvas = () => {
    let { data } = this.props

    let iterations = data.length

    // make data cumulative
    let cumulative = []

    for (let i = 0; i < iterations; i++) cumulative.push([data[i][0]])

    // make all values cumulative first
    for (let minute = 1; minute < MINUTES; minute++) {
      for (let iteration = 0; iteration < iterations; iteration++) {
        let val = cumulative[iteration][minute - 1] + data[iteration][minute]
        cumulative[iteration].push(val)
      }
    }

    // take logs
    if (this.state.scale === 'log') cumulative = cumulative.map((arr) => arr.map((i) => Math.log(i + 1)))
    else if (this.state.scale === 'sqrt') cumulative = cumulative.map((arr) => arr.map((i) => Math.sqrt(i)))

    // find max accessibility. NB do this before slicing so horiz. axis does not change
    let maxAccessibility = Math.max(...cumulative.map((arr) => Math.max(...arr)))

    cumulative = cumulative.slice(0, this.state.count)
    iterations = cumulative.length

    // grid is row-major order, with columns indicating a particular minute of the cumulative accessibiltiy graph
    // and rows indicating the number of iterations having the given accessibility value. So row 0 has the highest recorded accessibility of any iteration
    // at 120 minutes, and so on
    let grid = new Uint16Array(MINUTES * STEPS)

    let maxPixelValue = 0

    for (let iteration = 0; iteration < iterations; iteration++) {
      for (let minute = 0; minute < MINUTES; minute++) {
        let yPixel = STEPS - 1 - Math.floor(cumulative[iteration][minute] / maxAccessibility * (STEPS - 1))
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
      .domain([0, 0.01, 0.1, 1].map((i) => i * maxPixelValue))
      .out('rgb')

    // draw the canvas
    let ctx = this.canvas.getContext('2d')
    let id = ctx.createImageData(MINUTES * SCALE_X, STEPS * SCALE_Y)

    for (let gridx = 0; gridx < MINUTES; gridx++) {
      for (let gridy = 0; gridy < STEPS; gridy++) {
        let cell = gridy * MINUTES + gridx
        let col = colorScale(grid[cell])

        for (let xoff = 0; xoff < SCALE_X; xoff++) {
          for (let yoff = 0; yoff < SCALE_Y; yoff++) {
            let pixel = (gridy * SCALE_Y + yoff) * MINUTES * SCALE_X + gridx * SCALE_X + xoff
            id.data.set(col, pixel * 4)
            id.data[pixel * 4 + 3] = 255 // opaque
          }
        }
      }
    }

    ctx.putImageData(id, 0, 0)
  }

  log (x, base) {
    return Math.log(x) / Math.log(base)
  }
}
