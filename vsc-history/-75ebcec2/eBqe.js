window.addEventListener("scroll", function () {
  var header = this.document.querySelector("header");
  header.classList.toggle("abajo", window.scrollY > 0);
});

const api = {
  key: "68bb4dc66bf1b85d4e6d5f1b826bf7a5",
  url: "https://api.openweathermap.org/data/2.5/weather",
};


async function buscar(query) {
  try {
    
  } catch (err) {
    console.log(err);
    alert("Hubo un error")
  }
}

function onSubmit(event) {
  event.preventDefault();
  alert(busquedaCiudad.value);
}

const form = document.getElementById("formulario__busqueda");
const busquedaCiudad = document.getElementById("busqueda__ciudad");
form.addEventListener("submit", onSubmit, true);
