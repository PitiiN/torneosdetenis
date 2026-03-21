// const user = {
//   name: "Javier",
//   lastname: "Aravena",
//   edad: null,
//   talk() {
//     return "hola";
//   },
// };

// console.log(user);

// let json = JSON.stringify(user)
// console.log(json)

// const json = `{
//   "name": "Javier",
//   "lastname": "Aravena",
//   "family": [
//     {"name": "Pablo", "lastname": "Aravena"},
//     {"name": "Pio", "lastname": "Aravena"},
//     {"name": "Javiera", "lastname": "Rocha"},
//   ]
// };`

// console.log(json)

// const user = JSON.parse(json)

// console.log(user)

const user = {
  name: "Javier",
  lastname: "Aravena",
  family: [
    { name: "Pablo", lastname: "Aravena" },
    { name: "Pio", lastname: "Aravena" },
    { name: "Javiera", lastname: "Rocha" },
  ],
};

console.log(user.family);

let nombres = "";

user.family.forEach((e) => {
  nombres = nombres + `<li>${e.name}</li>`;
});

console.log(nombres)
