// Programacion Orientado a Objetos (POO)
// La Programación Orientada a Objetos (POO, o en inglés OOP) es un estilo de programación muy utilizado, donde creas y utilizas estructuras de datos de una forma muy similar a la vida real, lo que facilita considerablemente la forma de planificar y preparar el código de tus programas o aplicaciones.
// Una de las partes más complejas cuando estás empezando en el mundo de la programación (o incluso cuando ya llevas tiempo) es a la hora de crear las estructuras de datos. Con ejemplos sencillos, esto no es un problema, sin embargo, cuando los ejercicios se complican, una buena elección de una estructura de datos adecuada puede simplificar mucho el ejercicio, o complicarlo demasiado.

// Definiciones
/* Las variables y constantes incluidas en una función constructora o clase se denominan propiedades, y se utilizan para guardar información relacionada (se suele denominar estado). Por otro lado, las funciones incluidas en una función constructora o clase se denominan métodos y se utilizan para realizar una acción relacionada con la esta. */

// Funciones Constructoras
/* function Animal(nombre, genero) {
  this.nombre = nombre;
  this.genero = genero;
  this.saludar = function () {
    return `Hola, mi nombre es ${this.nombre} y soy ${this.genero}`;
  };
}

const animalUno = new Animal('Firulais', 'Macho')
const animalDos = new Animal('Chocolate', 'Hembra') */

/* function Animal(nombre, genero) {
  this.nombre = nombre;
  this.genero = genero;
}

Animal.prototype.saludar = function(){
  return `Hola, mi nombre es ${this.nombre} y mi genero es ${this.genero}`;
}

const animalUno = new Animal('Firulais', 'Macho')
const animalDos = new Animal('Chocolate', 'Hembra')

console.log(animalUno)
console.log(animalDos)
console.log(animalUno.saludar())
console.log(animalDos.saludar())
console.log(animalUno.hasOwnProperty('saludar')) */

//¿Qué es un método?
// Hasta ahora habíamos visto que los métodos eran funciones que viven dentro de una variable, más concretamente de un objeto. Los objetos de tipo string tienen varios métodos, los objetos de tipo number tiene otros métodos, etc... Justo eso es lo que definimos en el interior de una clase.
// Si añadimos un método a la clase Animal, al crear cualquier variable haciendo un new Animal(), tendrá automáticamente ese método disponible. Ten en cuenta que podemos crear varias variables de tipo Animal y serán totalmente independientes cada una.

// ¿Qué es un constructor?
// Se le llama constructor a un tipo especial de método de una clase, que se ejecuta automáticamente a la hora de hacer un new de dicha clase. Una clase solo puede tener un constructor, y en el caso de que no se especifique un constructor a una clase, tendrá uno vacío de forma implícita.
// Ojo: En un constructor no se puede utilizar nunca un return, puesto que al hacer un new se devuelve siempre el propio objeto creado.

// ¿Qué es una propiedad?
// Las clases, siendo estructuras para guardar información, pueden guardar variables con su correspondiente información. Dicho concepto se denomina propiedades y en Javascript se realiza en el interior del constructor, precedido de la palabra clave this (que hace referencia a «este» elemento, es decir, la clase)

// Clases
// Una clase es una forma de organizar código de forma entendible con el objetivo de simplificar el funcionamiento de nuestro programa. Además, hay que tener en cuenta que las clases son «conceptos abstractos» de los que se pueden crear objetos de programación, cada uno con sus características concretas.

/* function Animal(nombre, genero) {
  this.nombre = nombre;
  this.genero = genero;
  this.saludar = function () {
    return `Hola, mi nombre es ${this.nombre} y soy ${this.genero}`;
  };
}

const animalUno = new Animal("Firulais", "Macho");
const animalDos = new Animal("Chocolate", "Hembra"); */

/* class Animal {
  constructor(nombre, genero) {
    this.nombre = nombre;
    this.genero = genero;
  }
  saludar(){
    return `Hola, mi nombre es ${this.nombre} y soy ${this.genero}`
  }
}

const animalUno = new Animal('Jack', 'Macho')
const animalDos = new Animal('Poli', 'Macho')

console.log(animalUno)
console.log(animalDos)
console.log(animalUno.saludar())
console.log(animalDos.saludar()) */

//DOM
// Las siglas DOM significan Document Object Model, o lo que es lo mismo, la estructura del documento HTML. Una página HTML está formada por múltiples etiquetas HTML, anidadas una dentro de otra, formando un árbol de etiquetas relacionadas entre sí, que se denomina árbol DOM (o simplemente DOM).
// En Javascript, cuando nos referimos al DOM nos referimos a esta estructura, que podemos modificar de forma dinámica desde Javascript, añadiendo nuevas etiquetas, modificando o eliminando otras, cambiando sus atributos HTML, añadiendo clases, cambiando el contenido de texto, etc...

// En Javascript, la forma de acceder al DOM es a través de un objeto llamado document, que representa el árbol DOM de la página o pestaña del navegador donde nos encontramos. En su interior pueden existir varios tipos de elementos, pero principalmente serán element o node:
// Element no es más que la representación genérica de una etiqueta: HTMLElement.
// Node es una unidad más básica, la cuál puede ser element o un nodo de texto.
// Tods los elementos HTML, dependiendo del elemento que sean, tendrán un tipo de dato específico.

// console.log(window)
// console.log(window.document)
// console.log(document)
// console.log(document.head)
// console.log(document.body)
// console.log(document.documentElement)
// console.log(document.doctype)
// console.log(document.title)

console.log(document.documentElement.lang);
document.documentElement.lang = "es-PE";
console.log(document.documentElement.lang);
