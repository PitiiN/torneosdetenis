// SLIDER INICIO
window.addEventListener("scroll", function () {
  var header = this.document.querySelector("header");
  header.classList.toggle("abajo", window.scrollY > 0);
});


// API CLIMA
const api = {
  key: "68bb4dc66bf1b85d4e6d5f1b826bf7a5",
  url: "https://api.openweathermap.org/data/2.5/weather",
};

const ciudad = document.getElementById("ciudad");
const fecha = document.getElementById("fecha");
const imagenClima = document.getElementById("clima-img");
const temperaturaClima = document.getElementById("clima-valor");
const tiempo = document.getElementById("climas");
const rangoClima = document.getElementById("rangoClima");

async function buscar(query) {
  try {
    const response = await fetch(
      `${api.url}?q=${query}&appid=${api.key}&lang=es`
    );
    const data = await response.json();

    ciudad.innerHTML = `${data.name}, ${data.sys.country}`;
    fecha.innerHTML = (new Date()).toLocaleDateString();
    temperaturaClima.innerHTML = data.main.temp;
    tiempo.innerHTML = upperCase(data.weather[0].description);
    rangoClima.innerHTML = `${data.main.temp_min} ${data.main.temp_max}`

    console.log(data);
  } catch (err) {
    console.log(err);
    alert("Hubo un error");
  }
}

function onSubmit(event) {
  event.preventDefault();
  buscar(busquedaCiudad.value);
}

const form = document.getElementById("formulario__busqueda");
const busquedaCiudad = document.getElementById("busqueda__ciudad");
form.addEventListener("submit", onSubmit, true);
