import React, { useState } from "react";

const App = () => {

const [contador, setContador] = useState(0);

  return (
   <>
    <p>Contador: { contador }</p>
    <p>+</p>
    <p>-</p>
   </>
  );
};

export default App;
