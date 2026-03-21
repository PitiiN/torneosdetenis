// Declaración
// Eventos mediante HTML

// Eventos mediante propiedades
// function holaMundo() {
//     alert("Hola Mundo")
// }

// const evento = document.getElementById("evento")
// evento.onclick = holaMundo

// const boton = document.getElementById("evento")
// boton.addEventListener("click", function(){
//     alert("Hola")
// })

// const boton = document.getElementById("evento");
// boton.addEventListener("click", ()=>{
//     function saludar(nombre) {
//         alert(`hola ${nombre}`)
//         }
//     saludar("Javier")
// })

// const submit = document.getElementById("submit");

// function saludar(nombre) {
//   alert(`hola ${nombre}`);
// }

// submit.addEventListener("click", (e) => {
//   e.preventDefault();
//   saludar("Javier");
// });

// Callbacks
// Función dentro de otra función

function cuadradoNum(valor, callback) {
  setTimeout(() => {
    callback(valor, valor * valor);
  }, 0 | (Math.random() * 4000));
}

cuadradoNum(0, (valor, resultado) => {
  console.log("Acá inicia el callback");
  console.log(`callback ${valor}, ${resultado}`);
  cuadradoNum(1, (valor, resultado) => {
    console.log("Acá inicia el callback");
    console.log(`callback ${valor}, ${resultado}`);
  });
  cuadradoNum(2, (valor, resultado) => {
    console.log("Acá inicia el callback");
    console.log(`callback ${valor}, ${resultado}`);
  });
  cuadradoNum(3, (valor, resultado) => {
    console.log("Acá inicia el callback");
    console.log(`callback ${valor}, ${resultado}`);
  });
  cuadradoNum(4, (valor, resultado) => {
    console.log("Acá inicia el callback");
    console.log(`callback ${valor}, ${resultado}`);
  });
  cuadradoNum(5, (valor, resultado) => {
    console.log("Acá inicia el callback");
    console.log(`callback ${valor}, ${resultado}`);
  });
});
