import { StrictMode } from 'react' // identify the potential issues and bug in the react code
import { createRoot } from 'react-dom/client'
import './index.css' 
import App from './App.jsx' 

createRoot(document.getElementById('root')).render( // Find the HTML element with the id root, and put the React application inside it.
  <StrictMode>
    <App />
  </StrictMode>,
)

