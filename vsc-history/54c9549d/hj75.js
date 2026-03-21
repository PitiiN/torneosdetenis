import "./App.css";
import React from "react";
import { useState } from "react";

function App() {
  const [count, setCount] = useState(0)
  return (
    <div className="App">
      <header className="App-header">
<h1>Estamos viendo estados</h1>
<h3>El estado actual es: {count}</h3>
      </header>
    </div>
  );
}

export default App;
