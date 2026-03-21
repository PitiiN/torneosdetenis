import React, { useState } from "react";
import "./App.css";

const App = () => {
  const [contador, setContador] = useState(0);

  return (
    <>
      <div className="container-contenedor">
        <button
          onClick={() => {
            setContador((prevContador) => prevContador - 1);
          }}
        >
          -
        </button>
        <p>{contador}</p>
        <button
          onClick={() => {
            setContador((prevContador) => prevContador + 1);
          }}
        >
          +
        </button>
      </div>
    </>
  );
};

export default App;
