window.addEventListener("scroll", function () {
  var header = this.document.querySelector("header");
  header.classList.toggle("abajo", window.scrollY>0);
});

function iniciarMapa() {
  var coord = {lat: ,lng:};
  var mapa = new google.maps.Map(document.getElementById("mapa"), {
    zoom: 10,
    center: coord
  })
}