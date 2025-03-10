import './style.css'
import { initPWA } from './pwa.ts'

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
<div>
  <h1>dumb-do-not</h1>
  <p>A simple todo app</p>
</div>
`

initPWA(app)
