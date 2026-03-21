const user = {
  name: "Javier",
  lastname: "Aravena",
  talk() {
    return "hola";
  },
};

console.log(user);

let json = JSON.stringify(user)
