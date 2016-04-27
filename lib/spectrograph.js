/** A spectrograph of Analyst results */

import React, { Component } from 'react'
import chroma from 'chroma-js'
import d3 from 'd3'
import { data_graphic } from 'metrics-graphics'
import MersenneTwister from 'mersennetwister'

const STEPS = 200
const MINUTES = 120
const SCALE_X = 12
const SCALE_Y = 3
const TEXT_HEIGHT = 14 // height of text in canvas scales
const SLICE_HEIGHT = 200 // height of slice plots

export default class Spectrograph extends Component {
  constructor (props) {
    super(props)
    this.state = {
      count: this.props.data.length,
      scale: 'linear',
      seed: new MersenneTwister().int()
    }
  }

  assignState = (state) => {
    this.setState(Object.assign({}, this.state, state))
  }

  render () {
    this.twister = new MersenneTwister(this.state.seed)

    return <div>
      <label>
        <input type='range' min={1} max={this.props.data.length} step={1} value={this.state.count} onChange={(e) => this.assignState({ count: parseInt(e.target.value) })} />
        {this.state.count} iterations
      </label>

      <label>
        <input type='number' value={this.state.seed} onChange={(e) => this.assignState({ seed: parseInt(e.target.value) })} />
        Random seed
      </label>

      <button onClick={(e) => this.assignState({ seed: new MersenneTwister().int() })}>Randomize</button>

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

      <br/>

      <canvas
        ref={(canvas) => { this.canvas = canvas }}
        width={MINUTES * SCALE_X}
        height={STEPS * SCALE_Y}
        onMouseMove={(e) => this.draw(e.clientX, e.clientY)}
        // remove crosshairs on mouse out
        onMouseOut={(e) => this.draw()}
        style={{ cursor: 'none' }}
        />

      {/* wrap in narrow div so that width of prerotated chart does not cause wrap */}
      <div style={{ width: `${SLICE_HEIGHT}px`, display: 'inline-block' }}>
        <div
          ref={(div) => { this.columnChart = div }}
          style={{ transform: `rotate(90deg) translateX(${-STEPS * SCALE_Y}px)`, transformOrigin: 'left bottom' }}
          />
      </div>

      <div ref={(div) => { this.rowChart = div }} />

    </div>
  }

  componentDidMount () {
    this.draw()
  }

  componentDidUpdate () {
    this.draw()
  }

  draw = (x, y) => {
    this.drawCanvas(x, y)

    if (x !== undefined && y !== undefined) {
      this.drawColumnChart(x)
      this.drawRowChart(y)
    }
  }

  drawCanvas = (x, y) => {
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

    // perform a fisher-yates shuffle on the data before slicing, using a pre-seeded Mersenne Twister
    let mt = new MersenneTwister(this.state.seed)
    for (let i = cumulative.length - 1; i > 0; i--) {
      let j = mt.int() % i + 1 // nb not strictly correct as this has ever so slightly more probability at the low end if the max value of randint is not divisible by i + 1
      let temp = cumulative[i]
      cumulative[i] = cumulative[j]
      cumulative[j] = temp
    }

    // find max accessibility. NB do this before slicing so horiz. axis does not change
    let maxAccessibility = Math.max(...cumulative.map((arr) => Math.max(...arr)))

    cumulative = cumulative.slice(0, this.state.count)
    iterations = cumulative.length

    // grid is row-major order, with columns indicating a particular minute of the cumulative accessibiltiy graph
    // and rows indicating the number of iterations having the given accessibility value. So row 0 has the highest recorded accessibility of any iteration
    // at 120 minutes, and so on
    this.grid = new Uint16Array(MINUTES * STEPS)

    let maxPixelValue = 0

    let yScale

    if (this.state.scale === 'linear') {
      yScale = d3.scale.linear()
        .domain([0, maxAccessibility])
        .range([STEPS - 1, 0])
    } else if (this.state.scale === 'log') {
      yScale = d3.scale.log()
        .domain([1, maxAccessibility])
        // clamp because log(0) = -Infinity, this is fine as long as maxAccessibility is large
        .clamp(true)
        .range([STEPS - 1, 0])
    } else if (this.state.scale === 'sqrt') {
      yScale = d3.scale.pow()
        .exponent(0.5) // x^0.5 is sqrt(x)
        .domain([0, maxAccessibility])
        .range([STEPS - 1, 0])
    }

    for (let iteration = 0; iteration < iterations; iteration++) {
      for (let minute = 0; minute < MINUTES; minute++) {
        let yPixel = Math.floor(yScale(cumulative[iteration][minute]))
        this.grid[yPixel * MINUTES + minute] += 1

        if (this.grid[yPixel * MINUTES + minute] === undefined) {
          console.log('undefined!!')
        }

        maxPixelValue = Math.max(maxPixelValue, this.grid[yPixel * MINUTES + minute])
      }
    }

    const colorScale = chroma
      .scale(['black', 'blue', 'orange', 'white'])
      .mode('lab')
      .domain([0, 0.01, 0.1, 1].map((i) => i * maxPixelValue))

    // draw the canvas
    let ctx = this.canvas.getContext('2d')
    let id = ctx.createImageData(MINUTES * SCALE_X, STEPS * SCALE_Y)

    for (let gridx = 0; gridx < MINUTES; gridx++) {
      for (let gridy = 0; gridy < STEPS; gridy++) {
        let cell = gridy * MINUTES + gridx
        let col = colorScale(this.grid[cell]).rgb()

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

    ctx.font = `${TEXT_HEIGHT}px monospace`
    ctx.fillStyle = '#0f0'

    // draw cursor crosshairs
    if (x !== undefined && y !== undefined) {
      ctx.strokeStyle = '#fff'
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, STEPS * SCALE_Y)
      ctx.moveTo(0, y)
      ctx.lineTo(MINUTES * SCALE_X, y)
      ctx.stroke()

      // draw readout
      let minute = Math.floor(x / SCALE_X)
      let step = Math.floor(y / SCALE_Y)
      let val = Math.round(yScale.invert(step))
      let probability = this.grid[step * MINUTES + minute] / iterations
      let cumulativeProbability = 0

      for (let sumStep = 0; sumStep <= step; sumStep++) {
        cumulativeProbability += this.grid[sumStep * MINUTES + minute] / iterations
      }

      ctx.fillText(`${minute} mins, ${val} opportunities: p=${probability}, cumulative=${cumulativeProbability}`, 200, TEXT_HEIGHT)
    }

    // draw scales on top
    // x scale
    let offset = STEPS * SCALE_Y - TEXT_HEIGHT / 1.75
    for (let minute = 0, i = 0; minute < 121; minute += 15, i++) {
      ctx.fillText(i === 0 ? `${minute} minutes` : minute, minute * SCALE_X - (minute === 120 ? 30 : 0), offset)
    }

    // y scale
    yScale.ticks(5).forEach((tick, i, arr) => {
      let yoff = yScale(tick) * SCALE_Y

      // don't draw a label on top of the x axis labels
      if (yoff > offset - TEXT_HEIGHT) return

      let tickText = tick.toExponential()

      // highest valued tick gets label
      ctx.fillText(i === arr.length - 1 ? `${tickText} opportunities` : tickText, 0, yoff)
    })

    // color scale
    let colorOffsetX = SCALE_X * (MINUTES - 5)
    let textOffsetX = colorOffsetX - 45
    let offsetY = STEPS * SCALE_Y - 150

    ctx.strokeStyle = '#fff'

    for (let p of [1, 0.1, 0.05, 0.01, 0]) {
      ctx.fillText(p, textOffsetX, offsetY + TEXT_HEIGHT)
      let oldFillStyle = ctx.fillStyle
      ctx.fillStyle = colorScale(p * maxPixelValue).hex()
      ctx.fillRect(colorOffsetX, offsetY, TEXT_HEIGHT * 2, TEXT_HEIGHT)
      ctx.strokeRect(colorOffsetX, offsetY, TEXT_HEIGHT * 2, TEXT_HEIGHT)
      ctx.fillStyle = oldFillStyle
      offsetY += TEXT_HEIGHT * 1.5
    }
  }

  drawColumnChart (x) {
    let minute = Math.floor(x / SCALE_X)
    let values = []

    for (let step = 0; step < STEPS; step++) {
      values.push({ value: this.grid[step * MINUTES + minute], step })
    }

    // TODO this should be separate react component
    // NB the graphic will be rotate 90 degrees using css so width/height are backwards
    data_graphic({
      target: this.columnChart,
      width: STEPS * SCALE_Y,
      height: SLICE_HEIGHT,
      data: values,
      x_accessor: 'step',
      transition_on_update: false, // updates happen so fast that transitions seem sluggish
      interpolate_tension: 1, // interpolation is bad
      // axes are meaningless
      x_axis: false,
      y_axis: false,

      // no margins, line up with plot
      right: 0,
      left: 0,
      bottom: 0

    })
  }

  drawRowChart (y) {
    let step = Math.floor(y / SCALE_Y)
    let values = []

    for (let minute = 0; minute < MINUTES; minute++) {
      values.push({ value: this.grid[step * MINUTES + minute], minute })
    }

    data_graphic({
      target: this.rowChart,
      width: MINUTES * SCALE_X,
      height: SLICE_HEIGHT,
      data: values,
      x_accessor: 'minute',
      transition_on_update: false, // updates happen so fast that transitions seem sluggish
      interpolate_tension: 1, // interpolation is bad
      // axes are meaningless
      x_axis: false,
      y_axis: false,

      // no margins, line up with plot
      right: 0,
      left: 0,
      bottom: 0,
      top: 0
    })
  }
}
