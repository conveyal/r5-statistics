/** main entry point for r5 integration tests */

import React from 'react'
import { render } from 'react-dom'
import IntegrationResults from './integration-results'
import './style.css'

render(
  <IntegrationResults path={window.location.hash.slice(1)} />,
  document.getElementById('root')
)
