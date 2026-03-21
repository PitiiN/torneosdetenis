import React, { useState } from "react";
import "./App.css";

const App = () => {

const [contador, setContador] = useState(0);

  return (
   <>
    <div className="container-contenedor">
    <p>+</p>
    <p>{ contador }</p>
    <p>-</p>
    </div>
   </>
  );
};

export default App;
