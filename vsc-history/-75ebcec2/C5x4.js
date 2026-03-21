window.addEventListener("scroll", function () {
  var header = this.document.querySelector("header");
  header.classList.toggle("abajo", window.scrollY>0);
});

function iniciarMapa() {
  var coord = {lat: -33.4857616,lng: -70.6550805};
  var mapa = new google.maps.Map(document.getElementById("mapa"), {
    zoom: 10,
    center: coord
  })
}