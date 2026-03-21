// Fetch

// const request = fetch("https://jsonplaceholder.typicode.com/users")

// request.then(function(response){})

let c = console.log,
  $lista = document.getElementById("lista"),
  fragmento = document.createDocumentFragment,
  url = "https://jsonplaceholder.typicode.com/users";

function fetchApi() {
  //   fetch(url, {
  //     method: "GET",
  //   });
  fetch(url).then((response) => {
    c(response);
  });
}

document.getElementById("btn").addEventListener("click", () => {
  fetchApi();
});
