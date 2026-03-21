import React, { useState } from "react";
import "./App.css";

const App = () => {
  const [contador, setContador] = useState(0);

  return (
    <div className="App-header">
      <button
        onClick={() => {
          if (contador < 10) {
            setContador((prevContador) => prevContador + 1);
          }
        }}
      >
        +
      </button>
      <p>{contador}</p>
      <button
        onClick={() => {
          if (contador > 0) {
            setContador((prevContador) => prevContador - 1);
          }
        }}
      >
        -
      </button>
      <button
        onClick={() => {
          setContador(0);
        }}
      >
        Reset
      </button>
    </div>
  );
};

export default App;
