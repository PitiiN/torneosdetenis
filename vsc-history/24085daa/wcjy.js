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
    return response.json()
  })
  .then((json) => {
    c(json)
    json.forEach(e => {
        const li = document.createElement("li")
        li.innerHTML = `${e.name} -- ${e.phone}`
    })
  });
}

document.getElementById("btn").addEventListener("click", () => {
  fetchApi();
});
