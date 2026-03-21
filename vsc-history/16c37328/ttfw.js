import React, { useState } from "react";
import "./App.css";

const App = () => {
  const [contador, setContador] = useState(0);

  return (
    <>
      <div className="container-contenedor">
        <p onClick={ () => { setContador( prevContador => prevContador -1) }}>+</p>
        <p>{ contador }</p>
        <p onClick={ () => { setContador( prevContador => prevContador +1) }}>+</p>
      </div>
    </>
  );
};

export default App;
