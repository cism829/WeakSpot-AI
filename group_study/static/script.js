
var client_id = Math.floor(Math.random() * 15) + 1;

document.querySelector("#ws-id").textContent = client_id;

var ws = new WebSocket("ws://localhost:8000/ws/" + client_id);
ws.onmessage = function(event) {
    var messages = document.getElementById('messages')
    var message = document.createElement('p');
    // Check if it's your own message
    if (event.data.startsWith("You:")) {
        message.classList.add('user')
        // message.style.color = 'blue';      // your text
        // message.style.textAlign = 'right'; // push to right side
    } else if (event.data.includes(`entered the chat!`)) {
        // (optional safeguard if server sends back with your ID)
        message.classList.add('notification');
        // message.style.textAlign = 'right';
    } else {
        message.classList.add('other')
        // message.style.color = 'black'; // other users
        // message.style.textAlign = 'left';
    }
    var content = document.createTextNode(event.data)
    message.appendChild(content)
    messages.appendChild(message)
};
function sendMessage(event) {
    var input = document.getElementById("messageText")
    ws.send(input.value)
    input.value = ''
    event.preventDefault()
}
