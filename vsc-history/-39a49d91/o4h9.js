/* Crea una lista con los siguientes elementos:

- Tu nombre (string)
- Tu apellido (string)
- Tu edad (number)
- ¿Eres desarrollador de aplicaciones web? (boolean)
- Tu fecha de nacimiento (Date)
- Tu libro favorito (Objeto con propiedades: titulo, autor, fecha, url)
- Tu pasatiempos favoritos (Array)
- Declara una funcion miActividadFavorita la cual retorne un string con la accion que mas te guste realizar */

var nombre = "Javier";
var apellido = "Aravena";
var edad = 32;
var eresDesarrollador = true;
var fechaNacimiento = new Date("09/08/1990");
var libroFavorito = {
    titulo: "Harry Potter",
    autor: "JK Rowling",
    fecha: 1997,
    url: "https://harrypotter.com"
};
var pasatiempos = ["Ver series", "Jugar Tenis", "Jugar Videojuegos", "Cocinar"];
var miActividadFavorita = function () {console.log(pasatiempos[2])};

console.log(fechaNacimiento);
miActividadFavorita();

