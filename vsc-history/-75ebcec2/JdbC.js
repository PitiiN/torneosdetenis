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

const tarjetaClima = document.getElementById("clima");

const ciudad = document.getElementById("ciudad");
const fecha = document.getElementById("fecha");
const imagenClima = document.getElementById("climaImg");
const temperaturaClima = document.getElementById("clima-valor");
const tiempo = document.getElementById("climas");
const rangoClima = document.getElementById("rangoClima");

function updateImage(data) {
  const temperaturaClima = toCelsius(data.main.temp);
  let src = "assets/temp-mid.png";
  if (temperaturaClima > 26) {
    src = "assets/temp-high.png";
  } else if (temperaturaClima < 20) {
    src = "assets/temp-low.png";
  }
  climaImg.src = src;
}

async function buscar(query) {
  try {
    const response = await fetch(
      `${api.url}?q=${query}&appid=${api.key}&lang=es`
    );
    const data = await response.json();
    tarjetaClima.style.display = "block";
    ciudad.innerHTML = `${data.name}, ${data.sys.country}`;
    fecha.innerHTML = new Date().toLocaleDateString();
    temperaturaClima.innerHTML = `${toCelsius(data.main.temp)}°c`;
    tiempo.innerHTML = data.weather[0].description;
    rangoClima.innerHTML = `Mínima: ${toCelsius(
      data.main.temp_min
    )}°c / Máxima: ${toCelsius(data.main.temp_max)}°c`;
    updateImage(data);

    console.log(data);
  } catch (err) {
    console.log(err);
    alert("Hubo un error");
  }
}

function toCelsius(kelvin) {
  return Math.round(kelvin - 273.15);
}

function onSubmit(event) {
  event.preventDefault();
  buscar(busquedaCiudad.value);
}

const form = document.getElementById("formulario__busqueda");
const busquedaCiudad = document.getElementById("busqueda__ciudad");
form.addEventListener("submit", onSubmit, true);
