window.addEventListener("scroll", function () {
  var header = this.document.querySelector("header");
  header.classList.toggle("abajo", window.scrollY>0);
});

let mapa = L.mapa("mapa").setView([4.639386, -74.082412], 6)

L.titleLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors"
}).addTo(mapa)
