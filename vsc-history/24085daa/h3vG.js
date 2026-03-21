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

// function cuadradoNum(valor, callback) {
//   setTimeout(() => {
//     callback(valor, valor * valor);
//   }, 0 | (Math.random() * 4000));
// }

// cuadradoNum(0, function (valor, resultado) {
//   console.log("Acá inicia el callback");
//   console.log(`callback ${valor}, ${resultado}`);
// });
// cuadradoNum(0, function (valor, resultado) {
//   console.log("Acá inicia el callback");
//   console.log(`callback ${valor}, ${resultado}`);
// });
// cuadradoNum(0, function (valor, resultado) {
//   console.log("Acá inicia el callback");
//   console.log(`callback ${valor}, ${resultado}`);
// });

// Promesas

let compre = 15;
let caramelos = new Promise((resolve, reject) => {
  setTimeout(() => {
    if (compre >= 10) resolve(compre);
    else reject("No tenía plata");
  }, 2000);
});

console.log(caramelos);
