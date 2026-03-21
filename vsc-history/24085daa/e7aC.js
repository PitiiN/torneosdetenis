const user = {
  name: "Javier",
  lastname: "Aravena",
  edad: null,
  talk() {
    return "hola";
  },
};

console.log(user);

let json = JSON.stringify(user)
console.log(json)
