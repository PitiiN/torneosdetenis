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

const submit = document.getElementById("submit");

function saludar(nombre) {
  alert(`hola ${nombre}`);
}

submit.addEventListener("click", (e) => {
  e.preventDefault();
  saludar("Javier");
});
