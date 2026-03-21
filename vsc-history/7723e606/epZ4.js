function sonIguales(x, y) {
    // Devuelve "true" si "x" e "y" son iguales
    // De lo contrario, devuelve "false"
    // Tu código:
    return x == y ? true : false
  }

  var a = sonIguales(3, 3)
  console.log(a)

  function sonIguales(x, y) {
    // Devuelve "true" si "x" e "y" son iguales
    // De lo contrario, devuelve "false"
    // Tu código:
    return x == y ? true : false
  }

  function esPar(num) {
    // Devuelve "true" si "num" es par
    // De lo contrario, devuelve "false"
    // Tu código:
    return num % 2 == 0 ? true : false
  }

  function esImpar(num) {
    // Devuelve "true" si "num" es impar
    // De lo contrario, devuelve "false"
    // Tu código:
    return num % 2 != 0 ? true : false
  }

  console.log(esImpar(23))

  function numeroRandom() {
    //Generar un número al azar entre 0 y 1 y devolverlo
    //Pista: investigá qué hace el método Math.random()
    let random = Math.random()
    return random
  }

  console.log(numeroRandom())
  console.log(numeroRandom())
  console.log(numeroRandom())
  console.log(numeroRandom())

  function esPositivo(numero) {
    //La función va a recibir un entero. Devuelve como resultado una cadena de texto que indica si el número es positivo o negativo. 
    //Si el número es positivo, devolver ---> "Es positivo"
    //Si el número es negativo, devolver ---> "Es negativo"
    //Si el número es 0, devuelve false
    if (numero === 0) {
      return false
    } else if (numero > 0) {
      return "Es positivo"
    } else {
      return "Es negativo"
    }
  }

  console.log(esPositivo(1))

  function agregarSimboloExclamacion(str) {
    // Agrega un símbolo de exclamación al final de la string "str" y devuelve una nueva string
    // Ejemplo: "hello world" pasaría a ser "hello world!"
    // Tu código:
    let nuevaPalabra = String(str).concat("!")
    return nuevaPalabra
  }

  function combinarNombres(nombre, apellido) {
    // Devuelve "nombre" y "apellido" combinados en una string y separados por un espacio.
    // Ejemplo: "Soy", "Henry" -> "Soy Henry"
    // Tu código:
    let nombre2 = String(nombre)
    let apellido2 = String(apellido)
    let nombreApellido = nombre2 + " " + apellido2
    return nombreApellido
  }

  console.log(combinarNombres("Javier", "Aravena"))

  function esVocal(letra){
    //Escribe una función que reciba una letra y, si es una vocal, muestre el mensaje “Es vocal”. 
    //Verificar si el usuario ingresó un string de más de un carácter, en ese caso, informarle 
    //que no se puede procesar el dato mediante el mensaje "Dato incorrecto".
    // Si no es vocal, tambien debe devolver "Dato incorrecto".
    //Escribe tu código aquí
    let letra2 = String(letra)
    let cantidadLetras = letra2.length
    if (cantidadLetras > 1) {
      return "Dato incorrecto"
    }
    else if (letra2 === "a" || letra2 === "e" || letra2 === "i" || 
    letra2 === "o" || letra2 === "u") {
      return "Es vocal"
    } else {
      return "Dato incorrecto"
    }
  }

  console.log(esVocal("a"))

