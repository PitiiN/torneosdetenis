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

const submit = document.getElementById("submit")

submit.addEventListener("click", ()=>{
    function saludar(nombre) {
        alert(`hola ${nombre}`)
        }
    saludar("Javier")
})

console.log(submit)