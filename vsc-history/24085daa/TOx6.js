// Fetch

// const request = fetch("https://jsonplaceholder.typicode.com/users")

// request.then(function(response){})

let c = console.log,
  $lista = document.getElementById("lista"),
  fragmento = document.createDocumentFragment(),
  url = "https://jsonplaceholder.typicode.com/user";

function fetchApi() {
  //   fetch(url, {
  //     method: "GET",
  //   });
  fetch(url)
    .then((response) => {
      c(response);
      if(!response.ok) throw new Error(`${err.status}: ${message}`)
      return response.json()
    })
    .then((json) => {
      c(json);
      json.forEach((e) => {
        const li = document.createElement("li");
        li.innerHTML = `${e.name} -- ${e.phone}`;
        fragmento.appendChild(li);
      });
      $lista.appendChild(fragmento)
    })
    .catch((err)=> {
        c(err)
        let message = err.statusText || "Ocurrió un Error"
        $lista.innerHTML = `Error ${err.status}: ${message}`
    })
    .finally(() => {
        c("Este código siempre se va a ejecutar")
    });
}

document.getElementById("btn").addEventListener("click", () => {
  fetchApi();
});
